interface PourVolume {
    volume: number;
    price: number;
    name?: string;
}
interface ItemConfig {
    price: number;
    discount?: number | undefined;
    margin?: number | undefined;
    unit?: string | undefined;
    quantity?: number | undefined;
    vatRate?: number | undefined;
    tags?: string[] | undefined;
    id?: string | undefined;
    gross?: number | undefined;
    customerPrice?: number | undefined;
    pricePerBottle?: number | undefined;
    glassPrice?: number | undefined;
    pourVolumes?: PourVolume[] | undefined;
    availableUnits?: string[] | undefined;
    data?: Record<string, any> | undefined;
}
interface OfferTotals {
    totalPrice: number;
    totalSaved: number;
}

declare class OfferItem {
    readonly id: string;
    readonly price: number;
    readonly discount: number;
    readonly margin: number;
    readonly unit: string;
    readonly quantity: number;
    readonly vatRate: number;
    readonly tags: string[];
    readonly availableUnits: string[];
    readonly glassPrice: number | undefined;
    readonly pourVolumes: readonly PourVolume[];
    readonly data: Record<string, any>;
    readonly pricePerBottle: number;
    readonly pricePerUnit: number;
    readonly gross: number;
    readonly vatAmount: number;
    readonly customerPrice: number;
    readonly totalPrice: number;
    constructor(config: ItemConfig);
    update(fields: Partial<ItemConfig>): OfferItem;
    roundCustomerPrice(step?: number): OfferItem;
    roundGlassPrice(step?: number): OfferItem;
    roundPourVolumePrices(step?: number): OfferItem;
    /** Set or update a pour volume. If volume exists, update price/name. If not, add it. */
    setPourVolume(pv: PourVolume): OfferItem;
    /** Remove a pour volume by ml value */
    removePourVolume(volume: number): OfferItem;
    /** Remove all pour volumes */
    clearPourVolumes(): OfferItem;
    toConfig(): ItemConfig;
    toJSON(): {
        pricePerUnit: number;
        vatAmount: number;
        totalPrice: number;
        price: number;
        discount?: number | undefined;
        margin?: number | undefined;
        unit?: string | undefined;
        quantity?: number | undefined;
        vatRate?: number | undefined;
        tags?: string[] | undefined;
        id?: string | undefined;
        gross?: number | undefined;
        customerPrice?: number | undefined;
        pricePerBottle?: number | undefined;
        glassPrice?: number | undefined;
        pourVolumes?: PourVolume[] | undefined;
        availableUnits?: string[] | undefined;
        data?: Record<string, any> | undefined;
    };
    /**
     * Create an OfferItem from a wine object.
     * Use overrides to provide custom logic like company-specific unit defaults.
     */
    static fromWine(wine: any, overrides?: Partial<ItemConfig>): OfferItem;
}

type GroupingMode = 'type' | 'country' | 'strategy' | 'custom';
interface FilterRule {
    type: string;
    key?: string | number | undefined;
    exclude?: boolean | undefined;
    range?: [number | null, number | null] | undefined;
}
interface CustomCategory {
    id: string;
    name: string;
    itemIds: string[];
}
interface StrategyCategory {
    id: string;
    name: string;
    filters: FilterRule[];
}
interface SavedStrategy {
    id: string;
    name: string;
    categories: StrategyCategory[];
}
interface GroupingConfig {
    mode: GroupingMode;
    strategyId?: string | undefined;
    customCategories?: CustomCategory[] | undefined;
}
interface GroupedSection {
    value: string;
    items: readonly OfferItem[];
    isOther?: boolean;
    isCustom?: boolean;
    custom?: CustomCategory;
    strategyCategory?: StrategyCategory;
    strategyMissing?: boolean;
}
declare const OTHER_SECTION_VALUE = "__other__";
declare const STRATEGY_MISSING_VALUE = "__strategy_missing__";
/** Rendering order for built-in 'type' mode. */
declare const WINE_TYPE_KEYS: readonly ["sparkling", "white", "rose", "red", "fortified", "dessert"];
type WineTypeKey = typeof WINE_TYPE_KEYS[number];

