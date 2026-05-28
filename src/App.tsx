import React, { useState, useEffect } from 'react';
import { AdminLogin } from './components/AdminLogin';
import { AdminDashboard } from './components/AdminDashboard';
import { VoterApp } from './components/VoterApp';

export default function App() {
  const [adminHash, setAdminHash] = useState<string | null>(null);
  const [voterCode, setVoterCode] = useState<string | null>(null);

  useEffect(() => {
    // Check for voter code in URL query params
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      setVoterCode(code);
    }
  }, []);

  // If a voter code is present, ONLY show the VoterApp
  if (voterCode) {
    return <VoterApp code={voterCode} />;
  }

  // Otherwise, fallback to Admin mode
  if (adminHash) {
    return (
      <div className="min-h-screen bg-slate-50 p-4">
        <AdminDashboard adminHash={adminHash} onLogout={() => setAdminHash(null)} />
      </div>
    );
  }

  return <AdminLogin onLogin={(hash: string) => setAdminHash(hash)} />;
}
