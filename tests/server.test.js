const request = require('supertest');
const app = require('../server');

// Mock pg to prevent database connections during simple testing
jest.mock('pg', () => {
  const mPool = {
    query: jest.fn().mockResolvedValue({ rows: [] })
  };
  return { Pool: jest.fn(() => mPool) };
});

// Mock groq-sdk
jest.mock('groq-sdk', () => {
  return {
    Groq: jest.fn().mockImplementation(() => {
      return {
        chat: { completions: { create: jest.fn() } }
      };
    })
  };
});

describe('API Endpoints', () => {
  let server;

  beforeAll((done) => {
    // start server explicitly on a random port or just use supertest directly
    // since server.js calls app.listen, we might need to close it if it's running
    // but for now supertest wraps it.
    done();
  });

  afterAll((done) => {
    // If the server was started by server.js, we need to close it to allow jest to exit cleanly.
    // In server.js, app doesn't expose the server object.
    // So we'll just force exit in the jest config or here if needed.
    done();
  });

  it('should return 404 for unknown routes', async () => {
    const res = await request(app).get('/unknown-route');
    expect(res.statusCode).toEqual(404);
  });

  it('should return chat history', async () => {
    const res = await request(app).get('/history');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toEqual([]);
  });
});
