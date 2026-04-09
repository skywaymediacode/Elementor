const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

/**
 * Deploy Elementor page to WordPress via REST API
 */
async function deployToWordPress({ wpUrl, wpUser, wpAppPassword, title, elementorJson, images, clientSlug }) {
  const api = createWpApi(wpUrl, wpUser, wpAppPassword);

  // Step 1: Upload images to media library and replace URLs
  const imageMap = {};
  if (images && images.length > 0) {
    for (const img of images) {
      try {
        if (img.localPath && fs.existsSync(img.localPath)) {
          const mediaUrl = await uploadMedia(api, img.localPath, img.alt);
          if (mediaUrl) {
            imageMap[img.originalUrl] = mediaUrl;
            imageMap[img.localPath] = mediaUrl;
          }
        }
      } catch (err) {
        console.warn(`Failed to upload image ${img.filename}:`, err.message);
      }
    }
  }

  // Replace image URLs in JSON
  let jsonString = JSON.stringify(elementorJson);
  for (const [oldUrl, newUrl] of Object.entries(imageMap)) {
    jsonString = jsonString.split(oldUrl).join(newUrl);
  }
  const updatedJson = JSON.parse(jsonString);

  // Step 2: Create WordPress page
  const pageResponse = await api.post('/wp-json/wp/v2/pages', {
    title,
    status: 'publish',
    template: 'elementor_canvas',
    meta: {
      _elementor_edit_mode: 'builder',
      _elementor_template_type: 'wp-page',
      _elementor_version: '3.18.0',
      _elementor_data: JSON.stringify(updatedJson),
    },
  });

  const pageId = pageResponse.data.id;
  const pageUrl = pageResponse.data.link;

  // Step 3: Try to set Elementor data via post meta (some WP setups need this)
  try {
    await api.post(`/wp-json/wp/v2/pages/${pageId}`, {
      meta: {
        _elementor_data: JSON.stringify(updatedJson),
        _elementor_edit_mode: 'builder',
      },
    });
  } catch { /* meta might already be set */ }

  return { pageId, pageUrl, imageMap };
}

/**
 * Update an existing WordPress page's Elementor data
 */
async function updatePage({ wpUrl, wpUser, wpAppPassword, pageId, elementorJson }) {
  const api = createWpApi(wpUrl, wpUser, wpAppPassword);

  await api.post(`/wp-json/wp/v2/pages/${pageId}`, {
    meta: {
      _elementor_data: JSON.stringify(elementorJson),
      _elementor_edit_mode: 'builder',
    },
  });

  return { success: true, pageId };
}

/**
 * Fetch current Elementor JSON from a WordPress page
 */
async function getPageJSON({ wpUrl, wpUser, wpAppPassword, pageId }) {
  const api = createWpApi(wpUrl, wpUser, wpAppPassword);

  const response = await api.get(`/wp-json/wp/v2/pages/${pageId}`, {
    params: { context: 'edit' },
  });

  const meta = response.data.meta;
  if (meta?._elementor_data) {
    try {
      return JSON.parse(meta._elementor_data);
    } catch {
      return meta._elementor_data;
    }
  }

  return [];
}

/**
 * List all pages on a WordPress site
 */
async function listPages({ wpUrl, wpUser, wpAppPassword }) {
  const api = createWpApi(wpUrl, wpUser, wpAppPassword);

  const response = await api.get('/wp-json/wp/v2/pages', {
    params: { per_page: 100, context: 'edit' },
  });

  return response.data.map(page => ({
    id: page.id,
    title: page.title.rendered,
    slug: page.slug,
    status: page.status,
    link: page.link,
    template: page.template,
    hasElementor: !!page.meta?._elementor_edit_mode,
    modified: page.modified,
  }));
}

/**
 * Upload a file to WordPress Media Library
 */
async function uploadMedia(api, filePath, altText) {
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath), {
    filename: path.basename(filePath),
  });

  if (altText) {
    form.append('alt_text', altText);
  }

  const response = await api.post('/wp-json/wp/v2/media', form, {
    headers: {
      ...form.getHeaders(),
    },
    maxContentLength: 50 * 1024 * 1024,
  });

  return response.data.source_url;
}

/**
 * Create an authenticated WordPress API client
 */
function createWpApi(wpUrl, wpUser, wpAppPassword) {
  const baseURL = wpUrl.replace(/\/+$/, '');
  const auth = Buffer.from(`${wpUser}:${wpAppPassword}`).toString('base64');

  return axios.create({
    baseURL,
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    timeout: 30000,
  });
}

module.exports = { deployToWordPress, updatePage, getPageJSON, listPages, uploadMedia };
