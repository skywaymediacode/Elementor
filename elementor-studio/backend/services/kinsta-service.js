const axios = require('axios');

const KINSTA_API = 'https://api.kinsta.com/v2';

function getHeaders() {
  return {
    Authorization: `Bearer ${process.env.KINSTA_API_KEY}`,
    'Content-Type': 'application/json',
  };
}

async function listSites() {
  const response = await axios.get(`${KINSTA_API}/sites`, {
    headers: getHeaders(),
    params: { company: process.env.KINSTA_COMPANY_ID },
  });
  return response.data?.company?.sites || [];
}

async function getSite(siteId) {
  const response = await axios.get(`${KINSTA_API}/sites/${siteId}`, {
    headers: getHeaders(),
  });
  return response.data?.site || null;
}

async function clearCache(siteId) {
  // First get the environment ID
  const envResponse = await axios.get(`${KINSTA_API}/sites/${siteId}/environments`, {
    headers: getHeaders(),
  });

  const envId = envResponse.data?.site?.environments?.[0]?.id;
  if (!envId) throw new Error('No environment found for this site');

  const response = await axios.post(
    `${KINSTA_API}/sites/environments/${envId}/clear-cache`,
    {},
    { headers: getHeaders() }
  );
  return response.data;
}

async function listEnvironments(siteId) {
  const response = await axios.get(`${KINSTA_API}/sites/${siteId}/environments`, {
    headers: getHeaders(),
  });
  return response.data?.site?.environments || [];
}

module.exports = { listSites, getSite, clearCache, listEnvironments };
