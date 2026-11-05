jest.mock('../../models/Store', () => ({
  find: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findByIdAndDelete: jest.fn(),
}));
jest.mock('../../models/Offer', () => ({ find: jest.fn(), deleteMany: jest.fn() }));
jest.mock('../../models/User', () => ({ exists: jest.fn() }));
jest.mock('../../utils/auditLogger', () => ({ logAudit: jest.fn() }));

const Store = require('../../models/Store');
const Offer = require('../../models/Offer');
const User = require('../../models/User');
const { logAudit } = require('../../utils/auditLogger');
const controller = require('../../controllers/storeController');
const { mockQuery, mockRequest, mockResponse, ID_A } = require('../helpers/mocks');

const store = { _id: ID_A, name: 'Librería Azalea', address: 'Av. Juárez 1' };

beforeEach(() => {
  jest.clearAllMocks();
  User.exists.mockResolvedValue(null);
});

it('lists stores sorted by name', async () => {
  const query = mockQuery([store]);
  Store.find.mockReturnValue(query);
  const res = mockResponse();
  await controller.listStores(mockRequest(), res);
  expect(query.sort).toHaveBeenCalledWith({ name: 1 });
  expect(res.json).toHaveBeenCalledWith([store]);
});

describe('listNearStores', () => {
  const origin = { lat: '20.1757', lng: '-98.0527' };
  const near = { _id: 'n', name: 'Cerca', lat: 20.1763, lng: -98.0526 };
  const nearer = { _id: 'm', name: 'Más cerca', lat: 20.1757, lng: -98.0528 };
  const far = { _id: 'f', name: 'CDMX', lat: 19.4326, lng: -99.1332 };

  it('returns stores within the radius, nearest first, with distance_km', async () => {
    Store.find.mockReturnValue(mockQuery([near, far, nearer]));
    const res = mockResponse();
    await controller.listNearStores(mockRequest({ query: origin }), res);
    expect(Store.find).toHaveBeenCalledWith({ lat: { $ne: null }, lng: { $ne: null } });
    const body = res.json.mock.calls[0][0];
    expect(body.map((store) => store._id)).toEqual(['m', 'n']);
    expect(body[0].distance_km).toBe(0.01);
    expect(body[1]).toMatchObject({ name: 'Cerca', distance_km: 0.07 });
  });

  it('honours radius_km and caps it at 50 km', async () => {
    Store.find.mockReturnValue(mockQuery([near, far]));
    const res = mockResponse();
    await controller.listNearStores(mockRequest({ query: { ...origin, radius_km: '500' } }), res);
    expect(res.json.mock.calls[0][0].map((store) => store._id)).toEqual(['n']);

    Store.find.mockReturnValue(mockQuery([near, far]));
    const tiny = mockResponse();
    await controller.listNearStores(mockRequest({ query: { ...origin, radius_km: '0.01' } }), tiny);
    expect(tiny.json).toHaveBeenCalledWith([]);
  });

  it.each([
    ['missing coordinates', {}],
    ['a latitude out of range', { lat: '95', lng: '-98' }],
    ['a non-numeric longitude', { lat: '20', lng: 'abc' }],
    ['a zero radius', { lat: '20', lng: '-98', radius_km: '0' }],
    ['a non-numeric radius', { lat: '20', lng: '-98', radius_km: 'x' }],
  ])('rejects %s with 400', async (_label, query) => {
    await expect(
      controller.listNearStores(mockRequest({ query }), mockResponse())
    ).rejects.toMatchObject({ status: 400 });
    expect(Store.find).not.toHaveBeenCalled();
  });
});

it('returns a store with offers sorted by book title', async () => {
  Store.findById.mockReturnValue(mockQuery(store));
  Offer.find.mockReturnValue(
    mockQuery([
      { _id: 'o1', price: 10, stock: 5, book_id: { _id: 'b1', title: 'Rayuela' } },
      { _id: 'o2', price: 20, stock: 0, book_id: null },
      { _id: 'o3', price: 30, stock: 1, book_id: { _id: 'b2', title: 'Aura' } },
    ])
  );
  const res = mockResponse();
  await controller.getStore(mockRequest({ params: { id: ID_A } }), res);
  const body = res.json.mock.calls[0][0];
  expect(body.name).toBe(store.name);
  expect(body.offers.map((offer) => offer._id)).toEqual(['o2', 'o3', 'o1']);
  expect(body.offers[0]).toEqual({
    _id: 'o2',
    price: 20,
    stock: 0,
    is_available: false,
    book: null,
  });
  expect(body.offers[2]).toMatchObject({ stock: 5, is_available: true });
});

it('returns 404 for a missing store', async () => {
  Store.findById.mockReturnValue(mockQuery(null));
  await expect(
    controller.getStore(mockRequest({ params: { id: ID_A } }), mockResponse())
  ).rejects.toMatchObject({ status: 404 });
});

it('creates, updates and deletes a store with audit entries', async () => {
  Store.create.mockResolvedValue(store);
  Store.findByIdAndUpdate.mockResolvedValue(store);
  Store.findByIdAndDelete.mockResolvedValue(store);
  const req = mockRequest({
    params: { id: ID_A },
    body: { name: 'X', lat: 20.1, lng: -98.05, _id: 'hack' },
  });

  const createRes = mockResponse();
  await controller.createStore(req, createRes);
  expect(Store.create).toHaveBeenCalledWith({ name: 'X', lat: 20.1, lng: -98.05 });
  expect(createRes.status).toHaveBeenCalledWith(201);

  await controller.updateStore(req, mockResponse());
  const deleteRes = mockResponse();
  await controller.deleteStore(req, deleteRes);
  expect(Offer.deleteMany).toHaveBeenCalledWith({ store_id: ID_A });
  expect(deleteRes.status).toHaveBeenCalledWith(204);
  expect(logAudit.mock.calls.map((call) => call[1])).toEqual(['create', 'update', 'delete']);
});

it('returns 404 when updating or deleting a missing store', async () => {
  Store.findByIdAndUpdate.mockResolvedValue(null);
  Store.findByIdAndDelete.mockResolvedValue(null);
  const req = mockRequest({ params: { id: ID_A } });
  await expect(controller.updateStore(req, mockResponse())).rejects.toMatchObject({ status: 404 });
  await expect(controller.deleteStore(req, mockResponse())).rejects.toMatchObject({ status: 404 });
  expect(logAudit).not.toHaveBeenCalled();
});

it('refuses to delete a store that still has owner accounts', async () => {
  User.exists.mockResolvedValue({ _id: 'owner' });
  const req = mockRequest({ params: { id: ID_A } });
  await expect(controller.deleteStore(req, mockResponse())).rejects.toMatchObject({ status: 409 });
  expect(User.exists).toHaveBeenCalledWith({ role: 'store_owner', store_id: ID_A });
  expect(Store.findByIdAndDelete).not.toHaveBeenCalled();
});
