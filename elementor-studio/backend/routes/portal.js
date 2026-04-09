const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../db/schema');
const { processEditRequest } = require('../services/analyzer');

const JWT_SECRET = process.env.JWT_SECRET || 'elementor-studio-portal-secret';
const AGENCY_NAME = process.env.AGENCY_NAME || 'Your Agency';

// Portal auth middleware
function portalAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Authentication required' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.portalUser = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Portal login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Credentials required' });

  const db = getDb();
  const user = db.prepare('SELECT * FROM portal_users WHERE username = ?').get(username);

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(user.client_id);

  const token = jwt.sign({
    userId: user.id,
    clientId: user.client_id,
    username: user.username,
  }, JWT_SECRET, { expiresIn: '7d' });

  res.json({
    token,
    user: {
      id: user.id,
      displayName: user.display_name,
      clientName: client?.name,
    },
    agencyName: AGENCY_NAME,
  });
});

// Get portal info
router.get('/info', (req, res) => {
  res.json({ agencyName: AGENCY_NAME });
});

// Get client's pages
router.get('/pages', portalAuth, (req, res) => {
  const db = getDb();
  const pages = db.prepare(`
    SELECT p.id, p.title, p.slug, p.status, p.screenshot_path, p.updated_at,
           pr.name as project_name, pr.wp_url
    FROM pages p
    JOIN projects pr ON p.project_id = pr.id
    WHERE pr.client_id = ?
    ORDER BY p.updated_at DESC
  `).all(req.portalUser.clientId);

  res.json(pages);
});

// Get chat history
router.get('/chat/:pageId', portalAuth, (req, res) => {
  const db = getDb();
  const messages = db.prepare(
    'SELECT role, content, created_at FROM chat_messages WHERE client_id = ? AND page_id = ? ORDER BY created_at ASC'
  ).all(req.portalUser.clientId, req.params.pageId);

  res.json(messages);
});

// Send edit message (white-labeled - no AI mentions)
router.post('/chat', portalAuth, async (req, res) => {
  const { pageId, message } = req.body;
  if (!message) return res.status(400).json({ error: 'Message required' });

  const db = getDb();
  const clientId = req.portalUser.clientId;

  const page = db.prepare('SELECT * FROM pages WHERE id = ?').get(pageId);
  if (!page) return res.status(404).json({ error: 'Page not found' });

  const currentJson = page.elementor_json ? JSON.parse(page.elementor_json) : [];

  // Save user message
  db.prepare(
    'INSERT INTO chat_messages (client_id, project_id, page_id, role, content) VALUES (?, ?, ?, ?, ?)'
  ).run(clientId, page.project_id, page.id, 'user', message);

  // Get history
  const history = db.prepare(
    'SELECT role, content FROM chat_messages WHERE client_id = ? AND page_id = ? ORDER BY created_at DESC LIMIT 20'
  ).all(clientId, page.id).reverse();

  try {
    const result = await processEditRequest(message, currentJson, history);

    // Apply patches
    let updatedJson = currentJson;
    const patches = Array.isArray(result.patches) ? result.patches : [result.patches].filter(Boolean);

    for (const patch of patches) {
      updatedJson = applyPatchSimple(updatedJson, patch);
    }

    // Save
    db.prepare('UPDATE pages SET elementor_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(JSON.stringify(updatedJson), page.id);

    db.prepare(
      'INSERT INTO chat_messages (client_id, project_id, page_id, role, content, patch_json) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(clientId, page.project_id, page.id, 'assistant', result.description, JSON.stringify(patches));

    // Deploy if possible
    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(clientId);
    if (client.wp_url && client.wp_user && client.wp_app_password && page.wp_page_id) {
      try {
        const { updatePage } = require('../services/deployer');
        await updatePage({
          wpUrl: client.wp_url,
          wpUser: client.wp_user,
          wpAppPassword: client.wp_app_password,
          pageId: page.wp_page_id,
          elementorJson: updatedJson,
        });
      } catch (e) { /* best effort */ }
    }

    // Send notification email to agency (placeholder)
    console.log(`[Portal] Client ${req.portalUser.username} made an edit: ${result.description}`);

    res.json({ reply: result.description });
  } catch (err) {
    db.prepare(
      'INSERT INTO chat_messages (client_id, project_id, page_id, role, content) VALUES (?, ?, ?, ?, ?)'
    ).run(clientId, page.project_id, page.id, 'assistant', 'I couldn\'t process that request. Please try rephrasing.');

    res.status(500).json({ reply: 'I couldn\'t process that request. Please try rephrasing.' });
  }
});

// Simple patch applier for portal
function applyPatchSimple(json, patch) {
  if (!patch || !patch.action) return json;
  const data = JSON.parse(JSON.stringify(json));

  function find(els, id) {
    for (const el of els) {
      if (el.id === id) return el;
      if (el.elements) { const f = find(el.elements, id); if (f) return f; }
    }
    return null;
  }

  if (patch.action === 'update') {
    const w = find(data, patch.widgetId);
    if (w && patch.path) {
      const keys = patch.path.split('.');
      let cur = w.settings = w.settings || {};
      for (let i = 0; i < keys.length - 1; i++) {
        if (!cur[keys[i]]) cur[keys[i]] = {};
        cur = cur[keys[i]];
      }
      cur[keys[keys.length - 1]] = patch.value;
    }
  }
  return data;
}

module.exports = router;
