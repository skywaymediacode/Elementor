import React, { useState } from 'react';
import { motion } from 'framer-motion';

const settingsSections = [
  { id: 'api', label: 'API Keys', icon: '🔑' },
  { id: 'kinsta', label: 'Kinsta', icon: '☁' },
  { id: 'agency', label: 'Agency', icon: '🏢' },
  { id: 'wordpress', label: 'WordPress', icon: '🌐' },
];

export default function Settings() {
  const [activeSection, setActiveSection] = useState('api');
  const [settings, setSettings] = useState({
    anthropic_key: '',
    kinsta_key: '',
    kinsta_company: '',
    elementor_key: '',
    agency_name: '',
    notification_email: '',
    wp_theme: 'hello-elementor',
  });
  const [testResults, setTestResults] = useState({});
  const [saving, setSaving] = useState(false);

  function updateSetting(key, value) {
    setSettings(prev => ({ ...prev, [key]: value }));
  }

  async function testKinstaConnection() {
    setTestResults(prev => ({ ...prev, kinsta: 'testing' }));
    try {
      const res = await fetch('/api/kinsta/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: settings.kinsta_key,
          companyId: settings.kinsta_company,
        }),
      });
      const data = await res.json();
      setTestResults(prev => ({
        ...prev,
        kinsta: data.success ? `Connected! ${data.siteCount} sites found.` : `Failed: ${data.error}`,
      }));
    } catch (err) {
      setTestResults(prev => ({ ...prev, kinsta: `Error: ${err.message}` }));
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fafbfc' }}>
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '48px 24px' }}>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4, letterSpacing: '-0.02em' }}>
            Settings
          </h1>
          <p style={{ fontSize: 14, color: '#9ca3af', marginBottom: 32 }}>
            Configure your API keys and agency preferences
          </p>
        </motion.div>

        <div style={{ display: 'flex', gap: 24 }}>
          {/* Sidebar */}
          <div style={{ width: 200, flexShrink: 0 }}>
            {settingsSections.map(section => (
              <motion.button
                key={section.id}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveSection(section.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: 'none',
                  background: activeSection === section.id ? '#fff' : 'transparent',
                  boxShadow: activeSection === section.id ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                  fontSize: 13,
                  fontWeight: activeSection === section.id ? 500 : 400,
                  color: activeSection === section.id ? '#111827' : '#6b7280',
                  cursor: 'pointer',
                  marginBottom: 4,
                  textAlign: 'left',
                  transition: 'all 0.2s',
                }}
              >
                <span>{section.icon}</span>
                {section.label}
              </motion.button>
            ))}
          </div>

          {/* Content */}
          <div style={{ flex: 1 }}>
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                background: '#fff',
                borderRadius: 20,
                padding: 32,
                border: '1px solid #e5e7eb',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}
            >
              {activeSection === 'api' && (
                <>
                  <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20 }}>API Keys</h3>
                  <SettingField
                    label="Anthropic API Key"
                    value={settings.anthropic_key}
                    onChange={v => updateSetting('anthropic_key', v)}
                    placeholder="sk-ant-..."
                    type="password"
                    hint="Used for AI-powered conversion and editing"
                  />
                  <SettingField
                    label="Elementor License Key"
                    value={settings.elementor_key}
                    onChange={v => updateSetting('elementor_key', v)}
                    placeholder="Your Elementor Pro license key"
                    type="password"
                  />
                </>
              )}

              {activeSection === 'kinsta' && (
                <>
                  <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20 }}>Kinsta Hosting</h3>
                  <SettingField
                    label="Kinsta API Key"
                    value={settings.kinsta_key}
                    onChange={v => updateSetting('kinsta_key', v)}
                    placeholder="Your Kinsta API key"
                    type="password"
                  />
                  <SettingField
                    label="Company ID"
                    value={settings.kinsta_company}
                    onChange={v => updateSetting('kinsta_company', v)}
                    placeholder="Your Kinsta company ID"
                  />
                  <div style={{ marginTop: 8 }}>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={testKinstaConnection}
                      style={{
                        padding: '8px 18px',
                        borderRadius: 10,
                        border: '1px solid #e5e7eb',
                        background: '#fff',
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: 'pointer',
                      }}
                    >
                      Test Connection
                    </motion.button>
                    {testResults.kinsta && (
                      <span style={{
                        marginLeft: 12,
                        fontSize: 12,
                        color: testResults.kinsta.startsWith('Connected') ? '#10b981' : '#ef4444',
                      }}>
                        {testResults.kinsta}
                      </span>
                    )}
                  </div>
                </>
              )}

              {activeSection === 'agency' && (
                <>
                  <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20 }}>Agency Settings</h3>
                  <SettingField
                    label="Agency Name"
                    value={settings.agency_name}
                    onChange={v => updateSetting('agency_name', v)}
                    placeholder="Your Agency Name"
                    hint="Displayed in the client portal"
                  />
                  <SettingField
                    label="Notification Email"
                    value={settings.notification_email}
                    onChange={v => updateSetting('notification_email', v)}
                    placeholder="team@agency.com"
                    hint="Receive alerts when clients make changes"
                  />
                </>
              )}

              {activeSection === 'wordpress' && (
                <>
                  <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20 }}>WordPress Defaults</h3>
                  <SettingField
                    label="Default Theme"
                    value={settings.wp_theme}
                    onChange={v => updateSetting('wp_theme', v)}
                    placeholder="hello-elementor"
                    hint="The theme to use for new WordPress sites"
                  />
                  <div style={{
                    marginTop: 20,
                    padding: 16,
                    borderRadius: 12,
                    background: '#f0f9ff',
                    border: '1px solid #bfdbfe',
                    fontSize: 13,
                    color: '#1e40af',
                    lineHeight: 1.6,
                  }}>
                    <strong>WordPress Authentication:</strong> This tool uses Application Passwords for WP REST API access.
                    Go to WordPress Admin → Users → Your Profile → Application Passwords to create one.
                    Configure credentials per-client in the client settings.
                  </div>
                </>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingField({ label, value, onChange, placeholder, type = 'text', hint }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{
        display: 'block',
        fontSize: 13,
        fontWeight: 500,
        color: '#374151',
        marginBottom: 6,
      }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          padding: '10px 14px',
          borderRadius: 10,
          border: '1px solid #e5e7eb',
          fontSize: 14,
          outline: 'none',
          transition: 'border-color 0.2s',
        }}
        onFocus={e => e.target.style.borderColor = '#3b82f6'}
        onBlur={e => e.target.style.borderColor = '#e5e7eb'}
      />
      {hint && (
        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{hint}</div>
      )}
    </div>
  );
}
