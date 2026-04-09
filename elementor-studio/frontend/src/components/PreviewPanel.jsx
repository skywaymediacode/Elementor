import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';

const devices = [
  { id: 'desktop', label: 'Desktop', width: '100%', icon: '🖥' },
  { id: 'tablet', label: 'Tablet', width: '768px', icon: '📱' },
  { id: 'mobile', label: 'Mobile', width: '375px', icon: '📲' },
];

export default function PreviewPanel({ siteUrl, wpPageId, wpUrl, onPublish, refreshKey }) {
  const [device, setDevice] = useState('desktop');
  const iframeRef = useRef(null);

  const currentDevice = devices.find(d => d.id === device);
  const previewUrl = siteUrl || (wpUrl && wpPageId ? `${wpUrl}/?p=${wpPageId}` : null);

  function refreshPreview() {
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
    }
  }

  function openInElementor() {
    if (wpUrl && wpPageId) {
      window.open(`${wpUrl}/wp-admin/post.php?post=${wpPageId}&action=elementor`, '_blank');
    }
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: '#f9fafb',
    }}>
      {/* Browser chrome */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 20px',
        background: '#fff',
        borderBottom: '1px solid #e5e7eb',
      }}>
        {/* URL bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flex: 1,
          maxWidth: 480,
        }}>
          <div style={{
            display: 'flex',
            gap: 5,
          }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }} />
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b' }} />
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981' }} />
          </div>
          <div style={{
            flex: 1,
            background: '#f3f4f6',
            borderRadius: 8,
            padding: '6px 12px',
            fontSize: 12,
            color: '#6b7280',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {previewUrl || 'No preview available'}
          </div>
          <motion.button
            whileHover={{ scale: 1.1, rotate: 180 }}
            whileTap={{ scale: 0.9 }}
            onClick={refreshPreview}
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#6b7280',
            }}
          >
            ↻
          </motion.button>
        </div>

        {/* Device toggles */}
        <div style={{
          display: 'flex',
          gap: 2,
          background: '#f3f4f6',
          borderRadius: 10,
          padding: 3,
        }}>
          {devices.map(d => (
            <motion.button
              key={d.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => setDevice(d.id)}
              style={{
                padding: '4px 10px',
                borderRadius: 8,
                border: 'none',
                background: device === d.id ? '#fff' : 'transparent',
                boxShadow: device === d.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                fontSize: 13,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {d.icon}
            </motion.button>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          {wpUrl && wpPageId && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={openInElementor}
              style={{
                padding: '7px 14px',
                borderRadius: 10,
                border: '1px solid #e5e7eb',
                background: '#fff',
                fontSize: 12,
                fontWeight: 500,
                color: '#374151',
                cursor: 'pointer',
              }}
            >
              Open in Elementor
            </motion.button>
          )}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onPublish}
            style={{
              padding: '7px 18px',
              borderRadius: 10,
              border: 'none',
              background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
              fontSize: 12,
              fontWeight: 600,
              color: '#fff',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(59,130,246,0.3)',
            }}
          >
            Publish
          </motion.button>
        </div>
      </div>

      {/* Preview area */}
      <div style={{
        flex: 1,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        padding: device !== 'desktop' ? 24 : 0,
        overflow: 'auto',
      }}>
        <motion.div
          layout
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          style={{
            width: currentDevice.width,
            height: '100%',
            maxWidth: '100%',
            background: '#fff',
            borderRadius: device !== 'desktop' ? 16 : 0,
            overflow: 'hidden',
            boxShadow: device !== 'desktop'
              ? '0 20px 60px rgba(0,0,0,0.15)'
              : 'none',
          }}
        >
          {previewUrl ? (
            <iframe
              ref={iframeRef}
              key={refreshKey}
              src={previewUrl}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
              }}
              title="Site Preview"
            />
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: '#9ca3af',
              gap: 12,
            }}>
              <div style={{ fontSize: 48, opacity: 0.5 }}>🌐</div>
              <div style={{ fontSize: 15, fontWeight: 500, color: '#6b7280' }}>
                No preview available
              </div>
              <div style={{ fontSize: 13 }}>
                Deploy to WordPress to see a live preview
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
