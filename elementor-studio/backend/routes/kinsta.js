const express = require('express');
const router = express.Router();
const axios = require('axios');

const KINSTA_API = 'https://api.kinsta.com/v2';

function getHeaders() {
  return {
    Authorization: `Bearer ${process.env.KINSTA_API_KEY}`,
    'Content-Type': 'application/json',
  };
}

// List all sites
router.get('/sites', async (req, res) => {
  try {
    const response = await axios.get(`${KINSTA_API}/sites`, {
      headers: getHeaders(),
      params: { company: process.env.KINSTA_COMPANY_ID },
    });
    res.json(response.data);
  } catch (err) {
    res.status(err.response?.status || 500).json({
      error: err.response?.data?.message || err.message,
    });
  }
});

// Get site details
router.get('/sites/:siteId', async (req, res) => {
  try {
    const response = await axios.get(`${KINSTA_API}/sites/${req.params.siteId}`, {
      headers: getHeaders(),
    });
    res.json(response.data);
  } catch (err) {
    res.status(err.response?.status || 500).json({
      error: err.response?.data?.message || err.message,
    });
  }
});

// Create a new site
router.post('/sites', async (req, res) => {
  try {
    const { name, display_name, region } = req.body;
    const response = await axios.post(`${KINSTA_API}/sites`, {
      company: process.env.KINSTA_COMPANY_ID,
      display_name: display_name || name,
      region: region || 'us-central1',
      install_mode: 'new',
      is_subdomain_multisite: false,
      admin_email: process.env.NOTIFICATION_EMAIL || 'admin@agency.com',
      admin_password: require('crypto').randomBytes(16).toString('hex'),
      admin_user: 'admin',
      is_multisite: false,
      site_name: name,
      woo_install: false,
      wp_language: 'en_US',
    }, { headers: getHeaders() });
    res.json(response.data);
  } catch (err) {
    res.status(err.response?.status || 500).json({
      error: err.response?.data?.message || err.message,
    });
  }
});

// Get site environments
router.get('/sites/:siteId/environments', async (req, res) => {
  try {
    const response = await axios.get(`${KINSTA_API}/sites/${req.params.siteId}/environments`, {
      headers: getHeaders(),
    });
    res.json(response.data);
  } catch (err) {
    res.status(err.response?.status || 500).json({
      error: err.response?.data?.message || err.message,
    });
  }
});

// Clear cache
router.post('/sites/:siteId/cache/purge', async (req, res) => {
  try {
    // First get the environment ID
    const envResponse = await axios.get(`${KINSTA_API}/sites/${req.params.siteId}/environments`, {
      headers: getHeaders(),
    });

    const envId = envResponse.data?.site?.environments?.[0]?.id;
    if (!envId) return res.status(404).json({ error: 'No environment found' });

    const response = await axios.post(
      `${KINSTA_API}/sites/environments/${envId}/clear-cache`,
      {},
      { headers: getHeaders() }
    );
    res.json(response.data);
  } catch (err) {
    res.status(err.response?.status || 500).json({
      error: err.response?.data?.message || err.message,
    });
  }
});

// Test connection
router.post('/test', async (req, res) => {
  try {
    const { apiKey, companyId } = req.body;
    const response = await axios.get(`${KINSTA_API}/sites`, {
      headers: {
        Authorization: `Bearer ${apiKey || process.env.KINSTA_API_KEY}`,
        'Content-Type': 'application/json',
      },
      params: { company: companyId || process.env.KINSTA_COMPANY_ID },
    });
    res.json({ success: true, siteCount: response.data?.company?.sites?.length || 0 });
  } catch (err) {
    res.status(400).json({ success: false, error: err.response?.data?.message || err.message });
  }
});

module.exports = router;
