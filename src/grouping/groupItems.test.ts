import { describe, it, expect } from 'vitest';
import { OfferItem } from '../OfferItem.js';
import { groupItems } from './groupItems.js';
import { OTHER_SECTION_VALUE, STRATEGY_MISSING_VALUE, type SavedStrategy } from './types.js';

const item = (id: string, data: Record<string, unknown> = {}, price = 100) =>
    new OfferItem({ id, price, data });

describe('groupItems — type mode', () => {
    it('groups by detected wine type and pins Other to the end', () => {
        const items = [
            item('a', { type: 'red' }),
            item('b', { type: 'white' }),
            item('c', { type: 'sparkling' }),
            item('d', {}), // no type → Other
        ];
        const sections = groupItems(items, { mode: 'type' });
        const values = sections.map((s) => s.value);
        // Display order is ['sparkling', 'white', 'rose', 'orange', 'red', 'fortified', 'dessert']
        expect(values).toEqual(['sparkling', 'white', 'red', OTHER_SECTION_VALUE]);
    });

    it('gives orange wine its own section instead of falling into Other', () => {
        const items = [
            item('a', { type: 'red' }),
            item('b', { type: 'orange' }),
        ];
        const sections = groupItems(items, { mode: 'type' });
        const values = sections.map((s) => s.value);
        expect(values).toEqual(['orange', 'red']);
    });

    it('omits empty sections', () => {
        const sections = groupItems([item('a', { type: 'red' })], { mode: 'type' });
        expect(sections.length).toBe(1);
        expect(sections[0]?.value).toBe('red');
    });

    it('respects precedence (white, sparkling → sparkling)', () => {
        const items = [item('a', { type: 'white, sparkling' })];
        const sections = groupItems(items, { mode: 'type' });
        expect(sections[0]?.value).toBe('sparkling');
    });
});

describe('groupItems — country mode', () => {
    it('groups by country, sorted by item count desc then alphabetical', () => {
        const items = [
            item('a', { country: 'France' }),
            item('b', { country: 'Italy' }),
            item('c', { country: 'France' }),
            item('d', { country: 'Spain' }),
            item('e', { country: 'Italy' }),
            item('f', { country: 'France' }),
            item('g', {}), // no country → Other
        ];
        const sections = groupItems(items, { mode: 'country' });
        const values = sections.map((s) => s.value);
        expect(values).toEqual(['France', 'Italy', 'Spain', OTHER_SECTION_VALUE]);
        expect(sections[0]?.items.length).toBe(3);
        expect(sections[1]?.items.length).toBe(2);
    });
});

describe('groupItems — region / producer / grape modes', () => {
    // Shapes as the catalogue actually stores them: a broad `region` next to a
    // narrower `regions` trail, and `grapes` dominant-first.
    const rhone = item('a', {
        region: 'Rhône Valley',
        regions: ['Rhône', 'Châteauneuf-du-Pape'],
        producer: 'Domaine Giraud',
        grapes: ['Syrah', 'Garnacha Tinta', 'Monastrell'],
    });
    const rhone2 = item('b', {
        region: 'Rhône Valley',
        regions: ['Rhône', 'Crozes-Hermitage'],
        producer: 'Domaine Delhome',
        grapes: ['Marsanne'],
    });
    const alsace = item('c', {
        region: 'Alsace',
        producer: 'Domaine Marcel Deiss',
        grapes: ['Riesling', 'Gewurztraminer'],
    });
    const bare = item('d', {});

    it('groups by the broad region, not the appellation trail', () => {
        const sections = groupItems([rhone, rhone2, alsace, bare], { mode: 'region' });
        expect(sections.map((s) => s.value)).toEqual([
            'Rhône Valley',
            'Alsace',
            OTHER_SECTION_VALUE,
        ]);
        expect(sections[0]?.items.length).toBe(2);
    });

    it('groups by producer', () => {
        const sections = groupItems([rhone, rhone2, alsace], { mode: 'producer' });
        // One wine each, so purely alphabetical.
        expect(sections.map((s) => s.value)).toEqual([
            'Domaine Delhome',
            'Domaine Giraud',
            'Domaine Marcel Deiss',
        ]);
    });

    it('files a blend under its dominant grape', () => {
        const sections = groupItems([rhone, rhone2, alsace, bare], { mode: 'grape' });
        expect(sections.map((s) => s.value)).toEqual([
            'Marsanne',
            'Riesling',
            'Syrah',
            OTHER_SECTION_VALUE,
        ]);
    });

    it('accepts a bare grape string and skips blank entries', () => {
        const single = item('e', { grapes: 'Nebbiolo' });
        const padded = item('f', { grapes: ['', '  ', 'Nebbiolo'] });
        const sections = groupItems([single, padded], { mode: 'grape' });
        expect(sections.map((s) => s.value)).toEqual(['Nebbiolo']);
        expect(sections[0]?.items.length).toBe(2);
    });

    it('treats a blank or non-string value as ungrouped', () => {
        const blank = item('g', { region: '   ' });
        const numeric = item('h', { producer: 42 });
        expect(groupItems([blank], { mode: 'region' })[0]?.value).toBe(OTHER_SECTION_VALUE);
        expect(groupItems([numeric], { mode: 'producer' })[0]?.value).toBe(OTHER_SECTION_VALUE);
    });

    it('trims stored whitespace so one region is one section', () => {
        const padded = item('i', { region: ' Alsace ' });
        const sections = groupItems([padded, alsace], { mode: 'region' });
        expect(sections.map((s) => s.value)).toEqual(['Alsace']);
        expect(sections[0]?.items.length).toBe(2);
    });
});

