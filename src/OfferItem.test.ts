import { describe, it, expect } from 'vitest';
import { OfferItem } from './OfferItem.js';
import { UNIT_MULTIPLIERS } from './constants.js';

describe('OfferItem', () => {
    describe('Initialization & Calculations', () => {
        it('should calculate basic fields correctly for a single bottle', () => {
            const item = new OfferItem({
                price: 100,
                vatRate: 20,
                quantity: 1
            });

            expect(item.price).toBe(100);
            expect(item.pricePerBottle).toBe(100);
            expect(item.pricePerUnit).toBe(100);
            expect(item.gross).toBe(0);
            expect(item.vatAmount).toBe(20);
            expect(item.customerPrice).toBe(120);
            expect(item.totalPrice).toBe(120);
        });

        it('should match the user provided example calculation', () => {
            // Screen shot data:
            // Wholesale: 34.99
            // Gross (70%): 81.64
            // VAT (25.5%): 29.74
            // Final: 146.37

            const item = new OfferItem({
                price: 34.99,
                margin: 70,
                vatRate: 25.5,
                quantity: 1
            });

            expect(item.price).toBe(34.99);
            expect(item.gross).toBe(81.64);
            expect(item.vatAmount).toBe(29.74);
            expect(item.customerPrice).toBe(146.37);
            expect(item.totalPrice).toBe(146.37);
        });

        it('should handle discount correctly', () => {
            const item = new OfferItem({
                price: 100,
                discount: 10,
                vatRate: 20
            });

            // Price per bottle: 100 * 0.9 = 90
            expect(item.pricePerBottle).toBe(90);
            expect(item.vatAmount).toBe(18); // 90 * 0.2
            expect(item.customerPrice).toBe(108);
        });

        it('should handle margin correctly', () => {
            // Margin formula: price / (1 - margin/100)
            const item = new OfferItem({
                price: 100,
                margin: 50, // 50% margin means price doubles
                vatRate: 0
            });

            // Cost 100. Sell Price = 100 / (1 - 0.5) = 200.
            // Gross profit = 200 - 100 = 100.
            expect(item.gross).toBe(100);
            expect(item.customerPrice).toBe(200);
        });

        it('should handle units correctly', () => {
            const item = new OfferItem({
                price: 10,
                unit: 'case_6',
                quantity: 1
            });

            expect(item.pricePerBottle).toBe(10);
            expect(item.pricePerUnit).toBe(60); // 10 * 6
            expect(item.totalPrice).toBeCloseTo(75.3);
        });

        it('should handle quantity correctly', () => {
            const item = new OfferItem({
                price: 10,
                unit: 'bottle',
                quantity: 5
            });
            // Net unit: 10
            // VAT: 2.55
            // Gross Unit: 12.55
            // Total (5x): 62.75

            expect(item.pricePerUnit).toBe(10);
            expect(item.totalPrice).toBe(62.75);
        });
    });

    describe('Immutability', () => {
        it('should be frozen', () => {
            const item = new OfferItem({ price: 100 });
            expect(Object.isFrozen(item)).toBe(true);
        });

        it('should return new instance on update', () => {
            const item1 = new OfferItem({ price: 100 });
            const item2 = item1.update({ price: 200 });

            expect(item1.price).toBe(100);
            expect(item2.price).toBe(200);
            expect(item1).not.toBe(item2);
        });

        it('should update customer price (reverse calc) immutably', () => {
            const item = new OfferItem({ price: 100, vatRate: 0 });
            // Target 200. Cost 100.
            // Gross needed = 100. 
            // Margin = (100 / 200) * 100 = 50%

            const updated = item.updateCustomerPrice(200);

            expect(updated.customerPrice).toBe(200);
            expect(updated.margin).toBe(50);
            expect(item.margin).toBe(0); // Original untouched
        });
    });

    describe('Serialization', () => {
        it('toConfig should return clean config', () => {
            const config = {
                price: 100,
                id: 'test-id'
            };
            const item = new OfferItem(config);
            const exported = item.toConfig();

            expect(exported.price).toBe(100);
            expect(exported.id).toBe('test-id');
        });

        it('toJSON should include calculated fields', () => {
            const item = new OfferItem({ price: 100 });
            const json = item.toJSON();

            expect(json.price).toBe(100);
            expect(json.customerPrice).toBeDefined();
        });
    });
});
