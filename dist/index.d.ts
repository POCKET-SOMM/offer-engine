declare const DEFAULT_BOTTLE_ML = 750;
declare const DEFAULT_POUR_PREMIUM = 0.15;
declare const OFFER_STATUSES: readonly ["draft", "sent", "accepted"];
type OfferStatus = (typeof OFFER_STATUSES)[number];
declare const DEFAULT_OFFER_STATUS: OfferStatus;
declare const SUMMARY_THUMBNAIL_LIMIT = 8;
declare const SUMMARY_GROUP_THUMBNAIL_LIMIT = 3;

/**
 * A rounding rule as three numbers: snap `(value - ending)` to a multiple of
 * `step`, then add `ending` back. `direction` picks which grid candidate wins
 * (default 'nearest').
 */
interface RoundingRule {
    step: number;
    ending?: number;
    direction?: 'nearest' | 'up' | 'down';
}
type RoundingPreset = 'none' | 'whole' | 'whole_up' | 'half' | 'half_up' | 'charm_99' | 'charm_95' | 'charm_49' | 'five';
/** Anything the round methods accept: a bare step (legacy), a preset name, or a rule. */
type RoundInput = number | RoundingPreset | RoundingRule | null | undefined;
declare const ROUNDING_PRESETS: Record<RoundingPreset, RoundingRule | null>;
/**
 * Normalize a RoundInput to a rule (or null = no rounding).
 * A bare number keeps the legacy `roundCustomerPrice(step)` semantics.
 * Unknown preset strings and non-positive steps resolve to null rather than
 * throwing — rounding is a finishing touch, never worth failing an update for.
 */
declare function resolveRounding(input: RoundInput): RoundingRule | null;
/**
 * Snap `value` per `input`. Returns `value` unchanged (2-dp normalized) when
 * the input resolves to no rule.
 *
 * `opts.min` is a hard floor: when the snapped candidate lands below it, the
 * result is re-snapped UPWARD to the first grid candidate at or above the
 * floor — never a bare max, which would emit an off-grid price.
 */
declare function applyRounding(value: number, input?: RoundInput, opts?: {
    min?: number;
}): number;

type GroupingMode = 'type' | 'country' | 'strategy' | 'custom';
interface FilterRule {
    type: string;
    key?: string | number | undefined;
    exclude?: boolean | undefined;
    range?: [number | null, number | null] | undefined;
}
interface CustomCategory {
    id: string;
    name: string;
    itemIds: string[];
}
interface StrategyCategory {
    id: string;
    name: string;
    filters: FilterRule[];
}
interface SavedStrategy {
    id: string;
    name: string;
    categories: StrategyCategory[];
}
interface GroupingConfig {
    mode: GroupingMode;
    strategyId?: string | undefined;
    customCategories?: CustomCategory[] | undefined;
}
interface GroupedSection {
    value: string;
    items: readonly OfferItem[];
    isOther?: boolean;
    isCustom?: boolean;
    custom?: CustomCategory;
    strategyCategory?: StrategyCategory;
    strategyMissing?: boolean;
}
declare const OTHER_SECTION_VALUE = "__other__";
declare const STRATEGY_MISSING_VALUE = "__strategy_missing__";
/** Rendering order for built-in 'type' mode. */
declare const WINE_TYPE_KEYS: readonly ["sparkling", "white", "rose", "orange", "red", "fortified", "dessert"];
type WineTypeKey = typeof WINE_TYPE_KEYS[number];

declare const NEGOTIATION_PARTIES: readonly ["seller", "buyer"];
type NegotiationParty = (typeof NEGOTIATION_PARTIES)[number];
declare const REQUEST_KINDS: readonly ["quantity", "remove", "replace", "add", "note"];
type RequestKind = (typeof REQUEST_KINDS)[number];
declare const REQUEST_OUTCOMES: readonly ["open", "done", "changed", "declined"];
type RequestOutcome = (typeof REQUEST_OUTCOMES)[number];
/** A frozen, display-ready record line for a sent version. Composed by the
 *  consumer (i18n lives there) and stored verbatim — numbers it contains are
 *  captured at send time so they can never drift. */
