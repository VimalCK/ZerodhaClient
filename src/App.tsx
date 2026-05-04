import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import './App.css';
import type { AppState, PortfolioHolding, DetailEntry, Credentials } from './types';

const API_BASE = 'https://api.kite.trade';

function HoldingsPage() {
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [holdings, setHoldings] = useState<PortfolioHolding[]>([]);
  const [selectedHolding, setSelectedHolding] = useState<PortfolioHolding | null>(null);
  const [quoteDetails, setQuoteDetails] = useState<DetailEntry[]>([]);
  const [statusMessage, setStatusMessage] = useState('Click Holdings to load');
  const [isLoading, setIsLoading] = useState(false);
  const [isChartVisible, setIsChartVisible] = useState(false);
  const [sessionSummary, setSessionSummary] = useState('Not logged in');
  const navigate = useNavigate();

  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('credentials');
    if (saved) {
      const creds = JSON.parse(saved);
      setCredentials(creds);
      setApiKey(creds.apiKey || '');
      setApiSecret(creds.apiSecret || '');
      if (creds.accessToken) {
        setSessionSummary(creds.userName ? `${creds.userName} (${creds.userId})` : 'Signed in');
        setStatusMessage('Session restored.');
      }
    }

    const redirectToken = localStorage.getItem('redirect_token');
    if (redirectToken) {
      setStatusMessage('Completing login...');
      localStorage.removeItem('redirect_token');
      completeLogin(redirectToken);
    }
  }, []);

  const completeLogin = async (reqToken: string) => {
    if (!apiKey || !apiSecret || !reqToken) return;

    const checksum = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(apiKey + reqToken + apiSecret))
      .then(buffer => Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join(''));

    try {
      const response = await fetch(`${API_BASE}/session/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `api_key=${apiKey}&request_token=${reqToken}&secret=${apiSecret}&checksum=${checksum}`,
      });

      const data = await response.json();
      if (data.status === 'success') {
        const newCreds: Credentials = { apiKey, apiSecret, accessToken: data.data.access_token, userId: data.data.user_id, userName: data.data.user_name };
        localStorage.setItem('credentials', JSON.stringify(newCreds));
        setCredentials(newCreds);
        setSessionSummary(data.data.user_id);
        setStatusMessage('Login successful!');
      }
    } catch (e) {
      setStatusMessage('Login failed');
    }
  };

  const loadHoldings = async () => {
    if (!credentials?.accessToken) return;
    setIsLoading(true);
    setStatusMessage('Loading...');

    try {
      const response = await fetch(`${API_BASE}/portfolio/holdings`, {
        headers: { 'Authorization': `token ${credentials.apiKey}:${credentials.accessToken}` },
      });
      const data = await response.json();

      if (data.status === 'success') {
        const h: PortfolioHolding[] = data.data.map((item: any) => ({
          instrumentKey: `${item.exchange}:${item.trading_symbol}`,
          listTitle: item.trading_symbol,
          listSubtitle: `${item.exchange} · Qty ${item.quantity} · PnL ${item.pnl}`,
          holdingDetails: [
            { label: 'Product', value: item.product },
            { label: 'Quantity', value: String(item.quantity) },
            { label: 'Avg Price', value: String(item.average_price) },
            { label: 'Last Price', value: String(item.last_price) },
            { label: 'PnL', value: String(item.pnl) },
          ],
        }));
        setHoldings(h);
        setSelectedHolding(h[0] || null);
        setStatusMessage(`Loaded ${h.length} holdings`);
      }
    } catch (e: any) {
      setStatusMessage(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('credentials');
    setCredentials(null);
    setSessionSummary('Not logged in');
    setStatusMessage('Logged out');
  };

  return (
    <div className="app">
      <nav className="sidebar" style={{ width: 268 }}>
        <div className="nav-items">
          <button className="nav-item" onClick={loadHoldings} disabled={!credentials?.accessToken}>💰 Holdings</button>
        </div>
        <div className="nav-items" style={{ marginTop: 'auto' }}>
          <button className="nav-item" onClick={() => navigate('/settings')}>⚙️ Settings</button>
          <button className="nav-item" onClick={logout}>👤 {sessionSummary}</button>
        </div>
      </nav>

      <main className="main-content">
        <header className="header">
          <h1>Holdings</h1>
          <div className="status">{statusMessage}</div>
        </header>

        <div className="holdings-view">
          <div className="holdings-list">
            {holdings.map(h => (
              <div key={h.instrumentKey} className={`holding-item ${selectedHolding?.instrumentKey === h.instrumentKey ? 'selected' : ''}`} onClick={() => setSelectedHolding(h)}>
                <div className="holding-title">{h.listTitle}</div>
                <div className="holding-subtitle">{h.listSubtitle}</div>
              </div>
            ))}
            {holdings.length === 0 && <div className="no-selection">Click Holdings to load portfolio</div>}
          </div>

          <div className="detail-panel">
            <div className="detail-header">
              <h3>Details</h3>
              <button className="btn-secondary" onClick={() => setIsChartVisible(!isChartVisible)}>{isChartVisible ? '📋 Details' : '📈 Chart'}</button>
            </div>

            {isChartVisible && selectedHolding ? (
              <div className="chart-container">
                <iframe src={`https://www.tradingview.com/widget/advanced-chart/?symbol=NSE:${selectedHolding.instrumentKey.replace('NSE:', '')}`} title="Chart" />
              </div>
            ) : selectedHolding ? (
              <div className="details">
                {selectedHolding.holdingDetails.map((d, i) => (
                  <div key={i} className="detail-row"><span>{d.label}</span><span>{d.value}</span></div>
                ))}
              </div>
            ) : <div className="no-selection">Select a holding</div>}
          </div>
        </div>
      </main>
    </div>
  );
}

