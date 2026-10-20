// Integration tests: full Express middleware chain via supertest, with Mongoose models mocked.
const modelMock = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findById: jest.fn(),
  countDocuments: jest.fn(),
  distinct: jest.fn(),
  exists: jest.fn(),
  create: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findByIdAndDelete: jest.fn(),
  deleteMany: jest.fn(),
});
jest.mock('../../models/Book', () => modelMock());
jest.mock('../../models/Store', () => modelMock());
jest.mock('../../models/Offer', () => modelMock());
jest.mock('../../models/User', () => modelMock());
jest.mock('../../models/AuditLog', () => modelMock());

const request = require('supertest');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const app = require('../../app');
const Book = require('../../models/Book');
const Store = require('../../models/Store');
const Offer = require('../../models/Offer');
const User = require('../../models/User');
const AuditLog = require('../../models/AuditLog');
const { mockQuery, ID_A, ID_B, ID_C } = require('../helpers/mocks');

const ADMIN = { _id: ID_A, email: 'admin@test.dev', role: 'admin' };
const adminCookie = () => `token=${jwt.sign({ sub: ID_A }, process.env.JWT_SECRET)}`;

beforeEach(() => {
  jest.clearAllMocks();
  User.findById.mockReturnValue(mockQuery(ADMIN));
  AuditLog.create.mockResolvedValue({});
});

describe('public endpoints', () => {
  it('GET /api/health', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('GET /api/books returns the contract shape', async () => {
    Book.countDocuments.mockResolvedValue(1);
    Book.find.mockReturnValue(mockQuery([{ _id: ID_A, title: 'Aura' }]));
    Offer.find.mockReturnValue(
      mockQuery([
        {
          _id: ID_C,
          book_id: ID_A,
          price: 139,
          stock: 4,
          store_id: { _id: ID_B, name: 'S' },
        },
      ])
    );
    const res = await request(app).get('/api/books?q=aur&page=1&limit=20');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      items: [
        {
          _id: ID_A,
          title: 'Aura',
          min_price: 139,
          total_stock: 4,
          offers: [
            {
              _id: ID_C,
              price: 139,
              stock: 4,
              is_available: true,
              store: { _id: ID_B, name: 'S' },
            },
          ],
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
    });
  });

  it('GET /api/books with an invalid store_id returns 400', async () => {
    const res = await request(app).get('/api/books?store_id=abc');
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Invalid store_id');
  });

  it('GET /api/books/filters', async () => {
    Book.distinct.mockResolvedValue(['Novela']);
    const res = await request(app).get('/api/books/filters');
    expect(res.body).toEqual({ genres: ['Novela'], publishers: ['Novela'] });
  });

  it('GET /api/books/:id validates the id and returns 404 when missing', async () => {
    expect((await request(app).get('/api/books/123')).status).toBe(400);
    Book.findById.mockReturnValue(mockQuery(null));
    const res = await request(app).get(`/api/books/${ID_A}`);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'Book not found' });
  });

  it('GET /api/books/:id returns offers with derived is_available and total_stock', async () => {
    Book.findById.mockReturnValue(mockQuery({ _id: ID_A, title: 'Aura' }));
    Offer.find.mockReturnValue(
      mockQuery([
        { _id: ID_C, price: 99, stock: 0, store_id: { _id: ID_B, name: 'S' } },
        { _id: ID_B, price: 120, stock: 7, store_id: { _id: ID_B, name: 'S' } },
      ])
    );
    const res = await request(app).get(`/api/books/${ID_A}`);
    expect(res.status).toBe(200);
    expect(res.body.total_stock).toBe(7);
    expect(res.body.offers.map((offer) => [offer.stock, offer.is_available])).toEqual([
      [0, false],
      [7, true],
    ]);
  });

  it('GET /api/stores and /api/stores/:id', async () => {
    Store.find.mockReturnValue(mockQuery([{ _id: ID_B, name: 'S' }]));
    expect((await request(app).get('/api/stores')).body).toEqual([{ _id: ID_B, name: 'S' }]);
    Store.findById.mockReturnValue(mockQuery({ _id: ID_B, name: 'S' }));
    Offer.find.mockReturnValue(mockQuery([]));
    const res = await request(app).get(`/api/stores/${ID_B}`);
    expect(res.body).toEqual({ _id: ID_B, name: 'S', offers: [] });
  });

  it('unknown routes return 404 JSON', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Route not found');
  });
});

