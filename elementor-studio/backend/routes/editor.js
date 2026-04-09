const express = require('express');
const router = express.Router();
const { getDb } = require('../db/schema');
const { processEditRequest } = require('../services/analyzer');
const { deployToWordPress } = require('../services/deployer');

// Get chat history for a client/page
router.get('/history/:clientId', (req, res) => {
  const db = getDb();
  const { pageId } = req.query;

  let messages;
  if (pageId) {
    messages = db.prepare(
      'SELECT * FROM chat_messages WHERE client_id = ? AND page_id = ? ORDER BY created_at ASC'
    ).all(req.params.clientId, pageId);
  } else {
    messages = db.prepare(
      'SELECT * FROM chat_messages WHERE client_id = ? ORDER BY created_at ASC LIMIT 100'
    ).all(req.params.clientId);
  }

  res.json(messages.map(m => ({
    ...m,
    patch_json: m.patch_json ? JSON.parse(m.patch_json) : null,
  })));
});

// Send an edit message
router.post('/message', async (req, res) => {
  const { clientId, pageId, message } = req.body;

  if (!clientId || !message) {
    return res.status(400).json({ error: 'clientId and message are required' });
  }

  const db = getDb();
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(clientId);
  if (!client) return res.status(404).json({ error: 'Client not found' });

  // Find the page to edit
  let page;
  if (pageId) {
    page = db.prepare('SELECT * FROM pages WHERE id = ?').get(pageId);
  } else {
    // Get most recent page for this client
    page = db.prepare(`
      SELECT p.* FROM pages p
      JOIN projects pr ON p.project_id = pr.id
      WHERE pr.client_id = ?
      ORDER BY p.updated_at DESC LIMIT 1
    `).get(clientId);
  }

  if (!page) {
    return res.status(404).json({ error: 'No pages found for this client. Import a site first.' });
  }

  const currentJson = page.elementor_json ? JSON.parse(page.elementor_json) : [];

  // Save user message
  db.prepare(
    'INSERT INTO chat_messages (client_id, project_id, page_id, role, content) VALUES (?, ?, ?, ?, ?)'
  ).run(clientId, page.project_id, page.id, 'user', message);

  // Get chat history for context
  const history = db.prepare(
    'SELECT role, content FROM chat_messages WHERE client_id = ? AND page_id = ? ORDER BY created_at DESC LIMIT 20'
  ).all(clientId, page.id).reverse();

  const broadcast = req.app.get('broadcast');

  try {
    // Process with AI
    const result = await processEditRequest(message, currentJson, history);

    // Apply patches to the JSON
    let updatedJson = currentJson;
    const patches = Array.isArray(result.patches) ? result.patches : [result.patches].filter(Boolean);

    for (const patch of patches) {
      updatedJson = applyPatch(updatedJson, patch);
    }

    // Save updated JSON
    db.prepare('UPDATE pages SET elementor_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(JSON.stringify(updatedJson), page.id);

    // Save AI response
    db.prepare(
      'INSERT INTO chat_messages (client_id, project_id, page_id, role, content, patch_json) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(clientId, page.project_id, page.id, 'assistant', result.description, JSON.stringify(patches));

    // Deploy update if WordPress is configured
    let deployResult = null;
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
        deployResult = { deployed: true };

        // Clear Kinsta cache if configured
        if (client.kinsta_site_id) {
          try {
            const { clearCache } = require('../services/kinsta-service');
            await clearCache(client.kinsta_site_id);
          } catch (e) { /* cache clear is best-effort */ }
        }
      } catch (deployErr) {
        deployResult = { deployed: false, error: deployErr.message };
      }
    }

    // Broadcast update
    broadcast(clientId, {
      type: 'edit',
      pageId: page.id,
      patches,
      description: result.description,
    });

    res.json({
      success: true,
      description: result.description,
      patches,
      deployed: deployResult,
      previewUrl: client.wp_url ? `${client.wp_url}/?p=${page.wp_page_id}` : null,
    });
  } catch (err) {
    console.error('Editor error:', err);

    // Save error as AI message
    db.prepare(
      'INSERT INTO chat_messages (client_id, project_id, page_id, role, content) VALUES (?, ?, ?, ?, ?)'
    ).run(clientId, page.project_id, page.id, 'assistant', `Sorry, I couldn't process that change. ${err.message}`);

    res.status(500).json({ error: err.message });
  }
});

// Apply a JSON patch to Elementor data
function applyPatch(json, patch) {
  if (!patch || !patch.action) return json;

  const data = JSON.parse(JSON.stringify(json)); // deep clone

  switch (patch.action) {
    case 'update': {
      const widget = findWidget(data, patch.widgetId);
      if (widget && patch.path) {
        setNestedValue(widget.settings, patch.path, patch.value);
      }
      break;
    }
    case 'add': {
      if (patch.parentId) {
        const parent = findWidget(data, patch.parentId);
        if (parent && parent.elements) {
          const newWidget = patch.value;
          if (!newWidget.id) newWidget.id = require('uuid').v4().replace(/-/g, '').slice(0, 7);
          const insertAt = patch.position !== undefined ? patch.position : parent.elements.length;
          parent.elements.splice(insertAt, 0, newWidget);
        }
      } else if (patch.value) {
        // Add as new section at root level
        const newSection = patch.value;
        if (!newSection.id) newSection.id = require('uuid').v4().replace(/-/g, '').slice(0, 7);
        const insertAt = patch.position !== undefined ? patch.position : data.length;
        data.splice(insertAt, 0, newSection);
      }
      break;
    }
    case 'delete': {
      removeWidget(data, patch.widgetId);
      break;
    }
    case 'reorder': {
      if (patch.widgetId && patch.newPosition !== undefined) {
        reorderWidget(data, patch.widgetId, patch.newPosition);
      }
      break;
    }
  }

  return data;
}

function findWidget(elements, id) {
  for (const el of elements) {
    if (el.id === id) return el;
    if (el.elements) {
      const found = findWidget(el.elements, id);
      if (found) return found;
    }
  }
  return null;
}

function removeWidget(elements, id) {
  for (let i = 0; i < elements.length; i++) {
    if (elements[i].id === id) {
      elements.splice(i, 1);
      return true;
    }
    if (elements[i].elements && removeWidget(elements[i].elements, id)) {
      return true;
    }
  }
  return false;
}

function reorderWidget(elements, id, newPosition) {
  for (let i = 0; i < elements.length; i++) {
    if (elements[i].id === id) {
      const [widget] = elements.splice(i, 1);
      elements.splice(Math.min(newPosition, elements.length), 0, widget);
      return true;
    }
    if (elements[i].elements && reorderWidget(elements[i].elements, id, newPosition)) {
      return true;
    }
  }
  return false;
}

function setNestedValue(obj, path, value) {
  const keys = path.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]]) current[keys[i]] = {};
    current = current[keys[i]];
  }
  current[keys[keys.length - 1]] = value;
}

module.exports = router;
