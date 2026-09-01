import { describe, it, expect, beforeEach } from 'vitest';
import { Offer } from './Offer.js';
import { OfferItem } from './OfferItem.js';
import offerData from './offer.json' with { type: 'json' };

describe('Offer', () => {
    describe('Initialization', () => {
        it('should initialize with default values', () => {
            const offer = new Offer();
            expect(offer.id).toBeDefined();
            expect(offer.title).toBe('');
            expect(offer.items).toEqual([]);
            expect(offer.totals).toEqual({ totalPrice: 0, totalSaved: 0 });
            expect(Object.isFrozen(offer)).toBe(true);
        });

        it('should initialize with provided values', () => {
            const offer = new Offer({
                title: 'Test Offer',
                id: 'custom-id'
            });
            expect(offer.title).toBe('Test Offer');
            expect(offer.id).toBe('custom-id');
        });
    });

    describe('Item Management', () => {
        it('should add items and recalculate totals', () => {
            let offer = new Offer();

            // Add 2 items @ 100 each
            offer = offer.addItems([
                { price: 100, vatRate: 20 },
                { price: 100, vatRate: 20 }
            ]);

            expect(offer.items.length).toBe(2);
            // 100 * 2 = 200 Total Price
            // 0 Saved (no discount)
            expect(offer.totals.totalPrice).toBe(200);
            expect(offer.totals.totalSaved).toBe(0);
        });

        it('should remove items', () => {
            let offer = new Offer();
            offer = offer.addItems([
                { price: 100, id: 'item-1' },
                { price: 200, id: 'item-2' }
            ]);

            offer = offer.removeItems(['item-1']);

            expect(offer.items.length).toBe(1);
            expect(offer.items[0]?.id).toBe('item-2');
            expect(offer.totals.totalPrice).toBe(200);
        });

        it('should update items immutably', () => {
            let offer = new Offer();
            offer = offer.addItems([{ price: 100, id: '1' }]);
            const originalItem = offer.items[0];

            const updatedOffer = offer.updateItem('1', { price: 200 });

            expect(updatedOffer.items[0]?.price).toBe(200);
            expect(originalItem?.price).toBe(100);
            expect(offer).not.toBe(updatedOffer);
        });

        it('should support function-based updates', () => {
            let offer = new Offer();
            offer = offer.addItems([{ price: 100, id: '1' }]);

            const updatedOffer = offer.updateItem('1', (item: OfferItem) => item.update({ price: item.price + 50 }));

            expect(updatedOffer.items[0]?.price).toBe(150);
        });
    });

    describe('Grand Totals & VAT', () => {
        it('should calculate mixed VAT rates correctly', () => {
            let offer = new Offer();
            offer = offer.addItems([
                { price: 100, vatRate: 10 },
                { price: 100, vatRate: 20 }
            ]);

            // Mixed VAT doesn't affect totalPrice (Net) or totalSaved (0)
            expect(offer.totals.totalPrice).toBe(200);
            expect(offer.totals.totalSaved).toBe(0);
        });

        it('should handle units in grand totals', () => {
            let offer = new Offer();
            offer = offer.addItems([
                { price: 10, unit: 'case_6', quantity: 1 }
            ]);

            expect(offer.items[0]?.totalPrice).toBe(60);
            expect(offer.totals.totalPrice).toBe(60);
        });
    });
});

