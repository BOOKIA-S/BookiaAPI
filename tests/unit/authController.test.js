jest.mock('../../models/User', () => ({ findOne: jest.fn() }));
jest.mock('bcrypt', () => ({ compare: jest.fn() }));

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const controller = require('../../controllers/authController');
const { mockQuery, mockRequest, mockResponse, ID_A } = require('../helpers/mocks');

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
      user: { _id: ID_A, email: 'admin@test.dev', role: 'admin' },
    });
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
  expect(res.json).toHaveBeenCalledWith({ user: req.user });
});
