const { getDb } = require('../db/schema');
const { getPageJSON } = require('./deployer');

/**
 * Watches for changes on deployed WordPress sites.
 * Compares stored Elementor JSON with live data periodically.
 */
class SiteWatcher {
  constructor(broadcastFn) {
    this.broadcast = broadcastFn;
    this.interval = null;
    this.watching = new Map();
  }

  start(intervalMs = 60000) {
    if (this.interval) return;
    this.interval = setInterval(() => this.checkAll(), intervalMs);
    console.log(`[Watcher] Started - checking every ${intervalMs / 1000}s`);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      console.log('[Watcher] Stopped');
    }
  }

  addSite(clientId, pageId) {
    this.watching.set(pageId, clientId);
  }

  removeSite(pageId) {
    this.watching.delete(pageId);
  }

  async checkAll() {
    const db = getDb();

    for (const [pageId, clientId] of this.watching.entries()) {
      try {
        const page = db.prepare('SELECT * FROM pages WHERE id = ?').get(pageId);
        if (!page || !page.wp_page_id) continue;

        const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(page.project_id);
        const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(project.client_id);

        if (!client.wp_url || !client.wp_user || !client.wp_app_password) continue;

        const liveJson = await getPageJSON({
          wpUrl: client.wp_url,
          wpUser: client.wp_user,
          wpAppPassword: client.wp_app_password,
          pageId: page.wp_page_id,
        });

        const storedJson = page.elementor_json ? JSON.parse(page.elementor_json) : [];

        if (JSON.stringify(liveJson) !== JSON.stringify(storedJson)) {
          // Update stored JSON
          db.prepare('UPDATE pages SET elementor_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(JSON.stringify(liveJson), pageId);

          // Notify
          if (this.broadcast) {
            this.broadcast(clientId, {
              type: 'sync',
              pageId,
              message: 'Page was updated externally',
            });
          }
        }
      } catch (err) {
        console.warn(`[Watcher] Check failed for page ${pageId}:`, err.message);
      }
    }
  }
}

module.exports = { SiteWatcher };
