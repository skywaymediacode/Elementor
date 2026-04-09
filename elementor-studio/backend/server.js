require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { WebSocketServer } = require('ws');
const http = require('http');

const { getDb } = require('./db/schema');

// Ensure directories exist
const clientsDir = process.env.CLIENTS_DIR || path.join(__dirname, 'clients');
const logsDir = path.join(__dirname, 'logs');
[clientsDir, logsDir].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

// Initialize database
getDb();

const app = express();
const server = http.createServer(app);

// WebSocket server for real-time preview updates
const wss = new WebSocketServer({ server, path: '/ws' });
const wsClients = new Map();

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const clientId = url.searchParams.get('clientId');
  if (clientId) {
    if (!wsClients.has(clientId)) wsClients.set(clientId, new Set());
    wsClients.get(clientId).add(ws);
    ws.on('close', () => {
      wsClients.get(clientId)?.delete(ws);
    });
  }
});

function broadcastToClient(clientId, message) {
  const clients = wsClients.get(clientId);
  if (clients) {
    const data = JSON.stringify(message);
    clients.forEach(ws => {
      if (ws.readyState === 1) ws.send(data);
    });
  }
}

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve client assets
app.use('/assets', express.static(clientsDir));

// Serve frontend build
app.use(express.static(path.join(__dirname, '..', 'frontend', 'dist')));

// Make broadcast available to routes
app.set('broadcast', broadcastToClient);

// Routes
app.use('/api/convert', require('./routes/convert'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/editor', require('./routes/editor'));
app.use('/api/kinsta', require('./routes/kinsta'));
app.use('/api/elementor', require('./routes/elementor'));

// Portal routes (white-labeled)
app.use('/portal', require('./routes/portal'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0', name: 'Elementor Studio' });
});

// SPA fallback
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, '..', 'frontend', 'dist', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.json({ message: 'Elementor Studio API running. Build frontend with: cd frontend && npm run build' });
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[Error]', err.message);
  res.status(err.status || 500).json({ error: err.message });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n  Elementor Studio running on http://localhost:${PORT}`);
  console.log(`  WebSocket on ws://localhost:${PORT}/ws\n`);
});

module.exports = { app, server, broadcastToClient };
