const express = require('express');
const router = express.Router();
const axios = require('axios');
const { getDb } = require('../db/schema');

// Get Elementor JSON for a page
router.get('/page/:pageId/json', (req, res) => {
  const db = getDb();
  const page = db.prepare('SELECT * FROM pages WHERE id = ?').get(req.params.pageId);
  if (!page) return res.status(404).json({ error: 'Page not found' });
  res.json({
    pageId: page.id,
    title: page.title,
    elementor_json: page.elementor_json ? JSON.parse(page.elementor_json) : [],
  });
});

// Update Elementor JSON for a page
router.put('/page/:pageId/json', (req, res) => {
  const db = getDb();
  const { elementor_json } = req.body;

  const page = db.prepare('SELECT * FROM pages WHERE id = ?').get(req.params.pageId);
  if (!page) return res.status(404).json({ error: 'Page not found' });

  db.prepare('UPDATE pages SET elementor_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(JSON.stringify(elementor_json), req.params.pageId);

  res.json({ success: true });
});

// Push Elementor JSON to WordPress
router.post('/page/:pageId/deploy', async (req, res) => {
  const db = getDb();
  const page = db.prepare('SELECT * FROM pages WHERE id = ?').get(req.params.pageId);
  if (!page) return res.status(404).json({ error: 'Page not found' });

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(page.project_id);
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(project.client_id);

  if (!client.wp_url || !client.wp_user || !client.wp_app_password) {
    return res.status(400).json({ error: 'WordPress credentials not configured for this client' });
  }

  try {
    const { deployToWordPress, updatePage } = require('../services/deployer');
    const elementorJson = page.elementor_json ? JSON.parse(page.elementor_json) : [];

    let result;
    if (page.wp_page_id) {
      // Update existing page
      result = await updatePage({
        wpUrl: client.wp_url,
        wpUser: client.wp_user,
        wpAppPassword: client.wp_app_password,
        pageId: page.wp_page_id,
        elementorJson,
      });
    } else {
      // Create new page
      result = await deployToWordPress({
        wpUrl: client.wp_url,
        wpUser: client.wp_user,
        wpAppPassword: client.wp_app_password,
        title: page.title,
        elementorJson,
        images: [],
        clientSlug: client.slug,
      });
      db.prepare('UPDATE pages SET wp_page_id = ? WHERE id = ?').run(result.pageId, page.id);
    }

    db.prepare("UPDATE pages SET status = 'deployed', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(page.id);

    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fetch live Elementor JSON from WordPress
router.post('/page/:pageId/pull', async (req, res) => {
  const db = getDb();
  const page = db.prepare('SELECT * FROM pages WHERE id = ?').get(req.params.pageId);
  if (!page || !page.wp_page_id) return res.status(404).json({ error: 'Page not deployed' });

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(page.project_id);
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(project.client_id);

  try {
    const { getPageJSON } = require('../services/deployer');
    const json = await getPageJSON({
      wpUrl: client.wp_url,
      wpUser: client.wp_user,
      wpAppPassword: client.wp_app_password,
      pageId: page.wp_page_id,
    });

    db.prepare('UPDATE pages SET elementor_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(JSON.stringify(json), page.id);

    res.json({ success: true, elementor_json: json });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