interface OfferConfig {
    id?: string;
    title?: string;
    items?: readonly OfferItem[];
    menu?: any;
    data?: Record<string, any>;
}
declare class Offer {
    readonly id: string;
    readonly title: string;
    readonly items: readonly OfferItem[];
    readonly menu: any | null;
    readonly data: Record<string, any>;
    readonly totals: OfferTotals;
    constructor(config?: OfferConfig);
    private _calculateGrandTotals;
    private _getMultiplier;
    updateTitle(title: string): Offer;
    setMenu(menu: any): Offer;
    /**
     * Add items to the offer.
     * Converts raw data to OfferItem instances automatically.
     */
    addItems(configs: ItemConfig[]): Offer;
    /**
     * Remove items by ID
     */
    removeItems(ids: string[]): Offer;
    /**
     * Updates a specific item.
     * Uses the immutable update pattern of OfferItem.
     */
    updateItem(itemId: string, changes: Partial<ItemConfig> | ((item: OfferItem) => OfferItem)): Offer;
    /**
     * Replaces an old item with a new one (Swap)
     */
    swapItem(oldId: string, newConfig: ItemConfig): Offer;
    /**
     * Bulk update field across multiple items
     */
    bulkUpdateField(ids: string[] | undefined, field: keyof ItemConfig, value: any): Offer;
    setMargin(value: number, ids?: string[]): Offer;
    setGross(value: number, ids?: string[]): Offer;
    setDiscount(value: number, ids?: string[]): Offer;
    setQuantity(value: number, ids?: string[]): Offer;
    setVatRate(value: number, ids?: string[]): Offer;
    setPourVolume(pv: PourVolume, ids?: string[]): Offer;
    setGlassPrice(value: number, ids?: string[]): Offer;
    roundCustomerPrices(step?: number, ids?: string[]): Offer;
    roundGlassPrices(step?: number, ids?: string[]): Offer;
    roundPourVolumePrices(step?: number, ids?: string[]): Offer;
    setUnit(unit: string, ids?: string[]): Offer;
    private _withGrouping;
    private _grouping;
    private _customCategories;
    /** Replace (or clear) the grouping config on offer.data. */
    setGrouping(grouping: GroupingConfig | null): Offer;
    /** Switch to custom mode, seeding with the provided categories (snapshot from current grouping). */
    enterCustomMode(initialCategories: CustomCategory[]): Offer;
    /** Append a new custom category. Throws on validation failure. */
    addCustomCategory(name: string, opts?: {
        reserved?: readonly string[];
    }): Offer;
    /** Rename a custom category. Throws on validation failure. */
    renameCustomCategory(id: string, name: string, opts?: {
        reserved?: readonly string[];
    }): Offer;
    removeCustomCategory(id: string): Offer;
    /** Reorder existing categories by id. Unknown ids are ignored; missing ids retain their position at the end. */
    reorderCustomCategories(orderedIds: string[]): Offer;
    /**
     * Move an item to a category. Pass null to remove from all categories
     * (item then renders in the synthetic "Other" section).
     */
    moveItemToCategory(itemId: string, categoryId: string | null): Offer;
    /**
     * Drop itemIds in custom categories that no longer reference live items.
     * Safe to call when not in custom mode (no-op).
     */
    normalizeCustomGrouping(): Offer;
    /**
     * Serialize for API storage
     */
    toJSON(): {
        id: string;
        title: string;
        menu: any;
        items: {
            pricePerUnit: number;
            vatAmount: number;
            totalPrice: number;
            price: number;
            discount?: number | undefined;
            margin?: number | undefined;
            unit?: string | undefined;
            quantity?: number | undefined;
            vatRate?: number | undefined;
            tags?: string[] | undefined;
            id?: string | undefined;
            gross?: number | undefined;
            customerPrice?: number | undefined;
            pricePerBottle?: number | undefined;
            glassPrice?: number | undefined;
            pourVolumes?: PourVolume[] | undefined;
            availableUnits?: string[] | undefined;
            data?: Record<string, any> | undefined;
        }[];
        totals: OfferTotals;
        data: Record<string, any>;
    };
}

interface GroupOptions {
    savedStrategies?: SavedStrategy[];
}
/**
 * Pure grouping derivation. Never mutates inputs.
 * Returns sections in display order; "Other" pinned to the end when present.
 */
declare function groupItems(items: readonly OfferItem[], grouping: GroupingConfig, options?: GroupOptions): GroupedSection[];

/**
 * Evaluate a set of filter rules against an item.
 * Semantics mirror src/api/utils/filterBuilder.js:
 *   - rules of the same `type` combine with OR (any include matches; any exclude disqualifies)
 *   - rule groups of different types combine with AND
 */
declare function matchesRules(item: OfferItem, rules: FilterRule[]): boolean;

/**
 * Detect the canonical wine-type bucket for an item.
 * Returns null when no key matches (consumer routes to OTHER_SECTION_VALUE).
 */
declare function detectWineType(item: OfferItem): WineTypeKey | null;

/**
 * Drop itemIds that no longer reference live items.
 * Returns the original array reference if nothing changed (allows cheap === checks).
 */
declare function normalizeCustomGrouping(categories: readonly CustomCategory[], liveItemIds: ReadonlySet<string>): CustomCategory[];
type CategoryNameValidation = {
    ok: true;
} | {
    ok: false;
    reason: 'empty' | 'duplicate' | 'reserved';
};
/**
 * Validate a proposed custom-category name.
 * - Empty / whitespace-only → 'empty'
 * - Matches an existing name (case-insensitive, trimmed) → 'duplicate'
 * - Matches any reserved name (case-insensitive, trimmed) → 'reserved'
 *   (The consumer supplies translations of "Other" from every locale.)
 */
declare function validateCategoryName(name: string, existing: readonly string[], reserved: readonly string[]): CategoryNameValidation;

export { type CategoryNameValidation, type CustomCategory, type FilterRule, type GroupedSection, type GroupingConfig, type GroupingMode, type ItemConfig, OTHER_SECTION_VALUE, Offer, OfferItem, type PourVolume, STRATEGY_MISSING_VALUE, type SavedStrategy, type StrategyCategory, WINE_TYPE_KEYS, type WineTypeKey, detectWineType, groupItems, matchesRules, normalizeCustomGrouping, validateCategoryName };
