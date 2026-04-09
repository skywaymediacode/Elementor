import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './views/Dashboard';
import Editor from './views/Editor';
import Import from './views/Import';
import Settings from './views/Settings';
import Sidebar from './components/Sidebar';

export default function App() {
  return (
    <BrowserRouter>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar />
        <main style={{ flex: 1, marginLeft: 72 }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/editor/:clientId" element={<Editor />} />
            <Route path="/editor/:clientId/:pageId" element={<Editor />} />
            <Route path="/import" element={<Import />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
