export interface ItemConfig {
    price: number;
    discount?: number;
    margin?: number;
    unit?: string;
    quantity?: number;
    vatRate?: number;
    tags?: string[];
    id?: string;
    gross?: number;
    customerPrice?: number;
    pricePerBottle?: number;
    data?: Record<string, any>;
}

export interface CalculatedTotals {
    pricePerBottle: number;
    pricePerUnit: number;
    gross: number;
    vatAmount: number;
    customerPrice: number;
    totalPrice: number;
}

export interface OfferTotals {
    totalNet: number;
    totalVat: number;
    totalGross: number;
}
