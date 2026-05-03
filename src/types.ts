export interface PortfolioHolding {
  instrumentKey: string;
  listTitle: string;
  listSubtitle: string;
  holdingDetails: DetailEntry[];
}

export interface DetailEntry {
  label: string;
  value: string;
}

export interface SessionInfo {
  userName: string;
  userId: string;
  accessToken: string;
}

export interface Credentials {
  apiKey: string;
  apiSecret: string;
  accessToken?: string;
  userName?: string;
  userId?: string;
  redirectUrl?: string;
  publicToken?: string;
  enctoken?: string;
}

export interface AppState {
  isLoggedIn: boolean;
  sessionSummary: string;
  statusMessage: string;
  holdings: PortfolioHolding[];
  selectedHolding: PortfolioHolding | null;
  quoteDetails: DetailEntry[];
  quoteStatus: string;
  isChartVisible: boolean;
  isNavExpanded: boolean;
  isSettingsOpen: boolean;
}