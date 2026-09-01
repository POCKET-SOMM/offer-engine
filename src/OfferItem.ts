import { round } from './utils/math.js';
import { applyRounding, type RoundInput } from './utils/rounding.js';
import { UNIT_MULTIPLIERS, DEFAULT_BOTTLE_ML, DEFAULT_POUR_PREMIUM } from './constants.js';
import type { ItemConfig, PourVolume, PourStrategyInput } from './types.js';

export class OfferItem {
    public readonly id: string;
    /** Durable line identity. Unlike `id` (which is replaced by swapItem and
     *  dropped with removeItems), `lineId` survives a swap — negotiation
     *  requests reference lines through it so the conversation can keep
     *  pointing at "this slot in the offer" across rounds. Defaults to `id`,
     *  so offers stored before this field existed load with lineId === id. */
    public readonly lineId: string;
    public readonly price: number;
    public readonly discount: number;
    public readonly margin: number;
    public readonly unit: string;
    public readonly quantity: number;
    public readonly vatRate: number;
    public readonly tags: string[];
    public readonly availableUnits: string[];
    public readonly glassPrice: number | undefined;
    public readonly pourVolumes: readonly PourVolume[];
    public readonly data: Record<string, any>;

    // Calculated fields
    public readonly pricePerBottle: number;
    public readonly pricePerUnit: number;
    public readonly gross: number;
    public readonly vatAmount: number;
    public readonly customerPrice: number;
    public readonly totalPrice: number;

    constructor(config: ItemConfig) {
        this.id = config.id || crypto.randomUUID();
        this.lineId = config.lineId || this.id;
        this.price = config.price;
        this.unit = config.unit || 'bottle';
        this.quantity = config.quantity ?? 1;
        this.vatRate = config.vatRate ?? 25.5;
        this.tags = config.tags || [];
        this.availableUnits = config.availableUnits || ['bottle'];
        this.glassPrice = config.glassPrice;
        this.data = config.data || {};

        // Validate and normalize pour volumes
        const rawPours = config.pourVolumes || [];
        const validPours = rawPours.filter(p => p.volume > 0 && p.price >= 0);
        // Deduplicate by volume (last wins), then sort ascending
        const deduped = new Map<number, PourVolume>();
        for (const pv of validPours) {
            deduped.set(pv.volume, { ...pv });
        }
        this.pourVolumes = Object.freeze(
            Array.from(deduped.values())
                .sort((a, b) => a.volume - b.volume)
                .map(pv => Object.freeze(pv))
        );

        // 1. Resolve Price Per Bottle and Discount
        if (config.discount !== undefined && config.pricePerBottle !== undefined) {
            // TRUST BOTH if provided (prevents drift)
            this.discount = config.discount;
            this.pricePerBottle = config.pricePerBottle;
        } else if (config.pricePerBottle !== undefined) {
            this.pricePerBottle = config.pricePerBottle;
            this.discount = round((1 - this.pricePerBottle / this.price) * 100);
        } else {
            this.discount = round(config.discount || 0);
            this.pricePerBottle = round(this.price * (1 - this.discount / 100));
        }

        const multiplier = UNIT_MULTIPLIERS[this.unit.toUpperCase()] || 1;
        this.pricePerUnit = round(this.pricePerBottle * multiplier);

        // 2. Resolve calculations based on Hierarchy (customerPrice > gross > margin)
        if (config.customerPrice !== undefined) {
            this.customerPrice = config.customerPrice;

            // If we have gross or margin already provided, trust them to avoid re-derivation drift
            if (config.gross !== undefined) {
                this.gross = config.gross;
                const priceBeforeVat = this.pricePerBottle + this.gross;
                this.vatAmount = round(this.customerPrice - priceBeforeVat);
                this.margin = config.margin !== undefined ? config.margin : round((this.gross / priceBeforeVat) * 100);
            } else {
                const priceBeforeVat = this.customerPrice / (1 + this.vatRate / 100);
                this.vatAmount = round(this.customerPrice - priceBeforeVat);
                this.gross = round(priceBeforeVat - this.pricePerBottle);
                this.margin = config.margin !== undefined ? config.margin : round((this.gross / priceBeforeVat) * 100);
            }
        } else if (config.gross !== undefined) {
            this.gross = config.gross;
            const priceBeforeVat = this.pricePerBottle + this.gross;
            this.vatAmount = round(priceBeforeVat * (this.vatRate / 100));
            this.customerPrice = round(priceBeforeVat + this.vatAmount);
            this.margin = config.margin !== undefined ? config.margin : round((this.gross / priceBeforeVat) * 100);
        } else {
            this.margin = round(config.margin || 0);
            const marginMultiplier = 1 - this.margin / 100;
            this.gross = marginMultiplier === 0 ? 0 : round(this.pricePerBottle / marginMultiplier - this.pricePerBottle);
            const priceBeforeVat = this.pricePerBottle + this.gross;
            this.vatAmount = round(priceBeforeVat * (this.vatRate / 100));
            this.customerPrice = round(priceBeforeVat + this.vatAmount);
        }

        this.totalPrice = round(this.pricePerUnit * this.quantity);

        Object.freeze(this); // Ensure immutability
    }

