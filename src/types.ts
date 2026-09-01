import type { OfferStatus } from './constants.js';
import type { GroupingMode } from './grouping/types.js';
import type { NegotiationSummary, OfferRecipient } from './negotiation/types.js';

export interface PourVolume {
    volume: number;      // ml, primary key (unique per item)
    price: number;       // price for this pour
    name?: string;       // optional display label (e.g. "Medium")
}

/**
 * Named by-the-glass pricing policies. Like a margin, a strategy is applied
 * once to many items and each item derives its own price from its own state,
 * so one call yields N different pour prices.
 *
 * - `bottle_recovery`      — the first pour pays the bottle: price = net cost.
 * - `proportional_premium` — guest bottle price scaled to the pour, plus a
 *                            service premium.
 * - `margin_parity`        — pour priced to hit the item's own bottle margin.
 */
export type PourStrategy = 'bottle_recovery' | 'proportional_premium' | 'margin_parity';

export const POUR_STRATEGIES: readonly PourStrategy[] = [
    'bottle_recovery',
    'proportional_premium',
    'margin_parity',
] as const;

export interface PourStrategyInput {
    strategy: PourStrategy;
    volume: number;          // ml, the pour size being priced
    premium?: number;        // proportional_premium only (default DEFAULT_POUR_PREMIUM)
    bottleVolume?: number;   // default DEFAULT_BOTTLE_ML
    name?: string;           // optional display label for the resulting pour
}

/** One explicit per-item pour price, for prices the caller computed itself. */
export interface PourPriceEntry {
    id: string;
    price: number;
}

export interface OfferThumbnail {
    imgUrl?: string;
    title?: string;
}

// One section of the summary preview, mirroring how the offer is actually
// grouped. `count` is the group's TRUE size (thumbnails are capped), so a list
// row can render "+N" beyond the previewed few.
export interface OfferSummaryGroup {
    value: string;
    /** Display name for custom categories; absent for built-in type/country
     *  groups, whose `value` is a key the consumer localizes itself. */
    label?: string;
    count: number;
    thumbnails: OfferThumbnail[];
}

// Compact, denormalized projection of an Offer for list views. Embedded into
// toJSON() so a stored offer carries its own brief representation (thumbnails +
// count + status) without consumers having to load every item.
export interface OfferSummary {
    thumbnails: OfferThumbnail[];
    /** Grouped preview reflecting the offer's own grouping config. */
    groups: OfferSummaryGroup[];
    /** The mode `groups` was built with — 'type' when grouping is unset or is a
     *  strategy (see Offer.toSummary). */
    groupingMode: GroupingMode;
    wineCount: number;
    status: OfferStatus;
    /** Titles of all attached menus, in order; null for an untitled menu. Empty
     *  when no menu is attached. */
    menuTitles: (string | null)[];
    /** Negotiation badge data — present once the offer has been shared. */
    negotiation?: NegotiationSummary;
    /** Who the offer was sent to — present once the rep has said. */
    recipient?: OfferRecipient;
}

export interface ItemConfig {
    price: number;
    discount?: number | undefined;
    margin?: number | undefined;
    unit?: string | undefined;
    quantity?: number | undefined;
    vatRate?: number | undefined;
    tags?: string[] | undefined;
    id?: string | undefined;
    /** Durable line identity — see OfferItem.lineId. Defaults to `id`. */
    lineId?: string | undefined;
    gross?: number | undefined;
    customerPrice?: number | undefined;
    pricePerBottle?: number | undefined;
    glassPrice?: number | undefined;
    pourVolumes?: PourVolume[] | undefined;
    availableUnits?: string[] | undefined;
    data?: Record<string, any> | undefined;
}

export interface CalculatedTotals {
    pricePerBottle: number;
    pricePerUnit: number;
    gross: number;
    vatAmount: number;
    customerPrice: number;
    totalPrice: number;
}

export interface OfferTotals {
    totalPrice: number;
    totalSaved: number;
}
