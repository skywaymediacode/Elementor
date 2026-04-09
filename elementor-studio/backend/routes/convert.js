const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/schema');
const { scrapeWebsite } = require('../services/scraper');
const { analyzeAndConvert } = require('../services/analyzer');
const { convertToElementor } = require('../services/converter');
const { deployToWordPress } = require('../services/deployer');

// Start a new conversion
router.post('/', async (req, res) => {
  const { url, clientId, sourceType, kinstaSiteId, pageName } = req.body;

  if (!url) return res.status(400).json({ error: 'URL is required' });
  if (!clientId) return res.status(400).json({ error: 'Client ID is required' });

  const db = getDb();
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(clientId);
  if (!client) return res.status(404).json({ error: 'Client not found' });

  const broadcast = req.app.get('broadcast');

  // Create project
  const projectId = uuidv4();
  db.prepare(`
    INSERT INTO projects (id, client_id, name, source_url, source_type, status, kinsta_site_id)
    VALUES (?, ?, ?, ?, ?, 'scraping', ?)
  `).run(projectId, clientId, pageName || 'Imported Site', url, sourceType || 'html', kinstaSiteId || null);

  // Return immediately, process in background
  res.json({ projectId, status: 'scraping', message: 'Conversion started' });

  // Background processing
  try {
    // Step 1: Scrape
    broadcast(clientId, { type: 'progress', projectId, step: 'scraping', message: 'Analyzing website layout...' });
    const scrapeData = await scrapeWebsite(url, client.slug);

    db.prepare("UPDATE projects SET status = 'analyzing' WHERE id = ?").run(projectId);
    broadcast(clientId, { type: 'progress', projectId, step: 'analyzing', message: 'Extracting styles and content...' });

    // Step 2: Analyze with AI and convert
    const elementorJson = await analyzeAndConvert(scrapeData, sourceType);

    db.prepare("UPDATE projects SET status = 'converting' WHERE id = ?").run(projectId);
    broadcast(clientId, { type: 'progress', projectId, step: 'converting', message: 'Converting to Elementor format...' });

    // Step 3: Validate and enhance the Elementor JSON
    const finalJson = convertToElementor(elementorJson, scrapeData);

    // Step 4: Save page
    const pageId = uuidv4();
    db.prepare(`
      INSERT INTO pages (id, project_id, title, slug, elementor_json, screenshot_path, status)
      VALUES (?, ?, ?, ?, ?, ?, 'ready')
    `).run(
      pageId, projectId,
      scrapeData.title || pageName || 'Imported Page',
      scrapeData.slug || 'imported-page',
      JSON.stringify(finalJson),
      scrapeData.screenshotPath || null
    );

    // Step 5: Deploy if WordPress credentials available
    if (client.wp_url && client.wp_user && client.wp_app_password) {
      db.prepare("UPDATE projects SET status = 'deploying' WHERE id = ?").run(projectId);
      broadcast(clientId, { type: 'progress', projectId, step: 'deploying', message: 'Deploying to WordPress...' });

      try {
        const deployResult = await deployToWordPress({
          wpUrl: client.wp_url,
          wpUser: client.wp_user,
          wpAppPassword: client.wp_app_password,
          title: scrapeData.title || pageName || 'Imported Page',
          elementorJson: finalJson,
          images: scrapeData.images || [],
          clientSlug: client.slug,
        });

        db.prepare("UPDATE pages SET wp_page_id = ?, status = 'deployed' WHERE id = ?").run(deployResult.pageId, pageId);
        db.prepare("UPDATE projects SET status = 'deployed', wp_url = ? WHERE id = ?").run(deployResult.pageUrl, projectId);

        broadcast(clientId, {
          type: 'complete', projectId, pageId,
          step: 'deployed',
          message: 'Site deployed successfully!',
          pageUrl: deployResult.pageUrl,
        });
      } catch (deployErr) {
        console.error('Deploy error:', deployErr.message);
        db.prepare("UPDATE projects SET status = 'ready' WHERE id = ?").run(projectId);
        broadcast(clientId, {
          type: 'complete', projectId, pageId,
          step: 'ready',
          message: 'Conversion complete. Deploy manually or configure WordPress credentials.',
          warning: deployErr.message,
        });
      }
    } else {
      db.prepare("UPDATE projects SET status = 'ready' WHERE id = ?").run(projectId);
      broadcast(clientId, {
        type: 'complete', projectId, pageId,
        step: 'ready',
        message: 'Conversion complete! Configure WordPress credentials to deploy.',
      });
    }
  } catch (err) {
    console.error('Conversion error:', err);
    db.prepare("UPDATE projects SET status = 'error' WHERE id = ?").run(projectId);
    broadcast(clientId, { type: 'error', projectId, message: err.message });
  }
});

// Get conversion status
router.get('/:projectId/status', (req, res) => {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const pages = db.prepare('SELECT * FROM pages WHERE project_id = ?').all(project.id);
  res.json({ ...project, pages });
});

// Get page Elementor JSON
router.get('/page/:pageId', (req, res) => {
  const db = getDb();
  const page = db.prepare('SELECT * FROM pages WHERE id = ?').get(req.params.pageId);
  if (!page) return res.status(404).json({ error: 'Page not found' });

  res.json({
    ...page,
    elementor_json: page.elementor_json ? JSON.parse(page.elementor_json) : null,
  });
});

module.exports = router;
