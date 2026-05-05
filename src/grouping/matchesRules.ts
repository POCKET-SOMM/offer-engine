import type { OfferItem } from '../OfferItem.js';
import type { FilterRule } from './types.js';

type FieldExtractor = (item: OfferItem) => unknown;

/**
 * Maps a rule.type to the value extracted from an OfferItem.
 * The engine is wine-domain-aware here by design (see plan).
 * Adding a new filterable field = add an entry here.
 */
const FIELD_EXTRACTORS: Record<string, FieldExtractor> = {
    country: (item) => item.data?.['country'],
    region: (item) => item.data?.['region'],
    regions: (item) => item.data?.['regions'],
    grapes: (item) => item.data?.['grapes'],
    producer: (item) => item.data?.['producer'],
    year: (item) => item.data?.['year'],
    world: (item) => item.data?.['world'],
    supplier: (item) => item.data?.['supplier'],
    closure: (item) => item.data?.['closure'],
    packaging: (item) => item.data?.['packaging'],
    types: (item) => item.data?.['type'],
    price: (item) => item.price,
    alcohol: (item) => item.data?.['alcohol'],
    volume: (item) => item.data?.['volume'],
    stock: (item) => item.data?.['stockLevel'] ?? item.data?.['stock'],
};

const REGION_TYPES = new Set(['region', 'regions']);

function extract(item: OfferItem, type: string): unknown {
    const fn = FIELD_EXTRACTORS[type];
    return fn ? fn(item) : item.data?.[type];
}

function matchesKey(value: unknown, key: string | number, type: string): boolean {
    if (value === undefined || value === null) return false;

    if (Array.isArray(value)) {
        const lowered = typeof key === 'string' ? key.toLowerCase() : key;
        return value.some((v) => {
            if (typeof v === 'string' && typeof key === 'string') {
                return REGION_TYPES.has(type) ? v === key : v.toLowerCase() === lowered;
            }
            return v === key;
        });
    }

    if (typeof value === 'string' && typeof key === 'string') {
        if (REGION_TYPES.has(type)) return value === key;
        const v = value.toLowerCase();
        const k = key.toLowerCase();
        // 'types' field can be a comma-list like "white, sparkling"
        return type === 'types' ? v.includes(k) : v === k;
    }

    return value === key;
}

function matchesRange(value: unknown, range: [number | null, number | null]): boolean {
    if (typeof value !== 'number' || Number.isNaN(value)) return false;
    const [min, max] = range;
    if (min != null && value < min) return false;
    if (max != null && value > max) return false;
    return true;
}

function matchesSingleRule(item: OfferItem, rule: FilterRule): boolean {
    const value = extract(item, rule.type);
    if (rule.range) return matchesRange(value, rule.range);
    if (rule.key !== undefined) return matchesKey(value, rule.key, rule.type);
    return true;
}

/**
 * Evaluate a set of filter rules against an item.
 * Semantics mirror src/api/utils/filterBuilder.js:
 *   - rules of the same `type` combine with OR (any include matches; any exclude disqualifies)
 *   - rule groups of different types combine with AND
 */
export function matchesRules(item: OfferItem, rules: FilterRule[]): boolean {
    if (rules.length === 0) return true;

    const grouped = new Map<string, FilterRule[]>();
    for (const rule of rules) {
        const list = grouped.get(rule.type) ?? [];
        list.push(rule);
        grouped.set(rule.type, list);
    }

    for (const [, typeRules] of grouped) {
        const includes = typeRules.filter((r) => !r.exclude);
        const excludes = typeRules.filter((r) => r.exclude);

        if (includes.length > 0 && !includes.some((r) => matchesSingleRule(item, r))) return false;
        if (excludes.some((r) => matchesSingleRule(item, r))) return false;
    }
    return true;
}
