import { round } from './utils/math.js';
import { UNIT_MULTIPLIERS } from './constants.js';
import type { ItemConfig, CalculatedTotals } from './types.js';

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
    public readonly glassPrice: number;
    public readonly data: Record<string, any>;

    private readonly _explicitFields: Set<keyof ItemConfig>;

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
        this.glassPrice = config.glassPrice || 0;
        this.data = config.data || {};

        this._explicitFields = new Set();
        if (config.customerPrice !== undefined) this._explicitFields.add('customerPrice');
        if (config.gross !== undefined) this._explicitFields.add('gross');
        if (config.pricePerBottle !== undefined) this._explicitFields.add('pricePerBottle');

        // 1. Resolve Price Per Bottle and Discount
        if (config.pricePerBottle !== undefined) {
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
            const priceBeforeVat = this.customerPrice / (1 + this.vatRate / 100);
            this.vatAmount = round(this.customerPrice - priceBeforeVat);
            this.gross = priceBeforeVat - this.pricePerBottle;

            // Derive margin from resulting gross
            this.margin = round((this.gross / priceBeforeVat) * 100);
        } else if (config.gross !== undefined) {
            this.gross = config.gross;
            const priceBeforeVat = this.pricePerBottle + this.gross;
            this.vatAmount = round(priceBeforeVat * (this.vatRate / 100));
            this.customerPrice = round(priceBeforeVat + this.vatAmount);

            // Derive margin
            this.margin = round((this.gross / priceBeforeVat) * 100);
        } else {
            this.margin = round(config.margin || 0);
            const marginMultiplier = 1 - this.margin / 100;
            this.gross = marginMultiplier === 0 ? 0 : round(this.pricePerBottle / marginMultiplier - this.pricePerBottle);
            const priceBeforeVat = this.pricePerBottle + this.gross;
            this.vatAmount = round(priceBeforeVat * (this.vatRate / 100));
            this.customerPrice = round(priceBeforeVat + this.vatAmount);
        }

        this.totalPrice = this.customerPrice * multiplier * this.quantity;

        Object.freeze(this); // Ensure immutability
    }



    // --- Immutable Update Patterns ---

    update(fields: Partial<ItemConfig>): OfferItem {
        const config = this.toConfig();

        // Conflict Resolution:
        // If updating a lower-priority field, we MUST clear higher-priority explicit fields
        // to allow the new value to take effect.
        if (fields.margin !== undefined && fields.gross === undefined && fields.customerPrice === undefined) {
            delete config.gross;
            delete config.customerPrice;
        }
        if (fields.gross !== undefined && fields.customerPrice === undefined) {
            delete config.customerPrice;
        }
        if (fields.discount !== undefined && fields.pricePerBottle === undefined) {
            delete config.pricePerBottle;
        }

        return new OfferItem({ ...config, ...fields });
    }

    roundCustomerPrice(step: number = 1): OfferItem {
        const roundedValue = Math.round(this.customerPrice / step) * step;
        return this.update({ customerPrice: round(roundedValue) });
    }

    roundGlassPrice(step: number = 1): OfferItem {
        const roundedValue = Math.round(this.glassPrice / step) * step;
        return this.update({ glassPrice: round(roundedValue) });
    }

    toConfig(): ItemConfig {
        const config: ItemConfig = {
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
            data: { ...this.data }
        };

        if (this._explicitFields.has('customerPrice')) config.customerPrice = this.customerPrice;
        if (this._explicitFields.has('gross')) config.gross = this.gross;
        if (this._explicitFields.has('pricePerBottle')) config.pricePerBottle = this.pricePerBottle;

        return config;
    }
    toJSON() {
        return {
            ...this.toConfig(),
            pricePerBottle: this.pricePerBottle,
            pricePerUnit: this.pricePerUnit,
            gross: this.gross,
            vatAmount: this.vatAmount,
            customerPrice: this.customerPrice,
            totalPrice: this.totalPrice
        };
    }
}