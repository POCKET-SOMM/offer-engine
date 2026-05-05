import type { CustomCategory } from './types.js';

/**
 * Drop itemIds that no longer reference live items.
 * Returns the original array reference if nothing changed (allows cheap === checks).
 */
export function normalizeCustomGrouping(
    categories: readonly CustomCategory[],
    liveItemIds: ReadonlySet<string>
): CustomCategory[] {
    let changed = false;
    const next: CustomCategory[] = [];

    for (const cat of categories) {
        const filtered = cat.itemIds.filter((id) => liveItemIds.has(id));
        if (filtered.length !== cat.itemIds.length) {
            changed = true;
            next.push({ ...cat, itemIds: filtered });
        } else {
            next.push(cat);
        }
    }

    return changed ? next : (categories as CustomCategory[]);
}

export type CategoryNameValidation =
    | { ok: true }
    | { ok: false; reason: 'empty' | 'duplicate' | 'reserved' };

/**
 * Validate a proposed custom-category name.
 * - Empty / whitespace-only → 'empty'
 * - Matches an existing name (case-insensitive, trimmed) → 'duplicate'
 * - Matches any reserved name (case-insensitive, trimmed) → 'reserved'
 *   (The consumer supplies translations of "Other" from every locale.)
 */
export function validateCategoryName(
    name: string,
    existing: readonly string[],
    reserved: readonly string[]
): CategoryNameValidation {
    const trimmed = name.trim();
    if (trimmed === '') return { ok: false, reason: 'empty' };

    const lower = trimmed.toLowerCase();
    for (const r of reserved) {
        if (r.trim().toLowerCase() === lower) return { ok: false, reason: 'reserved' };
    }
    for (const e of existing) {
        if (e.trim().toLowerCase() === lower) return { ok: false, reason: 'duplicate' };
    }
    return { ok: true };
}
