import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';

const sourceTypes = [
  { id: 'divi', label: 'Divi', color: '#7c3aed' },
  { id: 'webflow', label: 'Webflow', color: '#4353ff' },
  { id: 'squarespace', label: 'Squarespace', color: '#000' },
  { id: 'wix', label: 'Wix', color: '#0c6efc' },
  { id: 'html', label: 'HTML/CSS', color: '#e34c26' },
  { id: 'wordpress', label: 'WordPress', color: '#21759b' },
];

const progressSteps = [
  { key: 'scraping', label: 'Analyzing layout...', icon: '🔍' },
  { key: 'analyzing', label: 'Extracting styles...', icon: '🎨' },
  { key: 'converting', label: 'Converting to Elementor...', icon: '⚡' },
  { key: 'deploying', label: 'Deploying to WordPress...', icon: '🚀' },
];

export default function Import() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(1);
  const [url, setUrl] = useState(searchParams.get('url') || '');
  const [sourceType, setSourceType] = useState('html');
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState('');
  const [newClientName, setNewClientName] = useState('');
  const [pageName, setPageName] = useState('');
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [projectId, setProjectId] = useState(null);
  const [kinstaSites, setKinstaSites] = useState([]);
  const [selectedKinsta, setSelectedKinsta] = useState('');

  useEffect(() => {
    fetchClients();
    fetchKinstaSites();
  }, []);

  async function fetchClients() {
    try {
      const res = await fetch('/api/clients');
      setClients(await res.json());
    } catch { /* empty */ }
  }

  async function fetchKinstaSites() {
    try {
      const res = await fetch('/api/kinsta/sites');
      const data = await res.json();
      setKinstaSites(data?.company?.sites || []);
    } catch { /* no kinsta */ }
  }

  async function startConversion() {
    setError(null);

    // Create client if new
    let clientId = selectedClient;
    if (!clientId && newClientName) {
      try {
        const res = await fetch('/api/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newClientName }),
        });
        const data = await res.json();
        clientId = data.id;
      } catch (err) {
        setError('Failed to create client');
        return;
      }
    }

    if (!clientId) {
      setError('Please select or create a client');
      return;
    }

    setStep(2);
    setStatus('scraping');

    try {
      const res = await fetch('/api/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          clientId,
          sourceType,
          kinstaSiteId: selectedKinsta || null,
          pageName: pageName || null,
        }),
      });

      const data = await res.json();
      setProjectId(data.projectId);

      // Poll for status
      pollStatus(data.projectId, clientId);
    } catch (err) {
      setError(err.message);
      setStatus('error');
    }
  }

  async function pollStatus(projId, clientId) {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/convert/${projId}/status`);
        const data = await res.json();
        setStatus(data.status);

        if (['deployed', 'ready', 'error'].includes(data.status)) {
          clearInterval(interval);
          if (data.status !== 'error') {
            setTimeout(() => {
              setStep(3);
            }, 1500);
          }
        }
      } catch { /* retry */ }
    }, 2000);
  }

  const currentProgressIdx = progressSteps.findIndex(s => s.key === status);

  return (
    <div style={{ minHeight: '100vh', background: '#fafbfc' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px' }}>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4, letterSpacing: '-0.02em' }}>
            Import Website
          </h1>
          <p style={{ fontSize: 14, color: '#9ca3af', marginBottom: 40 }}>
            Convert any website to Elementor with pixel-perfect accuracy
          </p>

          {/* Step indicators */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 40 }}>
            {[1, 2, 3].map(s => (
              <div key={s} style={{
                flex: 1,
                height: 3,
                borderRadius: 2,
                background: s <= step
                  ? 'linear-gradient(90deg, #3b82f6, #2563eb)'
                  : '#e5e7eb',
                transition: 'all 0.5s',
              }} />
            ))}
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {/* STEP 1: Configuration */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              {/* URL input */}
              <div style={{
                background: '#fff',
                borderRadius: 20,
                padding: 28,
                marginBottom: 20,
                border: '1px solid #e5e7eb',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 8 }}>
                  Website URL
                </label>
                <input
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  placeholder="https://example.com"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: 12,
                    border: '1px solid #e5e7eb',
                    fontSize: 14,
                    outline: 'none',
                    marginBottom: 16,
                  }}
                />

                <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 8 }}>
                  Source Type
                </label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {sourceTypes.map(st => (
                    <motion.button
                      key={st.id}
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => setSourceType(st.id)}
                      style={{
                        padding: '8px 18px',
                        borderRadius: 12,
                        border: sourceType === st.id ? `2px solid ${st.color}` : '1px solid #e5e7eb',
                        background: sourceType === st.id ? `${st.color}10` : '#fff',
                        fontSize: 13,
                        fontWeight: 500,
                        color: sourceType === st.id ? st.color : '#6b7280',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      {st.label}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Page name */}
              <div style={{
                background: '#fff',
                borderRadius: 20,
                padding: 28,
                marginBottom: 20,
                border: '1px solid #e5e7eb',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 8 }}>
                  Page Name (optional)
                </label>
                <input
                  value={pageName}
                  onChange={e => setPageName(e.target.value)}
                  placeholder="Home Page"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: 12,
                    border: '1px solid #e5e7eb',
                    fontSize: 14,
                    outline: 'none',
                  }}
                />
              </div>

              {/* Client selection */}
              <div style={{
                background: '#fff',
                borderRadius: 20,
                padding: 28,
                marginBottom: 20,
                border: '1px solid #e5e7eb',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 8 }}>
                  Assign to Client
                </label>
                {clients.length > 0 && (
                  <select
                    value={selectedClient}
                    onChange={e => setSelectedClient(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: 12,
                      border: '1px solid #e5e7eb',
                      fontSize: 14,
                      outline: 'none',
                      marginBottom: 12,
                      background: '#fff',
                    }}
                  >
                    <option value="">Select existing client...</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                )}

                {!selectedClient && (
                  <>
                    <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>
                      {clients.length > 0 ? 'Or create a new one:' : 'Create a client:'}
                    </div>
                    <input
                      value={newClientName}
                      onChange={e => setNewClientName(e.target.value)}
                      placeholder="New client name"
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        borderRadius: 12,
                        border: '1px solid #e5e7eb',
                        fontSize: 14,
                        outline: 'none',
                      }}
                    />
                  </>
                )}
              </div>

              {/* Kinsta site selection */}
              {kinstaSites.length > 0 && (
                <div style={{
                  background: '#fff',
                  borderRadius: 20,
                  padding: 28,
                  marginBottom: 20,
                  border: '1px solid #e5e7eb',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}>
                  <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 8 }}>
                    Deploy to Kinsta Site
                  </label>
                  <select
                    value={selectedKinsta}
                    onChange={e => setSelectedKinsta(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: 12,
                      border: '1px solid #e5e7eb',
                      fontSize: 14,
                      outline: 'none',
                      background: '#fff',
                    }}
                  >
                    <option value="">Select Kinsta site (optional)...</option>
                    {kinstaSites.map(s => (
                      <option key={s.id} value={s.id}>{s.display_name || s.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {error && (
                <div style={{
                  padding: '12px 16px',
                  borderRadius: 12,
                  background: '#fef2f2',
                  color: '#dc2626',
                  fontSize: 13,
                  marginBottom: 20,
                }}>
                  {error}
                </div>
              )}

              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={startConversion}
                disabled={!url.trim()}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: 14,
                  border: 'none',
                  background: url.trim()
                    ? 'linear-gradient(135deg, #3b82f6, #1d4ed8)'
                    : '#e5e7eb',
                  color: url.trim() ? '#fff' : '#9ca3af',
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: url.trim() ? 'pointer' : 'default',
                  boxShadow: url.trim() ? '0 4px 16px rgba(59,130,246,0.3)' : 'none',
                }}
              >
                Start Conversion
              </motion.button>
            </motion.div>
          )}

          {/* STEP 2: Progress */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              style={{
                background: '#fff',
                borderRadius: 24,
                padding: 48,
                border: '1px solid #e5e7eb',
                textAlign: 'center',
              }}
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                style={{ fontSize: 48, marginBottom: 24, display: 'inline-block' }}
              >
                ⟳
              </motion.div>

              <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 32 }}>
                Converting your website...
              </h2>

              <div style={{ maxWidth: 400, margin: '0 auto' }}>
                {progressSteps.map((ps, i) => {
                  const isActive = ps.key === status;
                  const isDone = i < currentProgressIdx;

                  return (
                    <motion.div
                      key={ps.key}
                      initial={{ opacity: 0.4 }}
                      animate={{ opacity: isActive || isDone ? 1 : 0.4 }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 14,
                        padding: '14px 0',
                        borderBottom: i < progressSteps.length - 1 ? '1px solid #f3f4f6' : 'none',
                      }}
                    >
                      <div style={{
                        width: 32,
                        height: 32,
                        borderRadius: 10,
                        background: isDone ? '#10b981' : isActive ? '#3b82f6' : '#f3f4f6',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 14,
                        color: isDone || isActive ? '#fff' : '#9ca3af',
                        transition: 'all 0.3s',
                      }}>
                        {isDone ? '✓' : ps.icon}
                      </div>
                      <span style={{
                        fontSize: 14,
                        fontWeight: isActive ? 500 : 400,
                        color: isActive ? '#111827' : isDone ? '#10b981' : '#9ca3af',
                      }}>
                        {ps.label}
                      </span>
                      {isActive && (
                        <motion.div
                          animate={{ opacity: [0.3, 1, 0.3] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                          style={{
                            marginLeft: 'auto',
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: '#3b82f6',
                          }}
                        />
                      )}
                    </motion.div>
                  );
                })}
              </div>

              {status === 'error' && (
                <div style={{ marginTop: 24, color: '#dc2626', fontSize: 14 }}>
                  Conversion failed. Please try again.
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    onClick={() => setStep(1)}
                    style={{
                      display: 'block',
                      margin: '12px auto 0',
                      padding: '8px 20px',
                      borderRadius: 10,
                      border: '1px solid #e5e7eb',
                      background: '#fff',
                      cursor: 'pointer',
                      fontSize: 13,
                    }}
                  >
                    Try Again
                  </motion.button>
                </div>
              )}
            </motion.div>
          )}

          {/* STEP 3: Complete */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{
                background: '#fff',
                borderRadius: 24,
                padding: 48,
                border: '1px solid #e5e7eb',
                textAlign: 'center',
              }}
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 32,
                  color: '#fff',
                  margin: '0 auto 24px',
                  boxShadow: '0 8px 24px rgba(16,185,129,0.3)',
                }}
              >
                ✓
              </motion.div>

              <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>
                Conversion Complete!
              </h2>
              <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 32 }}>
                Your website has been converted to Elementor format
              </p>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => navigate('/')}
                  style={{
                    padding: '12px 28px',
                    borderRadius: 12,
                    border: '1px solid #e5e7eb',
                    background: '#fff',
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Dashboard
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    const clientId = selectedClient || clients[clients.length - 1]?.id;
                    if (clientId) navigate(`/editor/${clientId}`);
                  }}
                  style={{
                    padding: '12px 28px',
                    borderRadius: 12,
                    border: 'none',
                    background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                    color: '#fff',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 4px 16px rgba(59,130,246,0.3)',
                  }}
                >
                  Open Editor
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
