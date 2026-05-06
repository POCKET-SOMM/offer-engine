import { describe, it, expect } from 'vitest';
import { OfferItem } from '../OfferItem.js';
import { detectWineType } from './wineType.js';

const itemWithType = (type: string | undefined) =>
    new OfferItem({ price: 10, data: type === undefined ? {} : { type } });

const itemWithData = (data: Record<string, unknown>) =>
    new OfferItem({ price: 10, data });

describe('detectWineType', () => {
    it('returns null for missing or empty type', () => {
        expect(detectWineType(itemWithType(undefined))).toBeNull();
        expect(detectWineType(itemWithType(''))).toBeNull();
    });

    it('detects each single-key type', () => {
        expect(detectWineType(itemWithType('red'))).toBe('red');
        expect(detectWineType(itemWithType('white'))).toBe('white');
        expect(detectWineType(itemWithType('rose'))).toBe('rose');
        expect(detectWineType(itemWithType('sparkling'))).toBe('sparkling');
        expect(detectWineType(itemWithType('dessert'))).toBe('dessert');
        expect(detectWineType(itemWithType('fortified'))).toBe('fortified');
    });

    it('applies precedence: later in the precedence list wins', () => {
        // 'white, sparkling' → sparkling beats white
        expect(detectWineType(itemWithType('white, sparkling'))).toBe('sparkling');
        // 'red, fortified' → fortified beats red
        expect(detectWineType(itemWithType('red, fortified'))).toBe('fortified');
        // 'white, dessert' → dessert beats white
        expect(detectWineType(itemWithType('white, dessert'))).toBe('dessert');
    });

    it('is case-insensitive', () => {
        expect(detectWineType(itemWithType('RED'))).toBe('red');
        expect(detectWineType(itemWithType('White, Sparkling'))).toBe('sparkling');
    });

    it('returns null when no key is recognized', () => {
        expect(detectWineType(itemWithType('orange wine'))).toBeNull();
    });

    it('accepts type as a string array (catalog wine shape)', () => {
        expect(detectWineType(itemWithData({ type: ['red'] }))).toBe('red');
        expect(detectWineType(itemWithData({ type: ['White'] }))).toBe('white');
        expect(detectWineType(itemWithData({ type: ['white', 'sparkling'] }))).toBe('sparkling');
    });

    it('returns null for empty or non-string array entries', () => {
        expect(detectWineType(itemWithData({ type: [] }))).toBeNull();
        expect(detectWineType(itemWithData({ type: [null, undefined] as unknown as string[] }))).toBeNull();
    });

    it('falls back to wine_type when type is absent (wine-card shape)', () => {
        expect(detectWineType(itemWithData({ wine_type: 'rose' }))).toBe('rose');
        expect(detectWineType(itemWithData({ wine_type: 'Sparkling' }))).toBe('sparkling');
    });

    it('prefers type over wine_type when both are present', () => {
        expect(detectWineType(itemWithData({ type: 'red', wine_type: 'white' }))).toBe('red');
        expect(detectWineType(itemWithData({ type: ['red'], wine_type: 'white' }))).toBe('red');
    });

    it('returns null when neither type nor wine_type is present', () => {
        expect(detectWineType(itemWithData({}))).toBeNull();
    });
});
