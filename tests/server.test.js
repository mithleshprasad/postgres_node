const request = require('supertest');

// Mocks must be defined before requiring the app
let mockCreate = jest.fn();

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
        chat: { completions: { create: (...args) => mockCreate(...args) } }
      };
    })
  };
});

const app = require('../server');

describe('API Endpoints', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
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

  describe('POST /chat', () => {
    it('should return 400 if message is missing', async () => {
      const res = await request(app).post('/chat').send({});
      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('error', 'Message is required');
    });

    it('should stream AI response successfully', async () => {
      // Setup the mock to return an array of chunks (which works with for await)
      mockCreate.mockResolvedValue([
        { choices: [{ delta: { content: 'Hello ' } }] },
        { choices: [{ delta: { content: 'World!' } }] }
      ]);

      const res = await request(app).post('/chat').send({ message: 'Hi there' });
      expect(res.statusCode).toEqual(200);
      expect(res.text).toEqual('Hello World!');
    });

    it('should return 500 if an error occurs before streaming', async () => {
      // Simulate an API error
      mockCreate.mockRejectedValue(new Error('Groq API failed'));

      const res = await request(app).post('/chat').send({ message: 'Crash it' });
      expect(res.statusCode).toEqual(500);
      expect(res.body).toHaveProperty('error', 'Failed to process chat');
    });
    
    it('should handle error if thrown during stream (headers sent)', async () => {
      // Simulate an error that throws DURING the async iteration
      // We can do this with an async generator that yields some data then throws
      mockCreate.mockReturnValue((async function* () {
        yield { choices: [{ delta: { content: 'Half ' } }] };
        throw new Error('Stream interrupted');
      })());

      const res = await request(app).post('/chat').send({ message: 'Crash mid-stream' });
      // The response code will remain 200 because headers were already sent with chunked encoding
      expect(res.statusCode).toEqual(200);
      // It should include the partial content and the error string we added in catch block
      expect(res.text).toContain('Half ');
      expect(res.text).toContain('[Error generating response]');
    });
  });
});