interface NegotiationLogLine {
    text: string;
    note?: string | undefined;
    who?: string | undefined;
}
/** One line of the offer as it stood at a transmission. */
interface BaselineLine {
    lineId: string;
    /** The wine's catalogue id (item.data.id), used to detect swaps. */
    wineId: string | null;
    title: string;
    /** The wine's thumbnail, so a request row can keep showing the wine it was
     *  about even after the line is swapped for a different one. */
    imgUrl?: string | undefined;
    quantity: number;
    unit: string;
    pricePerUnit: number;
    totalPrice: number;
}
/** Compact snapshot of the offer as transmitted. NOT a restore point and never
 *  rendered as a historical offer — it exists solely to derive `from → to`
 *  deltas and unprompted changes in the round that follows, and to freeze
 *  totals into log lines at send time. */
interface NegotiationBaseline {
    totals: {
        totalPrice: number;
    };
    lines: BaselineLine[];
}
/** One transmission by one party. Immutable once pushed. */
interface NegotiationVersion {
    id: string;
    /** 1-based, in send order. */
    number: number;
    sender: NegotiationParty;
    /** Display attribution captured at send ("Marco Bianchi · Bottega Nord"). */
    senderName?: string | undefined;
    /** ISO timestamp, supplied by the caller (the engine never reads the clock). */
    sentAt: string;
    log: NegotiationLogLine[];
    baseline: NegotiationBaseline;
}
/** A buyer ask from the live round. `from`/`declined`/`answerNote`/
 *  `answeredFreeText` are the only stored resolution state — everything else
 *  about "is this handled?" is derived (derive.ts). */
interface ChangeRequest {
    id: string;
    /** The buyer transmission that carried it. */
    versionId: string;
    kind: RequestKind;
    /** Target line. Null for free-text asks ('add' with no wine, 'note'). */
    lineId: string | null;
    /** Quantity as it stood when the round arrived — the "10" in "10 → 20". */
    from: number | null;
    /** Unit as it stood when the round arrived (pairs with `from`). */
    fromUnit: string | null;
    /** Requested quantity ('quantity' kind only). */
    to: number | null;
    /** Requested unit ('quantity' kind only) — lets an ask change unit, e.g.
     *  "10 bottles → 10 cases". Pairs with `to`; falls back to `fromUnit`. */
    toUnit: string | null;
    /** Requested wine for 'replace'/'add', in the consumer's wine shape. */
    wine: Record<string, any> | null;
    /** The requester's note. */
    note: string | null;
    /** Explicitly declined by the answerer — the one non-derivable outcome. */
    declined: boolean;
    /** The answerer's note, captured at the moment of the decision. */
    answerNote: string | null;
    /** 'note'-kind asks have nothing in the wine list to derive from; this is
     *  their explicit "I've answered this" bit. */
    answeredFreeText: boolean;
}
/** Consumer-facing input for submitting a round of requests — the engine
 *  stamps id, versionId, `from`, and the resolution fields itself. */
interface ChangeRequestInput {
    kind: RequestKind;
    lineId?: string | null | undefined;
    to?: number | null | undefined;
    /** Requested unit; defaults to the target line's current unit when omitted. */
    toUnit?: string | null | undefined;
    wine?: Record<string, any> | null | undefined;
    note?: string | null | undefined;
}
interface NegotiationState {
    state: 'open' | 'accepted';
    /** Whose move it is. Flips on every transmission. */
    turn: NegotiationParty;
    /** Append-only, oldest first. */
    versions: NegotiationVersion[];
    /** The live round's requests only. Frozen into the answering version's log
     *  at send and cleared. */
    requests: ChangeRequest[];
}
/** Who the offer was sent to. Captured when the rep shares it, and kept if the
 *  share is later withdrawn — re-sending should not ask again. This is the only
 *  place the buyer side has an identity; without it the conversation can only
 *  say "Restaurant". */
interface OfferRecipient {
    email: string;
    name?: string | undefined;
}
/** Projection embedded in toSummary() so list rows can badge "Your move" /
 *  "Their move" / "Approved" without loading items. */
