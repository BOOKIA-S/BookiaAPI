// Integration tests for the store_owner role: every store-scoped route through the real chain.
const modelMock = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findById: jest.fn(),
  exists: jest.fn(),
  create: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findByIdAndDelete: jest.fn(),
  findOneAndUpdate: jest.fn(),
  findOneAndDelete: jest.fn(),
  deleteMany: jest.fn(),
});
jest.mock('../../models/Book', () => modelMock());
jest.mock('../../models/Store', () => modelMock());
jest.mock('../../models/Offer', () => modelMock());
jest.mock('../../models/User', () => modelMock());
jest.mock('../../models/AuditLog', () => modelMock());

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../app');
const Book = require('../../models/Book');
const Store = require('../../models/Store');
const Offer = require('../../models/Offer');
const User = require('../../models/User');
const AuditLog = require('../../models/AuditLog');
const { mockQuery, ID_A, ID_B, ID_C } = require('../helpers/mocks');

const OWN_STORE = ID_A;
const OTHER_STORE = ID_B;
const OWNER = { _id: ID_C, email: 'duena@test.dev', role: 'store_owner', store_id: OWN_STORE };
const cookie = () => `token=${jwt.sign({ sub: ID_C }, process.env.JWT_SECRET)}`;
const OFFER_ID = '64b000000000000000000009';

/** Makes the offer with OFFER_ID belong to `storeId` for the store-access lookup. */
function offerBelongsTo(storeId) {
  Offer.findById.mockReturnValue(mockQuery({ _id: OFFER_ID, store_id: storeId }));
}

beforeEach(() => {
  jest.clearAllMocks();
  User.findById.mockReturnValue(mockQuery(OWNER));
  AuditLog.create.mockResolvedValue({});
  Book.exists.mockResolvedValue(true);
  Store.exists.mockResolvedValue(true);
});

describe('store owner on its own store', () => {
  it('GET /api/auth/me exposes store_id', async () => {
    const res = await request(app).get('/api/auth/me').set('Cookie', cookie());
    expect(res.body.user).toMatchObject({ role: 'store_owner', store_id: OWN_STORE });
  });

  it('updates its store data', async () => {
    Store.findByIdAndUpdate.mockResolvedValue({ _id: OWN_STORE, name: 'Nueva' });
    const res = await request(app)
      .put(`/api/stores/${OWN_STORE}`)
      .set('Cookie', cookie())
      .send({ name: 'Nueva' });
    expect(res.status).toBe(200);
    expect(AuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: ID_C, entity: 'store', action: 'update' })
    );
  });

  it('creates, updates and deletes offers of its store', async () => {
    const payload = { book_id: ID_B, store_id: OWN_STORE, price: 120, stock: 2 };
    Offer.create.mockResolvedValue({ _id: OFFER_ID, ...payload });
    const created = await request(app).post('/api/offers').set('Cookie', cookie()).send(payload);
    expect(created.status).toBe(201);

    offerBelongsTo(OWN_STORE);
    Offer.findByIdAndUpdate.mockResolvedValue({ _id: OFFER_ID, ...payload, stock: 0 });
    const updated = await request(app)
      .put(`/api/offers/${OFFER_ID}`)
      .set('Cookie', cookie())
      .send({ stock: 0, price: 99 });
    expect(updated.status).toBe(200);
    expect(updated.body.is_available).toBe(false);

    Offer.findByIdAndDelete.mockResolvedValue({ _id: OFFER_ID });
    const deleted = await request(app).delete(`/api/offers/${OFFER_ID}`).set('Cookie', cookie());
    expect(deleted.status).toBe(204);
  });
});

