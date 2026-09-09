
export const UNIT_MULTIPLIERS: Record<string, number> = {
    BOTTLE: 1,
    CASE_3: 3,
    CASE_4: 4,
    CASE_6: 6,
    CASE_12: 12,
    CASE_24: 24,
};

// --- Pour pricing ---
// Reference bottle size a pour is a share of. Overridable per call for magnums
// and half bottles.
export const DEFAULT_BOTTLE_ML = 750;

// Service premium the 'proportional_premium' pour strategy adds on top of the
// guest bottle price scaled to the pour.
export const DEFAULT_POUR_PREMIUM = 0.15;

// --- Offer lifecycle status ---
// A manual lifecycle the consumer sets via Offer.setStatus(). Stored on the
// offer.data bag (like grouping), and surfaced by toSummary()/toJSON().summary.
export const OFFER_STATUSES = ['draft', 'sent', 'accepted'] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];
export const DEFAULT_OFFER_STATUS: OfferStatus = 'draft';

// How many leading items toSummary() includes as thumbnails — a compact preview
// for offer-list rows, not the full item set.
export const SUMMARY_THUMBNAIL_LIMIT = 8;

// Per-group thumbnail cap for toSummary().groups. Kept small so every group is
// represented in a list row; each group also carries its true `count`, so a
// consumer can render a "+N" tile beyond these.
export const SUMMARY_GROUP_THUMBNAIL_LIMIT = 3;
// How far a supplied `margin` may sit from the one the resolved gross implies
// before the engine stops trusting it, in percentage points.
//
// A stored margin is kept verbatim so a round trip never drifts — re-deriving
// it from an already-rounded customerPrice moves it slightly, measured at up to
// 0.13pp across a sweep of prices, margins and VAT rates. Past this tolerance
// the two are not the same number rounded differently, they are a genuine
// contradiction (a 110 guest price labelled 70% when the wine cost makes it
// 50%), and the documented hierarchy applies: the price wins.
export const MARGIN_RECONCILE_TOLERANCE = 0.5;
