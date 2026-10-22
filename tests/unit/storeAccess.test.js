jest.mock('../../models/Offer', () => ({ findById: jest.fn() }));

const Offer = require('../../models/Offer');
const { require_store_access, offerStoreId } = require('../../middlewares/storeAccess');
const { mockQuery, mockRequest, mockResponse, ID_A, ID_B, ID_C } = require('../helpers/mocks');

const owner = { _id: ID_C, role: 'store_owner', store_id: ID_A };

beforeEach(() => jest.clearAllMocks());

describe('require_store_access', () => {
  const byParam = require_store_access((req) => req.params.id);

  it('lets admins operate on any store', async () => {
    const next = jest.fn();
    await byParam(mockRequest({ params: { id: ID_B } }), mockResponse(), next);
    expect(next).toHaveBeenCalledWith();
  });

  it('lets a store owner operate on its own store only', async () => {
    const next = jest.fn();
    await byParam(mockRequest({ user: owner, params: { id: ID_A } }), mockResponse(), next);
    expect(next).toHaveBeenCalledWith();
    await expect(
      byParam(mockRequest({ user: owner, params: { id: ID_B } }), mockResponse(), jest.fn())
    ).rejects.toMatchObject({ status: 403 });
  });

  it('rejects owners when no store is referenced unless the getter is optional', async () => {
    const req = mockRequest({ user: owner, body: {} });
    const getter = (r) => r.body.store_id;
    await expect(
      require_store_access(getter)(req, mockResponse(), jest.fn())
    ).rejects.toMatchObject({ status: 403 });
    const next = jest.fn();
    await require_store_access(getter, { optional: true })(req, mockResponse(), next);
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects readers, owners without a store and anonymous requests', async () => {
    for (const user of [
      { _id: ID_C, role: 'reader' },
      { ...owner, store_id: null },
    ]) {
      await expect(
        byParam(mockRequest({ user, params: { id: ID_A } }), mockResponse(), jest.fn())
      ).rejects.toMatchObject({ status: 403 });
    }
    await expect(
      byParam(mockRequest({ user: undefined }), mockResponse(), jest.fn())
    ).rejects.toMatchObject({ status: 401 });
  });

  it('accepts async getters and ObjectId-like values', async () => {
    const next = jest.fn();
    const getter = async () => ({ toString: () => ID_A });
    await require_store_access(getter)(mockRequest({ user: owner }), mockResponse(), next);
    expect(next).toHaveBeenCalledWith();
  });
});

describe('offerStoreId', () => {
  it("resolves the offer's store id, or null when missing or malformed", async () => {
    Offer.findById.mockReturnValueOnce(mockQuery({ store_id: ID_A }));
    expect(await offerStoreId({ params: { id: ID_B } })).toBe(ID_A);
    Offer.findById.mockReturnValueOnce(mockQuery(null));
    expect(await offerStoreId({ params: { id: ID_B } })).toBeNull();
    expect(await offerStoreId({ params: { id: 'nope' } })).toBeNull();
    expect(Offer.findById).toHaveBeenCalledTimes(2);
  });
});
