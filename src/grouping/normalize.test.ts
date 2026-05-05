import { describe, it, expect } from 'vitest';
import { normalizeCustomGrouping, validateCategoryName } from './normalize.js';
import type { CustomCategory } from './types.js';

describe('normalizeCustomGrouping', () => {
    it('returns the same array reference when nothing changes', () => {
        const cats: CustomCategory[] = [
            { id: 'c1', name: 'A', itemIds: ['i1', 'i2'] },
        ];
        const result = normalizeCustomGrouping(cats, new Set(['i1', 'i2']));
        expect(result).toBe(cats);
    });

    it('drops itemIds for items no longer present', () => {
        const cats: CustomCategory[] = [
            { id: 'c1', name: 'A', itemIds: ['i1', 'i2', 'gone'] },
            { id: 'c2', name: 'B', itemIds: ['i3'] },
        ];
        const result = normalizeCustomGrouping(cats, new Set(['i1', 'i2', 'i3']));
        expect(result[0]?.itemIds).toEqual(['i1', 'i2']);
        expect(result[1]?.itemIds).toEqual(['i3']);
    });

    it('preserves category metadata when filtering', () => {
        const cats: CustomCategory[] = [
            { id: 'c1', name: 'A', itemIds: ['gone'] },
        ];
        const result = normalizeCustomGrouping(cats, new Set());
        expect(result[0]?.id).toBe('c1');
        expect(result[0]?.name).toBe('A');
        expect(result[0]?.itemIds).toEqual([]);
    });
});

describe('validateCategoryName', () => {
    it('rejects empty / whitespace-only names', () => {
        expect(validateCategoryName('', [], [])).toEqual({ ok: false, reason: 'empty' });
        expect(validateCategoryName('   ', [], [])).toEqual({ ok: false, reason: 'empty' });
    });

    it('rejects reserved names case-insensitively', () => {
        expect(validateCategoryName('Other', [], ['Other', 'Andere'])).toEqual({
            ok: false,
            reason: 'reserved',
        });
        expect(validateCategoryName('andere', [], ['Other', 'Andere'])).toEqual({
            ok: false,
            reason: 'reserved',
        });
    });

    it('rejects duplicate names case-insensitively', () => {
        expect(validateCategoryName('French', ['french'], [])).toEqual({
            ok: false,
            reason: 'duplicate',
        });
    });

    it('reserved beats duplicate when both apply', () => {
        // Reserved is checked first by design — typically reserved names aren't duplicates anyway.
        expect(validateCategoryName('Other', ['Other'], ['Other'])).toEqual({
            ok: false,
            reason: 'reserved',
        });
    });

    it('accepts valid names', () => {
        expect(validateCategoryName('French Reds', ['Italian'], ['Other'])).toEqual({ ok: true });
    });
});
