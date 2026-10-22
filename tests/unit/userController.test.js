jest.mock('bcrypt', () => ({ hash: jest.fn(async () => 'hashed') }));
jest.mock('../../models/User', () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  exists: jest.fn(),
  create: jest.fn(),
  findOneAndUpdate: jest.fn(),
  findOneAndDelete: jest.fn(),
}));
jest.mock('../../models/Store', () => ({ exists: jest.fn() }));
jest.mock('../../utils/auditLogger', () => ({ logAudit: jest.fn() }));

const User = require('../../models/User');
const Store = require('../../models/Store');
const { logAudit } = require('../../utils/auditLogger');
const controller = require('../../controllers/userController');
const { mockQuery, mockRequest, mockResponse, ID_A, ID_B, ID_C } = require('../helpers/mocks');

const ownerDoc = {
  _id: ID_C,
  email: 'duena@test.dev',
  name: 'Lucía',
  role: 'store_owner',
  store_id: { _id: ID_B, name: 'Librería Azalea' },
  must_change_password: true,
  created_at: '2026-10-22T00:00:00.000Z',
};
const ownerView = {
  _id: ID_C,
  email: 'duena@test.dev',
  name: 'Lucía',
  role: 'store_owner',
  store_id: ID_B,
  store: { _id: ID_B, name: 'Librería Azalea' },
  must_change_password: true,
  created_at: '2026-10-22T00:00:00.000Z',
};
const validBody = {
  name: 'Lucía',
  email: 'Duena@Test.dev',
  password: 'secreto123',
  store_id: ID_B,
};

beforeEach(() => {
  jest.clearAllMocks();
  Store.exists.mockResolvedValue({ _id: ID_B });
  User.exists.mockResolvedValue(null);
  User.findOne.mockReturnValue(mockQuery(ownerDoc));
});

it('lists only store owners with their store', async () => {
  const query = mockQuery([ownerDoc, { ...ownerDoc, store_id: null }]);
  User.find.mockReturnValue(query);
  const res = mockResponse();
  await controller.listStoreOwners(mockRequest(), res);
  expect(User.find.mock.calls[0][0]).toEqual({ role: 'store_owner' });
  expect(query.sort).toHaveBeenCalledWith({ email: 1 });
  expect(res.json).toHaveBeenCalledWith({
    items: [ownerView, { ...ownerView, store_id: null, store: null }],
  });
});

describe('createStoreOwner', () => {
  it('creates a store owner assigned to an existing store', async () => {
    User.create.mockImplementation(async (doc) => ({ _id: ID_C, ...doc }));
    const res = mockResponse();
    await controller.createStoreOwner(mockRequest({ body: { ...validBody, role: 'admin' } }), res);
    expect(User.create).toHaveBeenCalledWith({
      name: 'Lucía',
      email: 'duena@test.dev',
      password_hash: 'hashed',
      role: 'store_owner',
      store_id: ID_B,
      must_change_password: true,
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ user: ownerView });
    expect(logAudit).toHaveBeenCalledWith(expect.anything(), 'create', 'user', ID_C);
  });

  it.each([
    [{ ...validBody, name: ' ' }, 400],
    [{ ...validBody, email: 'nope' }, 400],
    [{ ...validBody, password: 'short' }, 400],
    [{ ...validBody, store_id: 'bad' }, 400],
    [{ ...validBody, store_id: undefined }, 400],
  ])('validates the body (%#)', async (body, status) => {
    await expect(
      controller.createStoreOwner(mockRequest({ body }), mockResponse())
    ).rejects.toMatchObject({ status });
    expect(User.create).not.toHaveBeenCalled();
  });

  it('rejects a missing store and a duplicate email', async () => {
    Store.exists.mockResolvedValueOnce(null);
    await expect(
      controller.createStoreOwner(mockRequest({ body: validBody }), mockResponse())
    ).rejects.toMatchObject({ status: 400, message: 'Store does not exist' });
    User.exists.mockResolvedValueOnce({ _id: ID_A });
    await expect(
      controller.createStoreOwner(mockRequest({ body: validBody }), mockResponse())
    ).rejects.toMatchObject({ status: 409 });
    User.create.mockRejectedValueOnce({ code: 11000 });
    await expect(
      controller.createStoreOwner(mockRequest({ body: validBody }), mockResponse())
    ).rejects.toMatchObject({ status: 409 });
  });

  it('rethrows unexpected database errors', async () => {
    User.create.mockRejectedValueOnce(new Error('boom'));
    await expect(
      controller.createStoreOwner(mockRequest({ body: validBody }), mockResponse())
    ).rejects.toThrow('boom');
  });
});

describe('updateStoreOwner', () => {
  it('reassigns the store and renames the owner', async () => {
    User.findOneAndUpdate.mockReturnValue(mockQuery({ _id: ID_C }));
    const res = mockResponse();
    await controller.updateStoreOwner(
      mockRequest({ params: { id: ID_C }, body: { store_id: ID_B, name: ' Lu ', role: 'admin' } }),
      res
    );
    const [filter, update] = User.findOneAndUpdate.mock.calls[0];
    expect(filter).toEqual({ _id: ID_C, role: 'store_owner' });
    expect(update).toEqual({ store_id: ID_B, name: 'Lu' });
    expect(res.json).toHaveBeenCalledWith({ user: ownerView });
    expect(logAudit).toHaveBeenCalledWith(expect.anything(), 'update', 'user', ID_C);
  });

  it('validates input and returns 404 for non owners', async () => {
    await expect(
      controller.updateStoreOwner(
        mockRequest({ params: { id: ID_C }, body: { name: '' } }),
        mockResponse()
      )
    ).rejects.toMatchObject({ status: 400 });
    User.findOneAndUpdate.mockReturnValue(mockQuery(null));
    await expect(
      controller.updateStoreOwner(mockRequest({ params: { id: ID_A }, body: {} }), mockResponse())
    ).rejects.toMatchObject({ status: 404 });
    expect(logAudit).not.toHaveBeenCalled();
  });
});

describe('deleteStoreOwner', () => {
  it('deletes store owner accounts only', async () => {
    User.findOneAndDelete.mockResolvedValueOnce({ _id: ID_C });
    const res = mockResponse();
    await controller.deleteStoreOwner(mockRequest({ params: { id: ID_C } }), res);
    expect(User.findOneAndDelete).toHaveBeenCalledWith({ _id: ID_C, role: 'store_owner' });
    expect(res.status).toHaveBeenCalledWith(204);

    User.findOneAndDelete.mockResolvedValueOnce(null);
    await expect(
      controller.deleteStoreOwner(mockRequest({ params: { id: ID_A } }), mockResponse())
    ).rejects.toMatchObject({ status: 404 });
  });

  it('returns 404 when the owner disappears before it is reloaded', async () => {
    User.findOneAndUpdate.mockReturnValue(mockQuery({ _id: ID_C }));
    User.findOne.mockReturnValue(mockQuery(null));
    await expect(
      controller.updateStoreOwner(mockRequest({ params: { id: ID_C }, body: {} }), mockResponse())
    ).rejects.toMatchObject({ status: 404 });
  });
});
