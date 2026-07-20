import {
    UNIT_MULTIPLIERS,
    OFFER_STATUSES,
    DEFAULT_OFFER_STATUS,
    SUMMARY_THUMBNAIL_LIMIT,
    SUMMARY_GROUP_THUMBNAIL_LIMIT,
    type OfferStatus,
} from './constants.js';
import { OfferItem } from './OfferItem.js';
import type { ItemConfig, OfferTotals, PourVolume, OfferSummary, OfferSummaryGroup, OfferThumbnail } from './types.js';
import { round } from './utils/math.js';
import { normalizeCustomGrouping, validateCategoryName } from './grouping/normalize.js';
import { groupItems } from './grouping/groupItems.js';
import type { CustomCategory, GroupingConfig, GroupingMode } from './grouping/types.js';
import { sortItems, type SortConfig } from './sorting/sortItems.js';

export interface OfferConfig {
    id?: string;
    title?: string;
    items?: readonly OfferItem[];
    menu?: any; // Generic as it's outside the math engine scope
    data?: Record<string, any>;
}

export class Offer {
    public readonly id: string;
    public readonly title: string;
    public readonly items: readonly OfferItem[];
    public readonly menu: any | null;
    public readonly data: Record<string, any>;

    // Computed Grand Totals
    public readonly totals: OfferTotals;

    constructor(config: OfferConfig = {}) {
        this.id = config.id || crypto.randomUUID();
        this.title = config.title || '';
        this.items = Object.freeze(config.items || []);
        this.menu = config.menu || null;
        this.data = config.data || {};

        // Calculate aggregate totals whenever an Offer is created
        this.totals = Object.freeze(this._calculateGrandTotals());

        Object.freeze(this);
    }

    private _calculateGrandTotals(): OfferTotals {
        return this.items.reduce(
            (acc, item) => {
                const multiplier = this._getMultiplier(item);
                const volume = item.quantity * multiplier;
                const savedOnItem = round((item.price - item.pricePerBottle) * volume);

                return {
                    totalPrice: round(acc.totalPrice + item.totalPrice),
                    totalSaved: round(acc.totalSaved + savedOnItem),
                };
            },
            { totalPrice: 0, totalSaved: 0 }
        );
    }

    private _getMultiplier(item: OfferItem): number {
        // Helper to ensure VAT is calculated across the correct volume if needed
        return UNIT_MULTIPLIERS[item.unit] || 1;
    }

    // --- Immutable Mutation Methods ---

    updateTitle(title: string): Offer {
        return new Offer({ ...this, title });
    }

    setMenu(menu: any): Offer {
        return new Offer({ ...this, menu });
    }

    // --- Status ---
    // A manual lifecycle stored on the data bag (like grouping), so it survives a
    // toJSON()/new Offer() round-trip without a dedicated config field.

    /** Manual lifecycle status. Defaults to 'draft' when unset. */
    get status(): OfferStatus {
        return (this.data?.['status'] as OfferStatus) ?? DEFAULT_OFFER_STATUS;
    }

    /** Set the manual lifecycle status immutably. Throws on an unknown value. */
    setStatus(status: OfferStatus): Offer {
        if (!OFFER_STATUSES.includes(status)) {
            throw new Error(`Invalid offer status: ${status}`);
        }
        return new Offer({ ...this, data: { ...this.data, status } });
    }

    /**
     * Add items to the offer. 
     * Converts raw data to OfferItem instances automatically.
     */
    addItems(configs: ItemConfig[]): Offer {
        const newItems = configs.map(c => new OfferItem(c));
        return new Offer({
            ...this,
            items: [...this.items, ...newItems]
        });
    }

    /**
     * Remove items by ID
     */
    removeItems(ids: string[]): Offer {
        return new Offer({
            ...this,
            items: this.items.filter(item => !ids.includes(item.id))
        });
    }

    /**
     * Updates a specific item. 
     * Uses the immutable update pattern of OfferItem.
     */
    updateItem(itemId: string, changes: Partial<ItemConfig> | ((item: OfferItem) => OfferItem)): Offer {
        const newItems = this.items.map(item => {
            if (item.id !== itemId) return item;

            if (typeof changes === 'function') {
                return changes(item);
            }
            return item.update(changes);
        });

        return new Offer({ ...this, items: newItems });
    }

    /**
     * Replaces an old item with a new one (Swap)
     */
    swapItem(oldId: string, newConfig: ItemConfig): Offer {
        const newItems = this.items.map(item =>
            item.id === oldId ? new OfferItem(newConfig) : item
        );
        return new Offer({ ...this, items: newItems });
    }

