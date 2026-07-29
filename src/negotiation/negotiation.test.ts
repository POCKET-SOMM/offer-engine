import { describe, it, expect } from 'vitest';
import { Offer } from '../Offer.js';
import {
    resolveRequest,
    resolveRequests,
    countOpenRequests,
    deriveUnpromptedChanges,
    latestBaseline,
} from './derive.js';
import type { ChangeRequest } from './types.js';

const SENT_AT = '2026-07-29T12:00:00.000Z';

// A 3-line offer with catalogue ids on data — the shape the app stores.
const baseOffer = () => new Offer({ title: 'Test' }).addItems([
    { id: 'a', price: 10, quantity: 10, data: { id: 'wine-a', title: 'Muga Reserva' } },
    { id: 'b', price: 20, quantity: 5, data: { id: 'wine-b', title: 'Soave Classico' } },
    { id: 'c', price: 30, quantity: 2, data: { id: 'wine-c', title: 'Barolo' } },
]);

// Shorthand: a live offer (v1 sent) with one buyer round of requests.
const negotiatingOffer = (requests: Array<Partial<ChangeRequest> & { kind: ChangeRequest['kind'] }>) => {
    const sent = baseOffer().sendVersion({ sentAt: SENT_AT });
    return sent.submitRequests({
        sentAt: SENT_AT,
        senderName: 'Marco · Bottega Nord',
        requests: requests.map((r) => ({
            kind: r.kind,
            lineId: r.lineId,
            to: r.to,
            toUnit: r.toUnit,
            wine: r.wine,
            note: r.note,
        })),
    });
};

const liveRequest = (offer: Offer, index = 0) => offer.negotiation!.requests[index]!;

describe('lineId', () => {
    it('defaults to the item id and round-trips through toConfig', () => {
        const offer = baseOffer();
        expect(offer.items[0]!.lineId).toBe('a');
        expect(offer.items[0]!.toConfig().lineId).toBe('a');
    });

    it('survives swapItem', () => {
        const offer = baseOffer().swapItem('a', { id: 'z', price: 15, data: { id: 'wine-z' } });
        const swapped = offer.items[0]!;
        expect(swapped.id).toBe('z');
        expect(swapped.lineId).toBe('a');
    });

    it('swap-undo restores the original line identity via the explicit config', () => {
        const original = baseOffer();
        const oldConfig = original.items[0]!.toConfig();
        const swapped = original.swapItem('a', { id: 'z', price: 15 });
        const undone = swapped.swapItem('z', oldConfig);
        expect(undone.items[0]!.id).toBe('a');
        expect(undone.items[0]!.lineId).toBe('a');
    });

    it('loads stored blobs without lineId as lineId === id', () => {
        const stored = baseOffer().toJSON();
        stored.items.forEach((item: any) => delete item.lineId);
        const reloaded = new Offer({
            ...stored,
            items: stored.items.map((i: any) => new (Object.getPrototypeOf(baseOffer().items[0]!).constructor)(i)),
        });
        expect(reloaded.items[0]!.lineId).toBe('a');
    });
});