describe('Bulk Operations', () => {
    let offer = new Offer({
        items: [
            new OfferItem({ price: 100, id: '1', vatRate: 0 }),
            new OfferItem({ price: 200, id: '2', vatRate: 0 })
        ]
    });

    it('should set margin for all items', () => {
        const updated = offer.setMargin(50);
        expect(updated.items[0]?.margin).toBe(50);
        expect(updated.items[1]?.margin).toBe(50);
        expect(updated.items[0]?.customerPrice).toBe(200); // 100 / (1 - 0.5)
    });

    it('rounds affected prices when setMargin gets a round option', () => {
        const o = new Offer({
            items: [
                new OfferItem({ price: 5.91, id: 'a', vatRate: 25.5 }),
                new OfferItem({ price: 7.13, id: 'b', vatRate: 25.5 }),
            ],
        });
        const updated = o.setMargin(70, undefined, { round: 'charm_49' });
        for (const item of updated.items) {
            expect(Math.round((item.customerPrice % 1) * 100)).toBe(49);
            const sum = item.pricePerBottle + item.gross + item.vatAmount;
            expect(Math.abs(sum - item.customerPrice)).toBeLessThan(0.011);
        }
    });

    it('rounds only targeted ids and leaves others untouched', () => {
        const o = new Offer({
            items: [
                new OfferItem({ price: 5.91, id: 'a', vatRate: 25.5 }),
                new OfferItem({ price: 7.13, id: 'b', vatRate: 25.5 }),
            ],
        });
        const updated = o.setMargin(70, ['a'], { round: 'whole' });
        expect(updated.items[0]?.customerPrice).toBe(25);
        expect(updated.items[1]?.customerPrice).toBe(o.items[1]?.customerPrice);
    });

    it('setPourVolume with round option rounds the new pour price', () => {
        const o = new Offer({
            items: [new OfferItem({ price: 10, id: 'a' })],
        });
        const updated = o.setPourVolume({ volume: 150, price: 9.81 }, undefined, { round: 'half_up' });
        expect(updated.items[0]?.pourVolumes[0]?.price).toBe(10);
    });

    it('setPourVolumeByStrategy prices each item from its OWN state in one call', () => {
        const o = new Offer({
            items: [
                new OfferItem({ price: 10, id: 'a', vatRate: 0, margin: 50 }),
                new OfferItem({ price: 30, id: 'b', vatRate: 0, margin: 50 }),
            ],
        });
        const updated = o.setPourVolumeByStrategy({ strategy: 'bottle_recovery', volume: 125 });
        // One call, two different prices — the whole point of the strategy shape.
        expect(updated.items[0]?.pourVolumes[0]?.price).toBe(10);
        expect(updated.items[1]?.pourVolumes[0]?.price).toBe(30);
    });

    it('bottle_recovery uses net cost, not the pre-discount list price', () => {
        const o = new Offer({
            items: [new OfferItem({ price: 100, discount: 20, id: 'a', vatRate: 0 })],
        });
        const updated = o.setPourVolumeByStrategy({ strategy: 'bottle_recovery', volume: 125 });
        // pricePerBottle = 100 * (1 - 0.20) = 80, NOT the 100 list price.
        expect(o.items[0]?.pricePerBottle).toBe(80);
        expect(updated.items[0]?.pourVolumes[0]?.price).toBe(80);
    });

    it('proportional_premium scales the guest price by the pour share plus premium', () => {
        const o = new Offer({
            items: [new OfferItem({ price: 10, id: 'a', vatRate: 0, customerPrice: 60 })],
        });
        const updated = o.setPourVolumeByStrategy({
            strategy: 'proportional_premium',
            volume: 125,
            premium: 0.2,
        });
        // 60 * (125/750) * 1.2 = 12
        expect(updated.items[0]?.pourVolumes[0]?.price).toBe(12);
    });

    it('margin_parity prices the pour at the item own bottle margin', () => {
        const o = new Offer({
            items: [new OfferItem({ price: 60, id: 'a', vatRate: 0, margin: 50 })],
        });
        const updated = o.setPourVolumeByStrategy({ strategy: 'margin_parity', volume: 125 });
        // cost = 60 * (125/750) = 10; at 50% margin -> 10 / 0.5 = 20
        expect(updated.items[0]?.pourVolumes[0]?.price).toBe(20);
    });

    it('setPourVolumeByStrategy touches only targeted ids and can round', () => {
        const o = new Offer({
            items: [
                new OfferItem({ price: 9.81, id: 'a', vatRate: 0 }),
                new OfferItem({ price: 12.4, id: 'b', vatRate: 0 }),
            ],
        });
        const updated = o.setPourVolumeByStrategy(
            { strategy: 'bottle_recovery', volume: 125 },
            ['a'],
            { round: 'half_up' },
        );
        expect(updated.items[0]?.pourVolumes[0]?.price).toBe(10);
        expect(updated.items[1]?.pourVolumes).toHaveLength(0);
    });

    it('setPourVolumePerItem applies explicit per-item prices in one call', () => {
        const o = new Offer({
            items: [
                new OfferItem({ price: 10, id: 'a', vatRate: 0 }),
                new OfferItem({ price: 20, id: 'b', vatRate: 0 }),
                new OfferItem({ price: 30, id: 'c', vatRate: 0 }),
            ],
        });
        const updated = o.setPourVolumePerItem(125, [
            { id: 'a', price: 7 },
            { id: 'c', price: 11.4 },
        ], { round: 'half_up', name: 'Standard' });
        expect(updated.items[0]?.pourVolumes[0]).toMatchObject({ price: 7, name: 'Standard' });
        // Items absent from the price list are untouched.
        expect(updated.items[1]?.pourVolumes).toHaveLength(0);
        expect(updated.items[2]?.pourVolumes[0]?.price).toBe(11.5);
    });

    it('an unknown strategy throws rather than silently pricing pours at zero', () => {
        const o = new Offer({ items: [new OfferItem({ price: 10, id: 'a' })] });
        expect(() =>
            o.setPourVolumeByStrategy({ strategy: 'nonsense' as any, volume: 125 }),
        ).toThrow(/Unknown pour strategy/);
    });

    it('roundCustomerPrices accepts a preset name', () => {
        const o = new Offer({
            items: [new OfferItem({ price: 5.91, id: 'a', vatRate: 25.5, margin: 70 })],
        });
        const updated = o.roundCustomerPrices('charm_99');
        expect(updated.items[0]?.customerPrice).toBe(24.99);
    });

    it('should set gross for specific items', () => {
        const updated = offer.setGross(100, ['1']);
        expect(updated.items[0]?.gross).toBe(100);
        expect(updated.items[1]?.gross).toBe(0); // Item 2 was not updated
    });

    it('should set discount for all items', () => {
        const updated = offer.setDiscount(10);
        expect(updated.items[0]?.discount).toBe(10);
        expect(updated.items[1]?.discount).toBe(10);
        expect(updated.items[0]?.pricePerBottle).toBe(90);
    });

    it('should set quantity for all items', () => {
        const updated = offer.setQuantity(5);
        expect(updated.items[0]?.quantity).toBe(5);
        expect(updated.items[1]?.quantity).toBe(5);
    });

    it('should set vatRate for all items', () => {
        const updated = offer.setVatRate(25);
        expect(updated.items[0]?.vatRate).toBe(25);
        expect(updated.items[1]?.vatRate).toBe(25);
    });

    it('should set glassPrice for all items', () => {
        const updated = offer.setGlassPrice(12);
        expect(updated.items[0]?.glassPrice).toBe(12);
        expect(updated.items[1]?.glassPrice).toBe(12);
    });

    it('should set unit only if valid globally and allowed for item', () => {
        const o = new Offer({
            items: [
                new OfferItem({ price: 10, id: '1', availableUnits: ['bottle', 'case_6'] }),
                new OfferItem({ price: 10, id: '2', availableUnits: ['bottle'] })
            ]
        });

        let updated = o.setUnit('case_6');
        expect(updated.items[0]?.unit).toBe('case_6');
        expect(updated.items[1]?.unit).toBe('bottle'); // Should NOT update as it's not available

        // Should ignore invalid unit entirely and return self
        const invalidUpdate = updated.setUnit('NON_EXISTENT');
        expect(invalidUpdate).toBe(updated);
    });

    it('should bulk round customer prices', () => {
        const o = new Offer({
            items: [
                new OfferItem({ price: 10, margin: 39, vatRate: 0, id: '1' }), // 16.39
                new OfferItem({ price: 10, margin: 40, vatRate: 0, id: '2' })  // 16.67
            ]
        });
        const rounded = o.roundCustomerPrices();
        expect(rounded.items[0]?.customerPrice).toBe(16);
        expect(rounded.items[1]?.customerPrice).toBe(17);
    });

    it('should bulk round glass prices', () => {
        const o = new Offer({
            items: [
                new OfferItem({ price: 10, glassPrice: 12.34, id: '1' }),
                new OfferItem({ price: 10, glassPrice: 12.67, id: '2' })
            ]
        });
        const rounded = o.roundGlassPrices(0.5);
        expect(rounded.items[0]?.glassPrice).toBe(12.5);
        expect(rounded.items[1]?.glassPrice).toBe(12.5);
    });
});

