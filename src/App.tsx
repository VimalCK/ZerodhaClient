import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import './App.css';
import type { Credentials, PortfolioHolding } from './types';

const API_BASE = 'https://api.kite.trade';

function HoldingsPage() {
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [holdings, setHoldings] = useState<PortfolioHolding[]>([]);
  const [selectedHolding, setSelectedHolding] = useState<PortfolioHolding | null>(null);
  const [statusMessage, setStatusMessage] = useState('Click Holdings to load');
  const [isLoading, setIsLoading] = useState(false);
  const [isChartVisible, setIsChartVisible] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const saved = localStorage.getItem('credentials');
    if (saved) {
      const creds = JSON.parse(saved);
      setCredentials(creds);
      if (creds.accessToken) setStatusMessage('Session active');
    }

    const redirectToken = localStorage.getItem('redirect_token');
    if (redirectToken) {
      setStatusMessage('Completing login...');
      localStorage.removeItem('redirect_token');
      completeLogin(redirectToken);
    }
  }, []);

  const completeLogin = async (reqToken: string) => {
    if (!credentials?.apiKey || !credentials?.apiSecret) {
      setStatusMessage('Missing credentials');
      navigate('/settings');
      return;
    }
    
    const checksum = await crypto.subtle.digest('SHA-256', 
      new TextEncoder().encode(credentials.apiKey + reqToken + credentials.apiSecret))
      .then(buffer => Array.from(new Uint8Array(buffer))
      .map(b => b.toString(16).padStart(2, '0')).join(''));

    try {
      const response = await fetch(`${API_BASE}/session/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `api_key=${credentials.apiKey}&request_token=${reqToken}&secret=${credentials.apiSecret}&checksum=${checksum}`,
      });
      const data = await response.json();
      if (data.status === 'success') {
        const newCreds = { ...credentials, accessToken: data.data.access_token, userId: data.data.user_id, userName: data.data.user_name };
        localStorage.setItem('credentials', JSON.stringify(newCreds));
        setCredentials(newCreds);
        setStatusMessage('Logged in as ' + data.data.user_id);
      } else {
        setStatusMessage(data.message || 'Login failed');
      }
    } catch (e: any) {
      setStatusMessage(e.message);
    }
  };

  const loadHoldings = async () => {
    if (!credentials?.accessToken) {
      navigate('/settings');
      return;
    }
    setIsLoading(true);
    setStatusMessage('Loading holdings...');

    try {
      const response = await fetch(`${API_BASE}/portfolio/holdings`, {
        headers: { 'Authorization': `token ${credentials.apiKey}:${credentials.accessToken}` },
      });
      const data = await response.json();

      if (data.status === 'success') {
        const h: PortfolioHolding[] = data.data.map((item: any) => ({
          instrumentKey: `${item.exchange}:${item.trading_symbol}`,
          listTitle: item.trading_symbol,
          listSubtitle: `${item.exchange} · Qty ${item.quantity}`,
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
    setStatusMessage('Logged out');
    navigate('/settings');
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo"><span>📈</span></div>
        </div>
        <nav className="nav-menu">
          <a className="nav-item" title="Holdings" onClick={loadHoldings}>💰</a>
        </nav>
        <div className="nav-footer">
          <a className="nav-item" title="Settings" onClick={() => navigate('/settings')}>⚙️</a>
          <a className="nav-item" title={credentials?.userId || 'Account'} onClick={logout}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"/>
              <circle cx="12" cy="7" r="3.5"/>
              <path d="M5 18c0-3.5 3.134-6.5 7-6.5s7 3 7 6.5"/>
            </svg>
          </a>
        </div>
      </aside>

      <main className="main">
        <header className="header">
          <h1 className="header-title">Holdings</h1>
          <span className="header-status">{statusMessage}</span>
        </header>

        <div className="content">
          <div className="holdings-grid">
            <div className="card">
              <div className="card-header">
                <span className="card-title">Portfolio</span>
                <button className="btn btn-primary" onClick={loadHoldings} disabled={isLoading}>
                  {isLoading ? 'Loading...' : 'Refresh'}
                </button>
              </div>
              <div className="card-body">
                <div className="holdings-list">
                  {holdings.map(h => (
                    <div key={h.instrumentKey} 
                      className={`holding-item ${selectedHolding?.instrumentKey === h.instrumentKey ? 'selected' : ''}`}
                      onClick={() => setSelectedHolding(h)}>
                      <div className="symbol">{h.listTitle}</div>
                      <div className="meta">{h.listSubtitle}</div>
                    </div>
                  ))}
                  {holdings.length === 0 && (
                    <div className="empty">
                      <div className="empty-icon">📊</div>
                      <div className="empty-title">No holdings</div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="detail-panel">
              <div className="stats-grid">
                <div className="stat-box">
                  <div className="stat-label">Quantity</div>
                  <div className="stat-value">{selectedHolding?.holdingDetails.find(d => d.label === 'Quantity')?.value || '-'}</div>
                </div>
                <div className="stat-box">
                  <div className="stat-label">Avg Price</div>
                  <div className="stat-value">{selectedHolding?.holdingDetails.find(d => d.label === 'Avg Price')?.value || '-'}</div>
                </div>
                <div className="stat-box">
                  <div className="stat-label">Last Price</div>
                  <div className="stat-value">{selectedHolding?.holdingDetails.find(d => d.label === 'Last Price')?.value || '-'}</div>
                </div>
                <div className="stat-box">
                  <div className="stat-label">PnL</div>
                  <div className="stat-value">{selectedHolding?.holdingDetails.find(d => d.label === 'PnL')?.value || '-'}</div>
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <span className="card-title">{selectedHolding?.listTitle || 'Details'}</span>
                  <button className="btn btn-secondary" onClick={() => setIsChartVisible(!isChartVisible)}>
                    {isChartVisible ? 'Details' : 'Chart'}
                  </button>
                </div>
                <div className="card-body">
                  {isChartVisible && selectedHolding ? (
                    <div className="chart-box">
                      <iframe src={`https://www.tradingview.com/widget/advanced-chart/?symbol=NSE:${selectedHolding.instrumentKey.replace('NSE:', '')}`} />
                    </div>
                  ) : selectedHolding ? (
                    <div className="detail-list">
                      {selectedHolding.holdingDetails.map((d, i) => (
                        <div key={i} className="detail-row">
                          <span className="detail-label">{d.label}</span>
                          <span className="detail-value">{d.value}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty">
                      <div className="empty-icon">📈</div>
                      <div className="empty-title">Select a holding</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
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
  const [requestToken, setRequestToken] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const saved = localStorage.getItem('credentials');
    if (saved) {
      const creds = JSON.parse(saved);
      setCredentials(creds);
      setApiKey(creds.apiKey || '');
      setApiSecret(creds.apiSecret || '');
      if (creds.accessToken) setStatusMessage('Logged in as ' + creds.userId);
    }
  }, []);

  const saveCredentials = () => {
    if (!apiKey || !apiSecret) return;
    const creds = { apiKey, apiSecret, accessToken: '', userId: '' };
    localStorage.setItem('credentials', JSON.stringify(creds));
    setCredentials(creds);
    setStatusMessage('Credentials saved. Now login via Zerodha.');
  };

  const logout = () => {
    localStorage.removeItem('credentials');
    setCredentials(null);
    setStatusMessage('Logged out');
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo"><span>📈</span></div>
        </div>
        <nav className="nav-menu">
          <a className="nav-item" title="Holdings" onClick={() => navigate('/holdings')}>💰</a>
        </nav>
        <div className="nav-footer">
          <a className="nav-item" title="Settings">⚙️</a>
          <a className="nav-item user-btn" title={credentials?.userId || 'Account'} onClick={logout}>
            {credentials?.userId ? (
              <span className="user-avatar">{credentials.userId.slice(-2).toUpperCase()}</span>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            )}
          </a>
        </div>
      </aside>

      <main className="main">
        <header className="header">
          <h1 className="header-title">Settings</h1>
          <span className={`header-status ${statusMessage.includes('Logged') ? 'success' : ''}`}>
            {statusMessage || 'Configure your credentials'}
          </span>
        </header>

        <div className="content">
          <div className="card" style={{ maxWidth: 480 }}>
            <div className="card-body">
              <h2 style={{ marginBottom: 20 }}>Zerodha Credentials</h2>
              
              <div className="form-group">
                <label className="form-label">API Key</label>
                <input className="form-input" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="Enter API Key" />
              </div>
              
              <div className="form-group">
                <label className="form-label">API Secret</label>
                <input type="password" className="form-input" value={apiSecret} onChange={e => setApiSecret(e.target.value)} placeholder="Enter API Secret" />
              </div>
              
              <button className="btn btn-primary btn-block" onClick={saveCredentials} disabled={!apiKey || !apiSecret}>
                Save Credentials
              </button>

              <div style={{ marginTop: 32 }}>
                <label className="form-label">Request Token</label>
                <input className="form-input" value={requestToken} onChange={e => setRequestToken(e.target.value)} placeholder="Paste request_token from redirect URL" />
              </div>

              {credentials?.accessToken && (
                <button className="btn btn-danger btn-block" onClick={logout} style={{ marginTop: 16 }}>
                  Logout
                </button>
              )}
            </div>
          </div>
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

  if (path === '/redirect') return <div className="app"><div className="content"><div className="empty">Redirecting...</div></div></div>;

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