describe('flow: sendVersion / submitRequests', () => {
    it('sendVersion appends a numbered version with a baseline and flips the turn', () => {
        const offer = baseOffer().sendVersion({ sentAt: SENT_AT, senderName: 'You' });
        const neg = offer.negotiation!;
        expect(neg.versions).toHaveLength(1);
        expect(neg.versions[0]!.number).toBe(1);
        expect(neg.versions[0]!.sender).toBe('seller');
        expect(neg.versions[0]!.baseline.lines).toHaveLength(3);
        expect(neg.versions[0]!.baseline.totals.totalPrice).toBe(offer.totals.totalPrice);
        expect(neg.turn).toBe('buyer');
        expect(offer.status).toBe('sent');
    });

    it('submitRequests stamps from-quantities off the current lines and passes the turn', () => {
        const offer = negotiatingOffer([{ kind: 'quantity', lineId: 'a', to: 20 }]);
        const neg = offer.negotiation!;
        expect(neg.versions).toHaveLength(2);
        expect(neg.versions[1]!.sender).toBe('buyer');
        expect(neg.turn).toBe('seller');
        const req = neg.requests[0]!;
        expect(req.from).toBe(10);
        expect(req.to).toBe(20);
        expect(req.versionId).toBe(neg.versions[1]!.id);
        expect(req.declined).toBe(false);
    });

    it('the seller answer round keeps the requests as the buyer’s receipt', () => {
        let offer = negotiatingOffer([{ kind: 'quantity', lineId: 'a', to: 20 }]);
        offer = offer.setQuantity(18, ['a']).setUnpromptedNote('b', 'price holds');
        offer = offer.sendVersion({ sentAt: SENT_AT, log: [{ text: 'Set to 18 instead' }] });
        const neg = offer.negotiation!;
        expect(neg.versions).toHaveLength(3);
        expect(neg.turn).toBe('buyer');
        expect(neg.versions[2]!.log).toEqual([{ text: 'Set to 18 instead' }]);
        // Requests + notes survive the send (the buyer reads them as the
        // receipt), and outcomes still derive correctly because they anchor to
        // the round-opening baseline, not the just-sent one.
        expect(neg.requests).toHaveLength(1);
        expect(neg.unpromptedNotes).toEqual({ b: 'price holds' });
        expect(resolveRequest(neg.requests[0]!, offer)).toMatchObject({
            outcome: 'changed', label: 'setToInstead', params: { qty: 18 },
        });
    });

    it('a replace answered by a swap still reads done after the seller sends', () => {
        let offer = negotiatingOffer([{ kind: 'replace', lineId: 'c' }]);
        offer = offer.swapItem('c', { id: 'z', price: 25, data: { id: 'wine-z', title: 'Dolcetto' } });
        offer = offer.sendVersion({ sentAt: SENT_AT });
        expect(resolveRequest(liveRequest(offer), offer)).toMatchObject({
            outcome: 'done', label: 'swappedFor', params: { title: 'Dolcetto' },
        });
    });

    it('the buyer’s next round replaces the previous requests and notes', () => {
        let offer = negotiatingOffer([{ kind: 'quantity', lineId: 'a', to: 20 }]);
        offer = offer.setQuantity(20, ['a']).setUnpromptedNote('b', 'price holds');
        offer = offer.sendVersion({ sentAt: SENT_AT });
        offer = offer.submitRequests({ sentAt: SENT_AT, requests: [{ kind: 'remove', lineId: 'b' }] });
        const neg = offer.negotiation!;
        expect(neg.requests).toHaveLength(1);
        expect(neg.requests[0]!.kind).toBe('remove');
        expect(neg.unpromptedNotes).toEqual({});
    });

    it('acceptNegotiation ends the conversation and sets offer status', () => {
        const offer = negotiatingOffer([]).acceptNegotiation();
        expect(offer.negotiation!.state).toBe('accepted');
        expect(offer.status).toBe('accepted');
    });

    it('negotiation state survives a toJSON round-trip', () => {
        const offer = negotiatingOffer([{ kind: 'quantity', lineId: 'a', to: 20 }]);
        const reloaded = new Offer({ ...offer.toJSON(), items: [] });
        expect(reloaded.negotiation!.versions).toHaveLength(2);
        expect(reloaded.negotiation!.requests).toHaveLength(1);
    });
});