describe('Real Offer Data', () => {
    let baseOffer: Offer;

    beforeEach(() => {
        // Load the offer data directly from the JSON
        baseOffer = new Offer().addItems(offerData.items as any[]);
    });

    it('should load a real offer from JSON', () => {
        expect(baseOffer.items.length).toBeGreaterThan(0);
        // Verify key mapped fields exist
        const firstItem = baseOffer.items[0];
        expect(firstItem?.id).toBeDefined();
        expect(firstItem?.price).toBeGreaterThan(0);
        expect(firstItem?.vatRate).toBeDefined();
        // data object should hold original extra fields
        expect(firstItem?.data.title).toBeDefined();
    });

    it('should set margin to 50', () => {
        const updated = baseOffer.setMargin(50);
        
        const item = updated.items[0];
        expect(item?.margin).toBe(50);
        expect(item?.customerPrice).toBeGreaterThan(item!.pricePerBottle);
        // Verify immutability
        expect(item).not.toBe(baseOffer.items[0]);
    });

    it('should set margin to 0.5', () => {
        const updated = baseOffer.setMargin(0.5);
        
        const item = updated.items[0];
        expect(item?.margin).toBe(0.5);
        // Customer price should still be greater than or equal to vendor price, just very slightly
        expect(item?.customerPrice).toBeGreaterThan(item!.pricePerBottle);
        expect(item?.customerPrice).toBeLessThan(baseOffer.items[0]!.customerPrice); // assuming original margin > 0.5
    });

    it('should set discount to 10', () => {
        const updated = baseOffer.setDiscount(10);
        
        const item = updated.items[0];
        expect(item?.discount).toBe(10);
        expect(item?.pricePerBottle).toBeLessThan(item!.price);
    });

    it('should round customer prices correctly', () => {
        const withMargin = baseOffer.setMargin(33); // A random margin that likely yields decimals
        const rounded = withMargin.roundCustomerPrices(1);
        
        const item = rounded.items[0];
        expect(item?.customerPrice! % 1).toBe(0); // Should be an integer
    });

    it('should set glass price and round it', () => {
        let updated = baseOffer.setGlassPrice(12.34);
        updated = updated.roundGlassPrices(0.5);

        const item = updated.items[0];
        expect(item?.glassPrice).toBe(12.5);
    });
});