describe('auth flow', () => {
  it('logs in with a secure cookie, reads /me and logs out', async () => {
    const passwordHash = await bcrypt.hash('correct-horse', 10);
    User.findOne.mockReturnValue(mockQuery({ ...ADMIN, password_hash: passwordHash }));
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.dev', password: 'correct-horse' });
    expect(login.status).toBe(200);
    expect(login.body).toEqual({ user: ADMIN });
    const cookie = login.headers['set-cookie'][0];
    expect(cookie).toMatch(/^token=/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Strict/);

    const me = await request(app).get('/api/auth/me').set('Cookie', cookie.split(';')[0]);
    expect(me.status).toBe(200);
    expect(me.body).toEqual({ user: ADMIN });

    const logout = await request(app).post('/api/auth/logout');
    expect(logout.status).toBe(204);
    expect(logout.headers['set-cookie'][0]).toMatch(/token=;/);
  });

  it('rejects wrong credentials and NoSQL operator payloads', async () => {
    User.findOne.mockReturnValue(mockQuery(null));
    const wrong = await request(app)
      .post('/api/auth/login')
      .send({ email: 'x@y.z', password: 'p' });
    expect(wrong.status).toBe(401);
    const injected = await request(app)
      .post('/api/auth/login')
      .send({ email: { $ne: null }, password: { $ne: null } });
    expect(injected.status).toBe(400);
  });

  it('GET /api/auth/me without a cookie returns 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('malformed JSON returns 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email":');
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Malformed JSON body');
  });
});

describe('admin endpoints', () => {
  it('requires authentication and the admin role', async () => {
    expect((await request(app).post('/api/books').send({})).status).toBe(401);
    User.findById.mockReturnValue(mockQuery({ ...ADMIN, role: 'reader' }));
    const res = await request(app).post('/api/books').set('Cookie', adminCookie()).send({});
    expect(res.status).toBe(403);
    expect(Book.create).not.toHaveBeenCalled();
  });

  it('POST /api/books creates a book and writes an audit log', async () => {
    Book.create.mockResolvedValue({ _id: ID_B, title: 'Aura', author: 'Carlos Fuentes' });
    const res = await request(app)
      .post('/api/books')
      .set('Cookie', adminCookie())
      .send({ title: 'Aura', author: 'Carlos Fuentes', $where: 'sleep(1)' });
    expect(res.status).toBe(201);
    expect(Book.create).toHaveBeenCalledWith({ title: 'Aura', author: 'Carlos Fuentes' });
    expect(AuditLog.create).toHaveBeenCalledWith({
      user_id: ID_A,
      action: 'create',
      entity: 'book',
      entity_id: ID_B,
    });
  });

  it('maps Mongoose validation and duplicate errors', async () => {
    Book.create.mockRejectedValue({
      name: 'ValidationError',
      errors: { title: { message: 'title is required' } },
    });
    const invalid = await request(app).post('/api/books').set('Cookie', adminCookie()).send({});
    expect(invalid.status).toBe(400);
    expect(invalid.body.message).toBe('title is required');

    Book.exists.mockResolvedValue(true);
    Store.exists.mockResolvedValue(true);
    Offer.create.mockRejectedValue({ code: 11000 });
    const duplicate = await request(app)
      .post('/api/offers')
      .set('Cookie', adminCookie())
      .send({ book_id: ID_A, store_id: ID_B, price: 10 });
    expect(duplicate.status).toBe(409);
  });

  it('DELETE /api/stores/:id cascades offers and returns 204', async () => {
    Store.findByIdAndDelete.mockResolvedValue({ _id: ID_B });
    const res = await request(app).delete(`/api/stores/${ID_B}`).set('Cookie', adminCookie());
    expect(res.status).toBe(204);
    expect(Offer.deleteMany).toHaveBeenCalledWith({ store_id: ID_B });
    expect(AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({ action: 'delete' }));
  });

  it('POST /api/offers validates stock and returns the derived is_available', async () => {
    Book.exists.mockResolvedValue(true);
    Store.exists.mockResolvedValue(true);
    const payload = { book_id: ID_A, store_id: ID_B, price: 10 };
    for (const stock of [-1, 2.5, 'many']) {
      const res = await request(app)
        .post('/api/offers')
        .set('Cookie', adminCookie())
        .send({ ...payload, stock });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('stock must be a non-negative integer');
    }
    expect(Offer.create).not.toHaveBeenCalled();

    Offer.create.mockResolvedValue({ _id: ID_C, ...payload, stock: 3 });
    const created = await request(app)
      .post('/api/offers')
      .set('Cookie', adminCookie())
      .send({ ...payload, stock: 3, is_available: false });
    expect(created.status).toBe(201);
    expect(Offer.create).toHaveBeenCalledWith({ ...payload, stock: 3 });
    expect(created.body).toMatchObject({ stock: 3, is_available: true });
    expect(AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({ entity: 'offer' }));
  });

  it('PUT /api/offers/:id validates the id', async () => {
    const res = await request(app).put('/api/offers/xyz').set('Cookie', adminCookie()).send({});
    expect(res.status).toBe(400);
  });

  it('GET /api/audit-logs returns entries for admins only', async () => {
    AuditLog.find.mockReturnValue(mockQuery([{ action: 'create' }]));
    const res = await request(app).get('/api/audit-logs?limit=5').set('Cookie', adminCookie());
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ action: 'create' }]);
    expect((await request(app).get('/api/audit-logs')).status).toBe(401);
  });
});
