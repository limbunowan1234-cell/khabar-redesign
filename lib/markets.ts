// Symbols shown in the TradingView widgets. Only symbols that TradingView serves in its free widgets
// are used: BSE indices, world gold/silver and the rupee pairs. NSE (Nifty) and MCX (Indian gold and
// silver futures) come back empty in the free tier, so they are deliberately not listed.
export const TICKER_SYMBOLS = [
  { proName: 'BSE:SENSEX', title: 'Sensex' },
  { proName: 'BSE:BSE500', title: 'BSE 500' },
  { proName: 'TVC:GOLD', title: 'Gold $/oz' },
  { proName: 'TVC:SILVER', title: 'Silver $/oz' },
  { proName: 'FX_IDC:USDINR', title: 'USD/INR' },
];

export const OVERVIEW_TABS = [
  {
    title: 'Indian stocks',
    symbols: [
      { s: 'BSE:SENSEX', d: 'BSE Sensex' },
      { s: 'BSE:BSE100', d: 'BSE 100' },
      { s: 'BSE:BSE500', d: 'BSE 500' },
      { s: 'BSE:IT', d: 'BSE IT' },
    ],
  },
  {
    title: 'Gold & silver',
    symbols: [
      { s: 'FX_IDC:XAUINR', d: 'Gold, ₹ per ounce' },
      { s: 'FX_IDC:XAGINR', d: 'Silver, ₹ per ounce' },
      { s: 'TVC:GOLD', d: 'Gold, $ per ounce' },
      { s: 'TVC:SILVER', d: 'Silver, $ per ounce' },
    ],
  },
  {
    title: 'Rupee',
    symbols: [
      { s: 'FX_IDC:USDINR', d: 'US dollar / rupee' },
      { s: 'FX_IDC:EURINR', d: 'Euro / rupee' },
      { s: 'FX_IDC:GBPINR', d: 'Pound / rupee' },
    ],
  },
];