interface NegotiationSummary {
    state: NegotiationState['state'];
    turn: NegotiationParty;
    openCount: number;
    versionCount: number;
}

interface PourVolume {
    volume: number;
    price: number;
    name?: string;
}
/**
 * Named by-the-glass pricing policies. Like a margin, a strategy is applied
 * once to many items and each item derives its own price from its own state,
 * so one call yields N different pour prices.
 *
 * - `bottle_recovery`      — the first pour pays the bottle: price = net cost.
 * - `proportional_premium` — guest bottle price scaled to the pour, plus a
 *                            service premium.
 * - `margin_parity`        — pour priced to hit the item's own bottle margin.
 */
type PourStrategy = 'bottle_recovery' | 'proportional_premium' | 'margin_parity';
declare const POUR_STRATEGIES: readonly PourStrategy[];
interface PourStrategyInput {
    strategy: PourStrategy;
    volume: number;
    premium?: number;
    bottleVolume?: number;
    name?: string;
}
/** One explicit per-item pour price, for prices the caller computed itself. */
interface PourPriceEntry {
    id: string;
    price: number;
}
interface OfferThumbnail {
    imgUrl?: string;
    title?: string;
}
interface OfferSummaryGroup {
    value: string;
    /** Display name for custom categories; absent for built-in type/country
     *  groups, whose `value` is a key the consumer localizes itself. */
    label?: string;
    count: number;
    thumbnails: OfferThumbnail[];
}
interface OfferSummary {
    thumbnails: OfferThumbnail[];
    /** Grouped preview reflecting the offer's own grouping config. */
    groups: OfferSummaryGroup[];
    /** The mode `groups` was built with — 'type' when grouping is unset or is a
     *  strategy (see Offer.toSummary). */
    groupingMode: GroupingMode;
    wineCount: number;
    status: OfferStatus;
    /** Titles of all attached menus, in order; null for an untitled menu. Empty
     *  when no menu is attached. */
    menuTitles: (string | null)[];
    /** Negotiation badge data — present once the offer has been shared. */
    negotiation?: NegotiationSummary;
    /** Who the offer was sent to — present once the rep has said. */
    recipient?: OfferRecipient;
}
interface ItemConfig {
    price: number;
    discount?: number | undefined;
    margin?: number | undefined;
    unit?: string | undefined;
    quantity?: number | undefined;
    vatRate?: number | undefined;
    tags?: string[] | undefined;
    id?: string | undefined;
    /** Durable line identity — see OfferItem.lineId. Defaults to `id`. */
    lineId?: string | undefined;
    gross?: number | undefined;
    customerPrice?: number | undefined;
    pricePerBottle?: number | undefined;
    glassPrice?: number | undefined;
    pourVolumes?: PourVolume[] | undefined;
    availableUnits?: string[] | undefined;
    data?: Record<string, any> | undefined;
}
interface OfferTotals {
    totalPrice: number;
    totalSaved: number;
}

