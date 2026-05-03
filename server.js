const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const API_BASE = 'https://api.kite.trade';

app.post('/session/token', async (req, res) => {
  const { api_key, request_token, secret, checksum } = req.body;
  
  try {
    const body = new URLSearchParams();
    body.append('api_key', api_key);
    body.append('request_token', request_token);
    if (secret) body.append('secret', secret);
    if (checksum) body.append('checksum', checksum);

    const response = await fetch(`${API_BASE}/session/token`, {
      method: 'POST',
      headers: {
        'X-Kite-Version': '3',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/portfolio/holdings', async (req, res) => {
  const { api_key, access_token } = req.query;

  try {
    const response = await fetch(`${API_BASE}/portfolio/holdings`, {
      headers: {
        'Authorization': `token ${api_key}:${access_token}`,
      },
    });

    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/quote', async (req, res) => {
  const { api_key, access_token, i } = req.query;

  try {
    const response = await fetch(`${API_BASE}/quote?i=${i}`, {
      headers: {
        'Authorization': `token ${api_key}:${access_token}`,
      },
    });

    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = 3001;
app.listen(PORT, () => console.log(`Proxy server running on http://localhost:${PORT}`));