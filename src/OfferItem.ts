import { round } from './utils/math.js';
import { UNIT_MULTIPLIERS } from './constants.js';
import type { ItemConfig } from './types.js';

export class OfferItem {
    public readonly id: string;
    public readonly price: number;
    public readonly discount: number;
    public readonly margin: number;
    public readonly unit: string;
    public readonly quantity: number;
    public readonly vatRate: number;
    public readonly tags: string[];
    public readonly availableUnits: string[];
    public readonly glassPrice: number | undefined;
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
        this.price = config.price;
        this.unit = config.unit || 'bottle';
        this.quantity = config.quantity ?? 1;
        this.vatRate = config.vatRate ?? 25.5;
        this.tags = config.tags || [];
        this.availableUnits = config.availableUnits || ['bottle'];
        this.glassPrice = config.glassPrice;
        this.data = config.data || {};

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

        if (fields.discount !== undefined) delete config.pricePerBottle;
        if (fields.pricePerBottle !== undefined) delete config.discount;

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

    roundCustomerPrice(step: number = 1): OfferItem {
        const roundedValue = Math.round(this.customerPrice / step) * step;
        return this.update({ customerPrice: round(roundedValue) });
    }

    roundGlassPrice(step: number = 1): OfferItem {
        if (this.glassPrice === undefined) return this;
        const roundedValue = Math.round(this.glassPrice / step) * step;
        return this.update({ glassPrice: round(roundedValue) });
    }

    toConfig(): ItemConfig {
        return {
            id: this.id,
            price: this.price,
            discount: this.discount,
            margin: this.margin,
            unit: this.unit,
            quantity: this.quantity,
            vatRate: this.vatRate,
            tags: [...this.tags],
            availableUnits: [...this.availableUnits],
            glassPrice: this.glassPrice,
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
}