    /**
     * Bulk update field across multiple items
     */
    bulkUpdateField(ids: string[] | undefined, field: keyof ItemConfig, value: any): Offer {
        const newItems = this.items.map(item => {
            if (ids && !ids.includes(item.id)) return item;
            return item.update({ [field]: value });
        });
        return new Offer({ ...this, items: newItems });
    }

    setMargin(value: number, ids?: string[]): Offer {
        return this.bulkUpdateField(ids, 'margin', value);
    }

    setGross(value: number, ids?: string[]): Offer {
        return this.bulkUpdateField(ids, 'gross', value);
    }

    setDiscount(value: number, ids?: string[]): Offer {
        return this.bulkUpdateField(ids, 'discount', value);
    }

    setQuantity(value: number, ids?: string[]): Offer {
        return this.bulkUpdateField(ids, 'quantity', value);
    }

    setVatRate(value: number, ids?: string[]): Offer {
        return this.bulkUpdateField(ids, 'vatRate', value);
    }

    setPourVolume(pv: PourVolume, ids?: string[]): Offer {
        const newItems = this.items.map(item => {
            if (ids && !ids.includes(item.id)) return item;
            return item.setPourVolume(pv);
        });
        return new Offer({ ...this, items: newItems });
    }

    setGlassPrice(value: number, ids?: string[]): Offer {
        return this.bulkUpdateField(ids, 'glassPrice', value);
    }

    roundCustomerPrices(step: number = 1, ids?: string[]): Offer {
        const newItems = this.items.map(item => {
            if (ids && !ids.includes(item.id)) return item;
            return item.roundCustomerPrice(step);
        });
        return new Offer({ ...this, items: newItems });
    }

    roundGlassPrices(step: number = 1, ids?: string[]): Offer {
        const newItems = this.items.map(item => {
            if (ids && !ids.includes(item.id)) return item;
            return item.roundGlassPrice(step);
        });
        return new Offer({ ...this, items: newItems });
    }

    roundPourVolumePrices(step: number = 1, ids?: string[]): Offer {
        const newItems = this.items.map(item => {
            if (ids && !ids.includes(item.id)) return item;
            return item.roundPourVolumePrices(step);
        });
        return new Offer({ ...this, items: newItems });
    }

    setUnit(unit: string, ids?: string[]): Offer {
        if (!UNIT_MULTIPLIERS[unit.toUpperCase()]) {
            return this;
        }

        const newItems = this.items.map(item => {
            if (ids && !ids.includes(item.id)) return item;
            if (!item.availableUnits.includes(unit)) return item;
            return item.update({ unit });
        });

        return new Offer({ ...this, items: newItems });
    }

    // --- Grouping ---

    private _withGrouping(grouping: GroupingConfig | null): Offer {
        const nextData = { ...this.data };
        if (grouping === null) {
            delete nextData['grouping'];
        } else {
            nextData['grouping'] = grouping;
        }
        return new Offer({ ...this, data: nextData });
    }

    private _grouping(): GroupingConfig | undefined {
        return this.data?.['grouping'] as GroupingConfig | undefined;
    }

    private _customCategories(): CustomCategory[] {
        const g = this._grouping();
        return g?.customCategories ? [...g.customCategories] : [];
    }

    /** Replace (or clear) the grouping config on offer.data. */
    setGrouping(grouping: GroupingConfig | null): Offer {
        return this._withGrouping(grouping);
    }

    // --- Sorting ---
    // Like grouping, the sort lives on the `data` bag so it round-trips through
    // toJSON()/new Offer() and persists with the offer instead of being a
    // consumer-side, per-session view preference.

    /** The offer's saved item ordering, if one has been set. */
    get sort(): SortConfig | undefined {
        return this.data?.['sort'] as SortConfig | undefined;
    }

    /** Replace (or clear) the sort config on offer.data. */
    setSort(sort: SortConfig | null): Offer {
        const nextData = { ...this.data };
        if (!sort) {
            delete nextData['sort'];
        } else {
            nextData['sort'] = { field: sort.field, dir: sort.dir };
        }
        return new Offer({ ...this, data: nextData });
    }

    /** Items in the offer's saved sort order — insertion order when unset. */
    get sortedItems(): readonly OfferItem[] {
        const sort = this.sort;
        return sort ? sortItems(this.items, sort) : this.items;
    }

    /** Switch to custom mode, seeding with the provided categories (snapshot from current grouping). */
    enterCustomMode(initialCategories: CustomCategory[]): Offer {
        return this._withGrouping({ mode: 'custom', customCategories: initialCategories.map(c => ({
            ...c,
            itemIds: [...c.itemIds]
        })) });
    }