function SettingsPage() {
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [statusMessage, setStatusMessage] = useState('Enter API Key');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const saved = localStorage.getItem('credentials');
    if (saved) {
      const creds = JSON.parse(saved);
      setCredentials(creds);
      setApiKey(creds.apiKey || '');
      setApiSecret(creds.apiSecret || '');
    }
  }, []);

  const startLogin = async () => {
    if (!apiKey) return;
    window.open(`https://kite.trade/connect/login?v=3&api_key=${apiKey}`, '_blank');
    setStatusMessage('Opened login. After login, come back here.');
  };

  const logout = () => {
    localStorage.removeItem('credentials');
    setCredentials(null);
    setStatusMessage('Logged out');
  };

  return (
    <div className="app">
      <nav className="sidebar" style={{ width: 268 }}>
        <div className="nav-items" style={{ marginTop: 'auto' }}>
          <button className="nav-item" onClick={() => navigate('/holdings')}>💰 Holdings</button>
          <button className="nav-item" onClick={logout}>⚙️ Settings</button>
        </div>
      </nav>

      <main className="main-content">
        <header className="header">
          <h1>Settings</h1>
          <div className="status">{statusMessage}</div>
        </header>

        <div className="settings-panel">
          <h2>Zerodha Connection</h2>
          <label>API Key</label>
          <input value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="API Key" />
          <label>API Secret</label>
          <input type="password" value={apiSecret} onChange={e => setApiSecret(e.target.value)} placeholder="API Secret" />
          <button className="btn-primary" onClick={startLogin} disabled={isLoading}>1️⃣ Open Login</button>
          {credentials?.accessToken && <button className="btn-danger" onClick={logout} style={{ marginLeft: 8 }}>Logout</button>}
        </div>
      </main>
    </div>
  );
}

function App() {
  const path = window.location.pathname;

  useEffect(() => {
    if (path === '/redirect') {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('request_token');
      const status = params.get('status');
      if (token && status === 'success') {
        localStorage.setItem('redirect_token', token);
        window.location.href = '/holdings';
      }
    }
  }, [path]);

  if (path === '/redirect') return <div>Redirecting...</div>;

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/holdings" replace />} />
      <Route path="/holdings" element={<HoldingsPage />} />
      <Route path="/settings" element={<SettingsPage />} />
    </Routes>
  );
}

export default function Root() {
  return <BrowserRouter><App /></BrowserRouter>;
}