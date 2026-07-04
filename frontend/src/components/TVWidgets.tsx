"use client";
import React, { useEffect, useRef, useState } from 'react';

// Maps internal ticker symbols to TradingView compatible symbols
const mapTVSymbol = (sym: string) => {
  if (sym === 'BRK-B') return 'BRK.B';
  if (sym === 'BRK-A') return 'BRK.A';
  return sym;
};

// 1. Symbol Overview Chart (More illustrative, native ranges)
export function TVMiniChart({ symbol, sentiment }: { symbol: string, sentiment?: number }) {
  const container = useRef<HTMLDivElement>(null);
  
  // Pass the symbol directly; TradingView auto-resolves major US symbols like AAPL or BE.
  const tvSymbol = mapTVSymbol(symbol);

  useEffect(() => {
    let isMounted = true;
    
    const loadWidget = () => {
      if (!isMounted || !container.current) return;
      container.current.innerHTML = ""; // Clear old widget DOM
      
      const script = document.createElement("script");
      script.src = "https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js";
      script.async = true;
      script.innerHTML = JSON.stringify({
        "symbols": [
          [
            tvSymbol,
            `${tvSymbol}|1D`
          ]
        ],
        "chartOnly": false,
        "width": "100%",
        "height": "100%",
        "locale": "en",
        "colorTheme": "dark",
        "isTransparent": true,
        "autosize": true,
        "showVolume": false,
        "showMA": false,
        "hideDateRanges": false,
        "hideMarketStatus": false,
        "hideSymbolLogo": false,
        "scalePosition": "right",
        "scaleMode": "Normal",
        "fontFamily": "-apple-system, BlinkMacSystemFont, Trebuchet MS, Roboto, Ubuntu, sans-serif",
        "fontSize": "10",
        "noTimeScale": false,
        "valuesTracking": "1",
        "changeMode": "price-and-percent",
        "chartType": "area",
        "lineWidth": 2,
        "lineType": 0,
        "dateRanges": [
          "1d|1",
          "1m|30",
          "3m|60",
          "ytd|1D",
          "12m|1D",
          "60m|1W",
          "all|1M"
        ]
      });
      container.current.appendChild(script);
    };
    
    // Use a timeout to debounce strict mode issues and execute the async function
    const timer = setTimeout(() => {
      loadWidget();
    }, 100);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [tvSymbol, sentiment]);
  
  return (
    <div className="w-full flex flex-col relative" style={{ height: 380 }}>
      <div className="flex-1 w-full relative">
        <div className="absolute inset-0 tradingview-widget-container" ref={container} />
      </div>
    </div>
  );
}


// 5. Company Profile
export function TVCompanyProfile({ symbol }: { symbol: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const tvSymbol = mapTVSymbol(symbol);

  useEffect(() => {
    setIsLoading(true); // Reset loading state
    const timer = setTimeout(() => setIsLoading(false), 1000);
    let isMounted = true;

    const loadWidget = setTimeout(() => {
      if (!isMounted || !container.current) return;
      container.current.innerHTML = ""; // Clear old widget DOM
      const script = document.createElement("script");
      script.src = "https://s3.tradingview.com/external-embedding/embed-widget-symbol-profile.js";
      script.async = true;
      script.innerHTML = JSON.stringify({
        "width": "100%",
        "height": "100%",
        "colorTheme": "dark",
        "isTransparent": true,
        "symbol": tvSymbol,
        "locale": "en"
      });
      container.current.appendChild(script);
    }, 100);
    
    return () => {
      isMounted = false;
      clearTimeout(timer);
      clearTimeout(loadWidget);
    };
  }, [tvSymbol]);
  
  return (
    <div className="relative w-full rounded-2xl overflow-hidden" style={{ height: 300 }}>
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#141B2D]/40 backdrop-blur-md z-10">
          <div className="flex flex-col items-center gap-4">
            <div className="relative flex items-center justify-center w-12 h-12">
              <div className="absolute inset-0 rounded-full border border-[#00D4AA]/20"></div>
              <div className="absolute inset-0 rounded-full border border-[#00D4AA] border-t-transparent animate-spin"></div>
              <div className="w-2 h-2 rounded-full bg-[#00D4AA] animate-pulse shadow-[0_0_10px_#00D4AA]"></div>
            </div>
            <span className="font-[family-name:var(--font-geist-sans)] text-xs text-[#8B95A8] tracking-wider uppercase">Loading Data</span>
          </div>
        </div>
      )}
      <div className="tradingview-widget-container" ref={container} style={{ height: "100%", width: "100%" }} />
    </div>
  );
}

// 6. Fundamental Data
export function TVFundamentalData({ symbol }: { symbol: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const tvSymbol = mapTVSymbol(symbol);

  useEffect(() => {
    setIsLoading(true); // Reset loading state
    const timer = setTimeout(() => setIsLoading(false), 1200);
    let isMounted = true;

    const loadWidget = setTimeout(() => {
      if (!isMounted || !container.current) return;
      container.current.innerHTML = ""; // Clear old widget DOM
      const script = document.createElement("script");
      script.src = "https://s3.tradingview.com/external-embedding/embed-widget-financials.js";
      script.async = true;
      script.innerHTML = JSON.stringify({
        "colorTheme": "dark",
        "isTransparent": true,
        "largeChartUrl": "",
        "displayMode": "regular",
        "width": "100%",
        "height": "100%",
        "symbol": tvSymbol,
        "locale": "en"
      });
      container.current.appendChild(script);
    }, 100);
    
    return () => {
      isMounted = false;
      clearTimeout(timer);
      clearTimeout(loadWidget);
    };
  }, [tvSymbol]);
  
  return (
    <div className="relative w-full rounded-2xl overflow-hidden" style={{ height: 920 }}>
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#141B2D]/40 backdrop-blur-md z-10">
          <div className="flex flex-col items-center gap-4">
            <div className="relative flex items-center justify-center w-12 h-12">
              <div className="absolute inset-0 rounded-full border border-[#3B82F6]/20"></div>
              <div className="absolute inset-0 rounded-full border border-[#3B82F6] border-t-transparent animate-spin"></div>
              <div className="w-2 h-2 rounded-full bg-[#3B82F6] animate-pulse shadow-[0_0_10px_#3B82F6]"></div>
            </div>
            <span className="font-[family-name:var(--font-geist-sans)] text-xs text-[#8B95A8] tracking-wider uppercase">Loading Financials</span>
          </div>
        </div>
      )}
      <div className="tradingview-widget-container" ref={container} style={{ height: "100%", width: "100%" }} />
    </div>
  );
}


export function ExpandableWidget({ title, color, children }: { title: string, color: string, children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasRendered, setHasRendered] = useState(false);

  // Mark as rendered the first time it opens
  if (isOpen && !hasRendered) {
    setHasRendered(true);
  }
  
  return (
    <div className="w-full flex flex-col gap-2">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 rounded-xl bg-[#141B2D]/40 hover:bg-[#141B2D] border border-[#1E293B] transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full animate-pulse`} style={{ backgroundColor: color }}></span>
          <h3 className="text-sm font-[family-name:var(--font-geist-mono)] font-bold text-[#F1F5F9] uppercase tracking-widest">{title}</h3>
        </div>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>
      
      {hasRendered && (
        <div className={`w-full mt-2 rounded-2xl overflow-hidden bg-[#141B2D]/40 backdrop-blur-md border border-[#1E293B] shadow-2xl shadow-black/50 ${isOpen ? 'block animate-fade-up' : 'hidden'}`}>
          {children}
        </div>
      )}
    </div>
  );
}
