import { describe, it, expect } from 'vitest';
import { OfferItem } from '../OfferItem.js';
import { detectWineType } from './wineType.js';

const itemWithType = (type: string | undefined) =>
    new OfferItem({ price: 10, data: type === undefined ? {} : { type } });

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
});
