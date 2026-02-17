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
        this.discount = round(config.discount || 0);
        this.margin = round(config.margin || 0);
        this.unit = config.unit || 'bottle';
        this.quantity = config.quantity ?? 1;
        this.vatRate = config.vatRate ?? 25.5;
        this.tags = config.tags || [];
        this.data = config.data || {};

        // Run calculations
        const results = this._calculate();
        this.pricePerBottle = results.pricePerBottle;
        this.pricePerUnit = results.pricePerUnit;
        this.gross = results.gross;
        this.vatAmount = results.vatAmount;
        this.customerPrice = results.customerPrice;
        this.totalPrice = results.totalPrice;

        Object.freeze(this); // Ensure immutability
    }

    private _calculate(): CalculatedTotals {
        const pBottle = round(this.price * (1 - this.discount / 100));
        const multiplier = UNIT_MULTIPLIERS[this.unit] || 1;
        const pUnit = round(pBottle * multiplier);
        const marginMultiplier = 1 - this.margin / 100;

        // Handle edge case where margin is 100%
        const grossVal = marginMultiplier === 0 ? 0 : round(pBottle / marginMultiplier - pBottle);

        const priceBeforeVat = pBottle + grossVal;
        const vAmount = round(priceBeforeVat * (this.vatRate / 100));
        const cPrice = round(priceBeforeVat + vAmount);

        const tPrice = cPrice * multiplier * this.quantity;

        return {
            pricePerBottle: pBottle,
            pricePerUnit: pUnit,
            gross: grossVal,
            vatAmount: vAmount,
            customerPrice: cPrice,
            totalPrice: tPrice
        };
    }

    // --- Immutable Update Patterns ---

    update(fields: Partial<ItemConfig>): OfferItem {
        return new OfferItem({ ...this.toConfig(), ...fields });
    }

    // Example of your "Reverse Calculation" logic
    updateCustomerPrice(target: number): OfferItem {
        const priceBeforeVat = target / (1 + this.vatRate / 100);
        const targetGross = priceBeforeVat - this.pricePerBottle;
        const newMargin = round((targetGross / priceBeforeVat) * 100);
        return this.update({ margin: newMargin });
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
            data: { ...this.data }
        };
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