describe('resolveRequest — §4.1 derivation table', () => {
    it('quantity: met exactly → done', () => {
        let offer = negotiatingOffer([{ kind: 'quantity', lineId: 'a', to: 20 }]);
        offer = offer.setQuantity(20, ['a']);
        expect(resolveRequest(liveRequest(offer), offer)).toMatchObject({ outcome: 'done', label: 'doneAsAsked' });
    });

    it('quantity: untouched → open', () => {
        const offer = negotiatingOffer([{ kind: 'quantity', lineId: 'a', to: 20 }]);
        expect(resolveRequest(liveRequest(offer), offer).outcome).toBe('open');
    });

    it('quantity: set differently → changed with the actual qty', () => {
        let offer = negotiatingOffer([{ kind: 'quantity', lineId: 'a', to: 20 }]);
        offer = offer.setQuantity(18, ['a']);
        expect(resolveRequest(liveRequest(offer), offer)).toMatchObject({
            outcome: 'changed', label: 'setToInstead', params: { qty: 18 },
        });
    });

    it('quantity: line removed entirely → changed (removedInstead), never orphaned', () => {
        let offer = negotiatingOffer([{ kind: 'quantity', lineId: 'a', to: 20 }]);
        offer = offer.removeItems(['a']);
        expect(resolveRequest(liveRequest(offer), offer)).toMatchObject({ outcome: 'changed', label: 'removedInstead' });
    });

    it('remove: line dropped → done; qty 0 → done', () => {
        let offer = negotiatingOffer([{ kind: 'remove', lineId: 'b' }]);
        expect(resolveRequest(liveRequest(offer), offer).outcome).toBe('open');
        const dropped = offer.removeItems(['b']);
        expect(resolveRequest(liveRequest(dropped), dropped)).toMatchObject({ outcome: 'done', label: 'removed' });
        const zeroed = offer.setQuantity(0, ['b']);
        expect(resolveRequest(liveRequest(zeroed), zeroed).outcome).toBe('done');
    });

    it('remove: cut but kept → changed (cutToInstead)', () => {
        let offer = negotiatingOffer([{ kind: 'remove', lineId: 'b' }]);
        offer = offer.setQuantity(2, ['b']);
        expect(resolveRequest(liveRequest(offer), offer)).toMatchObject({
            outcome: 'changed', label: 'cutToInstead', params: { qty: 2 },
        });
    });

    it('replace: swapped on the same line → done with the new title', () => {
        let offer = negotiatingOffer([{ kind: 'replace', lineId: 'c', note: 'something lighter' }]);
        expect(resolveRequest(liveRequest(offer), offer).outcome).toBe('open');
        offer = offer.swapItem('c', { id: 'z', price: 25, data: { id: 'wine-z', title: 'Dolcetto' } });
        expect(resolveRequest(liveRequest(offer), offer)).toMatchObject({
            outcome: 'done', label: 'swappedFor', params: { title: 'Dolcetto' },
        });
    });

    it('replace: dropped without replacement → changed', () => {
        let offer = negotiatingOffer([{ kind: 'replace', lineId: 'c' }]);
        offer = offer.removeItems(['c']);
        expect(resolveRequest(liveRequest(offer), offer)).toMatchObject({ outcome: 'changed', label: 'droppedNoReplacement' });
    });

    it('replace answered by a volume cut → changed (volumeInstead), not lost', () => {
        // The §2 lost-strand case: buyer asks for a swap, seller keeps the wine
        // but cuts the volume. Must surface, and must not gate Send.
        let offer = negotiatingOffer([{ kind: 'replace', lineId: 'c', note: 'swap or just cut it' }]);
        offer = offer.setQuantity(1, ['c']);
        const resolved = resolveRequest(liveRequest(offer), offer);
        expect(resolved).toMatchObject({ outcome: 'changed', label: 'volumeInstead', params: { qty: 1 } });
        expect(countOpenRequests(offer)).toBe(0);
    });

    it('replace answered by a price change → changed (priceInstead)', () => {
        let offer = negotiatingOffer([{ kind: 'replace', lineId: 'c' }]);
        offer = offer.updateItem('c', { price: 40 });
        expect(resolveRequest(liveRequest(offer), offer)).toMatchObject({ outcome: 'changed', label: 'priceInstead' });
    });

    it('quantity answered by a swap → changed (swappedInstead)', () => {
        let offer = negotiatingOffer([{ kind: 'quantity', lineId: 'a', to: 20 }]);
        // Same quantity, different wine — the swap must not be swallowed by the
        // quantity request sitting open.
        offer = offer.swapItem('a', { id: 'z', price: 10, quantity: 10, data: { id: 'wine-z', title: 'Nero' } });
        expect(resolveRequest(liveRequest(offer), offer)).toMatchObject({
            outcome: 'changed', label: 'swappedInstead', params: { title: 'Nero' },
        });
    });

    it('remove answered by a swap → changed (swappedInstead)', () => {
        let offer = negotiatingOffer([{ kind: 'remove', lineId: 'b' }]);
        offer = offer.swapItem('b', { id: 'z', price: 20, quantity: 5, data: { id: 'wine-z', title: 'Nero' } });
        expect(resolveRequest(liveRequest(offer), offer)).toMatchObject({
            outcome: 'changed', label: 'swappedInstead',
        });
    });

    it('add with a target wine: settled only by that wine', () => {
        let offer = negotiatingOffer([{ kind: 'add', wine: { id: 'wine-x', title: 'Lambrusco' } }]);
        offer = offer.addItems([{ id: 'other', price: 12, data: { id: 'wine-y' } }]);
        expect(resolveRequest(liveRequest(offer), offer).outcome).toBe('open');
        offer = offer.addItems([{ id: 'x', price: 12, data: { id: 'wine-x', title: 'Lambrusco' } }]);
        expect(resolveRequest(liveRequest(offer), offer)).toMatchObject({
            outcome: 'done', label: 'added', params: { title: 'Lambrusco' },
        });
    });

    it('free-text add: settled by any addition, or by an explicit answer', () => {
        const offer = negotiatingOffer([{ kind: 'add', note: 'a lighter red under €18' }]);
        expect(resolveRequest(liveRequest(offer), offer).outcome).toBe('open');
        const added = offer.addItems([{ id: 'n', price: 12, data: { id: 'wine-n', title: 'Gamay' } }]);
        expect(resolveRequest(liveRequest(added), added).outcome).toBe('done');
        const answered = offer.markFreeTextAnswered(liveRequest(offer).id);
        expect(resolveRequest(liveRequest(answered), answered)).toMatchObject({ outcome: 'done', label: 'answered' });
    });

    it('note: settled by an answer note or an explicit mark', () => {
        const offer = negotiatingOffer([{ kind: 'note', lineId: 'a', note: 'is this organic?' }]);
        expect(resolveRequest(liveRequest(offer), offer).outcome).toBe('open');
        const answered = offer.setRequestAnswer(liveRequest(offer).id, 'Yes, certified.');
        expect(resolveRequest(liveRequest(answered), answered).outcome).toBe('done');
    });

    it('unit-aware: a "10 btl → 10 cs" ask is done only when the unit also matches', () => {
        // A line that can be ordered by bottle or case_6.
        const withCases = new Offer({ title: 'Test' }).addItems([
            { id: 'u', price: 10, quantity: 10, unit: 'bottle', availableUnits: ['bottle', 'case_6'], data: { id: 'wine-u', title: 'Chablis' } },
        ]).sendVersion({ sentAt: SENT_AT });
        const offer = withCases.submitRequests({
            sentAt: SENT_AT,
            requests: [{ kind: 'quantity', lineId: 'u', to: 10, toUnit: 'case_6' }],
        });
        const req = liveRequest(offer);
        expect(req.fromUnit).toBe('bottle');
        expect(req.toUnit).toBe('case_6');
        // Untouched (still 10 bottles) → open; the ask isn't met yet.
        expect(resolveRequest(req, offer).outcome).toBe('open');
        // Same number but still bottles → not done (unit differs) — a change.
        const stillBottles = offer.updateItem('u', { quantity: 12 });
        expect(resolveRequest(liveRequest(stillBottles), stillBottles).outcome).toBe('changed');
        // Switch to exactly 10 cases → done.
        const cased = offer.updateItem('u', { quantity: 10, unit: 'case_6' });
        expect(resolveRequest(liveRequest(cased), cased)).toMatchObject({ outcome: 'done', label: 'doneAsAsked' });
    });

    it('declined always wins, and undecline restores derivation', () => {
        let offer = negotiatingOffer([{ kind: 'quantity', lineId: 'a', to: 20 }]);
        offer = offer.setQuantity(20, ['a']);
        const declined = offer.declineRequest(liveRequest(offer).id);
        expect(resolveRequest(liveRequest(declined), declined).outcome).toBe('declined');
        const restored = declined.undeclineRequest(liveRequest(declined).id);
        expect(resolveRequest(liveRequest(restored), restored).outcome).toBe('done');
    });

    it('editing the wine list by hand settles the request with no sidebar interaction', () => {
        // The §4.1 headline: both paths produce the same state.
        let offer = negotiatingOffer([{ kind: 'quantity', lineId: 'a', to: 20 }]);
        expect(countOpenRequests(offer)).toBe(1);
        offer = offer.updateItem('a', { quantity: 20 });
        expect(countOpenRequests(offer)).toBe(0);
    });
});