declare class OfferItem {
    readonly id: string;
    /** Durable line identity. Unlike `id` (which is replaced by swapItem and
     *  dropped with removeItems), `lineId` survives a swap — negotiation
     *  requests reference lines through it so the conversation can keep
     *  pointing at "this slot in the offer" across rounds. Defaults to `id`,
     *  so offers stored before this field existed load with lineId === id. */
    readonly lineId: string;
    readonly price: number;
    readonly discount: number;
    readonly margin: number;
    readonly unit: string;
    readonly quantity: number;
    readonly vatRate: number;
    readonly tags: string[];
    readonly availableUnits: string[];
    readonly glassPrice: number | undefined;
    readonly pourVolumes: readonly PourVolume[];
    readonly data: Record<string, any>;
    readonly pricePerBottle: number;
    readonly pricePerUnit: number;
    readonly gross: number;
    readonly vatAmount: number;
    readonly customerPrice: number;
    readonly totalPrice: number;
    constructor(config: ItemConfig);
    update(fields: Partial<ItemConfig>): OfferItem;
    /**
     * Round the customer price. Accepts a bare step (legacy), a preset name
     * ('whole', 'half_up', 'charm_49', ...) or a RoundingRule. Rounding never
     * pushes the price below cost incl. VAT (gross >= 0), stepping up instead.
     */
    roundCustomerPrice(rule?: RoundInput): OfferItem;
    roundGlassPrice(rule?: RoundInput): OfferItem;
    roundPourVolumePrices(rule?: RoundInput): OfferItem;
    /** Set or update a pour volume. If volume exists, update price/name. If not, add it. */
    setPourVolume(pv: PourVolume): OfferItem;
    /**
     * Price one pour of THIS item under a named strategy. Each item derives
     * from its own state, so a single strategy produces a different price per
     * item — the same policy-not-price shape as setMargin.
     *
     * The per-ml floor (a pour is never cheaper per-ml than the bottle) is
     * advisory: nothing is clamped here, matching roundPourVolumePrices.
     */
    pourPriceFor(input: PourStrategyInput): number;
    /** Set a pour volume whose price this item derives from a named strategy. */
    setPourVolumeByStrategy(input: PourStrategyInput): OfferItem;
    /** Remove a pour volume by ml value */
    removePourVolume(volume: number): OfferItem;
    /** Remove all pour volumes */
    clearPourVolumes(): OfferItem;
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
        lineId?: string | undefined;
        gross?: number | undefined;
        customerPrice?: number | undefined;
        pricePerBottle?: number | undefined;
        glassPrice?: number | undefined;
        pourVolumes?: PourVolume[] | undefined;
        availableUnits?: string[] | undefined;
        data?: Record<string, any> | undefined;
    };
    /**
     * Create an OfferItem from a wine object.
     * Use overrides to provide custom logic like company-specific unit defaults.
     */
    static fromWine(wine: any, overrides?: Partial<ItemConfig>): OfferItem;
}

/** Fields an offer's items can be ordered by. */
type SortField = 'name' | 'price' | 'quantity' | 'vintage';
type SortDirection = 'asc' | 'desc';
/** The whole sort state: what we order by, and in which direction. */
interface SortConfig {
    field: SortField;
    dir: SortDirection;
}
declare const DEFAULT_SORT: SortConfig;
/**
 * Pure, stable-ish ordering of offer items. Never mutates the input — always
 * returns a new array. An unknown field is a no-op (items are returned in their
 * existing order) so a stale persisted sort can never throw or drop items.
 */
declare function sortItems(items?: readonly OfferItem[], sort?: SortConfig): OfferItem[];