    /** Append a new custom category. Throws on validation failure. */
    addCustomCategory(name: string, opts: { reserved?: readonly string[] } = {}): Offer {
        const categories = this._customCategories();
        const existing = categories.map((c) => c.name);
        const validation = validateCategoryName(name, existing, opts.reserved ?? []);
        if (!validation.ok) {
            throw new Error(`Invalid category name: ${validation.reason}`);
        }
        const next: CustomCategory = { id: crypto.randomUUID(), name: name.trim(), itemIds: [] };
        return this._withGrouping({
            mode: 'custom',
            customCategories: [...categories, next],
        });
    }

    /** Rename a custom category. Throws on validation failure. */
    renameCustomCategory(id: string, name: string, opts: { reserved?: readonly string[] } = {}): Offer {
        const categories = this._customCategories();
        const existing = categories.filter((c) => c.id !== id).map((c) => c.name);
        const validation = validateCategoryName(name, existing, opts.reserved ?? []);
        if (!validation.ok) {
            throw new Error(`Invalid category name: ${validation.reason}`);
        }
        return this._withGrouping({
            mode: 'custom',
            customCategories: categories.map((c) => c.id === id ? { ...c, name: name.trim() } : c),
        });
    }

    removeCustomCategory(id: string): Offer {
        const categories = this._customCategories();
        return this._withGrouping({
            mode: 'custom',
            customCategories: categories.filter((c) => c.id !== id),
        });
    }

    /** Reorder existing categories by id. Unknown ids are ignored; missing ids retain their position at the end. */
    reorderCustomCategories(orderedIds: string[]): Offer {
        const categories = this._customCategories();
        const byId = new Map(categories.map((c) => [c.id, c]));
        const seen = new Set<string>();
        const reordered: CustomCategory[] = [];

        for (const id of orderedIds) {
            const cat = byId.get(id);
            if (cat && !seen.has(id)) {
                reordered.push(cat);
                seen.add(id);
            }
        }
        for (const cat of categories) {
            if (!seen.has(cat.id)) reordered.push(cat);
        }
        return this._withGrouping({ mode: 'custom', customCategories: reordered });
    }

    /**
     * Move an item to a category. Pass null to remove from all categories
     * (item then renders in the synthetic "Other" section).
     */
    moveItemToCategory(itemId: string, categoryId: string | null): Offer {
        const categories = this._customCategories();
        const stripped = categories.map((c) => ({
            ...c,
            itemIds: c.itemIds.filter((id) => id !== itemId),
        }));
        const next = categoryId === null
            ? stripped
            : stripped.map((c) => c.id === categoryId ? { ...c, itemIds: [...c.itemIds, itemId] } : c);
        return this._withGrouping({ mode: 'custom', customCategories: next });
    }

    /**
     * Drop itemIds in custom categories that no longer reference live items.
     * Safe to call when not in custom mode (no-op).
     */
    normalizeCustomGrouping(): Offer {
        const grouping = this._grouping();
        if (grouping?.mode !== 'custom' || !grouping.customCategories) return this;
        const liveIds = new Set(this.items.map((i) => i.id));
        const normalized = normalizeCustomGrouping(grouping.customCategories, liveIds);
        if (normalized === grouping.customCategories) return this;
        return this._withGrouping({ ...grouping, customCategories: normalized });
    }

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
    toSummary(): OfferSummary {
        const toThumb = (item: OfferItem): OfferThumbnail => ({
            imgUrl: item.data?.['imgUrl'],
            title: item.data?.['title'],
        });

        const ordered = this.sortedItems;
        const configured = this._grouping();
        const mode: GroupingMode =
            configured?.mode && configured.mode !== 'strategy' ? configured.mode : 'type';
        const grouping: GroupingConfig = mode === 'custom'
            ? { mode: 'custom', customCategories: configured?.customCategories ?? [] }
            : { mode };

        const groups: OfferSummaryGroup[] = groupItems(ordered, grouping)
            .filter((section) => section.items.length > 0)
            .map((section) => {
                const label = section.custom?.name;
                return {
                    value: section.value,
                    ...(label ? { label } : {}),
                    count: section.items.length,
                    thumbnails: section.items
                        .slice(0, SUMMARY_GROUP_THUMBNAIL_LIMIT)
                        .map(toThumb),
                };
            });

        return {
            thumbnails: ordered.slice(0, SUMMARY_THUMBNAIL_LIMIT).map(toThumb),
            groups,
            groupingMode: mode,
            wineCount: this.items.length,
            status: this.status,
        };
    }

    /**
     * Serialize for API storage. `summary` is a top-level sibling of `items`
     * (not nested in `data`) so consumers projecting a brief list payload read
     * it straight off the stored record.
     */
    toJSON() {
        return {
            id: this.id,
            title: this.title,
            menu: this.menu,
            items: this.items.map(item => item.toJSON()),
            totals: this.totals,
            data: this.data,
            summary: this.toSummary(),
        };
    }
}