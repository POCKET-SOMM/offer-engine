// --- Offer negotiation ---
// A live offer becomes a two-way conversation: the buyer requests changes, the
// seller answers each one (or makes unprompted changes), every transmission is
// an immutable version. The whole structure lives on offer.data.negotiation —
// same pattern as grouping/sort/status — so it round-trips through
// toJSON()/new Offer() with no constructor involvement and is trivially
// removable once a proper backend owns it.
//
// The core rule: whether a request is handled is NEVER stored. It is derived
// from the offer as it stands (see derive.ts), so the checklist physically
// cannot contradict the wine list that will be sent. The only resolution state
// that can't be derived is an explicit decline (and, for free-text asks, an
// explicit "answered" mark) — those live on the request.

export const NEGOTIATION_PARTIES = ['seller', 'buyer'] as const;
export type NegotiationParty = (typeof NEGOTIATION_PARTIES)[number];

export const REQUEST_KINDS = ['quantity', 'remove', 'replace', 'add', 'note'] as const;
export type RequestKind = (typeof REQUEST_KINDS)[number];

export const REQUEST_OUTCOMES = ['open', 'done', 'changed', 'declined'] as const;
export type RequestOutcome = (typeof REQUEST_OUTCOMES)[number];

/** A frozen, display-ready record line for a sent version. Composed by the
 *  consumer (i18n lives there) and stored verbatim — numbers it contains are
 *  captured at send time so they can never drift. */
export interface NegotiationLogLine {
    text: string;
    note?: string | undefined;
    who?: string | undefined;
}

/** One line of the offer as it stood at a transmission. */
export interface BaselineLine {
    lineId: string;
    /** The wine's catalogue id (item.data.id), used to detect swaps. */
    wineId: string | null;
    title: string;
    quantity: number;
    unit: string;
    pricePerUnit: number;
    totalPrice: number;
}

/** Compact snapshot of the offer as transmitted. NOT a restore point and never
 *  rendered as a historical offer — it exists solely to derive `from → to`
 *  deltas and unprompted changes in the round that follows, and to freeze
 *  totals into log lines at send time. */
export interface NegotiationBaseline {
    totals: { totalPrice: number };
    lines: BaselineLine[];
}

/** One transmission by one party. Immutable once pushed. */
export interface NegotiationVersion {
    id: string;
    /** 1-based, in send order. */
    number: number;
    sender: NegotiationParty;
    /** Display attribution captured at send ("Marco Bianchi · Bottega Nord"). */
    senderName?: string | undefined;
    /** ISO timestamp, supplied by the caller (the engine never reads the clock). */
    sentAt: string;
    log: NegotiationLogLine[];
    baseline: NegotiationBaseline;
}

/** A buyer ask from the live round. `from`/`declined`/`answerNote`/
 *  `answeredFreeText` are the only stored resolution state — everything else
 *  about "is this handled?" is derived (derive.ts). */
export interface ChangeRequest {
    id: string;
    /** The buyer transmission that carried it. */
    versionId: string;
    kind: RequestKind;
    /** Target line. Null for free-text asks ('add' with no wine, 'note'). */
    lineId: string | null;
    /** Quantity as it stood when the round arrived — the "10" in "10 → 20". */
    from: number | null;
    /** Requested quantity ('quantity' kind only). */
    to: number | null;
    /** Requested wine for 'replace'/'add', in the consumer's wine shape. */
    wine: Record<string, any> | null;
    /** The requester's note. */
    note: string | null;
    /** Explicitly declined by the answerer — the one non-derivable outcome. */
    declined: boolean;
    /** The answerer's note, captured at the moment of the decision. */
    answerNote: string | null;
    /** 'note'-kind asks have nothing in the wine list to derive from; this is
     *  their explicit "I've answered this" bit. */
    answeredFreeText: boolean;
}

/** Consumer-facing input for submitting a round of requests — the engine
 *  stamps id, versionId, `from`, and the resolution fields itself. */
export interface ChangeRequestInput {
    kind: RequestKind;
    lineId?: string | null | undefined;
    to?: number | null | undefined;
    wine?: Record<string, any> | null | undefined;
    note?: string | null | undefined;
}

export interface NegotiationState {
    state: 'open' | 'accepted';
    /** Whose move it is. Flips on every transmission. */
    turn: NegotiationParty;
    /** Append-only, oldest first. */
    versions: NegotiationVersion[];
    /** The live round's requests only. Frozen into the answering version's log
     *  at send and cleared. */
    requests: ChangeRequest[];
    /** Seller notes on unprompted changes, keyed by lineId. The changes
     *  themselves are derived (diff vs the latest baseline) — only the note
     *  needs storage. Cleared at send after being frozen into the log. */
    unpromptedNotes: Record<string, string>;
}

/** Projection embedded in toSummary() so list rows can badge "Your move" /
 *  "Their move" / "Approved" without loading items. */
export interface NegotiationSummary {
    state: NegotiationState['state'];
    turn: NegotiationParty;
    openCount: number;
    versionCount: number;
}
