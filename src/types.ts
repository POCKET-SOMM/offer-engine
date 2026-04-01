export interface PourVolume {
    volume: number;      // ml, primary key (unique per item)
    price: number;       // price for this pour
    name?: string;       // optional display label (e.g. "Medium")
}

export interface ItemConfig {
    price: number;
    discount?: number | undefined;
    margin?: number | undefined;
    unit?: string | undefined;
    quantity?: number | undefined;
    vatRate?: number | undefined;
    tags?: string[] | undefined;
    id?: string | undefined;
    gross?: number | undefined;
    customerPrice?: number | undefined;
    pricePerBottle?: number | undefined;
    glassPrice?: number | undefined;
    pourVolumes?: PourVolume[] | undefined;
    availableUnits?: string[] | undefined;
    data?: Record<string, any> | undefined;
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
    totalPrice: number;
    totalSaved: number;
}
