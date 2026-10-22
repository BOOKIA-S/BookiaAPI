jest.mock('../../models/User', () => ({
  findOne: jest.fn(),
  exists: jest.fn(),
  create: jest.fn(),
}));
jest.mock('bcrypt', () => ({ compare: jest.fn(), hash: jest.fn() }));

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const controller = require('../../controllers/authController');
const { mockQuery, mockRequest, mockResponse, ID_A, ID_B } = require('../helpers/mocks');

const user = { _id: ID_A, email: 'admin@test.dev', role: 'admin', password_hash: 'hash' };

beforeEach(() => jest.clearAllMocks());

describe('login', () => {
  it('sets an httpOnly strict cookie and returns the public user', async () => {
    User.findOne.mockReturnValue(mockQuery(user));
    bcrypt.compare.mockResolvedValue(true);
    const res = mockResponse();
    await controller.login(
      mockRequest({ body: { email: ' Admin@Test.dev ', password: 'secret123' } }),
      res
    );
    expect(User.findOne).toHaveBeenCalledWith({ email: 'admin@test.dev' });
    const [name, token, options] = res.cookie.mock.calls[0];
    expect(name).toBe('token');
    expect(jwt.verify(token, process.env.JWT_SECRET).sub).toBe(ID_A);
    expect(options).toMatchObject({ httpOnly: true, sameSite: 'strict', secure: false });
    expect(res.json).toHaveBeenCalledWith({
      user: { _id: ID_A, email: 'admin@test.dev', name: '', role: 'admin', store_id: null },
    });
  });

  it('lets an admin through the admin portal', async () => {
    User.findOne.mockReturnValue(mockQuery(user));
    bcrypt.compare.mockResolvedValue(true);
    const res = mockResponse();
    await controller.login(
      mockRequest({ body: { email: 'admin@test.dev', password: 'secret123', portal: 'admin' } }),
      res
    );
    expect(res.cookie).toHaveBeenCalled();
  });

  it('lets a store owner through the admin portal with its store_id', async () => {
    User.findOne.mockReturnValue(mockQuery({ ...user, role: 'store_owner', store_id: ID_B }));
    bcrypt.compare.mockResolvedValue(true);
    const res = mockResponse();
    await controller.login(
      mockRequest({ body: { email: 'owner@test.dev', password: 'secret123', portal: 'admin' } }),
      res
    );
    expect(res.cookie).toHaveBeenCalled();
    expect(res.json.mock.calls[0][0].user).toMatchObject({ role: 'store_owner', store_id: ID_B });
  });

  it('rejects readers on the admin portal with 403 and no cookie', async () => {
    User.findOne.mockReturnValue(mockQuery({ ...user, role: 'reader' }));
    bcrypt.compare.mockResolvedValue(true);
    const res = mockResponse();
    await expect(
      controller.login(
        mockRequest({ body: { email: 'a@b.c', password: 'secret123', portal: 'admin' } }),
        res
      )
    ).rejects.toMatchObject({ status: 403 });
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it.each([{}, { email: 'a@b.c' }, { email: 'a@b.c', password: { $gt: '' } }])(
    'rejects incomplete credentials (%#)',
    async (body) => {
      await expect(controller.login(mockRequest({ body }), mockResponse())).rejects.toMatchObject({
        status: 400,
      });
    }
  );

  it('rejects unknown users and wrong passwords with 401', async () => {
    User.findOne.mockReturnValue(mockQuery(null));
    const req = mockRequest({ body: { email: 'a@b.c', password: 'x' } });
    await expect(controller.login(req, mockResponse())).rejects.toMatchObject({ status: 401 });

    User.findOne.mockReturnValue(mockQuery(user));
    bcrypt.compare.mockResolvedValue(false);
    await expect(controller.login(req, mockResponse())).rejects.toMatchObject({ status: 401 });
  });
});

describe('register', () => {
  const body = { name: ' Ana ', email: ' Ana@Test.dev ', password: 'secret123' };

  it('creates a reader with a hashed password and starts a session', async () => {
    User.exists.mockResolvedValue(null);
    bcrypt.hash.mockResolvedValue('hashed');
    User.create.mockResolvedValue({
      _id: ID_A,
      name: 'Ana',
      email: 'ana@test.dev',
      role: 'reader',
    });
    const res = mockResponse();
    await controller.register(mockRequest({ body: { ...body, role: 'admin' } }), res);
    expect(User.create).toHaveBeenCalledWith({
      name: 'Ana',
      email: 'ana@test.dev',
      password_hash: 'hashed',
      role: 'reader',
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      user: { _id: ID_A, email: 'ana@test.dev', name: 'Ana', role: 'reader', store_id: null },
    });
    const [, token] = res.cookie.mock.calls[0];
    expect(jwt.verify(token, process.env.JWT_SECRET)).toMatchObject({ sub: ID_A, role: 'reader' });
  });

  it.each([
    { email: 'a@b.c', password: 'secret123' },
    { name: 'Ana', email: 'not-an-email', password: 'secret123' },
    { name: 'Ana', email: 'a@b.c', password: 'short' },
    { name: 'Ana', email: 'a@b.c', password: { $gt: '' } },
  ])('rejects invalid input (%#)', async (input) => {
    await expect(
      controller.register(mockRequest({ body: input }), mockResponse())
    ).rejects.toMatchObject({ status: 400 });
    expect(User.create).not.toHaveBeenCalled();
  });

  it('rejects an email that is already registered with 409', async () => {
    User.exists.mockResolvedValue({ _id: ID_A });
    await expect(controller.register(mockRequest({ body }), mockResponse())).rejects.toMatchObject({
      status: 409,
    });
  });

  it('maps a duplicate key race to 409 and rethrows other errors', async () => {
    User.exists.mockResolvedValue(null);
    bcrypt.hash.mockResolvedValue('hashed');
    User.create.mockRejectedValueOnce(Object.assign(new Error('dup'), { code: 11000 }));
    await expect(controller.register(mockRequest({ body }), mockResponse())).rejects.toMatchObject({
      status: 409,
    });
    User.create.mockRejectedValueOnce(new Error('boom'));
    await expect(controller.register(mockRequest({ body }), mockResponse())).rejects.toThrow(
      'boom'
    );
  });
});

it('logout clears the cookie and returns 204', () => {
  const res = mockResponse();
  controller.logout(mockRequest(), res);
  expect(res.clearCookie).toHaveBeenCalledWith(
    'token',
    expect.objectContaining({ httpOnly: true })
  );
  expect(res.status).toHaveBeenCalledWith(204);
});

it('me returns the authenticated user', () => {
  const res = mockResponse();
  const req = mockRequest();
  controller.me(req, res);
  expect(res.json).toHaveBeenCalledWith({ user: { ...req.user, name: '', store_id: null } });
});
