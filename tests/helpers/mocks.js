// Shared test helpers: chainable Mongoose query mocks and Express req/res doubles.

/** Returns a thenable that mimics a Mongoose Query chain resolving to `result`. */
function mockQuery(result) {
  const query = {};
  for (const method of ['sort', 'skip', 'limit', 'populate', 'select', 'lean']) {
    query[method] = jest.fn(() => query);
  }
  query.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return query;
}

function mockResponse() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.end = jest.fn(() => res);
  res.cookie = jest.fn(() => res);
  res.clearCookie = jest.fn(() => res);
  return res;
}

function mockRequest(overrides = {}) {
  return {
    query: {},
    params: {},
    body: {},
    cookies: {},
    user: { _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', email: 'admin@test.dev', role: 'admin' },
    ...overrides,
  };
}

const ID_A = '64b000000000000000000001';
const ID_B = '64b000000000000000000002';
const ID_C = '64b000000000000000000003';

module.exports = { mockQuery, mockResponse, mockRequest, ID_A, ID_B, ID_C };