interface OfferConfig {
    id?: string;
    title?: string;
    items?: readonly OfferItem[];
    /** Canonical multi-menu store. Each entry is an opaque menu object (the math
     *  engine never inspects it — pairing lives in the consumer app). */
    menus?: readonly any[];
    /** @deprecated Legacy single menu. Wrapped into `menus` on construction so
     *  older stored blobs and callers keep working. Prefer `menus`. */
    menu?: any;
    data?: Record<string, any>;
}
declare class Offer {
    readonly id: string;
    readonly title: string;
    readonly items: readonly OfferItem[];
    readonly menus: readonly any[];
    readonly data: Record<string, any>;
    readonly totals: OfferTotals;
    constructor(config?: OfferConfig);
    /** Back-compat accessor: the first attached menu, or null. A prototype
     *  getter (not an own field), so `{ ...this }` spreads `menus` rather than a
     *  stale `menu` — keeps single-menu consumers working through the migration. */
    get menu(): any | null;
    private _calculateGrandTotals;
    private _getMultiplier;
    updateTitle(title: string): Offer;
    /** Replace the full set of attached menus. */
    setMenus(menus: any[]): Offer;
    /** Append one menu. */
    addMenu(menu: any): Offer;
    /** Remove a menu by id. No-op if the id isn't attached. */
    removeMenu(menuId: string): Offer;
    /** @deprecated Single-menu shim — replaces all menus with `[menu]` (or clears
     *  them when null). Prefer setMenus / addMenu / removeMenu. */
    setMenu(menu: any): Offer;
    /** Manual lifecycle status. Defaults to 'draft' when unset. */
    get status(): OfferStatus;
    /** Set the manual lifecycle status immutably. Throws on an unknown value. */
    setStatus(status: OfferStatus): Offer;
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
     * Replaces an old item with a new one (Swap).
     * The outgoing item's lineId is carried onto the replacement so references
     * that point at the line (negotiation requests) survive the swap. An
     * explicit lineId in the config wins — that's how swap-undo restores the
     * original line identity.
     */
    swapItem(oldId: string, newConfig: ItemConfig): Offer;
    /**
     * Bulk update field across multiple items
     */
    /**
     * Bulk update field across multiple items.
     * `opts.round` (step | preset | rule) rounds each affected item's
     * customer price right after the update — pass it on price-deriving
     * fields (margin, gross, discount, vatRate, customerPrice). On
     * glassPrice it rounds the glass price instead.
     */
    bulkUpdateField(ids: string[] | undefined, field: keyof ItemConfig, value: any, opts?: {
        round?: RoundInput;
    }): Offer;
    setMargin(value: number, ids?: string[], opts?: {
        round?: RoundInput;
    }): Offer;
    setGross(value: number, ids?: string[], opts?: {
        round?: RoundInput;
    }): Offer;
    setDiscount(value: number, ids?: string[], opts?: {
        round?: RoundInput;
    }): Offer;
    setQuantity(value: number, ids?: string[]): Offer;
    setVatRate(value: number, ids?: string[], opts?: {
        round?: RoundInput;
    }): Offer;
    setPourVolume(pv: PourVolume, ids?: string[], opts?: {
        round?: RoundInput;
    }): Offer;
    /**
     * Price one pour size across many items from a single named strategy.
     * Each item derives its own price from its own state, so N items yield N
     * different pour prices in ONE call. Omitted `ids` means every item.
     */
    setPourVolumeByStrategy(input: PourStrategyInput, ids?: string[], opts?: {
        round?: RoundInput;
    }): Offer;
    /**
     * Set one pour size with an EXPLICIT price per item, in a single call —
     * for prices the caller computed itself (a custom strategy, or prices the
     * user dictated per bottle). Items absent from `prices` are untouched.
     */
    setPourVolumePerItem(volume: number, prices: PourPriceEntry[], opts?: {
        round?: RoundInput;
        name?: string;
    }): Offer;
    setGlassPrice(value: number, ids?: string[], opts?: {
        round?: RoundInput;
    }): Offer;
    roundCustomerPrices(rule?: RoundInput, ids?: string[]): Offer;
    roundGlassPrices(rule?: RoundInput, ids?: string[]): Offer;
    roundPourVolumePrices(rule?: RoundInput, ids?: string[]): Offer;
    setUnit(unit: string, ids?: string[]): Offer;
    /** The negotiation conversation, or undefined for a never-shared draft. */
    get negotiation(): NegotiationState | undefined;
    /**
     * Freeform notes on wine lines, keyed by lineId. Independent of
     * `negotiation` — a note isn't itself a negotiated change (those are
     * derived, see negotiation/derive.ts), it's an annotation the sender
     * attaches to a line, on or off a live conversation. Cleared by
     * `submitRequests()` once the round it explained has been answered and
     * is preserved in that round's frozen log — see `setLineNote`.
     */
    get notes(): Record<string, string>;
    /** Who this offer was sent to, once the rep has said. Undefined until then. */
    get recipient(): OfferRecipient | undefined;
    /**
     * Record (or clear) the recipient. Separate from the transmission itself:
     * it survives `withdrawShare()` on purpose, so re-sending a pulled-back
     * offer doesn't ask who it's for all over again.
     */
    setRecipient(recipient: OfferRecipient | null): Offer;
    private _negotiationOrFresh;
    private _withNegotiation;
    private _updateRequest;
    /**
     * Seller transmission: record a version of the offer as it stands (initial
     * share and every answer round). Freezes the caller-composed log, snapshots
     * the baseline, and passes the turn. The answered round's requests (and the
     * seller's unprompted notes) deliberately SURVIVE this send — they are what
     * the buyer reads as her receipt; they're replaced by her next
     * submitRequests. Derivation stays anchored to the round-opening baseline
     * (roundBaseline), so outcomes keep reading correctly after the send.
     * `sentAt` is caller-supplied so the engine stays deterministic.
     */
    sendVersion({ senderName, sentAt, log }: {
        senderName?: string;
        sentAt: string;
        log?: NegotiationLogLine[];
    }): Offer;
    /**
     * Buyer transmission: a round of change requests. Stamps each request's
     * identity and its `from` quantity off the current line, snapshots the
     * baseline, and passes the turn to the seller.
     */
    submitRequests({ requests, senderName, sentAt, log }: {
        requests: ChangeRequestInput[];
        senderName?: string;
        sentAt: string;
        log?: NegotiationLogLine[];
    }): Offer;
    /** Explicitly decline a request — the one outcome the items can't express. */
    declineRequest(id: string): Offer;
    undeclineRequest(id: string): Offer;
    /** The answerer's note, captured at the moment of the decision. */
    setRequestAnswer(id: string, note: string | null): Offer;
    /** Settle a free-text ask ('note', or 'add' nothing was added for). */
    markFreeTextAnswered(id: string, answered?: boolean): Offer;
    /**
     * Record (or clear) a note on a line. Works whether or not a negotiation
     * has ever started — a note doesn't require anyone to be mid-round, it's
     * just an annotation. See `notes` for the lifecycle.
     */
    setLineNote(lineId: string, note: string): Offer;
    /**
     * Whether the conversation can be pulled back to a draft: any time it's
     * live and not yet accepted, regardless of how many rounds have gone
     * back and forth. Withdrawing here is a full undo, not a partial one —
     * it drops every version and every request whole, so a later round's
     * history (their replies, their asks) is gone too, not just the
     * seller's first send.
     */
    get canWithdrawShare(): boolean;
    /**
     * Undo the share: the conversation is dropped whole — every version,
     * every request — and the offer goes back to being a draft, as if it had
     * never been sent. The wine list is untouched — withdrawing pulls back
     * the transmission, not the edits made since. A no-op unless
     * `canWithdrawShare`.
     */
    withdrawShare(): Offer;
    /** Buyer accepts the offer as it stands. Ends the conversation. */
    acceptNegotiation(): Offer;
    private _withGrouping;
    private _grouping;
    private _customCategories;
    /** Replace (or clear) the grouping config on offer.data. */
    setGrouping(grouping: GroupingConfig | null): Offer;
    /** The offer's saved item ordering, if one has been set. */
    get sort(): SortConfig | undefined;
    /** Replace (or clear) the sort config on offer.data. */
    setSort(sort: SortConfig | null): Offer;
    /** Items in the offer's saved sort order — insertion order when unset. */
    get sortedItems(): readonly OfferItem[];
    /** Switch to custom mode, seeding with the provided categories (snapshot from current grouping). */
    enterCustomMode(initialCategories: CustomCategory[]): Offer;
    /** Append a new custom category. Throws on validation failure. */
    addCustomCategory(name: string, opts?: {
        reserved?: readonly string[];
    }): Offer;
    /** Rename a custom category. Throws on validation failure. */
    renameCustomCategory(id: string, name: string, opts?: {
        reserved?: readonly string[];
    }): Offer;
    removeCustomCategory(id: string): Offer;
    /** Reorder existing categories by id. Unknown ids are ignored; missing ids retain their position at the end. */
    reorderCustomCategories(orderedIds: string[]): Offer;
    /**
     * Move an item to a category. Pass null to remove from all categories
     * (item then renders in the synthetic "Other" section).
     */
    moveItemToCategory(itemId: string, categoryId: string | null): Offer;
    /**
     * Drop itemIds in custom categories that no longer reference live items.
     * Safe to call when not in custom mode (no-op).
     */
    normalizeCustomGrouping(): Offer;
    /**
     * Compact projection for list views: a flat capped thumbnail preview, the
     * same wines grouped the way the offer itself is grouped, the total wine
     * count, and the lifecycle status. Embedded into toJSON().summary so a
     * stored offer carries its own brief representation — list endpoints can
     * surface `summary` without loading every item.
     *
     * Item order follows the offer's saved `sort` (insertion order when unset).
     *
     * NOTE: `strategy` grouping is previewed as `type`. A saved strategy's
     * definition (its categories and filter rules) lives in the consumer app,
     * not on the offer, so it cannot be resolved here. Manual (`custom`)
     * grouping is fully self-contained and IS honoured.
     */
    toSummary(): OfferSummary;
    /**
     * Serialize for API storage. `summary` is a top-level sibling of `items`
     * (not nested in `data`) so consumers projecting a brief list payload read
     * it straight off the stored record.
     */
    toJSON(): {
        id: string;
        title: string;
        menus: readonly any[];
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
            lineId?: string | undefined;
            gross?: number | undefined;
            customerPrice?: number | undefined;
            pricePerBottle?: number | undefined;
            glassPrice?: number | undefined;
            pourVolumes?: PourVolume[] | undefined;
            availableUnits?: string[] | undefined;
            data?: Record<string, any> | undefined;
        }[];
        totals: OfferTotals;
        data: Record<string, any>;
        summary: OfferSummary;
    };
}

