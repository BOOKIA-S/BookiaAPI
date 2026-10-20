jest.mock('../../models/Book', () => ({
  find: jest.fn(),
  findById: jest.fn(),
  countDocuments: jest.fn(),
  distinct: jest.fn(),
  create: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findByIdAndDelete: jest.fn(),
}));
jest.mock('../../models/Offer', () => ({
  find: jest.fn(),
  distinct: jest.fn(),
  deleteMany: jest.fn(),
}));
jest.mock('../../utils/auditLogger', () => ({ logAudit: jest.fn() }));

const Book = require('../../models/Book');
const Offer = require('../../models/Offer');
const { logAudit } = require('../../utils/auditLogger');
const controller = require('../../controllers/bookController');
const { mockQuery, mockRequest, mockResponse, ID_A, ID_B, ID_C } = require('../helpers/mocks');

const book = { _id: ID_A, title: 'Pedro Páramo', author: 'Juan Rulfo' };

beforeEach(() => jest.clearAllMocks());

describe('listBooks', () => {
  it('returns paginated books with offers and min_price from available offers', async () => {
    Book.countDocuments.mockResolvedValue(1);
    Book.find.mockReturnValue(mockQuery([book]));
    Offer.find.mockReturnValue(
      mockQuery([
        {
          _id: 'o1',
          book_id: ID_A,
          price: 70,
          is_available: false,
          store_id: { _id: ID_B, name: 'S1' },
        },
        {
          _id: 'o2',
          book_id: ID_A,
          price: 89,
          is_available: true,
          store_id: { _id: ID_C, name: 'S2' },
        },
        { _id: 'o3', book_id: ID_A, price: 95, is_available: true, store_id: null },
      ])
    );
    const res = mockResponse();
    await controller.listBooks(mockRequest({ query: { page: '1', limit: '10' } }), res);

    const body = res.json.mock.calls[0][0];
    expect(body.total).toBe(1);
    expect(body.page).toBe(1);
    expect(body.limit).toBe(10);
    expect(body.items[0].min_price).toBe(89);
    expect(body.items[0].offers[0]).toEqual({
      _id: 'o1',
      price: 70,
      is_available: false,
      store: { _id: ID_B, name: 'S1' },
    });
    expect(body.items[0].offers[2].store).toBeNull();
    expect(Offer.distinct).not.toHaveBeenCalled();
  });

  it('applies escaped search, genre, publisher, store and price filters', async () => {
    Offer.distinct.mockResolvedValue([ID_A]);
    Book.countDocuments.mockResolvedValue(0);
    Book.find.mockReturnValue(mockQuery([]));
    const res = mockResponse();
    await controller.listBooks(
      mockRequest({
        query: {
          q: 'a.b(',
          genre: 'Novela',
          publisher: 'RM',
          store_id: ID_B,
          min_price: '50',
          max_price: '100',
          limit: '1000',
        },
      }),
      res
    );

    const offerFilter = Offer.distinct.mock.calls[0][1];
    expect(offerFilter).toEqual({ store_id: ID_B, price: { $gte: 50, $lte: 100 } });
    const bookFilter = Book.find.mock.calls[0][0];
    expect(bookFilter.$or[0].title.source).toBe('a\\.b\\(');
    expect(bookFilter.genre).toBe('Novela');
    expect(bookFilter.publisher).toBe('RM');
    expect(bookFilter._id).toEqual({ $in: [ID_A] });
    expect(Offer.find).not.toHaveBeenCalled();
    expect(res.json.mock.calls[0][0]).toEqual({ items: [], total: 0, page: 1, limit: 100 });
  });

  it('supports a single price bound and ignores non-string params', async () => {
    Offer.distinct.mockResolvedValue([]);
    Book.countDocuments.mockResolvedValue(0);
    Book.find.mockReturnValue(mockQuery([]));
    await controller.listBooks(
      mockRequest({ query: { max_price: '20', genre: { $ne: 'x' }, page: 'abc' } }),
      mockResponse()
    );
    expect(Offer.distinct.mock.calls[0][1]).toEqual({ price: { $lte: 20 } });
    expect(Book.find.mock.calls[0][0].genre).toBeUndefined();
  });

  it('rejects an invalid store_id', async () => {
    await expect(
      controller.listBooks(mockRequest({ query: { store_id: 'nope' } }), mockResponse())
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe('getBookFilters', () => {
  it('returns sorted, non-empty genres and publishers', async () => {
    Book.distinct.mockImplementation((field) =>
      Promise.resolve(field === 'genre' ? ['Novela', '', 'Cuento'] : ['RM', null])
    );
    const res = mockResponse();
    await controller.getBookFilters(mockRequest(), res);
    expect(res.json).toHaveBeenCalledWith({ genres: ['Cuento', 'Novela'], publishers: ['RM'] });
  });
});

describe('getBook', () => {
  it('returns the book with populated store offers', async () => {
    Book.findById.mockReturnValue(mockQuery(book));
    const store = { _id: ID_B, name: 'S1' };
    Offer.find.mockReturnValue(
      mockQuery([{ _id: 'o1', price: 10, is_available: true, store_id: store }])
    );
    const res = mockResponse();
    await controller.getBook(mockRequest({ params: { id: ID_A } }), res);
    expect(res.json).toHaveBeenCalledWith({
      ...book,
      offers: [{ _id: 'o1', price: 10, is_available: true, store }],
    });
  });

  it('throws 404 when the book does not exist', async () => {
    Book.findById.mockReturnValue(mockQuery(null));
    await expect(
      controller.getBook(mockRequest({ params: { id: ID_A } }), mockResponse())
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('admin writes', () => {
  it('creates a book with whitelisted fields and audits it', async () => {
    Book.create.mockResolvedValue(book);
    const req = mockRequest({ body: { title: 'Pedro Páramo', author: 'Juan Rulfo', role: 'x' } });
    const res = mockResponse();
    await controller.createBook(req, res);
    expect(Book.create).toHaveBeenCalledWith({ title: 'Pedro Páramo', author: 'Juan Rulfo' });
    expect(logAudit).toHaveBeenCalledWith(req.user, 'create', 'book', ID_A);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('updates a book and audits it', async () => {
    Book.findByIdAndUpdate.mockResolvedValue(book);
    const req = mockRequest({ params: { id: ID_A }, body: { genre: 'Novela' } });
    const res = mockResponse();
    await controller.updateBook(req, res);
    expect(Book.findByIdAndUpdate).toHaveBeenCalledWith(
      ID_A,
      { genre: 'Novela' },
      expect.objectContaining({ runValidators: true })
    );
    expect(logAudit).toHaveBeenCalledWith(req.user, 'update', 'book', ID_A);
    expect(res.json).toHaveBeenCalledWith(book);
  });

  it('returns 404 when updating a missing book', async () => {
    Book.findByIdAndUpdate.mockResolvedValue(null);
    await expect(
      controller.updateBook(mockRequest({ params: { id: ID_A } }), mockResponse())
    ).rejects.toMatchObject({ status: 404 });
    expect(logAudit).not.toHaveBeenCalled();
  });

  it('deletes a book, cascades offers and audits it', async () => {
    Book.findByIdAndDelete.mockResolvedValue(book);
    const req = mockRequest({ params: { id: ID_A } });
    const res = mockResponse();
    await controller.deleteBook(req, res);
    expect(Offer.deleteMany).toHaveBeenCalledWith({ book_id: ID_A });
    expect(logAudit).toHaveBeenCalledWith(req.user, 'delete', 'book', ID_A);
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it('returns 404 when deleting a missing book', async () => {
    Book.findByIdAndDelete.mockResolvedValue(null);
    await expect(
      controller.deleteBook(mockRequest({ params: { id: ID_A } }), mockResponse())
    ).rejects.toMatchObject({ status: 404 });
    expect(Offer.deleteMany).not.toHaveBeenCalled();
  });
});
