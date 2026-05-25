require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;

// Create a pool. If environment variables (PGHOST, PGUSER, etc.) are set,
// `pg` will use them automatically. Optionally, set DATABASE_URL.
const pool = new Pool();

app.get('/', (req, res) => {
  res.send('Postgres + Node server is running. Try GET /db');
});

app.get('/db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() AS now');
    res.json({ now: result.rows[0].now });
  } catch (err) {
    console.error('DB error', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/version', async (req, res) => {
  try {
    const r = await pool.query('SELECT version()');
    res.json({ version: r.rows[0].version });
  } catch (err) {
    console.error('DB error', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

module.exports = app;