    // --- Immutable Update Patterns ---

    update(fields: Partial<ItemConfig>): OfferItem {
        const config = this.toConfig();

        // Dependency Busting Logic
        if (fields.price !== undefined) {
            // If vendor price changes, we keep discount and margin intent, but re-derive costs
            delete config.pricePerBottle;
            delete config.gross;
            delete config.customerPrice;
        }

        if (fields.discount !== undefined) {
            delete config.pricePerBottle;
            delete config.customerPrice;
            delete config.gross;
        }
        if (fields.pricePerBottle !== undefined) {
            delete config.discount;
            delete config.customerPrice;
            delete config.gross;
        }

        if (fields.margin !== undefined) {
            delete config.gross;
            delete config.customerPrice;
        }
        if (fields.gross !== undefined) {
            delete config.margin;
            delete config.customerPrice;
        }
        if (fields.customerPrice !== undefined) {
            delete config.margin;
            delete config.gross;
        }

        return new OfferItem({ ...config, ...fields });
    }

    /**
     * Round the customer price. Accepts a bare step (legacy), a preset name
     * ('whole', 'half_up', 'charm_49', ...) or a RoundingRule. Rounding never
     * pushes the price below cost incl. VAT (gross >= 0), stepping up instead.
     */
    roundCustomerPrice(rule: RoundInput = 1): OfferItem {
        const floor = this.pricePerBottle * (1 + this.vatRate / 100);
        const roundedValue = applyRounding(this.customerPrice, rule, { min: round(floor) });
        if (roundedValue === this.customerPrice) return this;
        return this.update({ customerPrice: roundedValue });
    }

    roundGlassPrice(rule: RoundInput = 1): OfferItem {
        if (this.glassPrice === undefined) return this;
        const roundedValue = applyRounding(this.glassPrice, rule, { min: 0 });
        if (roundedValue === this.glassPrice) return this;
        return this.update({ glassPrice: roundedValue });
    }

    roundPourVolumePrices(rule: RoundInput = 1): OfferItem {
        if (this.pourVolumes.length === 0) return this;
        const rounded = this.pourVolumes.map(pv => ({
            ...pv,
            price: applyRounding(pv.price, rule, { min: 0 }),
        }));
        if (rounded.every((pv, i) => pv.price === this.pourVolumes[i]?.price)) return this;
        return this.update({ pourVolumes: rounded });
    }

    /** Set or update a pour volume. If volume exists, update price/name. If not, add it. */
    setPourVolume(pv: PourVolume): OfferItem {
        const existing = this.pourVolumes.filter(p => p.volume !== pv.volume);
        return this.update({ pourVolumes: [...existing, pv] });
    }

