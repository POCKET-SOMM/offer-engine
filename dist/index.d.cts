interface ItemConfig {
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
    availableUnits?: string[] | undefined;
    data?: Record<string, any> | undefined;
}
interface OfferTotals {
    totalPrice: number;
    totalSaved: number;
}

declare class OfferItem {
    readonly id: string;
    readonly price: number;
    readonly discount: number;
    readonly margin: number;
    readonly unit: string;
    readonly quantity: number;
    readonly vatRate: number;
    readonly tags: string[];
    readonly availableUnits: string[];
    readonly glassPrice: number | undefined;
    readonly data: Record<string, any>;
    readonly pricePerBottle: number;
    readonly pricePerUnit: number;
    readonly gross: number;
    readonly vatAmount: number;
    readonly customerPrice: number;
    readonly totalPrice: number;
    constructor(config: ItemConfig);
    update(fields: Partial<ItemConfig>): OfferItem;
    roundCustomerPrice(step?: number): OfferItem;
    roundGlassPrice(step?: number): OfferItem;
    toConfig(): ItemConfig;
    toJSON(): {
        pricePerUnit: number;
        vatAmount: number;
        totalPrice: number;
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
        availableUnits?: string[] | undefined;
        data?: Record<string, any> | undefined;
    };
    /**
     * Create an OfferItem from a wine object.
     * Use overrides to provide custom logic like company-specific unit defaults.
     */
    static fromWine(wine: any, overrides?: Partial<ItemConfig>): OfferItem;
}

interface OfferConfig {
    id?: string;
    title?: string;
    items?: readonly OfferItem[];
    menu?: any;
    data?: Record<string, any>;
}
declare class Offer {
    readonly id: string;
    readonly title: string;
    readonly items: readonly OfferItem[];
    readonly menu: any | null;
    readonly data: Record<string, any>;
    readonly totals: OfferTotals;
    constructor(config?: OfferConfig);
    private _calculateGrandTotals;
    private _getMultiplier;
    updateTitle(title: string): Offer;
    setMenu(menu: any): Offer;
    /**
     * Add items to the offer.
     * Converts raw data to OfferItem instances automatically.
     */
    addItems(configs: ItemConfig[]): Offer;
    /**
     * Remove items by ID
     */
    removeItems(ids: string[]): Offer;
    /**
     * Updates a specific item.
     * Uses the immutable update pattern of OfferItem.
     */
    updateItem(itemId: string, changes: Partial<ItemConfig> | ((item: OfferItem) => OfferItem)): Offer;
    /**
     * Replaces an old item with a new one (Swap)
     */
    swapItem(oldId: string, newConfig: ItemConfig): Offer;
    /**
     * Bulk update field across multiple items
     */
    bulkUpdateField(ids: string[] | undefined, field: keyof ItemConfig, value: any): Offer;
    setMargin(value: number, ids?: string[]): Offer;
    setGross(value: number, ids?: string[]): Offer;
    setDiscount(value: number, ids?: string[]): Offer;
    setQuantity(value: number, ids?: string[]): Offer;
    setVatRate(value: number, ids?: string[]): Offer;
    setGlassPrice(value: number, ids?: string[]): Offer;
    roundCustomerPrices(step?: number, ids?: string[]): Offer;
    roundGlassPrices(step?: number, ids?: string[]): Offer;
    setUnit(unit: string, ids?: string[]): Offer;
    /**
     * Serialize for API storage
     */
    toJSON(): {
        id: string;
        title: string;
        menu: any;
        items: {
            pricePerUnit: number;
            vatAmount: number;
            totalPrice: number;
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
            availableUnits?: string[] | undefined;
            data?: Record<string, any> | undefined;
        }[];
        totals: OfferTotals;
        data: Record<string, any>;
    };
}

export { Offer, OfferItem };