describe('deriveUnpromptedChanges', () => {
    it('is empty before any transmission and right after one', () => {
        expect(deriveUnpromptedChanges(baseOffer())).toEqual([]);
        const sent = baseOffer().sendVersion({ sentAt: SENT_AT });
        expect(deriveUnpromptedChanges(sent)).toEqual([]);
    });

    it('flags quantity, price, swap, add and remove edits nobody asked for', () => {
        let offer = negotiatingOffer([]);
        offer = offer
            .setQuantity(7, ['a'])
            .updateItem('b', { price: 25 })
            .swapItem('c', { id: 'z', price: 30, data: { id: 'wine-z', title: 'Dolcetto' } })
            .addItems([{ id: 'n', price: 9, data: { id: 'wine-n', title: 'Gamay' } }]);
        const changes = deriveUnpromptedChanges(offer);
        const types = changes.map((c) => c.type).sort();
        expect(types).toEqual(['add', 'price', 'quantity', 'swap']);
        const qty = changes.find((c) => c.type === 'quantity')!;
        expect(qty).toMatchObject({ lineId: 'a', from: 10, to: 7 });
    });

    it('disappears when the edit is reverted (undo removes the entry)', () => {
        let offer = negotiatingOffer([]);
        const edited = offer.setQuantity(7, ['a']);
        expect(deriveUnpromptedChanges(edited)).toHaveLength(1);
        const reverted = edited.setQuantity(10, ['a']);
        expect(deriveUnpromptedChanges(reverted)).toEqual([]);
    });

    it('excludes edits a live request explains', () => {
        let offer = negotiatingOffer([{ kind: 'quantity', lineId: 'a', to: 20 }]);
        offer = offer.setQuantity(18, ['a']); // answers the request — not unprompted
        expect(deriveUnpromptedChanges(offer)).toEqual([]);
    });

    it('stays visible to the buyer after the seller sends (round anchor)', () => {
        let offer = negotiatingOffer([{ kind: 'quantity', lineId: 'a', to: 20 }]);
        offer = offer.setQuantity(20, ['a']).setQuantity(9, ['b']);
        offer = offer.sendVersion({ sentAt: SENT_AT });
        const changes = deriveUnpromptedChanges(offer);
        expect(changes).toHaveLength(1);
        expect(changes[0]).toMatchObject({ type: 'quantity', lineId: 'b', from: 5, to: 9 });
        // …while "changed since the last transmission" is clean.
        expect(deriveUnpromptedChanges(offer, {
            baseline: latestBaseline(offer), ignoreRequests: true,
        })).toEqual([]);
    });

    it('excludes additions while an add request is pending', () => {
        let offer = negotiatingOffer([{ kind: 'add', note: 'anything light' }]);
        offer = offer.addItems([{ id: 'n', price: 9, data: { id: 'wine-n' } }]);
        expect(deriveUnpromptedChanges(offer)).toEqual([]);
    });
});

describe('summary projection', () => {
    it('embeds negotiation state for list badges once shared', () => {
        expect(baseOffer().toSummary()).not.toHaveProperty('negotiation');
        const offer = negotiatingOffer([{ kind: 'quantity', lineId: 'a', to: 20 }]);
        expect(offer.toSummary().negotiation).toEqual({
            state: 'open', turn: 'seller', openCount: 1, versionCount: 2,
        });
    });

    it('past versions are untouched by later edits (a record, not a snapshot)', () => {
        const offer = negotiatingOffer([{ kind: 'quantity', lineId: 'a', to: 20 }]);
        const v1 = offer.negotiation!.versions[0]!;
        const edited = offer.setQuantity(99, ['a']);
        expect(edited.negotiation!.versions[0]).toBe(v1);
        expect(latestBaseline(edited)!.lines.find((l) => l.lineId === 'a')!.quantity).toBe(10);
    });

    it('resolveRequests keeps stored order', () => {
        const offer = negotiatingOffer([
            { kind: 'quantity', lineId: 'a', to: 20 },
            { kind: 'remove', lineId: 'b' },
        ]);
        const resolved = resolveRequests(offer);
        expect(resolved.map((r) => r.request.kind)).toEqual(['quantity', 'remove']);
    });
});
