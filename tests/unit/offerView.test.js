const mongoose = require('mongoose');
const Offer = require('../../models/Offer');
const {
  isInStock,
  withAvailability,
  computeMinPrice,
  computeTotalStock,
  parseStock,
} = require('../../utils/offerView');

describe('offerView', () => {
  it('derives is_available from stock for plain objects and documents', () => {
    expect(withAvailability({ _id: 'o1', stock: 2 })).toEqual({
      _id: 'o1',
      stock: 2,
      is_available: true,
    });
    expect(withAvailability({ _id: 'o2', stock: 0, is_available: true })).toMatchObject({
      stock: 0,
      is_available: false,
    });
    expect(withAvailability({ toObject: () => ({ _id: 'o3' }) })).toEqual({
      _id: 'o3',
      stock: 0,
      is_available: false,
    });
    expect(isInStock(null)).toBe(false);
  });

  it('computes min_price ignoring zero-stock offers and total_stock', () => {
    const offers = [
      { price: 50, stock: 0 },
      { price: 80, stock: 2 },
      { price: 70, stock: 1 },
    ];
    expect(computeMinPrice(offers)).toBe(70);
    expect(computeMinPrice([{ price: 10, stock: 0 }])).toBeNull();
    expect(computeTotalStock(offers)).toBe(3);
    expect(computeTotalStock([])).toBe(0);
  });

  it('parses stock as a non-negative integer', () => {
    expect(parseStock(undefined)).toBeUndefined();
    expect(parseStock(4)).toBe(4);
    expect(parseStock('12')).toBe(12);
    for (const bad of [-1, 0.5, 'x', null, [], {}]) {
      expect(() => parseStock(bad)).toThrow('stock must be a non-negative integer');
    }
  });
});

describe('Offer model stock validation', () => {
  const base = () => ({
    book_id: new mongoose.Types.ObjectId(),
    store_id: new mongoose.Types.ObjectId(),
    price: 100,
  });

  it('defaults stock to 0 and does not store is_available', async () => {
    const offer = new Offer({ ...base(), is_available: true });
    await expect(offer.validate()).resolves.toBeUndefined();
    expect(offer.stock).toBe(0);
    expect(offer.toObject().is_available).toBeUndefined();
  });

  it.each([
    [-1, 'stock must be zero or greater'],
    [2.5, 'stock must be an integer'],
  ])('rejects stock %p', async (stock, message) => {
    const error = await new Offer({ ...base(), stock }).validate().catch((err) => err);
    expect(error.errors.stock.message).toBe(message);
  });
});
