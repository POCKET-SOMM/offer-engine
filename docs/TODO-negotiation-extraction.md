# TODO: Extract negotiation out of offer-engine

Status: **not started, agreed direction**. Written 2026-08-12 during a sommify-menu
session (started from "let's allow withdraw whenever" → turned into a scope
discussion). Withdraw itself was fixed in place in the meantime (see CHANGELOG /
git log around that date) — this doc is the deferred bigger move.

## The decision

`offer-engine` bills itself as *"Agnostic calculation engine for offers"* (see
`llms.txt`, `package.json` description). That's true for `OfferItem` pricing
math, grouping, and sorting. It stopped being true when the negotiation state
machine (versions, requests, turn, accept/withdraw, request-outcome derivation)
got bolted onto `Offer` — that's product policy, not calculation, and it's
been churning fast (status labels, banner actions, withdraw eligibility all
changed across one afternoon of sommify-menu work).

Every one of those product tweaks currently costs a full cross-repo release
cycle: edit here → `npm test` → `npm run build` → bump version → tag → push →
go to sommify-menu → re-pin the `github:` tag (remembering that plain
`npm install` after editing the pin string silently keeps the OLD commit — a
known gotcha, see the release-flow memory) → verify. That ceremony is worth it
for math (correctness bugs there are real, cross-consumer-consistency
matters). It's pure friction for "when is the withdraw button enabled."

**Decision: rip negotiation out of `offer-engine` entirely. It moves to
`sommify-menu`, operating on the same `offer.data.negotiation` shape the
engine already documents as "the same pattern as grouping/sort/status ...
trivially removable once a proper backend owns it"** (that line is already in
`Offer.ts`'s negotiation section comment — this was apparently anticipated).

As far as this environment shows, `offer-engine` has one real consumer today
(sommify-menu, both seller and buyer personas in the same React tree) despite
being designed multi-consumer — worth re-confirming that's still true before
executing, since the whole argument for keeping it in a shared package rests
on multiple consumers needing to agree on the rule.

## Scope

**Stays in offer-engine** (calculator-shaped):
- `OfferItem` — all pricing math
- `Offer` — item CRUD, totals, grouping (`src/grouping/`), sort (`src/sorting/`), `menus`
- `status` / `setStatus` / `OFFER_STATUSES` — neutral manual-lifecycle flag on
  `data`; negotiation code on the sommify-menu side will just call the
  still-public `offer.setStatus(...)` as part of composing its result, same
  as it composes `data.negotiation` today.
- `toSummary()` / `toJSON()` — but see below, they lose two fields.

**Moves to sommify-menu:**
- `src/negotiation/` (`types.ts`, `derive.ts`) — already pure functions
  decoupled from the `Offer` class (`derive.ts`'s own header comment says
  so), so this ports close to verbatim. Functions: `resolveRequest`,
  `resolveRequests`, `countOpenRequests`, `deriveUnpromptedChanges`,
  `itemByLineId`, `latestBaseline`, `roundBaseline`, `buildBaseline`.
- `Offer.ts` lines ~270–478 (the whole "--- Negotiation ---" section): the
  `negotiation`/`recipient` getters, `setRecipient`, `sendVersion`,
  `submitRequests`, `declineRequest`, `undeclineRequest`, `setRequestAnswer`,
  `markFreeTextAnswered`, `setLineNote`, `canWithdrawShare`, `withdrawShare`,
  `acceptNegotiation`. Each becomes a free function
  `fn(offer, ...args) → Offer`, built on the constructor-spread pattern
  already documented as the extension point:
  `new Offer({ ...offer, data: { ...offer.data, negotiation: next } })`.
- `negotiation/negotiation.test.ts` (509 lines, self-contained — confirmed
  `Offer.test.ts` has zero negotiation/recipient references, so this is a
  clean lift-and-shift as one unit).

## The one real design snag: `toSummary()`

`toSummary()` currently embeds `negotiation: {state, turn, openCount,
versionCount}` and `recipient` into the stored `summary` blob — what list
rows (`Offers/columns.jsx` → `offer.summary.negotiation`) read without
loading full items. Once negotiation leaves the engine, `toSummary()` can't
compute that block.

Fix: a `serializeOfferForSave(offer)` helper in sommify-menu that calls
`offer.toJSON()` then patches `.summary` with an app-computed
negotiation/recipient projection (using the ported `countOpenRequests`).
**Every** persistence call site must switch to it — found 9 in sommify-menu
today: 7 in `useOfferEditor.js`, plus `useCreateOffer.js` and
`useMigrateOffersOnList.js`. Missing one ships offers whose list-row status
badge silently goes stale. This needs to be one chokepoint.

## Gap: sommify-menu has no unit test runner

Only Playwright E2E exists there (`package.json` has no vitest/jest). Porting
`negotiation.test.ts` means standing up vitest first — small, known-quantity
(offer-engine already uses it). Worth doing rather than losing 509 lines of
request-resolution coverage (the §4.1 outcome-derivation rules are exactly
the fiddly stuff most likely to regress silently without tests).

## Call-site inventory (sommify-menu), as of 2026-08-12

Confirmed by grep — the *entire* negotiation surface funnels through two
files; nothing else touches the package's negotiation exports directly:

- `src/hooks/useOfferEditor.js` — the only place calling `Offer` negotiation
  *methods* (`prev.declineRequest(id)` etc., ~10 call sites) and the only
  place reading `offer.negotiation`/`offer.recipient` getters outside a couple
  of one-off reads below. Also owns every `.toJSON()` persistence call.
- `src/features/negotiation/useNegotiation.js` — the only place importing
  negotiation *functions* from `@pocket-somm/offer-engine`
  (`resolveRequests`, `deriveUnpromptedChanges`, `itemByLineId`,
  `latestBaseline`, `roundBaseline`). Its own logic (the sidebar view-model)
  doesn't change — it already only consumes the pure functions plus
  `useOfferEditor`'s wrapped actions.
- Direct `.negotiation`/`.recipient` getter reads elsewhere (small,
  mechanical `.data.negotiation` renames): `pages/RequestChanges/index.jsx`,
  `pages/OfferOverview/index.jsx` (×2), `pages/OfferOverview/_Recipient.jsx`.
- `pages/OfferOverview/index.jsx` also does
  `import { countOpenRequests } from '@pocket-somm/offer-engine'` directly.

Re-verify this list before executing — file line numbers and call sites will
have drifted by the time this is picked up.

## Suggested execution order (incremental, not one giant PR)

1. Stand up vitest in sommify-menu — independent, zero risk, can land anytime.
2. Port `negotiation/` (types + derive) into sommify-menu as pure functions,
   **alongside** the still-existing engine copy. Nothing switches over yet;
   just gets a second home and its tests ported.
3. Port the mutation methods as free functions; write
   `serializeOfferForSave`.
4. Flip `useOfferEditor.js` + `useNegotiation.js` + the getter call sites over
   to the local versions; delete the now-dead package imports.
5. Verify: manual smoke test of the whole negotiation flow (send → request →
   answer → accept/withdraw), ported unit tests green, Playwright green.
6. Only once (5) is green: strip the negotiation section out of
   `offer-engine`, bump **major** (breaking API removal), release, re-pin in
   sommify-menu.

Steps 2–4 can happen entirely in sommify-menu with the engine untouched — the
engine-side deletion is the last, most-reversible-to-defer step.

## Open question, not yet decided

Where the new module lives inside sommify-menu — sketched as
`src/features/negotiation/engine/` in discussion, but flattening into the
existing `src/features/negotiation/` (alongside `useNegotiation.js`,
`copy.js`) is also reasonable. Decide at execution time.
