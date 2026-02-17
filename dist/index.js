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
export {
  Offer,
  OfferItem,
  UNIT_MULTIPLIERS,
  round
};