describe('store owner outside its store gets 403', () => {
  it('cannot edit another store, nor create or delete stores', async () => {
    const other = await request(app)
      .put(`/api/stores/${OTHER_STORE}`)
      .set('Cookie', cookie())
      .send({ name: 'X' });
    expect(other.status).toBe(403);
    const created = await request(app)
      .post('/api/stores')
      .set('Cookie', cookie())
      .send({ name: 'X', address: 'Y' });
    expect(created.status).toBe(403);
    const deleted = await request(app).delete(`/api/stores/${OWN_STORE}`).set('Cookie', cookie());
    expect(deleted.status).toBe(403);
    expect(Store.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(Store.create).not.toHaveBeenCalled();
    expect(Store.findByIdAndDelete).not.toHaveBeenCalled();
  });

  it('cannot create an offer for another store or without a store', async () => {
    for (const store_id of [OTHER_STORE, undefined]) {
      const res = await request(app)
        .post('/api/offers')
        .set('Cookie', cookie())
        .send({ book_id: ID_B, store_id, price: 10, stock: 1 });
      expect(res.status).toBe(403);
    }
    expect(Offer.create).not.toHaveBeenCalled();
  });

  it('cannot update or delete offers of another store', async () => {
    offerBelongsTo(OTHER_STORE);
    const updated = await request(app)
      .put(`/api/offers/${OFFER_ID}`)
      .set('Cookie', cookie())
      .send({ price: 1 });
    const deleted = await request(app).delete(`/api/offers/${OFFER_ID}`).set('Cookie', cookie());
    expect([updated.status, deleted.status]).toEqual([403, 403]);
    expect(Offer.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(Offer.findByIdAndDelete).not.toHaveBeenCalled();
  });

  it('cannot move its own offer to another store', async () => {
    offerBelongsTo(OWN_STORE);
    const res = await request(app)
      .put(`/api/offers/${OFFER_ID}`)
      .set('Cookie', cookie())
      .send({ store_id: OTHER_STORE });
    expect(res.status).toBe(403);
    expect(Offer.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('gets 403 for an offer that does not exist', async () => {
    Offer.findById.mockReturnValue(mockQuery(null));
    const res = await request(app).delete(`/api/offers/${OFFER_ID}`).set('Cookie', cookie());
    expect(res.status).toBe(403);
  });

  it('has no access to books, audit logs, owner accounts or favorites', async () => {
    const calls = [
      request(app).post('/api/books').send({ title: 'A', author: 'B' }),
      request(app).get('/api/audit-logs'),
      request(app).get('/api/users'),
      request(app).get('/api/favorites'),
      request(app).put(`/api/favorites/${ID_B}`),
    ];
    const statuses = await Promise.all(calls.map((call) => call.set('Cookie', cookie())));
    expect(statuses.map((res) => res.status)).toEqual([403, 403, 403, 403, 403]);
  });
});

describe('admin manages store owner accounts', () => {
  const ADMIN = { _id: ID_A, email: 'admin@test.dev', role: 'admin' };
  const adminCookie = () => `token=${jwt.sign({ sub: ID_A }, process.env.JWT_SECRET)}`;

  beforeEach(() => User.findById.mockReturnValue(mockQuery(ADMIN)));

  it('creates an owner assigned to a store and lists it', async () => {
    User.exists.mockResolvedValue(null);
    User.create.mockImplementation(async (doc) => ({ _id: ID_C, ...doc }));
    const ownerDoc = { ...OWNER, name: 'Lucía', store_id: { _id: OWN_STORE, name: 'Azalea' } };
    User.findOne.mockReturnValue(mockQuery(ownerDoc));
    const res = await request(app)
      .post('/api/users')
      .set('Cookie', adminCookie())
      .send({ name: 'Lucía', email: OWNER.email, password: 'secreto123', store_id: OWN_STORE });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({
      role: 'store_owner',
      store_id: OWN_STORE,
      store: { _id: OWN_STORE, name: 'Azalea' },
    });
    expect(res.body.user.password_hash).toBeUndefined();
    expect(AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({ entity: 'user' }));

    User.find.mockReturnValue(mockQuery([ownerDoc]));
    const list = await request(app).get('/api/users').set('Cookie', adminCookie());
    expect(list.status).toBe(200);
    expect(list.body.items).toHaveLength(1);
  });

  it('reassigns and deletes owners, validating ids', async () => {
    User.findOneAndUpdate.mockReturnValue(mockQuery({ _id: ID_C }));
    User.findOne.mockReturnValue(mockQuery({ ...OWNER, store_id: OTHER_STORE }));
    const moved = await request(app)
      .patch(`/api/users/${ID_C}`)
      .set('Cookie', adminCookie())
      .send({ store_id: OTHER_STORE });
    expect(moved.status).toBe(200);
    expect(moved.body.user.store_id).toBe(OTHER_STORE);

    User.findOneAndDelete.mockResolvedValue({ _id: ID_C });
    const removed = await request(app).delete(`/api/users/${ID_C}`).set('Cookie', adminCookie());
    expect(removed.status).toBe(204);

    const bad = await request(app).delete('/api/users/nope').set('Cookie', adminCookie());
    expect(bad.status).toBe(400);
  });

  it('readers cannot reach owner management', async () => {
    User.findById.mockReturnValue(mockQuery({ ...ADMIN, role: 'reader' }));
    const res = await request(app).get('/api/users').set('Cookie', adminCookie());
    expect(res.status).toBe(403);
  });
});
