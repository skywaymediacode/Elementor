import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import ChatPanel from '../components/ChatPanel';
import PreviewPanel from '../components/PreviewPanel';

export default function Editor() {
  const { clientId, pageId: urlPageId } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [selectedPage, setSelectedPage] = useState(urlPageId || null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showPageList, setShowPageList] = useState(false);

  useEffect(() => {
    fetchClient();
  }, [clientId]);

  async function fetchClient() {
    try {
      const res = await fetch(`/api/clients/${clientId}`);
      const data = await res.json();
      setClient(data);

      // Auto-select first page if none selected
      if (!urlPageId && data.projects?.[0]?.pages?.[0]) {
        setSelectedPage(data.projects[0].pages[0].id);
      }
    } catch { /* empty */ }
    setLoading(false);
  }

  function handleUpdate() {
    setRefreshKey(k => k + 1);
  }

  async function handlePublish() {
    if (!selectedPage) return;
    try {
      const res = await fetch(`/api/elementor/page/${selectedPage}/deploy`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        setRefreshKey(k => k + 1);
        fetchClient();
      }
    } catch { /* empty */ }
  }

  const allPages = client?.projects?.flatMap(p => p.pages.map(pg => ({ ...pg, projectName: p.name }))) || [];
  const currentPage = allPages.find(p => p.id === selectedPage);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        color: '#9ca3af',
      }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          style={{ fontSize: 24 }}
        >
          ⟳
        </motion.div>
      </div>
    );
  }

  if (!client) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        gap: 16,
      }}>
        <div style={{ fontSize: 48, opacity: 0.3 }}>✕</div>
        <div style={{ fontSize: 16, fontWeight: 500, color: '#6b7280' }}>Client not found</div>
        <motion.button
          whileHover={{ scale: 1.03 }}
          onClick={() => navigate('/')}
          style={{
            padding: '8px 20px',
            borderRadius: 10,
            border: 'none',
            background: '#111827',
            color: '#fff',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Back to Dashboard
        </motion.button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Top bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 24px',
        borderBottom: '1px solid #f3f4f6',
        background: '#fff',
        zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate('/')}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: '1px solid #e5e7eb',
              background: '#fff',
              cursor: 'pointer',
              fontSize: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ←
          </motion.button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 14,
              fontWeight: 700,
            }}>
              {client.name?.charAt(0)?.toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{client.name}</div>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>
                {allPages.length} page{allPages.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        </div>

        {/* Page selector */}
        {allPages.length > 0 && (
          <div style={{ position: 'relative' }}>
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowPageList(!showPageList)}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                border: '1px solid #e5e7eb',
                background: '#fff',
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {currentPage?.title || 'Select page'}
              <span style={{ fontSize: 10, color: '#9ca3af' }}>▼</span>
            </motion.button>

            <AnimatePresence>
              {showPageList && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.98 }}
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: 6,
                    background: '#fff',
                    borderRadius: 12,
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
                    minWidth: 200,
                    overflow: 'hidden',
                    zIndex: 20,
                  }}
                >
                  {allPages.map(page => (
                    <button
                      key={page.id}
                      onClick={() => {
                        setSelectedPage(page.id);
                        setShowPageList(false);
                      }}
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: '10px 16px',
                        border: 'none',
                        background: page.id === selectedPage ? '#f3f4f6' : '#fff',
                        textAlign: 'left',
                        fontSize: 13,
                        cursor: 'pointer',
                        borderBottom: '1px solid #f9fafb',
                      }}
                    >
                      <div style={{ fontWeight: 500 }}>{page.title}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                        {page.status} · {page.projectName}
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Main content: Chat + Preview */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Chat panel */}
        <div style={{
          width: 380,
          borderRight: '1px solid #f3f4f6',
          flexShrink: 0,
        }}>
          <ChatPanel
            clientId={clientId}
            pageId={selectedPage}
            clientName={client.name}
            siteUrl={client.website_url}
            onUpdate={handleUpdate}
          />
        </div>

        {/* Preview panel */}
        <div style={{ flex: 1 }}>
          <PreviewPanel
            siteUrl={client.projects?.[0]?.wp_url}
            wpPageId={currentPage?.wp_page_id}
            wpUrl={client.wp_url}
            onPublish={handlePublish}
            refreshKey={refreshKey}
          />
        </div>
      </div>
    </div>
  );
}