describe('Grouping', () => {
    const buildOffer = () => new Offer({
        items: [
            new OfferItem({ price: 10, id: 'i1' }),
            new OfferItem({ price: 10, id: 'i2' }),
            new OfferItem({ price: 10, id: 'i3' }),
        ],
    });

    it('setGrouping writes to data.grouping immutably', () => {
        const offer = buildOffer();
        const next = offer.setGrouping({ mode: 'country' });
        expect(next).not.toBe(offer);
        expect(next.data['grouping']).toEqual({ mode: 'country' });
        expect(offer.data['grouping']).toBeUndefined();
    });

    it('setGrouping(null) clears the field', () => {
        const offer = buildOffer().setGrouping({ mode: 'country' });
        const cleared = offer.setGrouping(null);
        expect(cleared.data['grouping']).toBeUndefined();
    });

    it('enterCustomMode seeds custom categories', () => {
        const offer = buildOffer();
        const seed = [{ id: 'c1', name: 'A', itemIds: ['i1'] }];
        const next = offer.enterCustomMode(seed);
        expect(next.data['grouping']).toEqual({
            mode: 'custom',
            customCategories: [{ id: 'c1', name: 'A', itemIds: ['i1'] }],
        });
    });

    it('addCustomCategory throws on empty / duplicate / reserved name', () => {
        const offer = buildOffer().enterCustomMode([{ id: 'c1', name: 'Existing', itemIds: [] }]);
        expect(() => offer.addCustomCategory('')).toThrow(/empty/);
        expect(() => offer.addCustomCategory('existing')).toThrow(/duplicate/);
        expect(() => offer.addCustomCategory('Other', { reserved: ['Other'] })).toThrow(/reserved/);
    });

    it('addCustomCategory appends a new category with a fresh id', () => {
        const offer = buildOffer().enterCustomMode([]);
        const next = offer.addCustomCategory('French');
        const cats = next.data['grouping'].customCategories;
        expect(cats.length).toBe(1);
        expect(cats[0].name).toBe('French');
        expect(cats[0].itemIds).toEqual([]);
        expect(typeof cats[0].id).toBe('string');
    });

    it('renameCustomCategory updates the name; allows same name on same id', () => {
        const offer = buildOffer().enterCustomMode([
            { id: 'c1', name: 'A', itemIds: [] },
            { id: 'c2', name: 'B', itemIds: [] },
        ]);
        const renamed = offer.renameCustomCategory('c1', 'C');
        const cats = renamed.data['grouping'].customCategories;
        expect(cats.find((c: any) => c.id === 'c1').name).toBe('C');

        // No-op rename to itself should succeed
        expect(() => renamed.renameCustomCategory('c1', 'C')).not.toThrow();
        // Renaming to another category's name should fail
        expect(() => renamed.renameCustomCategory('c1', 'B')).toThrow(/duplicate/);
    });

    it('removeCustomCategory drops the category', () => {
        const offer = buildOffer().enterCustomMode([
            { id: 'c1', name: 'A', itemIds: ['i1'] },
            { id: 'c2', name: 'B', itemIds: [] },
        ]);
        const next = offer.removeCustomCategory('c1');
        const cats = next.data['grouping'].customCategories;
        expect(cats.length).toBe(1);
        expect(cats[0].id).toBe('c2');
    });

    it('reorderCustomCategories reorders by id and keeps unknown / missing ids stable', () => {
        const offer = buildOffer().enterCustomMode([
            { id: 'c1', name: 'A', itemIds: [] },
            { id: 'c2', name: 'B', itemIds: [] },
            { id: 'c3', name: 'C', itemIds: [] },
        ]);
        const reordered = offer.reorderCustomCategories(['c3', 'c1']);
        const cats = reordered.data['grouping'].customCategories;
        expect(cats.map((c: any) => c.id)).toEqual(['c3', 'c1', 'c2']);
    });

    it('moveItemToCategory moves an item across categories', () => {
        const offer = buildOffer().enterCustomMode([
            { id: 'c1', name: 'A', itemIds: ['i1', 'i2'] },
            { id: 'c2', name: 'B', itemIds: ['i3'] },
        ]);
        const moved = offer.moveItemToCategory('i1', 'c2');
        const cats = moved.data['grouping'].customCategories;
        expect(cats.find((c: any) => c.id === 'c1').itemIds).toEqual(['i2']);
        expect(cats.find((c: any) => c.id === 'c2').itemIds).toEqual(['i3', 'i1']);
    });

    it('moveItemToCategory(itemId, null) removes from all categories', () => {
        const offer = buildOffer().enterCustomMode([
            { id: 'c1', name: 'A', itemIds: ['i1'] },
            { id: 'c2', name: 'B', itemIds: ['i2'] },
        ]);
        const moved = offer.moveItemToCategory('i1', null);
        const cats = moved.data['grouping'].customCategories;
        expect(cats.flatMap((c: any) => c.itemIds)).toEqual(['i2']);
    });

    it('normalizeCustomGrouping is a no-op when not in custom mode', () => {
        const offer = buildOffer().setGrouping({ mode: 'type' });
        expect(offer.normalizeCustomGrouping()).toBe(offer);
    });

    it('normalizeCustomGrouping drops dead itemIds when in custom mode', () => {
        const offer = buildOffer().enterCustomMode([
            { id: 'c1', name: 'A', itemIds: ['i1', 'gone'] },
            { id: 'c2', name: 'B', itemIds: ['i3'] },
        ]);
        const normalized = offer.normalizeCustomGrouping();
        const cats = normalized.data['grouping'].customCategories;
        expect(cats.find((c: any) => c.id === 'c1').itemIds).toEqual(['i1']);
        expect(cats.find((c: any) => c.id === 'c2').itemIds).toEqual(['i3']);
    });

    it('normalizeCustomGrouping returns the same Offer when nothing changed', () => {
        const offer = buildOffer().enterCustomMode([
            { id: 'c1', name: 'A', itemIds: ['i1'] },
        ]);
        expect(offer.normalizeCustomGrouping()).toBe(offer);
    });

    it('grouping mutations preserve other offer state (items, title, totals)', () => {
        const offer = buildOffer().updateTitle('My offer');
        const next = offer.setGrouping({ mode: 'country' });
        expect(next.title).toBe('My offer');
        expect(next.items.length).toBe(3);
        expect(next.totals).toEqual(offer.totals);
    });
});

