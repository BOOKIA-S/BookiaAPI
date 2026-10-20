jest.mock('../../models/User', () => ({ findById: jest.fn(), findByIdAndUpdate: jest.fn() }));
jest.mock('../../models/Book', () => ({ find: jest.fn(), exists: jest.fn() }));

const User = require('../../models/User');
const Book = require('../../models/Book');
const controller = require('../../controllers/favoriteController');
const { mockQuery, mockRequest, mockResponse, ID_A, ID_B, ID_C } = require('../helpers/mocks');

beforeEach(() => jest.clearAllMocks());

describe('listFavorites', () => {
  it('returns saved books, most recent first, skipping deleted ones', async () => {
    User.findById.mockReturnValue(mockQuery({ favorite_book_ids: [ID_A, ID_B, ID_C] }));
    Book.find.mockReturnValue(
      mockQuery([
        { _id: ID_A, title: 'Aura' },
        { _id: ID_C, title: 'Pedro Páramo' },
      ])
    );
    const res = mockResponse();
    await controller.listFavorites(mockRequest(), res);
    expect(res.json).toHaveBeenCalledWith({
      items: [
        { _id: ID_C, title: 'Pedro Páramo' },
        { _id: ID_A, title: 'Aura' },
      ],
    });
  });

  it('skips the book query when there are no favorites', async () => {
    User.findById.mockReturnValue(mockQuery({}));
    const res = mockResponse();
    await controller.listFavorites(mockRequest(), res);
    expect(Book.find).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ items: [] });
  });

  it('returns 401 when the user no longer exists', async () => {
    User.findById.mockReturnValue(mockQuery(null));
    await expect(controller.listFavorites(mockRequest(), mockResponse())).rejects.toMatchObject({
      status: 401,
    });
  });
});

describe('addFavorite', () => {
  it('adds the book with $addToSet and returns the ids', async () => {
    Book.exists.mockResolvedValue({ _id: ID_B });
    User.findById.mockReturnValue(mockQuery({ favorite_book_ids: [ID_A] }));
    User.findByIdAndUpdate.mockReturnValue(mockQuery({ favorite_book_ids: [ID_A, ID_B] }));
    const res = mockResponse();
    const req = mockRequest({ params: { bookId: ID_B } });
    await controller.addFavorite(req, res);
    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
      req.user._id,
      { $addToSet: { favorite_book_ids: ID_B } },
      expect.any(Object)
    );
    expect(res.json).toHaveBeenCalledWith({ book_ids: [ID_A, ID_B] });
  });

  it('returns 404 for an unknown book', async () => {
    Book.exists.mockResolvedValue(null);
    await expect(
      controller.addFavorite(mockRequest({ params: { bookId: ID_B } }), mockResponse())
    ).rejects.toMatchObject({ status: 404 });
  });

  it('enforces the favorites limit for new books', async () => {
    Book.exists.mockResolvedValue({ _id: ID_B });
    User.findById.mockReturnValue(mockQuery({ favorite_book_ids: Array(200).fill(ID_A) }));
    await expect(
      controller.addFavorite(mockRequest({ params: { bookId: ID_B } }), mockResponse())
    ).rejects.toMatchObject({ status: 400 });
  });
});

it('removeFavorite pulls the book and returns the remaining ids', async () => {
  User.findByIdAndUpdate.mockReturnValue(mockQuery(null));
  const res = mockResponse();
  await controller.removeFavorite(mockRequest({ params: { bookId: ID_B } }), res);
  expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
    expect.anything(),
    { $pull: { favorite_book_ids: ID_B } },
    expect.any(Object)
  );
  expect(res.json).toHaveBeenCalledWith({ book_ids: [] });
});