interface GroupOptions {
    savedStrategies?: SavedStrategy[];
}
/**
 * Pure grouping derivation. Never mutates inputs.
 * Returns sections in display order; "Other" pinned to the end when present.
 */
declare function groupItems(items: readonly OfferItem[], grouping: GroupingConfig, options?: GroupOptions): GroupedSection[];

/**
 * Evaluate a set of filter rules against an item.
 * Semantics mirror src/api/utils/filterBuilder.js:
 *   - rules of the same `type` combine with OR (any include matches; any exclude disqualifies)
 *   - rule groups of different types combine with AND
 */
declare function matchesRules(item: OfferItem, rules: FilterRule[]): boolean;

/**
 * Detect the canonical wine-type bucket for an item.
 * Returns null when no key matches (consumer routes to OTHER_SECTION_VALUE).
 *
 * Accepts three real-world input shapes on `item.data`:
 *   - `type: string`          — legacy/normalized form
 *   - `type: string[]`        — catalog wines (Qdrant search results)
 *   - `wine_type: string`     — wine-card items (parsed from menu uploads),
 *                               used as a fallback when `type` is absent
 */
declare function detectWineType(item: OfferItem): WineTypeKey | null;

/**
 * Drop itemIds that no longer reference live items.
 * Returns the original array reference if nothing changed (allows cheap === checks).
 */