describe('Status', () => {
    const buildOffer = () => new Offer({
        items: [
            new OfferItem({ price: 10, id: 'i1', data: { imgUrl: 'a.png', title: 'Wine A' } }),
            new OfferItem({ price: 10, id: 'i2', data: { imgUrl: 'b.png', title: 'Wine B' } }),
        ],
    });

    it('defaults to draft', () => {
        expect(new Offer().status).toBe('draft');
    });

    it('setStatus writes to data.status immutably', () => {
        const offer = buildOffer();
        const next = offer.setStatus('sent');
        expect(next).not.toBe(offer);
        expect(next.status).toBe('sent');
        expect(next.data['status']).toBe('sent');
        expect(offer.status).toBe('draft');
    });

    it('setStatus throws on an unknown value', () => {
        expect(() => new Offer().setStatus('archived' as any)).toThrow(/Invalid offer status/);
    });

    it('status round-trips through toJSON / new Offer', () => {
        const json = buildOffer().setStatus('accepted').toJSON();
        const restored = new Offer({ ...json, items: json.items.map(i => new OfferItem(i)) });
        expect(restored.status).toBe('accepted');
    });

    it('setStatus preserves items, title and grouping', () => {
        const offer = buildOffer().updateTitle('My offer').setGrouping({ mode: 'country' });
        const next = offer.setStatus('sent');
        expect(next.title).toBe('My offer');
        expect(next.items.length).toBe(2);
        expect(next.data['grouping']).toEqual({ mode: 'country' });
    });
});

