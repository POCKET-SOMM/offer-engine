/**
 * Standardized financial rounding to 2 decimal places.
 * Centralizing this ensures consistency across all calculations.
 */
export const round = (value: number): number => {
    return Math.round((value + Number.EPSILON) * 100) / 100;
};