declare function normalizeCustomGrouping(categories: readonly CustomCategory[], liveItemIds: ReadonlySet<string>): CustomCategory[];
type CategoryNameValidation = {
    ok: true;
} | {
    ok: false;
    reason: 'empty' | 'duplicate' | 'reserved';
};
/**
 * Validate a proposed custom-category name.
 * - Empty / whitespace-only → 'empty'
 * - Matches an existing name (case-insensitive, trimmed) → 'duplicate'
 * - Matches any reserved name (case-insensitive, trimmed) → 'reserved'
 *   (The consumer supplies translations of "Other" from every locale.)
 */
declare function validateCategoryName(name: string, existing: readonly string[], reserved: readonly string[]): CategoryNameValidation;

/** Structural view of an Offer — keeps this module free of a value-import
 *  cycle with Offer.ts (which imports these functions for toSummary). */
interface NegotiationOfferView {
    items: readonly OfferItem[];
    negotiation?: NegotiationState | undefined;
}
interface ResolvedRequest {
    request: ChangeRequest;
    outcome: RequestOutcome;
    /** Outcome token for the consumer to localize; null while open. */
    label: string | null;
    params?: Record<string, any> | undefined;
}
type UnpromptedChangeType = 'quantity' | 'price' | 'swap' | 'add' | 'remove';
/** A change nobody asked for, derived by diffing the current items against the
 *  latest transmitted baseline. Reverting the edit makes the entry disappear. */
