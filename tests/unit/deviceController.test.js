jest.mock('../../models/Device', () => ({ findOneAndUpdate: jest.fn(), deleteOne: jest.fn() }));

const Device = require('../../models/Device');
const controller = require('../../controllers/deviceController');
const { mockQuery, mockRequest, mockResponse, ID_A } = require('../helpers/mocks');

const TOKEN = 'fcm-token:APA91b_example-123';

beforeEach(() => jest.clearAllMocks());

describe('registerDevice', () => {
  it('upserts the token for the signed-in user and returns the device', async () => {
    const device = { _id: ID_A, token: TOKEN, platform: 'android' };
    Device.findOneAndUpdate.mockReturnValue(mockQuery(device));
    const req = mockRequest({ body: { token: `  ${TOKEN} `, platform: 'android' } });
    const res = mockResponse();
    await controller.registerDevice(req, res);
    expect(Device.findOneAndUpdate).toHaveBeenCalledWith(
      { token: TOKEN },
      { $set: { user_id: req.user._id, platform: 'android' } },
      expect.objectContaining({ upsert: true, runValidators: true })
    );
    expect(res.json).toHaveBeenCalledWith({ device });
  });

  it.each([
    ['missing token', { platform: 'ios' }, 'token is required'],
    ['blank token', { token: '   ', platform: 'ios' }, 'token is required'],
    ['non-string token', { token: 123, platform: 'ios' }, 'token is required'],
    [
      'too long token',
      { token: 'x'.repeat(4097), platform: 'ios' },
      'token must be at most 4096 characters',
    ],
    ['missing platform', { token: TOKEN }, 'platform must be one of: android, ios'],
    [
      'unknown platform',
      { token: TOKEN, platform: 'web' },
      'platform must be one of: android, ios',
    ],
  ])('returns 400 for %s', async (_, body, message) => {
    await expect(
      controller.registerDevice(mockRequest({ body }), mockResponse())
    ).rejects.toMatchObject({ status: 400, message });
    expect(Device.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('returns 400 when there is no body', async () => {
    await expect(
      controller.registerDevice(mockRequest({ body: undefined }), mockResponse())
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe('unregisterDevice', () => {
  it("deletes only the signed-in user's token and answers 204", async () => {
    Device.deleteOne.mockResolvedValue({ deletedCount: 1 });
    const req = mockRequest({ params: { token: TOKEN } });
    const res = mockResponse();
    await controller.unregisterDevice(req, res);
    expect(Device.deleteOne).toHaveBeenCalledWith({ token: TOKEN, user_id: req.user._id });
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.end).toHaveBeenCalled();
  });

  it('still answers 204 when the token is unknown or belongs to someone else', async () => {
    Device.deleteOne.mockResolvedValue({ deletedCount: 0 });
    const res = mockResponse();
    await controller.unregisterDevice(mockRequest({ params: { token: TOKEN } }), res);
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it('returns 400 for a too long token', async () => {
    const req = mockRequest({ params: { token: 'x'.repeat(4097) } });
    await expect(controller.unregisterDevice(req, mockResponse())).rejects.toMatchObject({
      status: 400,
    });
    expect(Device.deleteOne).not.toHaveBeenCalled();
  });
});
