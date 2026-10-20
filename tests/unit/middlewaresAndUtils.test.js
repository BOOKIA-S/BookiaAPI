jest.mock('../../models/User', () => ({ findById: jest.fn() }));
jest.mock('../../models/AuditLog', () => ({ create: jest.fn(), find: jest.fn() }));

const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const AuditLog = require('../../models/AuditLog');
const { requireAuth, requireRole } = require('../../middlewares/auth');
const { errorHandler, notFound } = require('../../middlewares/errorHandler');
const { sanitizeBody, validateObjectId } = require('../../middlewares/validation');
const { logAudit } = require('../../utils/auditLogger');
const { listAuditLogs } = require('../../controllers/auditLogController');
const { HttpError } = require('../../utils/httpError');
const sanitize = require('../../utils/sanitize');
const { mockQuery, mockRequest, mockResponse, ID_A } = require('../helpers/mocks');

beforeEach(() => jest.clearAllMocks());

describe('requireAuth', () => {
  const sign = (payload) => jwt.sign(payload, process.env.JWT_SECRET);

  it('attaches the user for a valid token', async () => {
    User.findById.mockReturnValue(mockQuery({ _id: ID_A, email: 'a@b.c', role: 'admin' }));
    const req = mockRequest({ cookies: { token: sign({ sub: ID_A }) }, user: undefined });
    const next = jest.fn();
    await requireAuth(req, mockResponse(), next);
    expect(req.user).toEqual({ _id: ID_A, email: 'a@b.c', role: 'admin' });
    expect(next).toHaveBeenCalledWith();
  });

  it.each([
    ['missing cookie', {}],
    ['bad signature', { token: jwt.sign({ sub: ID_A }, 'other') }],
    ['bad subject', { token: sign({ sub: 'x' }) }],
  ])('rejects %s', async (_label, cookies) => {
    await expect(
      requireAuth(mockRequest({ cookies }), mockResponse(), jest.fn())
    ).rejects.toMatchObject({ status: 401 });
  });

  it('rejects tokens of deleted users', async () => {
    User.findById.mockReturnValue(mockQuery(null));
    const req = mockRequest({ cookies: { token: sign({ sub: ID_A }) } });
    await expect(requireAuth(req, mockResponse(), jest.fn())).rejects.toMatchObject({
      status: 401,
    });
  });
});

describe('requireRole', () => {
  it('passes, forbids or requires auth depending on req.user', () => {
    const next = jest.fn();
    requireRole('admin')(mockRequest(), mockResponse(), next);
    expect(next).toHaveBeenLastCalledWith();
    requireRole('admin')(mockRequest({ user: { role: 'reader' } }), mockResponse(), next);
    expect(next.mock.lastCall[0].status).toBe(403);
    requireRole('admin')(mockRequest({ user: undefined }), mockResponse(), next);
    expect(next.mock.lastCall[0].status).toBe(401);
  });
});

describe('errorHandler', () => {
  const run = (err) => {
    const res = mockResponse();
    errorHandler(err, mockRequest(), res, jest.fn());
    return [res.status.mock.calls[0][0], res.json.mock.calls[0][0].message];
  };

  it('maps known errors to statuses', () => {
    expect(run(new HttpError(418, 'teapot'))).toEqual([418, 'teapot']);
    expect(
      run({ name: 'ValidationError', errors: { a: { message: 'a bad' }, b: { message: 'b bad' } } })
    ).toEqual([400, 'a bad, b bad']);
    expect(run({ name: 'CastError', path: 'price' })).toEqual([400, 'Invalid value for price']);
    expect(run({ code: 11000 })[0]).toBe(409);
    expect(run({ type: 'entity.parse.failed' })[0]).toBe(400);
    expect(run({ type: 'entity.too.large' })[0]).toBe(413);
    expect(run(new Error('boom'))).toEqual([500, 'Internal server error']);
  });

  it('notFound returns 404', () => {
    const res = mockResponse();
    notFound(mockRequest(), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('validation middlewares', () => {
  it('strips operator keys from the body', () => {
    const req = mockRequest({
      body: { title: 'x', $where: '1', nested: { 'a.b': 1, ok: [{ $gt: 1 }] } },
    });
    const next = jest.fn();
    sanitizeBody(req, mockResponse(), next);
    expect(req.body).toEqual({ title: 'x', nested: { ok: [{}] } });
    expect(next).toHaveBeenCalled();
  });

  it('validates ObjectId params', () => {
    const next = jest.fn();
    validateObjectId()(mockRequest({ params: { id: ID_A } }), mockResponse(), next);
    expect(next).toHaveBeenLastCalledWith();
    validateObjectId('id')(mockRequest({ params: { id: '1' } }), mockResponse(), next);
    expect(next.mock.lastCall[0].status).toBe(400);
  });
});

describe('sanitize utils', () => {
  it('parses and cleans values', () => {
    expect(sanitize.escapeRegex('a+b*')).toBe('a\\+b\\*');
    expect(sanitize.toCleanString('  hi  ')).toBe('hi');
    expect(sanitize.toCleanString('   ')).toBeUndefined();
    expect(sanitize.toCleanString(5)).toBeUndefined();
    expect(sanitize.toNumber(3)).toBe(3);
    expect(sanitize.toNumber(Infinity)).toBeUndefined();
    expect(sanitize.toNumber('x')).toBeUndefined();
    expect(sanitize.toNumber('')).toBeUndefined();
    expect(sanitize.toPositiveInt('0', 5, 10)).toBe(5);
    expect(sanitize.toPositiveInt('50', 5, 10)).toBe(10);
    expect(sanitize.pickFields(null, ['a'])).toEqual({});
    expect(sanitize.stripOperators('text')).toBe('text');
  });
});

describe('audit logging', () => {
  it('logAudit stores the entry with snake_case fields', async () => {
    await logAudit({ _id: ID_A }, 'create', 'book', 'b1');
    expect(AuditLog.create).toHaveBeenCalledWith({
      user_id: ID_A,
      action: 'create',
      entity: 'book',
      entity_id: 'b1',
    });
  });

  it('listAuditLogs returns the latest entries with a capped limit', async () => {
    const query = mockQuery([{ action: 'create' }]);
    AuditLog.find.mockReturnValue(query);
    const res = mockResponse();
    await listAuditLogs(mockRequest({ query: { limit: '9999' } }), res);
    expect(query.sort).toHaveBeenCalledWith({ created_at: -1 });
    expect(query.limit).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([{ action: 'create' }]);
  });
});
