import type { OfferItem } from '../OfferItem.js';
import { matchesRules } from './matchesRules.js';
import { detectWineType } from './wineType.js';
import {
    OTHER_SECTION_VALUE,
    STRATEGY_MISSING_VALUE,
    WINE_TYPE_KEYS,
    type CustomCategory,
    type GroupedSection,
    type GroupingConfig,
    type SavedStrategy,
} from './types.js';

interface GroupOptions {
    savedStrategies?: SavedStrategy[];
}

function buildOtherSection(items: readonly OfferItem[]): GroupedSection {
    return { value: OTHER_SECTION_VALUE, items, isOther: true };
}

function groupByType(items: readonly OfferItem[]): GroupedSection[] {
    const buckets = new Map<string, OfferItem[]>();
    const other: OfferItem[] = [];

    for (const item of items) {
        const key = detectWineType(item);
        if (key === null) {
            other.push(item);
            continue;
        }
        const list = buckets.get(key) ?? [];
        list.push(item);
        buckets.set(key, list);
    }

    const sections: GroupedSection[] = [];
    for (const key of WINE_TYPE_KEYS) {
        const list = buckets.get(key);
        if (list && list.length > 0) sections.push({ value: key, items: list });
    }
    if (other.length > 0) sections.push(buildOtherSection(other));
    return sections;
}

function groupByCountry(items: readonly OfferItem[]): GroupedSection[] {
    const buckets = new Map<string, OfferItem[]>();
    const other: OfferItem[] = [];

    for (const item of items) {
        const country = item.data?.['country'];
        if (typeof country !== 'string' || country.trim() === '') {
            other.push(item);
            continue;
        }
        const list = buckets.get(country) ?? [];
        list.push(item);
        buckets.set(country, list);
    }

    const sections: GroupedSection[] = Array.from(buckets.entries())
        .sort((a, b) => {
            if (b[1].length !== a[1].length) return b[1].length - a[1].length;
            return a[0].localeCompare(b[0]);
        })
        .map(([value, list]) => ({ value, items: list }));

    if (other.length > 0) sections.push(buildOtherSection(other));
    return sections;
}

function groupByStrategy(
    items: readonly OfferItem[],
    strategyId: string | undefined,
    savedStrategies: SavedStrategy[]
): GroupedSection[] {
    const strategy = strategyId ? savedStrategies.find((s) => s.id === strategyId) : undefined;
    if (!strategy) {
        return [{ value: STRATEGY_MISSING_VALUE, items: [], strategyMissing: true }];
    }

    const buckets = new Map<string, OfferItem[]>();
    const other: OfferItem[] = [];

    for (const item of items) {
        let placed = false;
        for (const cat of strategy.categories) {
            if (matchesRules(item, cat.filters)) {
                const list = buckets.get(cat.id) ?? [];
                list.push(item);
                buckets.set(cat.id, list);
                placed = true;
                break;
            }
        }
        if (!placed) other.push(item);
    }

    const sections: GroupedSection[] = [];
    for (const cat of strategy.categories) {
        const list = buckets.get(cat.id);
        if (list && list.length > 0) sections.push({ value: cat.id, items: list, strategyCategory: cat });
    }
    if (other.length > 0) sections.push(buildOtherSection(other));
    return sections;
}

function groupByCustom(
    items: readonly OfferItem[],
    categories: CustomCategory[]
): GroupedSection[] {
    const byId = new Map(items.map((i) => [i.id, i]));
    const claimed = new Set<string>();
    const sections: GroupedSection[] = [];

    for (const cat of categories) {
        const list: OfferItem[] = [];
        for (const id of cat.itemIds) {
            const item = byId.get(id);
            if (item && !claimed.has(id)) {
                list.push(item);
                claimed.add(id);
            }
        }
        sections.push({ value: cat.id, items: list, isCustom: true, custom: cat });
    }

    const orphans = items.filter((i) => !claimed.has(i.id));
    if (orphans.length > 0) sections.push(buildOtherSection(orphans));
    return sections;
}

/**
 * Pure grouping derivation. Never mutates inputs.
 * Returns sections in display order; "Other" pinned to the end when present.
 */
export function groupItems(
    items: readonly OfferItem[],
    grouping: GroupingConfig,
    options: GroupOptions = {}
): GroupedSection[] {
    switch (grouping.mode) {
        case 'type':
            return groupByType(items);
        case 'country':
            return groupByCountry(items);
        case 'strategy':
            return groupByStrategy(items, grouping.strategyId, options.savedStrategies ?? []);
        case 'custom':
            return groupByCustom(items, grouping.customCategories ?? []);
        default:
            return groupByType(items);
    }
}