    /**
     * Price one pour of THIS item under a named strategy. Each item derives
     * from its own state, so a single strategy produces a different price per
     * item — the same policy-not-price shape as setMargin.
     *
     * The per-ml floor (a pour is never cheaper per-ml than the bottle) is
     * advisory: nothing is clamped here, matching roundPourVolumePrices.
     */
    pourPriceFor(input: PourStrategyInput): number {
        const bottleVolume = input.bottleVolume ?? DEFAULT_BOTTLE_ML;
        if (!(input.volume > 0) || !(bottleVolume > 0)) return 0;
        const share = input.volume / bottleVolume;

        switch (input.strategy) {
            case 'bottle_recovery':
                return round(this.pricePerBottle);
            case 'proportional_premium': {
                const premium = input.premium ?? DEFAULT_POUR_PREMIUM;
                return round(this.customerPrice * share * (1 + premium));
            }
            case 'margin_parity': {
                const cost = this.pricePerBottle * share;
                const marginFraction = this.margin / 100;
                // A margin of 100%+ has no finite price; fall back to cost.
                return round(marginFraction >= 1 ? cost : cost / (1 - marginFraction));
            }
            default:
                throw new Error(`Unknown pour strategy: ${input.strategy}`);
        }
    }

    /** Set a pour volume whose price this item derives from a named strategy. */
    setPourVolumeByStrategy(input: PourStrategyInput): OfferItem {
        return this.setPourVolume({
            volume: input.volume,
            price: this.pourPriceFor(input),
            ...(input.name ? { name: input.name } : {}),
        });
    }

    /** Remove a pour volume by ml value */
    removePourVolume(volume: number): OfferItem {
        return this.update({ pourVolumes: this.pourVolumes.filter(p => p.volume !== volume) });
    }

    /** Remove all pour volumes */
    clearPourVolumes(): OfferItem {
        return this.update({ pourVolumes: [] });
    }

    toConfig(): ItemConfig {
        return {
            id: this.id,
            lineId: this.lineId,
            price: this.price,
            discount: this.discount,
            margin: this.margin,
            unit: this.unit,
            quantity: this.quantity,
            vatRate: this.vatRate,
            tags: [...this.tags],
            availableUnits: [...this.availableUnits],
            glassPrice: this.glassPrice,
            pourVolumes: this.pourVolumes.map(pv => ({ ...pv })),
            gross: this.gross,
            customerPrice: this.customerPrice,
            pricePerBottle: this.pricePerBottle,
            data: { ...this.data }
        };
    }

    toJSON() {
        return {
            ...this.toConfig(),
            pricePerUnit: this.pricePerUnit,
            vatAmount: this.vatAmount,
            totalPrice: this.totalPrice
        };
    }

    /**
     * Create an OfferItem from a wine object.
     * Use overrides to provide custom logic like company-specific unit defaults.
     */
    static fromWine(wine: any, overrides?: Partial<ItemConfig>): OfferItem {
        const availableUnits: string[] = [];

        // Single bottles are available if no quantity increment is specified or it is 1
        if (wine.qtyIncrements === undefined || wine.qtyIncrements === 1) {
            availableUnits.push('bottle');
        }

        // Add case option if wine is sold in multi-bottle cases
        if (wine.bottlesPerCase && wine.bottlesPerCase > 1) {
            availableUnits.push(`case_${wine.bottlesPerCase}`);
        }

        const config: ItemConfig = {
            id: wine.id || crypto.randomUUID(),
            price: parseFloat(wine.price) || 0,
            discount: 0,
            unit: availableUnits[0],
            quantity: 1,
            vatRate: 25.5,
            margin: 70.0,
            tags: [],
            data: { ...wine, availableUnits },
            availableUnits,
            ...overrides
        };

        return new OfferItem(config);
    }
}