interface UnpromptedChange {
    type: UnpromptedChangeType;
    lineId: string;
    /** Current item (absent for 'remove'). */
    item?: OfferItem | undefined;
    /** Baseline line (absent for 'add'). */
    baseline?: BaselineLine | undefined;
    from?: number | undefined;
    to?: number | undefined;
    /** Previous wine title, for 'swap'. */
    fromTitle?: string | undefined;
}
declare function itemByLineId(view: NegotiationOfferView, lineId: string | null): OfferItem | undefined;
/** The offer as last transmitted. Undefined before the first send. */
declare function latestBaseline(view: NegotiationOfferView): NegotiationBaseline | undefined;
/** The offer as it stood when the live round OPENED — the anchor request
 *  deltas and unprompted changes derive against. This is the baseline of the
 *  buyer transmission that carried the live requests; it matters after the
 *  seller answers (requests survive that send so the buyer can read the
 *  receipt), when the *latest* baseline already contains the answers.
 *  Falls back to the latest baseline when no round is live. */
declare function roundBaseline(view: NegotiationOfferView): NegotiationBaseline | undefined;
/** Snapshot the current items into a baseline. Called at send time. */
declare function buildBaseline(view: NegotiationOfferView, totalPrice: number): NegotiationBaseline;
/**
 * Derive one request's outcome from the live offer (§4.1 of the handoff).
 *
 * An explicit decline always wins; everything else is read off the wine list.
 * The request is compared against the round-opening baseline line across ALL
 * dimensions (quantity, unit, wine identity, price), so that answering an ask
 * with a *different kind* of change is never lost: e.g. a swap request the
 * seller answers by cutting the volume reports `changed` (volumeInstead)
 * rather than sitting `open` while the volume change vanishes. The dimension
 * the request actually asked about wins when it's satisfied.
 */
declare function resolveRequest(request: ChangeRequest, view: NegotiationOfferView): ResolvedRequest;
/** Resolve the whole live round, in stored (offer) order. */
declare function resolveRequests(view: NegotiationOfferView): ResolvedRequest[];
declare function countOpenRequests(view: NegotiationOfferView): number;
/**
 * Changes nobody asked for: the diff between current items and the round's
 * opening baseline, minus anything a live request explains (a request
 * targeting that lineId, or — for additions — any pending 'add' ask).
 *
 * `opts.baseline` overrides the anchor (e.g. the latest baseline, to ask
 * "what changed since the last transmission?"); `opts.ignoreRequests` skips
 * the request-explains-it exclusion, which only makes sense against the
 * round anchor.
 */
declare function deriveUnpromptedChanges(view: NegotiationOfferView, opts?: {
    baseline?: NegotiationBaseline;
    ignoreRequests?: boolean;
}): UnpromptedChange[];

export { type BaselineLine, type CategoryNameValidation, type ChangeRequest, type ChangeRequestInput, type CustomCategory, DEFAULT_BOTTLE_ML, DEFAULT_OFFER_STATUS, DEFAULT_POUR_PREMIUM, DEFAULT_SORT, type FilterRule, type GroupedSection, type GroupingConfig, type GroupingMode, type ItemConfig, NEGOTIATION_PARTIES, type NegotiationBaseline, type NegotiationLogLine, type NegotiationOfferView, type NegotiationParty, type NegotiationState, type NegotiationSummary, type NegotiationVersion, OFFER_STATUSES, OTHER_SECTION_VALUE, Offer, OfferItem, type OfferRecipient, type OfferStatus, type OfferSummary, type OfferSummaryGroup, type OfferThumbnail, POUR_STRATEGIES, type PourPriceEntry, type PourStrategy, type PourStrategyInput, type PourVolume, REQUEST_KINDS, REQUEST_OUTCOMES, ROUNDING_PRESETS, type RequestKind, type RequestOutcome, type ResolvedRequest, type RoundInput, type RoundingPreset, type RoundingRule, STRATEGY_MISSING_VALUE, SUMMARY_GROUP_THUMBNAIL_LIMIT, SUMMARY_THUMBNAIL_LIMIT, type SavedStrategy, type SortConfig, type SortDirection, type SortField, type StrategyCategory, type UnpromptedChange, type UnpromptedChangeType, WINE_TYPE_KEYS, type WineTypeKey, applyRounding, buildBaseline, countOpenRequests, deriveUnpromptedChanges, detectWineType, groupItems, itemByLineId, latestBaseline, matchesRules, normalizeCustomGrouping, resolveRequest, resolveRequests, resolveRounding, roundBaseline, sortItems, validateCategoryName };
