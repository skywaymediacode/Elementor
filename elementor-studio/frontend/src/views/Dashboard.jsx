import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import ClientFolder from '../components/ClientFolder';

export default function Dashboard() {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importUrl, setImportUrl] = useState('');
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchClients();
  }, []);

  async function fetchClients() {
    try {
      const res = await fetch('/api/clients');
      const data = await res.json();
      setClients(data);
    } catch { /* empty */ }
    setLoading(false);
  }

  async function createClient() {
    if (!newClientName.trim()) return;
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newClientName }),
      });
      if (res.ok) {
        setNewClientName('');
        setShowNewClient(false);
        fetchClients();
      }
    } catch { /* empty */ }
  }

  function handleImport() {
    if (importUrl.trim()) {
      navigate(`/import?url=${encodeURIComponent(importUrl)}`);
    } else {
      navigate('/import');
    }
  }

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ minHeight: '100vh', background: '#fafbfc' }}>
      {/* Hero section */}
      <div style={{
        background: 'linear-gradient(135deg, #000 0%, #111827 50%, #1e3a5f 100%)',
        padding: '48px 40px 56px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Floating orbs */}
        <div className="animate-float-slow" style={{
          position: 'absolute',
          top: -40,
          right: 120,
          width: 200,
          height: 200,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(59,130,246,0.15), transparent 70%)',
        }} />
        <div className="animate-float" style={{
          position: 'absolute',
          bottom: -60,
          left: 200,
          width: 160,
          height: 160,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(59,130,246,0.1), transparent 70%)',
        }} />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 style={{
            fontSize: 32,
            fontWeight: 700,
            color: '#fff',
            marginBottom: 6,
            letterSpacing: '-0.02em',
          }}>
            Elementor Studio
          </h1>
          <p style={{
            fontSize: 15,
            color: 'rgba(255,255,255,0.5)',
            marginBottom: 28,
          }}>
            Convert any website to Elementor. Edit with AI chat.
          </p>

          {/* Import bar */}
          <div style={{
            display: 'flex',
            gap: 10,
            maxWidth: 640,
          }}>
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              background: 'rgba(255,255,255,0.08)',
              borderRadius: 14,
              border: '1px solid rgba(255,255,255,0.1)',
              padding: '0 16px',
              backdropFilter: 'blur(10px)',
            }}>
              <span style={{ color: 'rgba(255,255,255,0.3)', marginRight: 10, fontSize: 14 }}>🔗</span>
              <input
                value={importUrl}
                onChange={e => setImportUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleImport()}
                placeholder="Paste any website URL to convert..."
                style={{
                  flex: 1,
                  padding: '14px 0',
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  fontSize: 14,
                  color: '#fff',
                }}
              />
            </div>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleImport}
              style={{
                padding: '0 28px',
                borderRadius: 14,
                border: 'none',
                background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                color: '#fff',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(59,130,246,0.4)',
                whiteSpace: 'nowrap',
              }}
            >
              Convert to Elementor
            </motion.button>
          </div>

          {/* Source type chips */}
          <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            {['Divi', 'Webflow', 'Squarespace', 'Wix', 'HTML/CSS', 'WordPress'].map(type => (
              <motion.span
                key={type}
                whileHover={{ scale: 1.05, background: 'rgba(255,255,255,0.12)' }}
                style={{
                  padding: '5px 12px',
                  borderRadius: 20,
                  border: '1px solid rgba(255,255,255,0.1)',
                  fontSize: 12,
                  color: 'rgba(255,255,255,0.5)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {type}
              </motion.span>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Client grid */}
      <div style={{ padding: '32px 40px' }}>
        {/* Toolbar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: '#111827' }}>Clients</h2>
            <span style={{
              background: '#f3f4f6',
              color: '#6b7280',
              fontSize: 12,
              fontWeight: 500,
              padding: '2px 10px',
              borderRadius: 12,
            }}>
              {clients.length}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              background: '#fff',
              borderRadius: 10,
              border: '1px solid #e5e7eb',
              padding: '0 12px',
            }}>
              <span style={{ color: '#9ca3af', fontSize: 14, marginRight: 8 }}>⌕</span>
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search clients..."
                style={{
                  border: 'none',
                  outline: 'none',
                  padding: '8px 0',
                  fontSize: 13,
                  background: 'transparent',
                  width: 180,
                }}
              />
            </div>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setShowNewClient(true)}
              style={{
                padding: '8px 18px',
                borderRadius: 10,
                border: 'none',
                background: '#111827',
                color: '#fff',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              + New Client
            </motion.button>
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              style={{ fontSize: 24, display: 'inline-block' }}
            >
              ⟳
            </motion.div>
          </div>
        ) : filtered.length > 0 ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 20,
          }}>
            {filtered.map((client, i) => (
              <ClientFolder key={client.id} client={client} index={i} />
            ))}
          </div>
        ) : clients.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              textAlign: 'center',
              padding: '80px 40px',
              background: '#fff',
              borderRadius: 20,
              border: '1px dashed #e5e7eb',
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.4 }}>✦</div>
            <h3 style={{ fontSize: 18, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
              No clients yet
            </h3>
            <p style={{ fontSize: 14, color: '#9ca3af', marginBottom: 24, maxWidth: 400, margin: '0 auto 24px' }}>
              Create your first client or import a website to get started.
            </p>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setShowNewClient(true)}
              style={{
                padding: '10px 24px',
                borderRadius: 12,
                border: 'none',
                background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                color: '#fff',
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(59,130,246,0.3)',
              }}
            >
              + Create Client
            </motion.button>
          </motion.div>
        ) : (
          <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af', fontSize: 14 }}>
            No clients matching "{searchQuery}"
          </div>
        )}
      </div>

      {/* New client modal */}
      <AnimatePresence>
        {showNewClient && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowNewClient(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.4)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              style={{
                background: '#fff',
                borderRadius: 24,
                padding: 32,
                width: 420,
                boxShadow: '0 24px 80px rgba(0,0,0,0.2)',
              }}
            >
              <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 20 }}>New Client</h3>
              <input
                autoFocus
                value={newClientName}
                onChange={e => setNewClientName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createClient()}
                placeholder="Client name"
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
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowNewClient(false)}
                  style={{
                    padding: '10px 20px',
                    borderRadius: 10,
                    border: '1px solid #e5e7eb',
                    background: '#fff',
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={createClient}
                  style={{
                    padding: '10px 24px',
                    borderRadius: 10,
                    border: 'none',
                    background: '#111827',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Create
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
