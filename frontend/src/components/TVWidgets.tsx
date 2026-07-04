"use client";
import React, { useEffect, useRef, useState } from 'react';

// 1. Mini Chart (Great for cards)
export function TVMiniChart({ symbol }: { symbol: string }) {
  const container = useRef<HTMLDivElement>(null);
  
  // Pass the symbol directly; TradingView auto-resolves major US symbols like AAPL or BE.
  const tvSymbol = symbol;

  useEffect(() => {
    if (container.current) {
      container.current.innerHTML = ""; // Clear old widget DOM
      const script = document.createElement("script");
      script.src = "https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js";
      script.async = true;
      script.innerHTML = JSON.stringify({
        "symbol": tvSymbol,
        "width": "100%",
        "height": "100%",
        "locale": "en",
        "dateRange": "12M",
        "colorTheme": "dark",
        "trendLineColor": "#00D4AA",
        "underLineColor": "rgba(0, 212, 170, 0.3)",
        "underLineBottomColor": "rgba(0, 212, 170, 0)",
        "isTransparent": true,
        "autosize": true
      });
      container.current.appendChild(script);
    }
  }, [tvSymbol]);
  
  return <div className="tradingview-widget-container" ref={container} style={{ height: 220, width: "100%" }} />;
}


// 5. Company Profile
export function TVCompanyProfile({ symbol }: { symbol: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const tvSymbol = symbol;

  useEffect(() => {
    setIsLoading(true); // Reset loading state
    const timer = setTimeout(() => setIsLoading(false), 1000);

    if (container.current) {
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
    }
    
    return () => clearTimeout(timer);
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
  const tvSymbol = symbol;

  useEffect(() => {
    setIsLoading(true); // Reset loading state
    const timer = setTimeout(() => setIsLoading(false), 1200);

    if (container.current) {
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
    }
    
    return () => clearTimeout(timer);
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
