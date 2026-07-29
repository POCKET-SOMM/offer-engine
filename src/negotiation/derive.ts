import type { OfferItem } from '../OfferItem.js';
import type {
    BaselineLine,
    ChangeRequest,
    NegotiationBaseline,
    NegotiationState,
    RequestOutcome,
} from './types.js';

// Derivation of request outcomes and unprompted changes from the offer as it
// stands now. Pure — no clock, no i18n. Labels are returned as tokens plus
// params so the consumer localizes them ("setToInstead" → "Set to 18 cases
// instead").

/** Structural view of an Offer — keeps this module free of a value-import
 *  cycle with Offer.ts (which imports these functions for toSummary). */
export interface NegotiationOfferView {
    items: readonly OfferItem[];
    negotiation?: NegotiationState | undefined;
}

export interface ResolvedRequest {
    request: ChangeRequest;
    outcome: RequestOutcome;
    /** Outcome token for the consumer to localize; null while open. */
    label: string | null;
    params?: Record<string, any> | undefined;
}

export type UnpromptedChangeType = 'quantity' | 'price' | 'swap' | 'add' | 'remove';

/** A change nobody asked for, derived by diffing the current items against the
 *  latest transmitted baseline. Reverting the edit makes the entry disappear. */
export interface UnpromptedChange {
    type: UnpromptedChangeType;
    lineId: string;
    /** Current item (absent for 'remove'). */
    item?: OfferItem | undefined;
    /** Baseline line (absent for 'add'). */
    baseline?: BaselineLine | undefined;
    from?: number | undefined;
    to?: number | undefined;
    /** Previous wine title, for 'swap'. */
    fromTitle?: string | undefined;
}

const wineIdOf = (item: OfferItem): string | null => item.data?.['id'] ?? null;

export function itemByLineId(view: NegotiationOfferView, lineId: string | null): OfferItem | undefined {
    if (lineId == null) return undefined;
    return view.items.find((item) => item.lineId === lineId);
}

/** The offer as last transmitted. Undefined before the first send. */
export function latestBaseline(view: NegotiationOfferView): NegotiationBaseline | undefined {
    const versions = view.negotiation?.versions;
    return versions?.length ? versions[versions.length - 1]!.baseline : undefined;
}

/** The offer as it stood when the live round OPENED — the anchor request
 *  deltas and unprompted changes derive against. This is the baseline of the
 *  buyer transmission that carried the live requests; it matters after the
 *  seller answers (requests survive that send so the buyer can read the
 *  receipt), when the *latest* baseline already contains the answers.
 *  Falls back to the latest baseline when no round is live. */
export function roundBaseline(view: NegotiationOfferView): NegotiationBaseline | undefined {
    const neg = view.negotiation;
    const versionId = neg?.requests?.[0]?.versionId;
    if (versionId) {
        const opening = neg!.versions.find((v) => v.id === versionId);
        if (opening) return opening.baseline;
    }
    return latestBaseline(view);
}

/** Snapshot the current items into a baseline. Called at send time. */
export function buildBaseline(view: NegotiationOfferView, totalPrice: number): NegotiationBaseline {
    return {
        totals: { totalPrice },
        lines: view.items.map((item) => ({
            lineId: item.lineId,
            wineId: wineIdOf(item),
            title: item.data?.['title'] ?? '',
            quantity: item.quantity,
            unit: item.unit,
            pricePerUnit: item.pricePerUnit,
            totalPrice: item.totalPrice,
        })),
    };
}

/**
 * Derive one request's outcome from the live offer (§4.1 of the handoff).
 * An explicit decline always wins; everything else is read off the wine list.
 */
