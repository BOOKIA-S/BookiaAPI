jest.mock('../../models/Offer', () => ({
  create: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findByIdAndDelete: jest.fn(),
}));
jest.mock('../../models/Book', () => ({ exists: jest.fn() }));
jest.mock('../../models/Store', () => ({ exists: jest.fn() }));
jest.mock('../../utils/auditLogger', () => ({ logAudit: jest.fn() }));

const Offer = require('../../models/Offer');
const Book = require('../../models/Book');
const Store = require('../../models/Store');
const { logAudit } = require('../../utils/auditLogger');
const controller = require('../../controllers/offerController');
const { mockRequest, mockResponse, ID_A, ID_B, ID_C } = require('../helpers/mocks');

const body = { book_id: ID_A, store_id: ID_B, price: 120, is_available: true };
const offer = { _id: ID_C, ...body };

beforeEach(() => {
  jest.clearAllMocks();
  Book.exists.mockResolvedValue({ _id: ID_A });
  Store.exists.mockResolvedValue({ _id: ID_B });
});

describe('createOffer', () => {
  it('creates an offer after checking references and audits it', async () => {
    Offer.create.mockResolvedValue(offer);
    const req = mockRequest({ body: { ...body, extra: 1 } });
    const res = mockResponse();
    await controller.createOffer(req, res);
    expect(Offer.create).toHaveBeenCalledWith(body);
    expect(logAudit).toHaveBeenCalledWith(req.user, 'create', 'offer', ID_C);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it.each([
    [{ ...body, book_id: 'bad' }, 'Invalid book_id'],
    [{ ...body, store_id: 42 }, 'Invalid store_id'],
  ])('rejects malformed ids (%#)', async (input, message) => {
    await expect(
      controller.createOffer(mockRequest({ body: input }), mockResponse())
    ).rejects.toMatchObject({ status: 400, message });
  });

  it('rejects references that do not exist', async () => {
    Book.exists.mockResolvedValueOnce(null);
    await expect(
      controller.createOffer(mockRequest({ body }), mockResponse())
    ).rejects.toMatchObject({ message: 'Book does not exist' });
    Store.exists.mockResolvedValueOnce(null);
    await expect(
      controller.createOffer(mockRequest({ body }), mockResponse())
    ).rejects.toMatchObject({ message: 'Store does not exist' });
    expect(Offer.create).not.toHaveBeenCalled();
  });
});

describe('updateOffer / deleteOffer', () => {
  it('updates only provided fields', async () => {
    Offer.findByIdAndUpdate.mockResolvedValue(offer);
    const req = mockRequest({ params: { id: ID_C }, body: { price: 99 } });
    const res = mockResponse();
    await controller.updateOffer(req, res);
    expect(Book.exists).not.toHaveBeenCalled();
    expect(Offer.findByIdAndUpdate).toHaveBeenCalledWith(ID_C, { price: 99 }, expect.any(Object));
    expect(logAudit).toHaveBeenCalledWith(req.user, 'update', 'offer', ID_C);
    expect(res.json).toHaveBeenCalledWith(offer);
  });

  it('returns 404 for missing offers', async () => {
    Offer.findByIdAndUpdate.mockResolvedValue(null);
    Offer.findByIdAndDelete.mockResolvedValue(null);
    const req = mockRequest({ params: { id: ID_C } });
    await expect(controller.updateOffer(req, mockResponse())).rejects.toMatchObject({
      status: 404,
    });
    await expect(controller.deleteOffer(req, mockResponse())).rejects.toMatchObject({
      status: 404,
    });
  });

  it('deletes an offer and audits it', async () => {
    Offer.findByIdAndDelete.mockResolvedValue(offer);
    const req = mockRequest({ params: { id: ID_C } });
    const res = mockResponse();
    await controller.deleteOffer(req, res);
    expect(logAudit).toHaveBeenCalledWith(req.user, 'delete', 'offer', ID_C);
    expect(res.status).toHaveBeenCalledWith(204);
  });
});
