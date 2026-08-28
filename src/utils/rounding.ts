import { round } from './math.js';

/**
 * A rounding rule as three numbers: snap `(value - ending)` to a multiple of
 * `step`, then add `ending` back. `direction` picks which grid candidate wins
 * (default 'nearest').
 */
export interface RoundingRule {
    step: number;
    ending?: number;
    direction?: 'nearest' | 'up' | 'down';
}

export type RoundingPreset =
    | 'none'
    | 'whole'
    | 'whole_up'
    | 'half'
    | 'half_up'
    | 'charm_99'
    | 'charm_95'
    | 'charm_49'
    | 'five';

/** Anything the round methods accept: a bare step (legacy), a preset name, or a rule. */
export type RoundInput = number | RoundingPreset | RoundingRule | null | undefined;

export const ROUNDING_PRESETS: Record<RoundingPreset, RoundingRule | null> = {
    none: null,
    whole: { step: 1 },
    whole_up: { step: 1, direction: 'up' },
    half: { step: 0.5 },
    half_up: { step: 0.5, direction: 'up' },
    charm_99: { step: 1, ending: 0.99 },
    charm_95: { step: 1, ending: 0.95 },
    charm_49: { step: 1, ending: 0.49 },
    five: { step: 5 },
};

/**
 * Normalize a RoundInput to a rule (or null = no rounding).
 * A bare number keeps the legacy `roundCustomerPrice(step)` semantics.
 * Unknown preset strings and non-positive steps resolve to null rather than
 * throwing — rounding is a finishing touch, never worth failing an update for.
 */
export function resolveRounding(input: RoundInput): RoundingRule | null {
    if (input === null || input === undefined) return null;
    if (typeof input === 'number') {
        return input > 0 ? { step: input } : null;
    }
    if (typeof input === 'string') {
        return ROUNDING_PRESETS[input as RoundingPreset] ?? null;
    }
    if (typeof input === 'object' && typeof input.step === 'number' && input.step > 0) {
        return input;
    }
    return null;
}

const snap = (value: number, step: number, direction: RoundingRule['direction']): number => {
    // Epsilon nudge so a value already sitting on the grid doesn't jump a
    // whole step under 'up'/'down' (same idiom as roundPourPriceUp).
    if (direction === 'up') return Math.ceil(value / step - 1e-9) * step;
    if (direction === 'down') return Math.floor(value / step + 1e-9) * step;
    return Math.round(value / step) * step;
};

/**
 * Snap `value` per `input`. Returns `value` unchanged (2-dp normalized) when
 * the input resolves to no rule.
 *
 * `opts.min` is a hard floor: when the snapped candidate lands below it, the
 * result is re-snapped UPWARD to the first grid candidate at or above the
 * floor — never a bare max, which would emit an off-grid price.
 */
export function applyRounding(
    value: number,
    input?: RoundInput,
    opts: { min?: number } = {},
): number {
    const rule = resolveRounding(input);
    if (!rule) return round(value);
    const ending = rule.ending ?? 0;
    let result = snap(value - ending, rule.step, rule.direction ?? 'nearest') + ending;
    if (opts.min !== undefined && result < opts.min) {
        result = snap(opts.min - ending, rule.step, 'up') + ending;
        // An ending below the floor's fractional part can still leave us one
        // step short (e.g. floor 25.60 with charm_49 -> 25.49): step up once.
        if (result < opts.min) result += rule.step;
    }
    return round(result);
}
