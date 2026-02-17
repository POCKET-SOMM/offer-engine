import { describe, it, expect } from 'vitest';
import { Offer } from './Offer.js';
import { OfferItem } from './OfferItem.js';

describe('Offer', () => {
    describe('Initialization', () => {
        it('should initialize with default values', () => {
            const offer = new Offer();
            expect(offer.id).toBeDefined();
            expect(offer.title).toBe('');
            expect(offer.items).toEqual([]);
            expect(offer.totals).toEqual({ totalNet: 0, totalVat: 0, totalGross: 0 });
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
            // 100 * 2 = 200 Net
            // 20 * 2 = 40 VAT
            // 240 Gross
            expect(offer.totals.totalNet).toBe(200);
            expect(offer.totals.totalVat).toBe(40);
            expect(offer.totals.totalGross).toBe(240);
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
            expect(offer.totals.totalNet).toBe(200);
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
                { price: 100, vatRate: 10 }, // 100 + 10 = 110
                { price: 100, vatRate: 20 }  // 100 + 20 = 120
            ]);

            expect(offer.totals.totalNet).toBe(200);
            expect(offer.totals.totalVat).toBe(30);
            expect(offer.totals.totalGross).toBe(230);
        });

        it('should handle units in grand totals', () => {
            // _getMultiplier logic check
            let offer = new Offer();
            // 1 case_6: 10 per bottle * 6 = 60 user enters partial unit price?
            // Actually currently logic is: price is per bottle. unit is just a multiplier for total.

            offer = offer.addItems([
                { price: 10, unit: 'case_6', quantity: 1 }
            ]);

            // 1 item line.
            // OfferItem calculates:
            // pricePerBottle: 10
            // pricePerUnit: 60
            // totalPrice: 60

            // Offer totals:
            // net: 60

            expect(offer.items[0]?.totalPrice).toBeCloseTo(75.3);
            expect(offer.totals.totalNet).toBe(60);
        });
    });
});
