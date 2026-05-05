import { describe, it, expect } from 'vitest';
import { OfferItem } from '../OfferItem.js';
import { matchesRules } from './matchesRules.js';

const wine = (data: Record<string, unknown>, price = 100) =>
    new OfferItem({ price, data });

describe('matchesRules', () => {
    it('empty rule list matches everything', () => {
        expect(matchesRules(wine({ country: 'France' }), [])).toBe(true);
    });

    it('matches by country (case-insensitive)', () => {
        const item = wine({ country: 'France' });
        expect(matchesRules(item, [{ type: 'country', key: 'france' }])).toBe(true);
        expect(matchesRules(item, [{ type: 'country', key: 'FRANCE' }])).toBe(true);
        expect(matchesRules(item, [{ type: 'country', key: 'italy' }])).toBe(false);
    });

    it('matches region case-sensitively', () => {
        const item = wine({ region: 'Burgundy' });
        expect(matchesRules(item, [{ type: 'region', key: 'Burgundy' }])).toBe(true);
        expect(matchesRules(item, [{ type: 'region', key: 'burgundy' }])).toBe(false);
    });

    it('matches type substring (handles comma lists)', () => {
        const sparkling = wine({ type: 'white, sparkling' });
        expect(matchesRules(sparkling, [{ type: 'types', key: 'sparkling' }])).toBe(true);
        expect(matchesRules(sparkling, [{ type: 'types', key: 'white' }])).toBe(true);
        expect(matchesRules(sparkling, [{ type: 'types', key: 'red' }])).toBe(false);
    });

    it('matches array fields like grapes', () => {
        const item = wine({ grapes: ['Pinot Noir', 'Chardonnay'] });
        expect(matchesRules(item, [{ type: 'grapes', key: 'Pinot Noir' }])).toBe(true);
        expect(matchesRules(item, [{ type: 'grapes', key: 'pinot noir' }])).toBe(true);
        expect(matchesRules(item, [{ type: 'grapes', key: 'Merlot' }])).toBe(false);
    });

    it('matches numeric range on price', () => {
        const item = wine({}, 50);
        expect(matchesRules(item, [{ type: 'price', range: [10, 100] }])).toBe(true);
        expect(matchesRules(item, [{ type: 'price', range: [60, 100] }])).toBe(false);
        expect(matchesRules(item, [{ type: 'price', range: [10, 40] }])).toBe(false);
        // null bounds are open-ended
        expect(matchesRules(item, [{ type: 'price', range: [null, 100] }])).toBe(true);
        expect(matchesRules(item, [{ type: 'price', range: [10, null] }])).toBe(true);
    });

    it('AND across different rule types', () => {
        const item = wine({ country: 'France', type: 'white' });
        expect(matchesRules(item, [
            { type: 'country', key: 'france' },
            { type: 'types', key: 'white' },
        ])).toBe(true);
        expect(matchesRules(item, [
            { type: 'country', key: 'france' },
            { type: 'types', key: 'red' },
        ])).toBe(false);
    });

    it('OR within the same rule type', () => {
        const french = wine({ country: 'France' });
        const italian = wine({ country: 'Italy' });
        const german = wine({ country: 'Germany' });
        const rules = [
            { type: 'country', key: 'france' },
            { type: 'country', key: 'italy' },
        ];
        expect(matchesRules(french, rules)).toBe(true);
        expect(matchesRules(italian, rules)).toBe(true);
        expect(matchesRules(german, rules)).toBe(false);
    });

    it('exclude rules invert', () => {
        const french = wine({ country: 'France' });
        const italian = wine({ country: 'Italy' });
        const rules = [{ type: 'country', key: 'france', exclude: true }];
        expect(matchesRules(french, rules)).toBe(false);
        expect(matchesRules(italian, rules)).toBe(true);
    });

    it('returns false when required field is missing', () => {
        const item = wine({});
        expect(matchesRules(item, [{ type: 'country', key: 'france' }])).toBe(false);
    });
});
