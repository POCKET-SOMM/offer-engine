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
