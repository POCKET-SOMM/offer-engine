import { describe, it, expect } from 'vitest';
import { applyRounding, resolveRounding, ROUNDING_PRESETS } from './rounding.js';

describe('resolveRounding', () => {
    it('passes numbers through as bare steps (legacy)', () => {
        expect(resolveRounding(0.5)).toEqual({ step: 0.5 });
        expect(resolveRounding(1)).toEqual({ step: 1 });
    });

    it('resolves preset names', () => {
        expect(resolveRounding('charm_99')).toEqual({ step: 1, ending: 0.99 });
        expect(resolveRounding('five')).toEqual({ step: 5 });
        expect(resolveRounding('none')).toBeNull();
    });

    it('passes rules through and rejects garbage without throwing', () => {
        expect(resolveRounding({ step: 2, direction: 'up' })).toEqual({ step: 2, direction: 'up' });
        expect(resolveRounding(undefined)).toBeNull();
        expect(resolveRounding(null)).toBeNull();
        expect(resolveRounding(0)).toBeNull();
        expect(resolveRounding(-1)).toBeNull();
        expect(resolveRounding('bogus' as any)).toBeNull();
        expect(resolveRounding({ step: 0 } as any)).toBeNull();
    });
});

describe('applyRounding', () => {
    it('matches the preset table for 24.72', () => {
        expect(applyRounding(24.72, 'whole')).toBe(25);
        expect(applyRounding(24.72, 'whole_up')).toBe(25);
        expect(applyRounding(24.72, 'half')).toBe(24.5);
        expect(applyRounding(24.72, 'half_up')).toBe(25);
        expect(applyRounding(24.72, 'charm_99')).toBe(24.99);
        expect(applyRounding(24.72, 'charm_95')).toBe(24.95);
        expect(applyRounding(24.72, 'charm_49')).toBe(24.49);
        expect(applyRounding(24.72, 'five')).toBe(25);
        expect(applyRounding(24.72, 'none')).toBe(24.72);
    });

    it('does not jump a step when the value is already on the grid (up/down epsilon)', () => {
        expect(applyRounding(25, 'whole_up')).toBe(25);
        expect(applyRounding(12.5, 'half_up')).toBe(12.5);
        expect(applyRounding(24.99, 'charm_99')).toBe(24.99);
        expect(applyRounding(25, { step: 1, direction: 'down' })).toBe(25);
    });

    it('rounds down when asked', () => {
        expect(applyRounding(24.72, { step: 1, direction: 'down' })).toBe(24);
        expect(applyRounding(24.72, { step: 0.5, direction: 'down' })).toBe(24.5);
    });

    it('re-snaps upward onto the grid when below min, never emitting off-grid', () => {
        // whole rounding with a floor of 24.9: nearest candidate 25 is fine
        expect(applyRounding(24.6, 'whole', { min: 24.9 })).toBe(25);
        // charm_49 with floor 25.6: 25.49 breaches, next grid candidate is 26.49
        expect(applyRounding(25.51, 'charm_49', { min: 25.6 })).toBe(26.49);
        // five with floor 21: snap from 18 -> 20 breaches -> 25
        expect(applyRounding(18, 'five', { min: 21 })).toBe(25);
    });

    it('2-dp normalizes when no rule applies', () => {
        expect(applyRounding(24.726666)).toBe(24.73);
    });

    it('preset table covers every preset name', () => {
        for (const [name, rule] of Object.entries(ROUNDING_PRESETS)) {
            if (name === 'none') expect(rule).toBeNull();
            else expect(rule && rule.step > 0).toBe(true);
        }
    });
});
