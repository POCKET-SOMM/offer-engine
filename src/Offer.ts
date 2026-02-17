import { UNIT_MULTIPLIERS } from './constants.js';
import { OfferItem } from './OfferItem.js';
import type { ItemConfig, OfferTotals } from './types.js';
import { round } from './utils/math.js';

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
            (acc, item) => ({
                totalNet: round(acc.totalNet + item.pricePerUnit * item.quantity),
                totalVat: round(acc.totalVat + item.vatAmount * (item.quantity * this._getMultiplier(item))),
                totalGross: round(acc.totalGross + item.totalPrice), // totalPrice in Item is already calculated
            }),
            { totalNet: 0, totalVat: 0, totalGross: 0 }
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
    bulkUpdateField(ids: string[], field: keyof ItemConfig, value: any): Offer {
        const newItems = this.items.map(item => {
            if (!ids.includes(item.id)) return item;
            return item.update({ [field]: value });
        });
        return new Offer({ ...this, items: newItems });
    }

    /**
     * Serialize for API storage
     */
    toJSON() {
        return {
            id: this.id,
            title: this.title,
            menu: this.menu,
            items: this.items.map(item => item.toJSON()),
            totals: this.totals,
            data: this.data
        };
    }
}