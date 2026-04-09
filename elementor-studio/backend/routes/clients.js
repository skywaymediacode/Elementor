const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const slugify = require('slugify');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { getDb } = require('../db/schema');

// List all clients
router.get('/', (req, res) => {
  const db = getDb();
  const clients = db.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM projects WHERE client_id = c.id) as project_count,
      (SELECT COUNT(*) FROM pages p JOIN projects pr ON p.project_id = pr.id WHERE pr.client_id = c.id) as page_count,
      (SELECT MAX(p.updated_at) FROM pages p JOIN projects pr ON p.project_id = pr.id WHERE pr.client_id = c.id) as last_edited
    FROM clients c ORDER BY c.updated_at DESC
  `).all();
  res.json(clients);
});

// Get single client with projects and pages
router.get('/:id', (req, res) => {
  const db = getDb();
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
  if (!client) return res.status(404).json({ error: 'Client not found' });

  const projects = db.prepare('SELECT * FROM projects WHERE client_id = ? ORDER BY updated_at DESC').all(client.id);
  for (const project of projects) {
    project.pages = db.prepare('SELECT * FROM pages WHERE project_id = ? ORDER BY created_at ASC').all(project.id);
  }
  client.projects = projects;

  const portalUser = db.prepare('SELECT id, username, display_name, created_at FROM portal_users WHERE client_id = ?').get(client.id);
  client.portal_user = portalUser || null;

  res.json(client);
});

// Create client
router.post('/', (req, res) => {
  const db = getDb();
  const { name, email, phone, website_url, wp_url, wp_user, wp_app_password, kinsta_site_id } = req.body;

  if (!name) return res.status(400).json({ error: 'Name is required' });

  const id = uuidv4();
  const slug = slugify(name, { lower: true, strict: true });

  // Create client folder
  const clientDir = path.join(process.env.CLIENTS_DIR || path.join(__dirname, '..', 'clients'), slug);
  if (!fs.existsSync(clientDir)) {
    fs.mkdirSync(clientDir, { recursive: true });
    fs.mkdirSync(path.join(clientDir, 'assets'), { recursive: true });
    fs.mkdirSync(path.join(clientDir, 'screenshots'), { recursive: true });
  }

  db.prepare(`
    INSERT INTO clients (id, name, slug, email, phone, website_url, kinsta_site_id, wp_url, wp_user, wp_app_password)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, slug, email || null, phone || null, website_url || null, kinsta_site_id || null, wp_url || null, wp_user || null, wp_app_password || null);

  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
  res.status(201).json(client);
});

// Update client
router.put('/:id', (req, res) => {
  const db = getDb();
  const { name, email, phone, website_url, wp_url, wp_user, wp_app_password, kinsta_site_id } = req.body;

  const existing = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Client not found' });

  db.prepare(`
    UPDATE clients SET
      name = COALESCE(?, name),
      email = COALESCE(?, email),
      phone = COALESCE(?, phone),
      website_url = COALESCE(?, website_url),
      wp_url = COALESCE(?, wp_url),
      wp_user = COALESCE(?, wp_user),
      wp_app_password = COALESCE(?, wp_app_password),
      kinsta_site_id = COALESCE(?, kinsta_site_id),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(name, email, phone, website_url, wp_url, wp_user, wp_app_password, kinsta_site_id, req.params.id);

  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
  res.json(client);
});

// Delete client
router.delete('/:id', (req, res) => {
  const db = getDb();
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
  if (!client) return res.status(404).json({ error: 'Client not found' });

  db.prepare('DELETE FROM clients WHERE id = ?').run(req.params.id);

  // Remove client folder
  const clientDir = path.join(process.env.CLIENTS_DIR || path.join(__dirname, '..', 'clients'), client.slug);
  if (fs.existsSync(clientDir)) {
    fs.rmSync(clientDir, { recursive: true, force: true });
  }

  res.json({ success: true });
});

// Create portal user for client
router.post('/:id/portal-user', async (req, res) => {
  const db = getDb();
  const { username, password, display_name } = req.body;

  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
  if (!client) return res.status(404).json({ error: 'Client not found' });

  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  const hash = await bcrypt.hash(password, 10);
  const id = uuidv4();

  try {
    db.prepare(`
      INSERT INTO portal_users (id, client_id, username, password_hash, display_name)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, client.id, username, hash, display_name || client.name);

    res.status(201).json({ id, username, display_name: display_name || client.name });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Username already exists' });
    }
    throw err;
  }
});

module.exports = router;
