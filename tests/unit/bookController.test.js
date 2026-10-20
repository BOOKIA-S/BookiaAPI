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
  create: jest.fn(),
}));
jest.mock('../../models/Store', () => ({ exists: jest.fn() }));
jest.mock('../../utils/auditLogger', () => ({ logAudit: jest.fn() }));

const Book = require('../../models/Book');
const Offer = require('../../models/Offer');
const Store = require('../../models/Store');
const { logAudit } = require('../../utils/auditLogger');
const controller = require('../../controllers/bookController');
const { mockQuery, mockRequest, mockResponse, ID_A, ID_B, ID_C } = require('../helpers/mocks');

const book = { _id: ID_A, title: 'Pedro Páramo', author: 'Juan Rulfo' };

beforeEach(() => jest.clearAllMocks());

describe('listBooks', () => {
  it('returns paginated books with offers, min_price from in-stock offers and total_stock', async () => {
    Book.countDocuments.mockResolvedValue(1);
    Book.find.mockReturnValue(mockQuery([book]));
    Offer.find.mockReturnValue(
      mockQuery([
        {
          _id: 'o1',
          book_id: ID_A,
          price: 70,
          stock: 0,
          store_id: { _id: ID_B, name: 'S1' },
        },
        {
          _id: 'o2',
          book_id: ID_A,
          price: 89,
          stock: 4,
          store_id: { _id: ID_C, name: 'S2' },
        },
        { _id: 'o3', book_id: ID_A, price: 95, stock: 2, store_id: null },
      ])
    );
    const res = mockResponse();
    await controller.listBooks(mockRequest({ query: { page: '1', limit: '10' } }), res);

    const body = res.json.mock.calls[0][0];
    expect(body.total).toBe(1);
    expect(body.page).toBe(1);
    expect(body.limit).toBe(10);
    expect(body.items[0].min_price).toBe(89);
    expect(body.items[0].total_stock).toBe(6);
    expect(body.items[0].offers[0]).toEqual({
      _id: 'o1',
      price: 70,
      stock: 0,
      is_available: false,
      store: { _id: ID_B, name: 'S1' },
    });
    expect(body.items[0].offers[1].is_available).toBe(true);
    expect(body.items[0].offers[2].store).toBeNull();
    expect(Offer.distinct).not.toHaveBeenCalled();
  });

  it('returns min_price null and total_stock 0 when no offer has stock', async () => {
    Book.countDocuments.mockResolvedValue(2);
    Book.find.mockReturnValue(mockQuery([book, { _id: ID_B, title: 'Aura' }]));
    Offer.find.mockReturnValue(
      mockQuery([
        { _id: 'o1', book_id: ID_A, price: 50, stock: 0, store_id: null },
        { _id: 'o2', book_id: ID_A, price: 60, stock: 0, store_id: null },
      ])
    );
    const res = mockResponse();
    await controller.listBooks(mockRequest(), res);
    const [withOffers, withoutOffers] = res.json.mock.calls[0][0].items;
    expect(withOffers.min_price).toBeNull();
    expect(withOffers.total_stock).toBe(0);
    expect(withOffers.offers.every((offer) => offer.is_available === false)).toBe(true);
    expect(withoutOffers).toMatchObject({ offers: [], min_price: null, total_stock: 0 });
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
  it('returns the book with populated store offers and total_stock', async () => {
    Book.findById.mockReturnValue(mockQuery(book));
    const store = { _id: ID_B, name: 'S1' };
    Offer.find.mockReturnValue(
      mockQuery([
        { _id: 'o1', price: 10, stock: 3, store_id: store },
        { _id: 'o2', price: 12, stock: 0, store_id: store },
      ])
    );
    const res = mockResponse();
    await controller.getBook(mockRequest({ params: { id: ID_A } }), res);
    expect(res.json).toHaveBeenCalledWith({
      ...book,
      offers: [
        { _id: 'o1', price: 10, stock: 3, is_available: true, store },
        { _id: 'o2', price: 12, stock: 0, is_available: false, store },
      ],
      total_stock: 3,
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

  it('creates the book and its initial offer together and audits both', async () => {
    Book.create.mockResolvedValue(book);
    Store.exists.mockResolvedValue({ _id: ID_B });
    Offer.create.mockResolvedValue({
      _id: ID_C,
      book_id: ID_A,
      store_id: ID_B,
      price: 150,
      stock: 3,
    });
    const req = mockRequest({
      body: {
        title: 'Pedro Páramo',
        author: 'Juan Rulfo',
        initial_offer: { store_id: ID_B, price: '150', stock: '3' },
      },
    });
    const res = mockResponse();
    await controller.createBook(req, res);
    expect(Book.create).toHaveBeenCalledWith({ title: 'Pedro Páramo', author: 'Juan Rulfo' });
    expect(Offer.create).toHaveBeenCalledWith({
      store_id: ID_B,
      price: 150,
      stock: 3,
      book_id: ID_A,
    });
    expect(logAudit).toHaveBeenCalledWith(req.user, 'create', 'book', ID_A);
    expect(logAudit).toHaveBeenCalledWith(req.user, 'create', 'offer', ID_C);
    expect(res.json.mock.calls[0][0].offers[0]).toMatchObject({ _id: ID_C, is_available: true });
  });

  it.each([
    [{ store_id: 'nope', price: 10, stock: 1 }],
    [{ store_id: ID_B, price: 0, stock: 1 }],
    [{ store_id: ID_B, price: 10, stock: 1.5 }],
    ['x'],
  ])('rejects an invalid initial offer before creating the book (%#)', async (initial_offer) => {
    Store.exists.mockResolvedValue({ _id: ID_B });
    const req = mockRequest({ body: { title: 'T', author: 'A', initial_offer } });
    await expect(controller.createBook(req, mockResponse())).rejects.toMatchObject({ status: 400 });
    expect(Book.create).not.toHaveBeenCalled();
  });

  it('rejects an initial offer for an unknown store', async () => {
    Store.exists.mockResolvedValue(null);
    const req = mockRequest({
      body: { title: 'T', author: 'A', initial_offer: { store_id: ID_B, price: 10 } },
    });
    await expect(controller.createBook(req, mockResponse())).rejects.toMatchObject({ status: 400 });
    expect(Book.create).not.toHaveBeenCalled();
  });

  it('removes the book again when the offer cannot be created', async () => {
    Book.create.mockResolvedValue(book);
    Store.exists.mockResolvedValue({ _id: ID_B });
    Offer.create.mockRejectedValue(new Error('db down'));
    const req = mockRequest({
      body: { title: 'T', author: 'A', initial_offer: { store_id: ID_B, price: 10, stock: 0 } },
    });
    await expect(controller.createBook(req, mockResponse())).rejects.toThrow('db down');
    expect(Book.findByIdAndDelete).toHaveBeenCalledWith(ID_A);
    expect(logAudit).not.toHaveBeenCalled();
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
