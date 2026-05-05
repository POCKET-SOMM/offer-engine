export { Offer } from './Offer.js';
export { OfferItem } from './OfferItem.js';
export type { PourVolume, ItemConfig } from './types.js';

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