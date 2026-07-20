
export const UNIT_MULTIPLIERS: Record<string, number> = {
    BOTTLE: 1,
    CASE_3: 3,
    CASE_4: 4,
    CASE_6: 6,
    CASE_12: 12,
    CASE_24: 24,
};

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