import type { OfferItem } from '../OfferItem.js';

/** Fields an offer's items can be ordered by. */
export type SortField = 'name' | 'price' | 'quantity' | 'vintage';
export type SortDirection = 'asc' | 'desc';

/** The whole sort state: what we order by, and in which direction. */
export interface SortConfig {
    field: SortField;
    dir: SortDirection;
}

export const DEFAULT_SORT: SortConfig = { field: 'price', dir: 'asc' };

/**
 * Field → comparable value. `price` reads the net per-bottle price (what the
 * buyer actually pays), `vintage` falls back to `year` since wine payloads use
 * either. Anything unlisted leaves the order untouched.
 */
const getters: Record<SortField, (item: OfferItem) => string | number> = {
    name: (item) => String(item.data?.['title'] ?? '').toLowerCase(),
    price: (item) => item.pricePerBottle ?? 0,
    quantity: (item) => item.quantity ?? 0,
    vintage: (item) => Number(item.data?.['vintage'] ?? item.data?.['year']) || 0,
};

/**
 * Pure, stable-ish ordering of offer items. Never mutates the input — always
 * returns a new array. An unknown field is a no-op (items are returned in their
 * existing order) so a stale persisted sort can never throw or drop items.
 */
export function sortItems(
    items: readonly OfferItem[] = [],
    sort: SortConfig = DEFAULT_SORT
): OfferItem[] {
    const get = sort?.field ? getters[sort.field] : undefined;
    if (!get) return [...items];

    const sign = sort.dir === 'desc' ? -1 : 1;
    return [...items].sort((a, b) => {
        const av = get(a);
        const bv = get(b);
        if (typeof av === 'string' || typeof bv === 'string') {
            return sign * String(av).localeCompare(String(bv));
        }
        return sign * ((av as number) - (bv as number));
    });
}