describe('Summary', () => {
    const wine = (id: string, price: number, extra: Record<string, any> = {}) =>
        new OfferItem({ price, id, data: { imgUrl: `${id}.png`, title: `Wine ${id}`, ...extra } });

    it('derives thumbnails, groups, wineCount and status', () => {
        const offer = new Offer({
            items: [wine('a', 10, { type: 'white' }), wine('b', 10, { type: 'red' })],
        }).setStatus('sent');

        // Sections follow WINE_TYPE_KEYS order, so white precedes red.
        expect(offer.toSummary()).toEqual({
            thumbnails: [
                { imgUrl: 'a.png', title: 'Wine a' },
                { imgUrl: 'b.png', title: 'Wine b' },
            ],
            groups: [
                { value: 'white', count: 1, thumbnails: [{ imgUrl: 'a.png', title: 'Wine a' }] },
                { value: 'red', count: 1, thumbnails: [{ imgUrl: 'b.png', title: 'Wine b' }] },
            ],
            groupingMode: 'type',
            wineCount: 2,
            status: 'sent',
            menuTitles: [],
        });
    });

    it('caps thumbnails at the limit but reports the full wineCount', () => {
        const items = Array.from({ length: 12 }, (_, i) => wine(`i${i}`, 10));
        const summary = new Offer({ items }).toSummary();
        expect(summary.thumbnails.length).toBe(8);
        expect(summary.wineCount).toBe(12);
    });

    it('caps each group at 3 thumbnails but reports the group true count', () => {
        const items = Array.from({ length: 5 }, (_, i) => wine(`r${i}`, 10, { type: 'red' }));
        const [group] = new Offer({ items }).toSummary().groups;
        expect(group!.value).toBe('red');
        expect(group!.count).toBe(5);
        expect(group!.thumbnails).toHaveLength(3);
    });

    it('honours manual (custom) grouping, including its labels', () => {
        const offer = new Offer({ items: [wine('i1', 10), wine('i2', 10), wine('i3', 10)] })
            .setGrouping({
                mode: 'custom',
                customCategories: [
                    { id: 'c1', name: 'Starters', itemIds: ['i1', 'i2'] },
                    { id: 'c2', name: 'Mains', itemIds: ['i3'] },
                ],
            });

        const summary = offer.toSummary();
        expect(summary.groupingMode).toBe('custom');
        expect(summary.groups.map((g) => [g.value, g.label, g.count])).toEqual([
            ['c1', 'Starters', 2],
            ['c2', 'Mains', 1],
        ]);
    });

    it('routes unclaimed wines to an Other group in custom mode', () => {
        const offer = new Offer({ items: [wine('i1', 10), wine('i2', 10)] })
            .setGrouping({
                mode: 'custom',
                customCategories: [{ id: 'c1', name: 'Picked', itemIds: ['i1'] }],
            });

        expect(offer.toSummary().groups.map((g) => [g.value, g.count])).toEqual([
            ['c1', 1],
            ['__other__', 1],
        ]);
    });

    it('previews strategy grouping as type — strategies live in the consumer app', () => {
        const offer = new Offer({ items: [wine('a', 10, { type: 'white' }), wine('b', 10, { type: 'red' })] })
            .setGrouping({ mode: 'strategy', strategyId: 'not-resolvable-here' });

        const summary = offer.toSummary();
        expect(summary.groupingMode).toBe('type');
        expect(summary.groups.map((g) => g.value)).toEqual(['white', 'red']);
    });

    it('groups untyped wines under Other', () => {
        const summary = new Offer({ items: [wine('x', 10)] }).toSummary();
        expect(summary.groups.map((g) => [g.value, g.count])).toEqual([['__other__', 1]]);
    });

    it('orders the preview by the offer saved sort', () => {
        const offer = new Offer({
            items: [wine('a', 30, { type: 'red' }), wine('b', 10, { type: 'red' }), wine('c', 20, { type: 'red' })],
        }).setSort({ field: 'price', dir: 'asc' });

        expect(offer.toSummary().thumbnails.map((t) => t.title)).toEqual(['Wine b', 'Wine c', 'Wine a']);
    });

    it('omits empty groups', () => {
        const summary = new Offer({ items: [wine('a', 10, { type: 'red' })] }).toSummary();
        expect(summary.groups).toHaveLength(1);
        expect(summary.groups.every((g) => g.count > 0)).toBe(true);
    });

    it('returns an empty preview for an empty offer', () => {
        expect(new Offer().toSummary()).toEqual({
            thumbnails: [],
            groups: [],
            groupingMode: 'type',
            wineCount: 0,
            status: 'draft',
            menuTitles: [],
        });
    });

    it('toJSON embeds the summary as a top-level sibling of items', () => {
        const json = new Offer({ items: [wine('a', 10, { type: 'red' })] }).toJSON();
        expect(json.summary).toEqual({
            thumbnails: [{ imgUrl: 'a.png', title: 'Wine a' }],
            groups: [{ value: 'red', count: 1, thumbnails: [{ imgUrl: 'a.png', title: 'Wine a' }] }],
            groupingMode: 'type',
            wineCount: 1,
            status: 'draft',
            menuTitles: [],
        });
    });
});

