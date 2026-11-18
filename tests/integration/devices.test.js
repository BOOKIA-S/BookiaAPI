// Integration tests for /api/devices: auth (Bearer and cookie), routing and validation,
// with Mongoose models mocked.
jest.mock('../../models/User', () => ({ findById: jest.fn() }));
jest.mock('../../models/Device', () => ({ findOneAndUpdate: jest.fn(), deleteOne: jest.fn() }));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../app');
const User = require('../../models/User');
const Device = require('../../models/Device');
const { mockQuery, ID_A, ID_B } = require('../helpers/mocks');

const READER = { _id: ID_B, email: 'reader@test.dev', role: 'reader' };
const bearer = (sub) => `Bearer ${jwt.sign({ sub }, process.env.JWT_SECRET)}`;
const TOKEN = 'dGVzdC1mY20tdG9rZW4:APA91bH-example_token';

beforeEach(() => {
  jest.clearAllMocks();
  User.findById.mockReturnValue(mockQuery(READER));
});

describe('POST /api/devices', () => {
  it('registers the FCM token of a mobile reader (Bearer)', async () => {
    const device = { _id: ID_A, token: TOKEN, platform: 'android' };
    Device.findOneAndUpdate.mockReturnValue(mockQuery(device));
    const res = await request(app)
      .post('/api/devices')
      .set('Authorization', bearer(ID_B))
      .send({ token: TOKEN, platform: 'android' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ device });
    expect(Device.findOneAndUpdate.mock.calls[0][1]).toEqual({
      $set: { user_id: ID_B, platform: 'android' },
    });
  });

  it('accepts the session cookie too', async () => {
    Device.findOneAndUpdate.mockReturnValue(mockQuery({ token: TOKEN, platform: 'ios' }));
    const res = await request(app)
      .post('/api/devices')
      .set('Cookie', `token=${jwt.sign({ sub: ID_B }, process.env.JWT_SECRET)}`)
      .send({ token: TOKEN, platform: 'ios' });
    expect(res.status).toBe(200);
  });

  it('returns 401 without a session', async () => {
    const res = await request(app).post('/api/devices').send({ token: TOKEN, platform: 'ios' });
    expect(res.status).toBe(401);
    expect(Device.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('returns 403 while the password change is pending', async () => {
    User.findById.mockReturnValue(mockQuery({ ...READER, must_change_password: true }));
    const res = await request(app)
      .post('/api/devices')
      .set('Authorization', bearer(ID_B))
      .send({ token: TOKEN, platform: 'ios' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PASSWORD_CHANGE_REQUIRED');
  });

  it('returns 400 for an invalid platform', async () => {
    const res = await request(app)
      .post('/api/devices')
      .set('Authorization', bearer(ID_B))
      .send({ token: TOKEN, platform: 'web' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('platform must be one of: android, ios');
  });

  it('ignores operator keys in the body', async () => {
    const res = await request(app)
      .post('/api/devices')
      .set('Authorization', bearer(ID_B))
      .send({ token: { $ne: '' }, platform: 'android' });
    expect(res.status).toBe(400);
    expect(Device.findOneAndUpdate).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/devices/:token', () => {
  it('removes the token of the signed-in user', async () => {
    Device.deleteOne.mockResolvedValue({ deletedCount: 1 });
    const res = await request(app)
      .delete(`/api/devices/${encodeURIComponent(TOKEN)}`)
      .set('Authorization', bearer(ID_B));
    expect(res.status).toBe(204);
    expect(Device.deleteOne).toHaveBeenCalledWith({ token: TOKEN, user_id: ID_B });
  });

  it('returns 401 without a session', async () => {
    const res = await request(app).delete(`/api/devices/${encodeURIComponent(TOKEN)}`);
    expect(res.status).toBe(401);
    expect(Device.deleteOne).not.toHaveBeenCalled();
  });
});
