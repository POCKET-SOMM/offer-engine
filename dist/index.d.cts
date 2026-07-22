declare const OFFER_STATUSES: readonly ["draft", "sent", "accepted"];
type OfferStatus = (typeof OFFER_STATUSES)[number];
declare const DEFAULT_OFFER_STATUS: OfferStatus;
declare const SUMMARY_THUMBNAIL_LIMIT = 8;
declare const SUMMARY_GROUP_THUMBNAIL_LIMIT = 3;

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

interface PourVolume {
    volume: number;
    price: number;
    name?: string;
}
interface OfferThumbnail {
    imgUrl?: string;
    title?: string;
}
interface OfferSummaryGroup {
    value: string;
    /** Display name for custom categories; absent for built-in type/country
     *  groups, whose `value` is a key the consumer localizes itself. */
    label?: string;
    count: number;
    thumbnails: OfferThumbnail[];
}
interface OfferSummary {
    thumbnails: OfferThumbnail[];
    /** Grouped preview reflecting the offer's own grouping config. */
    groups: OfferSummaryGroup[];
    /** The mode `groups` was built with — 'type' when grouping is unset or is a
     *  strategy (see Offer.toSummary). */
    groupingMode: GroupingMode;
    wineCount: number;
    status: OfferStatus;
    /** Titles of all attached menus, in order. Empty when no menu is attached. */
    menuTitles: string[];
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

/** Fields an offer's items can be ordered by. */
type SortField = 'name' | 'price' | 'quantity' | 'vintage';
type SortDirection = 'asc' | 'desc';
/** The whole sort state: what we order by, and in which direction. */
interface SortConfig {
    field: SortField;
    dir: SortDirection;
}
declare const DEFAULT_SORT: SortConfig;
/**
 * Pure, stable-ish ordering of offer items. Never mutates the input — always
 * returns a new array. An unknown field is a no-op (items are returned in their
 * existing order) so a stale persisted sort can never throw or drop items.
 */
declare function sortItems(items?: readonly OfferItem[], sort?: SortConfig): OfferItem[];

interface OfferConfig {
    id?: string;
    title?: string;
    items?: readonly OfferItem[];
    /** Canonical multi-menu store. Each entry is an opaque menu object (the math
     *  engine never inspects it — pairing lives in the consumer app). */
    menus?: readonly any[];
    /** @deprecated Legacy single menu. Wrapped into `menus` on construction so
     *  older stored blobs and callers keep working. Prefer `menus`. */
    menu?: any;
    data?: Record<string, any>;
}
declare class Offer {
    readonly id: string;
    readonly title: string;
    readonly items: readonly OfferItem[];
    readonly menus: readonly any[];
    readonly data: Record<string, any>;
    readonly totals: OfferTotals;
    constructor(config?: OfferConfig);
    /** Back-compat accessor: the first attached menu, or null. A prototype
     *  getter (not an own field), so `{ ...this }` spreads `menus` rather than a
     *  stale `menu` — keeps single-menu consumers working through the migration. */
    get menu(): any | null;
    private _calculateGrandTotals;
    private _getMultiplier;
    updateTitle(title: string): Offer;
    /** Replace the full set of attached menus. */
    setMenus(menus: any[]): Offer;
    /** Append one menu. */
    addMenu(menu: any): Offer;
    /** Remove a menu by id. No-op if the id isn't attached. */
    removeMenu(menuId: string): Offer;
    /** @deprecated Single-menu shim — replaces all menus with `[menu]` (or clears
     *  them when null). Prefer setMenus / addMenu / removeMenu. */
    setMenu(menu: any): Offer;
    /** Manual lifecycle status. Defaults to 'draft' when unset. */
    get status(): OfferStatus;
    /** Set the manual lifecycle status immutably. Throws on an unknown value. */
    setStatus(status: OfferStatus): Offer;
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
    /** The offer's saved item ordering, if one has been set. */
    get sort(): SortConfig | undefined;
    /** Replace (or clear) the sort config on offer.data. */
    setSort(sort: SortConfig | null): Offer;
    /** Items in the offer's saved sort order — insertion order when unset. */
    get sortedItems(): readonly OfferItem[];
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
     * Compact projection for list views: a flat capped thumbnail preview, the
     * same wines grouped the way the offer itself is grouped, the total wine
     * count, and the lifecycle status. Embedded into toJSON().summary so a
     * stored offer carries its own brief representation — list endpoints can
     * surface `summary` without loading every item.
     *
     * Item order follows the offer's saved `sort` (insertion order when unset).
     *
     * NOTE: `strategy` grouping is previewed as `type`. A saved strategy's
     * definition (its categories and filter rules) lives in the consumer app,
     * not on the offer, so it cannot be resolved here. Manual (`custom`)
     * grouping is fully self-contained and IS honoured.
     */
    toSummary(): OfferSummary;
    /**
     * Serialize for API storage. `summary` is a top-level sibling of `items`
     * (not nested in `data`) so consumers projecting a brief list payload read
     * it straight off the stored record.
     */
    toJSON(): {
        id: string;
        title: string;
        menus: readonly any[];
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
        summary: OfferSummary;
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
 *
 * Accepts three real-world input shapes on `item.data`:
 *   - `type: string`          — legacy/normalized form
 *   - `type: string[]`        — catalog wines (Qdrant search results)
 *   - `wine_type: string`     — wine-card items (parsed from menu uploads),
 *                               used as a fallback when `type` is absent
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

export { type CategoryNameValidation, type CustomCategory, DEFAULT_OFFER_STATUS, DEFAULT_SORT, type FilterRule, type GroupedSection, type GroupingConfig, type GroupingMode, type ItemConfig, OFFER_STATUSES, OTHER_SECTION_VALUE, Offer, OfferItem, type OfferStatus, type OfferSummary, type OfferSummaryGroup, type OfferThumbnail, type PourVolume, STRATEGY_MISSING_VALUE, SUMMARY_GROUP_THUMBNAIL_LIMIT, SUMMARY_THUMBNAIL_LIMIT, type SavedStrategy, type SortConfig, type SortDirection, type SortField, type StrategyCategory, WINE_TYPE_KEYS, type WineTypeKey, detectWineType, groupItems, matchesRules, normalizeCustomGrouping, sortItems, validateCategoryName };