export function resolveRequest(request: ChangeRequest, view: NegotiationOfferView): ResolvedRequest {
    if (request.declined) return { request, outcome: 'declined', label: 'declined' };

    const item = itemByLineId(view, request.lineId);

    switch (request.kind) {
        case 'quantity': {
            if (!item) return { request, outcome: 'changed', label: 'removedInstead' };
            if (item.quantity === request.to) return { request, outcome: 'done', label: 'doneAsAsked' };
            if (item.quantity !== request.from) {
                return { request, outcome: 'changed', label: 'setToInstead', params: { qty: item.quantity } };
            }
            return { request, outcome: 'open', label: null };
        }
        case 'remove': {
            if (!item || item.quantity === 0) return { request, outcome: 'done', label: 'removed' };
            if (item.quantity !== request.from) {
                return { request, outcome: 'changed', label: 'cutToInstead', params: { qty: item.quantity } };
            }
            return { request, outcome: 'open', label: null };
        }
        case 'replace': {
            if (!item) return { request, outcome: 'changed', label: 'droppedNoReplacement' };
            const baselineLine = roundBaseline(view)?.lines.find((l) => l.lineId === request.lineId);
            const swapped = baselineLine && wineIdOf(item) !== baselineLine.wineId;
            if (swapped) {
                return { request, outcome: 'done', label: 'swappedFor', params: { title: item.data?.['title'] ?? '' } };
            }
            return { request, outcome: 'open', label: null };
        }
        case 'add': {
            const baseline = roundBaseline(view);
            const baselineIds = new Set((baseline?.lines ?? []).map((l) => l.lineId));
            const added = view.items.filter((i) => !baselineIds.has(i.lineId));
            // A concrete wine ask is met by that wine; a free-text ask by any
            // addition (§4.1: "a wine was added → Done").
            const match = request.wine?.['id']
                ? added.find((i) => wineIdOf(i) === request.wine!['id'])
                : added[0];
            if (match) {
                return { request, outcome: 'done', label: 'added', params: { title: match.data?.['title'] ?? '' } };
            }
            if (request.answeredFreeText) return { request, outcome: 'done', label: 'answered' };
            return { request, outcome: 'open', label: null };
        }
        case 'note': {
            // Nothing in the wine list can settle a free-text ask — replying to
            // it (or explicitly marking it answered) is what settles it.
            if (request.answeredFreeText || (request.answerNote && request.answerNote.trim())) {
                return { request, outcome: 'done', label: 'answered' };
            }
            return { request, outcome: 'open', label: null };
        }
        default:
            return { request, outcome: 'open', label: null };
    }
}

/** Resolve the whole live round, in stored (offer) order. */
export function resolveRequests(view: NegotiationOfferView): ResolvedRequest[] {
    return (view.negotiation?.requests ?? []).map((request) => resolveRequest(request, view));
}

export function countOpenRequests(view: NegotiationOfferView): number {
    return resolveRequests(view).filter((r) => r.outcome === 'open').length;
}

/**
 * Changes nobody asked for: the diff between current items and the round's
 * opening baseline, minus anything a live request explains (a request
 * targeting that lineId, or — for additions — any pending 'add' ask).
 *
 * `opts.baseline` overrides the anchor (e.g. the latest baseline, to ask
 * "what changed since the last transmission?"); `opts.ignoreRequests` skips
 * the request-explains-it exclusion, which only makes sense against the
 * round anchor.
 */
export function deriveUnpromptedChanges(
    view: NegotiationOfferView,
    opts: { baseline?: NegotiationBaseline; ignoreRequests?: boolean } = {},
): UnpromptedChange[] {
    const baseline = opts.baseline ?? roundBaseline(view);
    if (!baseline) return [];

    const requests = opts.ignoreRequests ? [] : (view.negotiation?.requests ?? []);
    const requestedLineIds = new Set(requests.map((r) => r.lineId).filter((id): id is string => id != null));
    const hasAddRequests = requests.some((r) => r.kind === 'add');

    const changes: UnpromptedChange[] = [];
    const itemsByLineId = new Map(view.items.map((item) => [item.lineId, item]));

    for (const line of baseline.lines) {
        if (requestedLineIds.has(line.lineId)) continue;
        const item = itemsByLineId.get(line.lineId);
        if (!item) {
            changes.push({ type: 'remove', lineId: line.lineId, baseline: line, from: line.quantity, to: 0 });
            continue;
        }
        if (wineIdOf(item) !== line.wineId) {
            changes.push({ type: 'swap', lineId: line.lineId, item, baseline: line, fromTitle: line.title });
            continue;
        }
        if (item.quantity !== line.quantity) {
            changes.push({ type: 'quantity', lineId: line.lineId, item, baseline: line, from: line.quantity, to: item.quantity });
        }
        if (item.pricePerUnit !== line.pricePerUnit) {
            changes.push({ type: 'price', lineId: line.lineId, item, baseline: line, from: line.pricePerUnit, to: item.pricePerUnit });
        }
    }

    const baselineIds = new Set(baseline.lines.map((l) => l.lineId));
    for (const item of view.items) {
        if (baselineIds.has(item.lineId)) continue;
        // Additions are attributable to pending 'add' asks (matched or not, the
        // add flow claims them) — only flag them unprompted when nobody asked
        // for anything new.
        if (hasAddRequests) continue;
        changes.push({ type: 'add', lineId: item.lineId, item });
    }

    return changes;
}
