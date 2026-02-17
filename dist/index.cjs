"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  Offer: () => Offer,
  OfferItem: () => OfferItem,
  UNIT_MULTIPLIERS: () => UNIT_MULTIPLIERS,
  round: () => round
});
module.exports = __toCommonJS(index_exports);

// src/constants.ts
var UNIT_MULTIPLIERS = {
  BOTTLE: 1,
  CASE: 6,
  PALLET: 600
  // Example value, adjust as needed
};

// src/utils/math.ts
function round(value, precision = 2) {
  const factor = Math.pow(10, precision);
  return Math.round(value * factor) / factor;
}

// src/OfferItem.ts
var OfferItem = class {
  data;
  constructor(data) {
    this.data = data;
  }
  get id() {
    return this.data.id;
  }
  get name() {
    return this.data.name;
  }
  get price() {
    return this.data.price;
  }
  get quantity() {
    return this.data.quantity;
  }
  get unit() {
    return this.data.unit;
  }
  get multiplier() {
    return UNIT_MULTIPLIERS[this.unit];
  }
  get totalUnits() {
    return this.quantity * this.multiplier;
  }
  get totalPrice() {
    return round(this.price * this.quantity);
  }
  toJSON() {
    return { ...this.data };
  }
};

// src/Offer.ts
var Offer = class {
  data;
  items;
  constructor(data) {
    this.data = data;
    this.items = data.items.map((item) => new OfferItem(item));
  }
  get id() {
    return this.data.id;
  }
  get totalItems() {
    return this.items.reduce((sum, item) => sum + item.quantity, 0);
  }
  get totalUnits() {
    return this.items.reduce((sum, item) => sum + item.totalUnits, 0);
  }
  get totalPrice() {
    return round(this.items.reduce((sum, item) => sum + item.totalPrice, 0));
  }
  addItem(itemData) {
    const newItem = new OfferItem(itemData);
    this.items.push(newItem);
    this.data.items.push(itemData);
  }
  removeItem(itemId) {
    this.items = this.items.filter((item) => item.id !== itemId);
    this.data.items = this.data.items.filter((item) => item.id !== itemId);
  }
  toJSON() {
    return {
      ...this.data,
      items: this.items.map((item) => item.toJSON())
    };
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Offer,
  OfferItem,
  UNIT_MULTIPLIERS,
  round
});
