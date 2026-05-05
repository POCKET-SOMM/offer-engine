import type { OfferItem } from '../OfferItem.js';
import { WINE_TYPE_KEYS, type WineTypeKey } from './types.js';

/**
 * Precedence order: when a wine's type string includes multiple keys (e.g.
 * "white, sparkling"), the LAST key in this array wins. Mirrors the legacy
 * sommify-menu behavior so "white, sparkling" → "sparkling".
 */
const PRECEDENCE: readonly WineTypeKey[] = ['red', 'white', 'rose', 'sparkling', 'dessert', 'fortified'];

/**
 * Detect the canonical wine-type bucket for an item.
 * Returns null when no key matches (consumer routes to OTHER_SECTION_VALUE).
 */
export function detectWineType(item: OfferItem): WineTypeKey | null {
    const raw = item.data?.['type'];
    const typeStr = typeof raw === 'string' ? raw.toLowerCase() : '';
    if (!typeStr) return null;

    for (let i = 0; i < PRECEDENCE.length; i++) {
        const candidate = PRECEDENCE[i]!;
        if (!typeStr.includes(candidate)) continue;
        const laterMatches = PRECEDENCE.slice(i + 1).some((later) => typeStr.includes(later));
        if (!laterMatches) return candidate;
    }
    return null;
}

export { WINE_TYPE_KEYS };
export type { WineTypeKey };
