jest.mock('../../models/Reservation', () => ({
  find: jest.fn(),
  findOneAndUpdate: jest.fn(),
  countDocuments: jest.fn(),
  exists: jest.fn(),
  create: jest.fn(),
}));
jest.mock('../../models/Offer', () => ({
  findOneAndUpdate: jest.fn(),
  updateOne: jest.fn(),
  exists: jest.fn(),
}));

const Reservation = require('../../models/Reservation');
const Offer = require('../../models/Offer');
const controller = require('../../controllers/reservationController');
const { RESERVATION_TTL_MS } = require('../../utils/reservationRules');
const { mockQuery, mockRequest, mockResponse, ID_A, ID_B, ID_C } = require('../helpers/mocks');

const READER = { _id: ID_A, email: 'lector@test.dev', role: 'reader' };
const ADMIN = { _id: ID_A, email: 'admin@test.dev', role: 'admin' };
const OWNER = { _id: ID_A, email: 'dueno@test.dev', role: 'store_owner', store_id: ID_B };
const OFFER = { _id: ID_C, book_id: ID_A, store_id: ID_B, price: 120, stock: 2 };

beforeEach(() => {
  jest.clearAllMocks();
  // No overdue reservations unless a test says otherwise.
  Reservation.find.mockReturnValue(mockQuery([]));
  Offer.updateOne.mockResolvedValue({});
});

