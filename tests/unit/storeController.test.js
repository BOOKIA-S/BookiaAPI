jest.mock('../../models/Store', () => ({
  find: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findByIdAndDelete: jest.fn(),
}));
jest.mock('../../models/Offer', () => ({ find: jest.fn(), deleteMany: jest.fn() }));
jest.mock('../../utils/auditLogger', () => ({ logAudit: jest.fn() }));

const Store = require('../../models/Store');
const Offer = require('../../models/Offer');
const { logAudit } = require('../../utils/auditLogger');
const controller = require('../../controllers/storeController');
const { mockQuery, mockRequest, mockResponse, ID_A } = require('../helpers/mocks');

const store = { _id: ID_A, name: 'Librería Azalea', address: 'Av. Juárez 1' };

beforeEach(() => jest.clearAllMocks());

it('lists stores sorted by name', async () => {
  const query = mockQuery([store]);
  Store.find.mockReturnValue(query);
  const res = mockResponse();
  await controller.listStores(mockRequest(), res);
  expect(query.sort).toHaveBeenCalledWith({ name: 1 });
  expect(res.json).toHaveBeenCalledWith([store]);
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
  const req = mockRequest({ params: { id: ID_A }, body: { name: 'X', _id: 'hack' } });

  const createRes = mockResponse();
  await controller.createStore(req, createRes);
  expect(Store.create).toHaveBeenCalledWith({ name: 'X' });
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