describe('Menus', () => {
    it('defaults to an empty menus array', () => {
        expect(new Offer().menus).toEqual([]);
        expect(new Offer().menu).toBeNull();
    });

    it('wraps a legacy single `menu` config into `menus`', () => {
        const offer = new Offer({ menu: { id: 'm1', title: 'Dinner' } });
        expect(offer.menus).toEqual([{ id: 'm1', title: 'Dinner' }]);
        // Back-compat accessor still resolves the first menu.
        expect(offer.menu).toEqual({ id: 'm1', title: 'Dinner' });
    });

    it('prefers `menus` over a legacy `menu` when both are present', () => {
        const offer = new Offer({
            menus: [{ id: 'a', title: 'A' }],
            menu: { id: 'b', title: 'B' },
        });
        expect(offer.menus.map((m) => m.id)).toEqual(['a']);
    });

    it('add / remove / setMenus are immutable and preserve order', () => {
        const base = new Offer()
            .addMenu({ id: 'm1', title: 'One' })
            .addMenu({ id: 'm2', title: 'Two' });
        expect(base.menus.map((m) => m.id)).toEqual(['m1', 'm2']);

        const dropped = base.removeMenu('m1');
        expect(dropped.menus.map((m) => m.id)).toEqual(['m2']);
        // Original is untouched.
        expect(base.menus.map((m) => m.id)).toEqual(['m1', 'm2']);

        expect(base.setMenus([]).menus).toEqual([]);
    });

    it('setMenu shim replaces all menus (and clears on null)', () => {
        const offer = new Offer().addMenu({ id: 'a' }).addMenu({ id: 'b' });
        expect(offer.setMenu({ id: 'c' }).menus.map((m) => m.id)).toEqual(['c']);
        expect(offer.setMenu(null).menus).toEqual([]);
    });

    it('round-trips menus through toJSON / new Offer without the legacy `menu` key', () => {
        const json = new Offer()
            .addMenu({ id: 'm1', title: 'One' })
            .addMenu({ id: 'm2', title: 'Two' })
            .toJSON();
        expect(json.menus.map((m: any) => m.id)).toEqual(['m1', 'm2']);
        expect('menu' in json).toBe(false);
        expect(new Offer(json).menus.map((m) => m.id)).toEqual(['m1', 'm2']);
    });

    it('summary lists every attached menu title in order, null for untitled', () => {
        const offer = new Offer()
            .addMenu({ id: 'm1', title: 'Dinner' })
            .addMenu({ id: 'm2', title: 'Wine Card' })
            .addMenu({ id: 'm3' }); // untitled → null, not dropped
        expect(offer.toSummary().menuTitles).toEqual(['Dinner', 'Wine Card', null]);
    });

    it('menus survive unrelated mutations (title, status, grouping)', () => {
        const offer = new Offer({ menus: [{ id: 'm1', title: 'One' }] })
            .updateTitle('Renamed')
            .setStatus('sent')
            .setGrouping({ mode: 'country' });
        expect(offer.menus.map((m) => m.id)).toEqual(['m1']);
    });
});

