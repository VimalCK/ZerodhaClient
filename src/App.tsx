import React, { useState, useEffect } from 'react';
import { useNavigate, Routes, Route } from 'react-router-dom';
import './App.css';
import type { AppState, PortfolioHolding, DetailEntry, Credentials } from './types';

const API_BASE = 'https://api.kite.trade';

function App() {
  const navigate = useNavigate();
  const [state, setState] = useState<AppState>({
    isLoggedIn: false,
    sessionSummary: 'Not logged in',
    statusMessage: 'Enter API Key in Settings to sign in.',
    holdings: [],
    selectedHolding: null,
    quoteDetails: [],
    quoteStatus: '',
    isChartVisible: false,
    isNavExpanded: true,
    isSettingsOpen: true,
  });

  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [requestToken, setRequestToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [autoLoginAttempted, setAutoLoginAttempted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('credentials');
    if (saved) {
      try {
        const creds = JSON.parse(saved);
        setCredentials(creds);
        setApiKey(creds.apiKey || '');
        setApiSecret(creds.apiSecret || '');
        if (creds.accessToken) {
          setState(s => ({ ...s, isLoggedIn: true, sessionSummary: creds.userName ? `${creds.userName} (${creds.userId})` : 'Signed in', statusMessage: 'Session restored.' }));
        }
      } catch {}
    }

    const fullUrl = window.location.href;
    const urlParams = new URLSearchParams(window.location.search);
    const reqToken = urlParams.get('request_token');
    const status = urlParams.get('status');
    if (reqToken && status === 'success') {
      setRequestToken(reqToken);
      window.history.replaceState(null, '', '/');
      setState(s => ({ ...s, statusMessage: 'Request token received. Auto-completing login...', isSettingsOpen: true }));
    }
  }, []);

  useEffect(() => {
    if (requestToken && apiKey && apiSecret && !autoLoginAttempted && !credentials?.accessToken) {
      setAutoLoginAttempted(true);
      setTimeout(() => completeLogin(), 500);
    }
  }, [requestToken, apiKey, apiSecret]);

  const saveCredentials = (creds: Credentials) => {
    localStorage.setItem('credentials', JSON.stringify(creds));
    setCredentials(creds);
  };

  const updateApiKey = (value: string) => {
    setApiKey(value);
    if (credentials) {
      saveCredentials({ ...credentials, apiKey: value });
    } else if (value || apiSecret) {
      saveCredentials({ apiKey: value, apiSecret, accessToken: '' });
    }
  };

  const updateApiSecret = (value: string) => {
    setApiSecret(value);
    if (credentials) {
      saveCredentials({ ...credentials, apiSecret: value });
    } else if (apiKey || value) {
      saveCredentials({ apiKey, apiSecret: value, accessToken: '' });
    }
  };

  const apiCall = async (endpoint: string, method = 'GET', body?: string) => {
    if (!credentials?.accessToken) throw new Error('Not logged in');
    
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method,
      headers: {
        'Authorization': `token ${credentials.apiKey}:${credentials.accessToken}`,
      },
      body: method === 'POST' ? body : undefined,
    });
    
    if (!response.ok) throw new Error(`API Error: ${response.status}`);
    return response.json();
  };

  const startLogin = async () => {
    if (!apiKey) {
      setState(s => ({ ...s, statusMessage: 'Enter API key first.' }));
      return;
    }
    
    setIsLoading(true);
    try {
      const loginUrl = `https://kite.trade/connect/login?v=3&api_key=${apiKey}`;
      window.open(loginUrl, '_blank');
      setState(s => ({ ...s, statusMessage: 'Login page opened. Enter request token below.' }));
    } catch (e: any) {
      setState(s => ({ ...s, statusMessage: e.message }));
    } finally {
      setIsLoading(false);
    }
  };

  const completeLogin = async () => {
    if (!apiKey || !apiSecret || !requestToken) {
      setState(s => ({ ...s, statusMessage: 'Fill all fields.' }));
      return;
    }

    const checksum = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(apiKey + requestToken + apiSecret))
      .then(buffer => Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join(''));
    
    setIsLoading(true);
    setState(s => ({ ...s, statusMessage: 'Completing login...' }));
    
    try {
      const payload = { api_key: apiKey, request_token: requestToken, secret: apiSecret, checksum };
      console.log('Payload:', payload);
      const response = await fetch(`${API_BASE}/session/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(payload).toString(),
      });
      
      const data = await response.json();
      console.log('Login response:', data);
      
      if (data.status === 'success') {
        const accessToken = data.data.access_token;
        const userProfile = data.data.user_id;
        const userName = data.data.user_name;
        
        const newCreds: Credentials = { 
          apiKey, 
          apiSecret, 
          accessToken, 
          userId: userProfile,
          userName,
          publicToken: data.data.public_token,
          enctoken: data.data.enctoken,
        };
        saveCredentials(newCreds);
        
        setState(s => ({ ...s, isLoggedIn: true, sessionSummary: userProfile, statusMessage: 'Login successful!', isSettingsOpen: false }));
      } else {
        setState(s => ({ ...s, statusMessage: data.message || 'Login failed' }));
      }
    } catch (e: any) {
      setState(s => ({ ...s, statusMessage: e.message }));
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    saveCredentials({ apiKey, apiSecret, accessToken: '', userId: '' });
    setState(s => ({ ...s, isLoggedIn: false, sessionSummary: 'Not logged in', statusMessage: 'Logged out.', holdings: [], selectedHolding: null }));
  };

  const loadHoldings = async () => {
    setIsLoading(true);
    setState(s => ({ ...s, statusMessage: 'Loading holdings...' }));
    
    try {
      const data = await apiCall('/portfolio/holdings');
      
      if (data.status === 'success' && data.data) {
        const holdings: PortfolioHolding[] = data.data.map((h: any) => ({
          instrumentKey: `${h.exchange}:${h.trading_symbol}`,
          listTitle: h.trading_symbol,
          listSubtitle: `${h.exchange} · Qty ${h.quantity} · PnL ${h.pnl}`,
          holdingDetails: [
            { label: 'Product', value: h.product },
            { label: 'Quantity', value: String(h.quantity) },
            { label: 'Avg Price', value: String(h.average_price) },
            { label: 'Last Price', value: String(h.last_price) },
            { label: 'PnL', value: String(h.pnl) },
            { label: 'ISIN', value: h.isin },
          ],
        }));
        
        setState(s => ({ ...s, holdings, selectedHolding: holdings[0] || null, statusMessage: `Loaded ${holdings.length} holdings.` }));
      }
    } catch (e: any) {
      setState(s => ({ ...s, statusMessage: e.message }));
    } finally {
      setIsLoading(false);
    }
  };

  const loadQuote = async (instrumentKey: string) => {
    setState(s => ({ ...s, quoteStatus: 'Loading quote...' }));
    
    try {
      const data = await apiCall(`/quote?i=${instrumentKey}`);
      
      if (data.status === 'success' && data.data) {
        const quote = data.data[instrumentKey];
        const details: DetailEntry[] = [
          { label: 'Last', value: String(quote.last_price) },
          { label: 'Open', value: String(quote.ohlc.open) },
          { label: 'High', value: String(quote.ohlc.high) },
          { label: 'Low', value: String(quote.ohlc.low) },
          { label: 'Close', value: String(quote.ohlc.close) },
          { label: 'Volume', value: String(quote.volume) },
          { label: 'OI', value: String(quote.oi) },
        ];
        
        setState(s => ({ ...s, quoteDetails: details, quoteStatus: '' }));
      }
    } catch (e: any) {
      setState(s => ({ ...s, quoteStatus: e.message }));
    }
  };

  const toggleNav = () => setState(s => ({ ...s, isNavExpanded: !s.isNavExpanded }));

  const openHoldings = async () => {
    navigate('/holdings');
    setState(s => ({ ...s, isSettingsOpen: false, isChartVisible: false }));
    await loadHoldings();
  };

  const selectHolding = async (holding: PortfolioHolding) => {
    setState(s => ({ ...s, selectedHolding: holding, isChartVisible: false, quoteDetails: [], quoteStatus: '' }));
    await loadQuote(holding.instrumentKey);
  };

  const toggleChart = () => setState(s => ({ ...s, isChartVisible: !s.isChartVisible }));

  const openSettings = () => {
    navigate('/settings');
    setState(s => ({ ...s, isSettingsOpen: true }));
  };

  return (
    <Routes>
      <Route path="/holdings" element={
        <div className="app">
          <nav className="sidebar" style={{ width: state.isNavExpanded ? 268 : 56 }}>
            <button className="hamburger" onClick={toggleNav}>☰</button>
            {state.isNavExpanded && (
              <div className="nav-items">
                <button className="nav-item" onClick={openHoldings}>💰 Holdings</button>
                <button className="nav-item" onClick={openSettings}>⚙️ Settings</button>
                <button className="nav-item" onClick={logout}>👤 {state.sessionSummary}</button>
              </div>
            )}
          </nav>
          
          <main className="main-content">
            <header className="header">
              <h1>Holdings</h1>
              <div className="status">{state.statusMessage}</div>
            </header>
            
            <div className="holdings-view">
              <div className="holdings-list">
                {state.holdings.map(h => (
                  <div key={h.instrumentKey} className={`holding-item ${state.selectedHolding?.instrumentKey === h.instrumentKey ? 'selected' : ''}`} onClick={() => selectHolding(h)}>
                    <div className="holding-title">{h.listTitle}</div>
                    <div className="holding-subtitle">{h.listSubtitle}</div>
                  </div>
                ))}
                {state.holdings.length === 0 && (
                  <div className="no-selection">Click Holdings to load your portfolio</div>
                )}
              </div>
              
              <div className="detail-panel">
                <div className="detail-header">
                  <h3>Details</h3>
                  <button className="btn-secondary" onClick={toggleChart}>{state.isChartVisible ? '📋 Details' : '📈 Chart'}</button>
                </div>
                
                {state.isChartVisible && state.selectedHolding ? (
                  <div className="chart-container">
                    <iframe 
                      src={`https://www.tradingview.com/widget/advanced-chart/?symbol=NSE:${state.selectedHolding.instrumentKey.replace('NSE:', '')}`}
                      title="TradingView Chart"
                    ></iframe>
                  </div>
                ) : state.selectedHolding ? (
                  <div className="details">
                    {state.selectedHolding.holdingDetails.map((d, i) => (
                      <div key={i} className="detail-row">
                        <span>{d.label}</span>
                        <span>{d.value}</span>
                      </div>
                    ))}
                    {state.quoteDetails.length > 0 && (
                      <>
                        <div className="section-title">Market Quote</div>
                        {state.quoteDetails.map((d, i) => (
                          <div key={i} className="detail-row">
                            <span>{d.label}</span>
                            <span>{d.value}</span>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                ) : (
                  <div className="no-selection">Select a holding</div>
                )}
              </div>
            </div>
          </main>
        </div>
      } />
      <Route path="/settings" element={
        <div className="app">
          <nav className="sidebar" style={{ width: state.isNavExpanded ? 268 : 56 }}>
            <button className="hamburger" onClick={toggleNav}>☰</button>
            {state.isNavExpanded && (
              <div className="nav-items">
                <button className="nav-item" onClick={openHoldings}>💰 Holdings</button>
                <button className="nav-item" onClick={openSettings}>⚙️ Settings</button>
                <button className="nav-item" onClick={logout}>👤 {state.sessionSummary}</button>
              </div>
            )}
          </nav>
          
          <main className="main-content">
            <header className="header">
              <h1>Settings</h1>
              <div className="status">{state.statusMessage}</div>
            </header>
            
            <div className="settings-panel">
              <h2>Zerodha Connection</h2>
              <label>API Key</label>
              <input placeholder="Enter API Key" value={apiKey} onChange={e => updateApiKey(e.target.value)} />
              <label>API Secret</label>
              <input type="password" placeholder="Enter API Secret" value={apiSecret} onChange={e => updateApiSecret(e.target.value)} />
              <button className="btn-primary" onClick={startLogin} disabled={isLoading}>1️⃣ Open Login</button>
              {state.isLoggedIn ? (
                <button className="btn-danger" onClick={logout} style={{ marginLeft: 8 }}>Logout</button>
              ) : (
                <>
                  <label style={{ marginTop: 16, display: 'block' }}>Request Token: {requestToken || '(none)'}</label>
                  <input placeholder="Paste request_token from redirect URL" value={requestToken} onChange={e => setRequestToken(e.target.value)} />
                  <button className="btn-primary" onClick={completeLogin} disabled={isLoading}>2️⃣ Complete Login</button>
                </>
              )}
            </div>
          </main>
        </div>
      } />
    </Routes>
  );
}

export default App;