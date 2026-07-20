import { describe, it, expect } from 'vitest';
import { OfferItem } from '../OfferItem.js';
import { sortItems, DEFAULT_SORT } from './sortItems.js';

const item = (id: string, price: number, extra: Record<string, any> = {}) =>
    new OfferItem({ id, price, ...extra });

const ids = (items: readonly OfferItem[]) => items.map((i) => i.id);

describe('sortItems', () => {
    it('defaults to price ascending', () => {
        const items = [item('a', 30), item('b', 10), item('c', 20)];
        expect(ids(sortItems(items))).toEqual(['b', 'c', 'a']);
        expect(DEFAULT_SORT).toEqual({ field: 'price', dir: 'asc' });
    });

    it('sorts by price descending', () => {
        const items = [item('a', 30), item('b', 10), item('c', 20)];
        expect(ids(sortItems(items, { field: 'price', dir: 'desc' }))).toEqual(['a', 'c', 'b']);
    });

    it('sorts by name case-insensitively', () => {
        const items = [
            item('a', 10, { data: { title: 'zinfandel' } }),
            item('b', 10, { data: { title: 'Amarone' } }),
            item('c', 10, { data: { title: 'merlot' } }),
        ];
        expect(ids(sortItems(items, { field: 'name', dir: 'asc' }))).toEqual(['b', 'c', 'a']);
    });

    it('sorts by quantity', () => {
        const items = [
            item('a', 10, { quantity: 5 }),
            item('b', 10, { quantity: 1 }),
            item('c', 10, { quantity: 3 }),
        ];
        expect(ids(sortItems(items, { field: 'quantity', dir: 'asc' }))).toEqual(['b', 'c', 'a']);
    });

    it('sorts by vintage, falling back to `year`', () => {
        const items = [
            item('a', 10, { data: { vintage: 2018 } }),
            item('b', 10, { data: { year: 2010 } }),
            item('c', 10, { data: { vintage: 2015 } }),
        ];
        expect(ids(sortItems(items, { field: 'vintage', dir: 'asc' }))).toEqual(['b', 'c', 'a']);
    });

    it('treats a missing vintage as 0 rather than dropping the item', () => {
        const items = [item('a', 10, { data: { vintage: 2018 } }), item('b', 10)];
        const sorted = sortItems(items, { field: 'vintage', dir: 'asc' });
        expect(ids(sorted)).toEqual(['b', 'a']);
        expect(sorted).toHaveLength(2);
    });

    it('leaves order untouched for an unknown field and never throws', () => {
        const items = [item('a', 30), item('b', 10)];
        const sorted = sortItems(items, { field: 'nope' as any, dir: 'asc' });
        expect(ids(sorted)).toEqual(['a', 'b']);
    });

    it('never mutates the input array', () => {
        const items = [item('a', 30), item('b', 10)];
        const before = ids(items);
        sortItems(items, { field: 'price', dir: 'asc' });
        expect(ids(items)).toEqual(before);
    });

    it('handles an empty list', () => {
        expect(sortItems([])).toEqual([]);
        expect(sortItems()).toEqual([]);
    });
});
