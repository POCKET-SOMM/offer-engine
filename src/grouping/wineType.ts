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
 *
 * Accepts three real-world input shapes on `item.data`:
 *   - `type: string`          — legacy/normalized form
 *   - `type: string[]`        — catalog wines (Qdrant search results)
 *   - `wine_type: string`     — wine-card items (parsed from menu uploads),
 *                               used as a fallback when `type` is absent
 */
export function detectWineType(item: OfferItem): WineTypeKey | null {
    const raw = item.data?.['type'];
    const fallback = item.data?.['wine_type'];

    let typeStr = '';
    if (typeof raw === 'string') {
        typeStr = raw.toLowerCase();
    } else if (Array.isArray(raw)) {
        typeStr = raw.filter((v) => typeof v === 'string').join(' ').toLowerCase();
    } else if (typeof fallback === 'string') {
        typeStr = fallback.toLowerCase();
    }
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
