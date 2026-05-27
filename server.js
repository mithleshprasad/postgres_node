require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const { Groq } = require('groq-sdk');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Initialize Postgres pool
const pool = new Pool();

// Initialize Groq client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY // Ensure this is set in .env
});

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Create table if it doesn't exist
const initDb = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id SERIAL PRIMARY KEY,
        role VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Database initialized');
  } catch (err) {
    console.error('Error initializing database:', err);
  }
};

initDb();

// Get chat history
app.get('/history', async (req, res) => {
  try {
    const result = await pool.query('SELECT role, content FROM chat_messages ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Chat endpoint with streaming
app.post('/chat', async (req, res) => {
  const userMessage = req.body.message;
  
  if (!userMessage) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    // Save user message to DB
    await pool.query('INSERT INTO chat_messages (role, content) VALUES ($1, $2)', ['user', userMessage]);
    
    // Fetch recent history to provide context to the model
    const historyResult = await pool.query('SELECT role, content FROM chat_messages ORDER BY id ASC LIMIT 20');
    const messages = historyResult.rows.map(row => ({
      role: row.role,
      content: row.content
    }));

    const chatCompletion = await groq.chat.completions.create({
      "messages": messages,
      "model": "openai/gpt-oss-120b",
      "temperature": 1,
      "max_completion_tokens": 1024,
      "top_p": 1,
      "stream": true,
      "reasoning_effort": "medium",
      "stop": null
    });

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');

    let aiFullResponse = '';

    for await (const chunk of chatCompletion) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        aiFullResponse += content;
        res.write(content);
      }
    }
    
    // Save AI response to DB
    await pool.query('INSERT INTO chat_messages (role, content) VALUES ($1, $2)', ['assistant', aiFullResponse]);
    
    res.end();
  } catch (err) {
    console.error('Groq/DB Error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to process chat' });
    } else {
      res.end('\n[Error generating response]');
    }
  }
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

module.exports = app;