describe('Sort', () => {
    const wine = (id: string, price: number) => new OfferItem({ price, id, data: { title: id } });

    it('stores the sort on the data bag and round-trips through toJSON', () => {
        const offer = new Offer().setSort({ field: 'name', dir: 'desc' });
        expect(offer.sort).toEqual({ field: 'name', dir: 'desc' });

        const json = offer.toJSON();
        expect(json.data['sort']).toEqual({ field: 'name', dir: 'desc' });
        expect(new Offer({ data: json.data }).sort).toEqual({ field: 'name', dir: 'desc' });
    });

    it('clears the sort when passed null', () => {
        const offer = new Offer().setSort({ field: 'price', dir: 'asc' }).setSort(null);
        expect(offer.sort).toBeUndefined();
        expect('sort' in offer.data).toBe(false);
    });

    it('sortedItems keeps insertion order when no sort is set', () => {
        const offer = new Offer({ items: [wine('a', 30), wine('b', 10)] });
        expect(offer.sortedItems.map((i) => i.id)).toEqual(['a', 'b']);
    });

    it('sortedItems applies the saved sort', () => {
        const offer = new Offer({ items: [wine('a', 30), wine('b', 10), wine('c', 20)] })
            .setSort({ field: 'price', dir: 'desc' });
        expect(offer.sortedItems.map((i) => i.id)).toEqual(['a', 'c', 'b']);
    });

    it('setSort returns a new frozen Offer and leaves the original untouched', () => {
        const original = new Offer();
        const sorted = original.setSort({ field: 'price', dir: 'asc' });
        expect(sorted).not.toBe(original);
        expect(original.sort).toBeUndefined();
        expect(Object.isFrozen(sorted)).toBe(true);
    });
});
