import type { OfferItem } from '../OfferItem.js';

export type GroupingMode = 'type' | 'country' | 'strategy' | 'custom';

export interface FilterRule {
    type: string;
    key?: string | number | undefined;
    exclude?: boolean | undefined;
    range?: [number | null, number | null] | undefined;
}

export interface CustomCategory {
    id: string;
    name: string;
    itemIds: string[];
}

export interface StrategyCategory {
    id: string;
    name: string;
    filters: FilterRule[];
}

export interface SavedStrategy {
    id: string;
    name: string;
    categories: StrategyCategory[];
}

export interface GroupingConfig {
    mode: GroupingMode;
    strategyId?: string | undefined;
    customCategories?: CustomCategory[] | undefined;
}

export interface GroupedSection {
    value: string;
    items: readonly OfferItem[];
    isOther?: boolean;
    isCustom?: boolean;
    custom?: CustomCategory;
    strategyCategory?: StrategyCategory;
    strategyMissing?: boolean;
}

export const OTHER_SECTION_VALUE = '__other__';
export const STRATEGY_MISSING_VALUE = '__strategy_missing__';

/** Rendering order for built-in 'type' mode. */
export const WINE_TYPE_KEYS = ['sparkling', 'white', 'rose', 'red', 'fortified', 'dessert'] as const;
export type WineTypeKey = typeof WINE_TYPE_KEYS[number];