describe('groupItems — strategy mode', () => {
    const strategies: SavedStrategy[] = [
        {
            id: 's1',
            name: 'Test',
            categories: [
                {
                    id: 'frenchWhite',
                    name: 'French whites',
                    filters: [
                        { type: 'country', key: 'france' },
                        { type: 'types', key: 'white' },
                    ],
                },
                {
                    id: 'french',
                    name: 'French (other)',
                    filters: [{ type: 'country', key: 'france' }],
                },
            ],
        },
    ];

    it('first match wins (later category never claims item that matched earlier)', () => {
        const french_white = item('a', { country: 'France', type: 'white' });
        const french_red = item('b', { country: 'France', type: 'red' });
        const sections = groupItems(
            [french_white, french_red],
            { mode: 'strategy', strategyId: 's1' },
            { savedStrategies: strategies }
        );
        expect(sections.find((s) => s.value === 'frenchWhite')?.items.map((i) => i.id)).toEqual(['a']);
        expect(sections.find((s) => s.value === 'french')?.items.map((i) => i.id)).toEqual(['b']);
    });

    it('routes unmatched items to Other', () => {
        const italian = item('c', { country: 'Italy', type: 'red' });
        const sections = groupItems(
            [italian],
            { mode: 'strategy', strategyId: 's1' },
            { savedStrategies: strategies }
        );
        expect(sections.length).toBe(1);
        expect(sections[0]?.value).toBe(OTHER_SECTION_VALUE);
    });

    it('returns missing-strategy marker when strategyId is unknown', () => {
        const sections = groupItems(
            [item('a')],
            { mode: 'strategy', strategyId: 'nope' },
            { savedStrategies: strategies }
        );
        expect(sections).toEqual([
            { value: STRATEGY_MISSING_VALUE, items: [], strategyMissing: true },
        ]);
    });
});

describe('groupItems — custom mode', () => {
    it('renders categories in stored order; orphans go to Other', () => {
        const items = [item('a'), item('b'), item('c')];
        const sections = groupItems(items, {
            mode: 'custom',
            customCategories: [
                { id: 'cat1', name: 'First', itemIds: ['b', 'a'] },
                { id: 'cat2', name: 'Second', itemIds: [] },
            ],
        });
        expect(sections.map((s) => s.value)).toEqual(['cat1', 'cat2', OTHER_SECTION_VALUE]);
        expect(sections[0]?.items.map((i) => i.id)).toEqual(['b', 'a']);
        expect(sections[1]?.items).toEqual([]);
        expect(sections[2]?.items.map((i) => i.id)).toEqual(['c']);
    });

    it('ignores duplicate itemIds across categories (first wins)', () => {
        const items = [item('a')];
        const sections = groupItems(items, {
            mode: 'custom',
            customCategories: [
                { id: 'c1', name: 'A', itemIds: ['a'] },
                { id: 'c2', name: 'B', itemIds: ['a'] },
            ],
        });
        expect(sections[0]?.items.map((i) => i.id)).toEqual(['a']);
        expect(sections[1]?.items).toEqual([]);
    });

    it('ignores itemIds referencing missing items (rendering is forgiving)', () => {
        const items = [item('a')];
        const sections = groupItems(items, {
            mode: 'custom',
            customCategories: [
                { id: 'c1', name: 'A', itemIds: ['gone', 'a'] },
            ],
        });
        expect(sections[0]?.items.map((i) => i.id)).toEqual(['a']);
    });

    it('renders no Other section when all items are claimed', () => {
        const items = [item('a')];
        const sections = groupItems(items, {
            mode: 'custom',
            customCategories: [{ id: 'c1', name: 'A', itemIds: ['a'] }],
        });
        expect(sections.length).toBe(1);
    });

    it('handles empty custom categories', () => {
        const items = [item('a')];
        const sections = groupItems(items, { mode: 'custom', customCategories: [] });
        expect(sections.length).toBe(1);
        expect(sections[0]?.value).toBe(OTHER_SECTION_VALUE);
        expect(sections[0]?.items.map((i) => i.id)).toEqual(['a']);
    });
});

describe('groupItems — empty offer', () => {
    it('returns empty array regardless of mode', () => {
        expect(groupItems([], { mode: 'type' })).toEqual([]);
        expect(groupItems([], { mode: 'country' })).toEqual([]);
        expect(groupItems([], { mode: 'custom', customCategories: [] })).toEqual([]);
    });
});
