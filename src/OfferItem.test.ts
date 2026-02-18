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
            expect(item.totalPrice).toBe(100); // Net total
            expect(item.glassPrice).toBe(0);
            expect(item.availableUnits).toEqual(['bottle']);
        });

        it('should handle glassPrice provided in config', () => {
            const item = new OfferItem({
                price: 100,
                glassPrice: 15,
                availableUnits: ['bottle', 'case_6']
            });
            expect(item.glassPrice).toBe(15);
            expect(item.availableUnits).toEqual(['bottle', 'case_6']);
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
            expect(item.totalPrice).toBe(34.99); // Net total
        });

        it('should handle discount correctly', () => {
            const item = new OfferItem({
                price: 100,
                discount: 10,
                vatRate: 20
            });

            // Price per bottle: 100 * 0.9 = 90
            expect(item.price).toBe(100);
            expect(item.pricePerBottle).toBe(90);
            expect(item.vatAmount).toBe(18); // 90 * 0.2
            expect(item.customerPrice).toBe(108);
        });

        it('should handle reverse discount calculation correctly', () => {
            const item = new OfferItem({
                price: 100,
                discount: 0,
                vatRate: 20,
                quantity: 1
            });

            // set price per bottle to 90
            const updated = item.update({ pricePerBottle: 90 });
            expect(updated.pricePerBottle).toBe(90);
            expect(updated.discount).toBe(10);
        });

        it('should handle reverse gross calculation correctly', () => {
            const item = new OfferItem({
                price: 41.75,
                margin: 70,
                vatRate: 25.5,
                quantity: 1
            });

            // gross should be 97.42, vat should be 35.49, customer price should be 174.66
            expect(item.gross).toBe(97.42);
            expect(item.vatAmount).toBe(35.49);
            expect(item.customerPrice).toBe(174.66);

            // update gross to 100
            const updated = item.update({ gross: 100 });
            expect(updated.gross).toBe(100);
            // vat should be 36.15
            expect(updated.vatAmount).toBe(36.15);
            // customer price should be 177.90
            expect(updated.customerPrice).toBe(177.90);
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
            expect(item.totalPrice).toBe(60); // Net total
        });

        it('should handle quantity correctly', () => {
            const item = new OfferItem({
                price: 10,
                unit: 'bottle',
                quantity: 5
            });

            expect(item.pricePerUnit).toBe(10);
            expect(item.totalPrice).toBe(50); // Net total: 10 * 5
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

            const updated = item.update({ customerPrice: 200 });

            expect(updated.customerPrice).toBe(200);
            // Margin = (100 / 200) * 100 = 50%
            // Note: margin is rounded in results if derived, but we verify the exact target is kept
            expect(updated.margin).toBe(50);
            expect(item.margin).toBe(0); // Original untouched
        });
    });

    describe('Rounding', () => {
        it('should round customerPrice to closest whole number by default', () => {
            const item = new OfferItem({ price: 10, vatRate: 0, margin: 39 });
            // 10 / (1 - 0.39) = 16.3934... -> rounds to 16.39
            expect(item.customerPrice).toBe(16.39);

            const rounded = item.roundCustomerPrice();
            expect(rounded.customerPrice).toBe(16);
        });

        it('should round customerPrice to specific step (0.5)', () => {
            const item = new OfferItem({ price: 10, vatRate: 0, margin: 39 });
            // customerPrice: 16.39
            const rounded = item.roundCustomerPrice(0.5);
            expect(rounded.customerPrice).toBe(16.5);
        });

        it('should round customerPrice to specific step (0.1)', () => {
            const item = new OfferItem({ price: 10, vatRate: 0, margin: 39 });
            // customerPrice: 16.39
            const rounded = item.roundCustomerPrice(0.1);
            expect(rounded.customerPrice).toBe(16.4);
        });

        it('should round glassPrice', () => {
            const item = new OfferItem({ price: 10, glassPrice: 12.34 });
            const rounded = item.roundGlassPrice();
            expect(rounded.glassPrice).toBe(12);

            const roundedHalf = item.roundGlassPrice(0.5);
            expect(roundedHalf.glassPrice).toBe(12.5);
        });
    });

    describe('Priority Hierarchy & Drift Prevention', () => {
        it('should prioritized explicit fields over derived versions', () => {
            const item = new OfferItem({
                price: 100,
                customerPrice: 200,
                vatRate: 0
            });

            expect(item.customerPrice).toBe(200);
            expect(item.gross).toBe(100);
        });

        it('should prevent "discount drift" for specific edge cases (e.g., 19.89 @ 23% discount)', () => {
            // User example:
            // Price: 19.89
            // Discount: 23%
            // Resulting pricePerBottle: round(19.89 * 0.77) = round(15.3153) = 15.32
            // Reverse discount if calculated from 15.32: (1 - 15.32/19.89) * 100 = 22.97637... -> 22.98
            // The item should KEEP 23% as its discount field if it was set explicitly.

            let item = new OfferItem({
                price: 19.89,
                discount: 23,
                vatRate: 25.5
            });

            expect(item.discount).toBe(23);

            // Simulation of update that triggers re-serialization
            item = item.update({ quantity: 2 });
            expect(item.discount).toBe(23); // Should still be exactly 23

            // Simulation of full re-serialization
            const config = item.toConfig();
            const reCreated = new OfferItem(config);
            expect(reCreated.discount).toBe(23);
        });

        it('should prioritize gross over margin', () => {
            const item = new OfferItem({
                price: 100,
                margin: 10,
                gross: 50, // This should win
                vatRate: 0
            });

            expect(item.gross).toBe(50);
            expect(item.customerPrice).toBe(150);
        });

        it('should prevent drift after multiple updates and re-serializations', () => {
            // Set an exact customer price that doesn't align with a 2-decimal margin
            // Custom target: 146.37 (from previous example)
            // If we deriving from 70% margin, it's 146.37.
            // Let's pick a value that drifts normally:
            // Price: 41.75
            // Target Gross: 100
            // Margin = (100 / (41.75 + 100)) * 100 = 70.54673... -> rounds to 70.55
            // If we use 70.55 margin: 41.75 / (1 - 0.7055) - 41.75 = 100.016... -> 100.02

            let item = new OfferItem({
                price: 41.75,
                gross: 100,
                vatRate: 25.5
            });

            expect(item.gross).toBe(100);

            // Re-create from config (serialization simulation)
            item = new OfferItem(item.toConfig());
            expect(item.gross).toBe(100);

            // Update something unrelated
            item = item.update({ quantity: 10 });
            expect(item.gross).toBe(100); // Should still be exactly 100
        });

        it('should clear higher-priority locks when lower-priority fields are updated', () => {
            const item = new OfferItem({
                price: 100,
                customerPrice: 200,
                vatRate: 0
            });

            expect(item.customerPrice).toBe(200);

            // Now update margin (lower priority than customerPrice)
            // It should clear the customerPrice lock and recalculate from margin.
            const updated = item.update({ margin: 75 });

            // Cost 100, Margin 75% -> Sale Price = 100 / (1 - 0.75) = 400
            expect(updated.customerPrice).toBe(400);
        });
    });

    describe('Serialization', () => {
        it('toConfig should return accurate explicit fields', () => {
            const item = new OfferItem({
                price: 100,
                customerPrice: 200
            });
            const config = item.toConfig();

            expect(config.customerPrice).toBe(200);
            // Margin should be OMITTED because customerPrice is the source of truth
            expect(config.margin).toBeUndefined();
        });

        it('toJSON should include calculated fields', () => {
            const item = new OfferItem({ price: 100 });
            const json = item.toJSON();

            expect(json.price).toBe(100);
            expect(json.customerPrice).toBeDefined();
        });
    });
});
