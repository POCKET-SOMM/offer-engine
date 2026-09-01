export { Offer } from './Offer.js';
export { OfferItem } from './OfferItem.js';
export {
    OFFER_STATUSES,
    DEFAULT_OFFER_STATUS,
    SUMMARY_THUMBNAIL_LIMIT,
    SUMMARY_GROUP_THUMBNAIL_LIMIT,
} from './constants.js';
export type { OfferStatus } from './constants.js';
export type { PourVolume, ItemConfig, OfferSummary, OfferSummaryGroup, OfferThumbnail } from './types.js';
export { POUR_STRATEGIES } from './types.js';
export type { PourStrategy, PourStrategyInput, PourPriceEntry } from './types.js';
export { DEFAULT_BOTTLE_ML, DEFAULT_POUR_PREMIUM } from './constants.js';

// Rounding
export { applyRounding, resolveRounding, ROUNDING_PRESETS } from './utils/rounding.js';
export type { RoundingRule, RoundingPreset, RoundInput } from './utils/rounding.js';

// Sorting
export { sortItems, DEFAULT_SORT } from './sorting/sortItems.js';
export type { SortConfig, SortField, SortDirection } from './sorting/sortItems.js';

// Grouping
export { groupItems } from './grouping/groupItems.js';
export { matchesRules } from './grouping/matchesRules.js';
export { detectWineType } from './grouping/wineType.js';
export { normalizeCustomGrouping, validateCategoryName } from './grouping/normalize.js';
export {
    WINE_TYPE_KEYS,
    OTHER_SECTION_VALUE,
    STRATEGY_MISSING_VALUE,
} from './grouping/types.js';
export type {
    GroupingMode,
    GroupingConfig,
    FilterRule,
    CustomCategory,
    StrategyCategory,
    SavedStrategy,
    GroupedSection,
    WineTypeKey,
} from './grouping/types.js';
export type { CategoryNameValidation } from './grouping/normalize.js';

// Negotiation
export {
    resolveRequest,
    resolveRequests,
    countOpenRequests,
    deriveUnpromptedChanges,
    itemByLineId,
    latestBaseline,
    roundBaseline,
    buildBaseline,
} from './negotiation/derive.js';
export { NEGOTIATION_PARTIES, REQUEST_KINDS, REQUEST_OUTCOMES } from './negotiation/types.js';
export type {
    NegotiationParty,
    RequestKind,
    RequestOutcome,
    NegotiationLogLine,
    BaselineLine,
    NegotiationBaseline,
    NegotiationVersion,
    ChangeRequest,
    ChangeRequestInput,
    NegotiationState,
    NegotiationSummary,
    OfferRecipient,
} from './negotiation/types.js';
export type {
    ResolvedRequest,
    UnpromptedChange,
    UnpromptedChangeType,
    NegotiationOfferView,
} from './negotiation/derive.js';