describe('createReservation', () => {
  const body = { offer_id: ID_C, quantity: 2 };

  it('takes the copies out of stock atomically and creates a pending reservation', async () => {
    Reservation.countDocuments.mockResolvedValue(0);
    Offer.findOneAndUpdate.mockReturnValue(mockQuery(OFFER));
    Reservation.create.mockImplementation(async (data) => ({ _id: ID_B, ...data }));
    const res = mockResponse();
    const before = Date.now();
    await controller.createReservation(mockRequest({ user: READER, body }), res);

    expect(Offer.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: ID_C, stock: { $gte: 2 } },
      { $inc: { stock: -2 } },
      expect.any(Object)
    );
    const created = Reservation.create.mock.calls[0][0];
    expect(created).toMatchObject({
      user_id: ID_A,
      offer_id: ID_C,
      store_id: ID_B,
      book_id: ID_A,
      price: 120,
      quantity: 2,
      status: 'pendiente',
    });
    expect(created.expires_at.getTime()).toBeGreaterThanOrEqual(before + RESERVATION_TTL_MS);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('defaults quantity to 1', async () => {
    Reservation.countDocuments.mockResolvedValue(0);
    Offer.findOneAndUpdate.mockReturnValue(mockQuery(OFFER));
    Reservation.create.mockImplementation(async (data) => data);
    await controller.createReservation(
      mockRequest({ user: READER, body: { offer_id: ID_C } }),
      mockResponse()
    );
    expect(Reservation.create.mock.calls[0][0].quantity).toBe(1);
  });

  it.each([[0], [6], [1.5], ['x']])('rejects quantity %p', async (quantity) => {
    await expect(
      controller.createReservation(
        mockRequest({ user: READER, body: { offer_id: ID_C, quantity } }),
        mockResponse()
      )
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rejects a malformed offer id', async () => {
    await expect(
      controller.createReservation(
        mockRequest({ user: READER, body: { offer_id: 'nope' } }),
        mockResponse()
      )
    ).rejects.toMatchObject({ status: 400 });
  });

  it('limits active reservations per reader', async () => {
    Reservation.countDocuments.mockResolvedValue(10);
    await expect(
      controller.createReservation(mockRequest({ user: READER, body }), mockResponse())
    ).rejects.toMatchObject({ status: 400 });
    expect(Offer.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('returns 409 when there are not enough copies', async () => {
    Reservation.countDocuments.mockResolvedValue(0);
    Offer.findOneAndUpdate.mockReturnValue(mockQuery(null));
    Offer.exists.mockResolvedValue({ _id: ID_C });
    await expect(
      controller.createReservation(mockRequest({ user: READER, body }), mockResponse())
    ).rejects.toMatchObject({ status: 409 });
    expect(Reservation.create).not.toHaveBeenCalled();
  });

  it('returns 404 when the offer does not exist', async () => {
    Reservation.countDocuments.mockResolvedValue(0);
    Offer.findOneAndUpdate.mockReturnValue(mockQuery(null));
    Offer.exists.mockResolvedValue(null);
    await expect(
      controller.createReservation(mockRequest({ user: READER, body }), mockResponse())
    ).rejects.toMatchObject({ status: 404 });
  });

  it('gives the copies back when saving the reservation fails', async () => {
    Reservation.countDocuments.mockResolvedValue(0);
    Offer.findOneAndUpdate.mockReturnValue(mockQuery(OFFER));
    Reservation.create.mockRejectedValue(new Error('db down'));
    await expect(
      controller.createReservation(mockRequest({ user: READER, body }), mockResponse())
    ).rejects.toThrow('db down');
    expect(Offer.updateOne).toHaveBeenCalledWith({ _id: ID_C }, { $inc: { stock: 2 } });
  });
});

describe('expireOverdue', () => {
  it('expires overdue active reservations and returns their stock', async () => {
    Reservation.find.mockReturnValue(mockQuery([{ _id: ID_A }, { _id: ID_B }]));
    Reservation.findOneAndUpdate
      .mockResolvedValueOnce({ _id: ID_A, offer_id: ID_C, quantity: 3 })
      .mockResolvedValueOnce(null); // already handled by someone else
    const now = new Date();
    const expired = await controller.expireOverdue({ store_id: ID_B }, now);

    expect(expired).toBe(1);
    expect(Reservation.find).toHaveBeenCalledWith(
      {
        store_id: ID_B,
        status: { $in: ['pendiente', 'confirmada'] },
        expires_at: { $lte: now },
      },
      '_id'
    );
    expect(Reservation.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: ID_A, status: { $in: ['pendiente', 'confirmada'] } },
      { $set: { status: 'vencida' } },
      expect.any(Object)
    );
    expect(Offer.updateOne).toHaveBeenCalledTimes(1);
    expect(Offer.updateOne).toHaveBeenCalledWith({ _id: ID_C }, { $inc: { stock: 3 } });
  });
});

describe('listMyReservations', () => {
  it('returns the reader reservations with book and store flattened', async () => {
    Reservation.find.mockReturnValueOnce(mockQuery([])).mockReturnValueOnce(
      mockQuery([
        {
          _id: ID_C,
          book_id: { _id: ID_A, title: 'Aura' },
          store_id: { _id: ID_B, name: 'Librería' },
          status: 'pendiente',
        },
      ])
    );
    const res = mockResponse();
    await controller.listMyReservations(mockRequest({ user: READER }), res);
    expect(Reservation.find).toHaveBeenLastCalledWith({ user_id: ID_A });
    expect(res.json).toHaveBeenCalledWith({
      items: [
        {
          _id: ID_C,
          book_id: ID_A,
          book: { _id: ID_A, title: 'Aura' },
          store_id: ID_B,
          store: { _id: ID_B, name: 'Librería' },
          status: 'pendiente',
        },
      ],
    });
  });
});

describe('cancelMyReservation', () => {
  it('cancels an active reservation of the reader and releases stock', async () => {
    const doc = { _id: ID_B, offer_id: ID_C, quantity: 1, status: 'cancelada' };
    Reservation.findOneAndUpdate.mockResolvedValue({ ...doc, toObject: () => doc });
    const res = mockResponse();
    await controller.cancelMyReservation(mockRequest({ user: READER, params: { id: ID_B } }), res);
    expect(Reservation.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: ID_B, user_id: ID_A, status: { $in: ['pendiente', 'confirmada'] } },
      { $set: { status: 'cancelada' } },
      expect.any(Object)
    );
    expect(Offer.updateOne).toHaveBeenCalledWith({ _id: ID_C }, { $inc: { stock: 1 } });
    expect(res.json).toHaveBeenCalledWith(doc);
  });

  it('returns 404 for a reservation of someone else', async () => {
    Reservation.findOneAndUpdate.mockResolvedValue(null);
    Reservation.exists.mockResolvedValue(null);
    await expect(
      controller.cancelMyReservation(
        mockRequest({ user: READER, params: { id: ID_B } }),
        mockResponse()
      )
    ).rejects.toMatchObject({ status: 404 });
  });

  it('returns 409 when it is no longer active', async () => {
    Reservation.findOneAndUpdate.mockResolvedValue(null);
    Reservation.exists.mockResolvedValue({ _id: ID_B });
    await expect(
      controller.cancelMyReservation(
        mockRequest({ user: READER, params: { id: ID_B } }),
        mockResponse()
      )
    ).rejects.toMatchObject({ status: 409 });
    expect(Offer.updateOne).not.toHaveBeenCalled();
  });
});

describe('listManagedReservations', () => {
  it('lets the admin see every store and filter by status and store', async () => {
    const res = mockResponse();
    await controller.listManagedReservations(
      mockRequest({ user: ADMIN, query: { status: 'pendiente', store_id: ID_C } }),
      res
    );
    expect(Reservation.find).toHaveBeenLastCalledWith({ status: 'pendiente', store_id: ID_C });
    expect(res.json).toHaveBeenCalledWith({ items: [] });
  });

  it('limits a store owner to their own store, ignoring store_id', async () => {
    await controller.listManagedReservations(
      mockRequest({ user: OWNER, query: { store_id: ID_C } }),
      mockResponse()
    );
    expect(Reservation.find).toHaveBeenLastCalledWith({ store_id: ID_B });
  });

  it('rejects a store owner without a store', async () => {
    await expect(
      controller.listManagedReservations(
        mockRequest({ user: { ...OWNER, store_id: null } }),
        mockResponse()
      )
    ).rejects.toMatchObject({ status: 403 });
  });

  it('rejects readers', async () => {
    await expect(
      controller.listManagedReservations(mockRequest({ user: READER }), mockResponse())
    ).rejects.toMatchObject({ status: 403 });
  });

  it.each([[{ status: 'perdida' }], [{ store_id: 'nope' }]])(
    'rejects invalid filters %p',
    async (query) => {
      await expect(
        controller.listManagedReservations(mockRequest({ user: ADMIN, query }), mockResponse())
      ).rejects.toMatchObject({ status: 400 });
    }
  );
});

describe('updateReservationStatus', () => {
  it('confirms a pending reservation of the owner store without touching stock', async () => {
    Reservation.findOneAndUpdate.mockResolvedValue({ _id: ID_C, status: 'confirmada' });
    const res = mockResponse();
    await controller.updateReservationStatus(
      mockRequest({ user: OWNER, params: { id: ID_C }, body: { status: 'confirmada' } }),
      res
    );
    expect(Reservation.findOneAndUpdate).toHaveBeenCalledWith(
      { store_id: ID_B, _id: ID_C, status: { $in: ['pendiente'] } },
      { $set: { status: 'confirmada' } },
      expect.any(Object)
    );
    expect(Offer.updateOne).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ _id: ID_C, status: 'confirmada' });
  });

  it('keeps the copies out of stock when delivered', async () => {
    Reservation.findOneAndUpdate.mockResolvedValue({ _id: ID_C, status: 'entregada' });
    await controller.updateReservationStatus(
      mockRequest({ user: ADMIN, params: { id: ID_C }, body: { status: 'entregada' } }),
      mockResponse()
    );
    expect(Offer.updateOne).not.toHaveBeenCalled();
  });

  it('releases stock when the store cancels', async () => {
    Reservation.findOneAndUpdate.mockResolvedValue({
      _id: ID_C,
      offer_id: ID_A,
      quantity: 2,
      status: 'cancelada',
    });
    await controller.updateReservationStatus(
      mockRequest({ user: ADMIN, params: { id: ID_C }, body: { status: 'cancelada' } }),
      mockResponse()
    );
    expect(Offer.updateOne).toHaveBeenCalledWith({ _id: ID_A }, { $inc: { stock: 2 } });
  });

  it.each([['pendiente'], ['vencida'], [undefined]])('rejects status %p', async (status) => {
    await expect(
      controller.updateReservationStatus(
        mockRequest({ user: ADMIN, params: { id: ID_C }, body: { status } }),
        mockResponse()
      )
    ).rejects.toMatchObject({ status: 400 });
  });

  it('returns 404 for a reservation of another store', async () => {
    Reservation.findOneAndUpdate.mockResolvedValue(null);
    Reservation.exists.mockResolvedValue(null);
    await expect(
      controller.updateReservationStatus(
        mockRequest({ user: OWNER, params: { id: ID_C }, body: { status: 'entregada' } }),
        mockResponse()
      )
    ).rejects.toMatchObject({ status: 404 });
  });

  it('returns 409 for an invalid transition', async () => {
    Reservation.findOneAndUpdate.mockResolvedValue(null);
    Reservation.exists.mockResolvedValue({ _id: ID_C });
    await expect(
      controller.updateReservationStatus(
        mockRequest({ user: ADMIN, params: { id: ID_C }, body: { status: 'confirmada' } }),
        mockResponse()
      )
    ).rejects.toMatchObject({ status: 409 });
  });
});
