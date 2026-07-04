"use client";
import React, { useEffect, useRef } from 'react';

// 1. Mini Chart (The one you saw, great for cards)
function TVMiniChart({ symbol }: { symbol: string }) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (container.current && container.current.children.length === 0) {
      const script = document.createElement("script");
      script.src = "https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js";
      script.async = true;
      script.innerHTML = JSON.stringify({
        "symbol": symbol,
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
  }, [symbol]);
  return <div className="tradingview-widget-container" ref={container} style={{ height: 220, width: "100%" }} />;
}

// 2. Single Ticker (Minimal text only, no chart)
function TVSingleTicker({ symbol }: { symbol: string }) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (container.current && container.current.children.length === 0) {
      const script = document.createElement("script");
      script.src = "https://s3.tradingview.com/external-embedding/embed-widget-single-quote.js";
      script.async = true;
      script.innerHTML = JSON.stringify({
        "symbol": symbol,
        "width": "100%",
        "colorTheme": "dark",
        "isTransparent": true,
        "locale": "en"
      });
      container.current.appendChild(script);
    }
  }, [symbol]);
  return <div className="tradingview-widget-container" ref={container} style={{ width: "100%" }} />;
}

// 3. Symbol Info (Price + Key fundamentals)
function TVSymbolInfo({ symbol }: { symbol: string }) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (container.current && container.current.children.length === 0) {
      const script = document.createElement("script");
      script.src = "https://s3.tradingview.com/external-embedding/embed-widget-symbol-info.js";
      script.async = true;
      script.innerHTML = JSON.stringify({
        "symbol": symbol,
        "width": "100%",
        "locale": "en",
        "colorTheme": "dark",
        "isTransparent": true
      });
      container.current.appendChild(script);
    }
  }, [symbol]);
  return <div className="tradingview-widget-container" ref={container} style={{ width: "100%" }} />;
}

// 4. Ticker Tape (Scrolling banner for the top of a page)
function TVTickerTape() {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (container.current && container.current.children.length === 0) {
      const script = document.createElement("script");
      script.src = "https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js";
      script.async = true;
      script.innerHTML = JSON.stringify({
        "symbols": [
          {"proName": "NASDAQ:AAPL", "title": "Apple"},
          {"proName": "NASDAQ:NVDA", "title": "Nvidia"},
          {"proName": "NASDAQ:TSLA", "title": "Tesla"},
          {"proName": "NASDAQ:AMZN", "title": "Amazon"}
        ],
        "showSymbolLogo": true,
        "isTransparent": true,
        "displayMode": "adaptive",
        "colorTheme": "dark",
        "locale": "en"
      });
      container.current.appendChild(script);
    }
  }, []);
  return <div className="tradingview-widget-container" ref={container} style={{ width: "100%" }} />;
}

// 5. Advanced Chart (Full interactive terminal chart)
function TVAdvancedChart({ symbol }: { symbol: string }) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (container.current && container.current.children.length === 0) {
      const script = document.createElement("script");
      script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
      script.async = true;
      script.innerHTML = JSON.stringify({
        "autosize": true,
        "symbol": symbol,
        "interval": "D",
        "timezone": "Etc/UTC",
        "theme": "dark",
        "style": "1",
        "locale": "en",
        "enable_publishing": false,
        "backgroundColor": "rgba(10, 15, 26, 1)",
        "gridColor": "rgba(255, 255, 255, 0.05)",
        "hide_top_toolbar": true,
        "hide_legend": true,
        "save_image": false,
        "container_id": "tradingview_123",
        "support_host": "https://www.tradingview.com"
      });
      container.current.appendChild(script);
    }
  }, [symbol]);
  return <div className="tradingview-widget-container" ref={container} style={{ height: 400, width: "100%" }} />;
}


export default function TVDemoPage() {
  return (
    <div className="min-h-screen bg-[#0A0F1A] text-[#F1F5F9] pb-20 font-sans">
      {/* Ticker tape usually goes at the very top of a site */}
      <div className="w-full bg-[#141B2D] border-b border-[#ffffff]/5">
        <TVTickerTape />
      </div>

      <div className="p-10 max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">TradingView Widget Mega-Demo</h1>
        <p className="text-[#8B95A8] mb-12 max-w-3xl">
          Here is a showcase of the different widgets we can use, rendered in Aura's aesthetic. All of these are completely free and handle their own real-time data.
        </p>
        
        <h2 className="text-xl font-bold mb-6 text-[#00D4AA]">1. Single Ticker (Ultra Minimal)</h2>
        <p className="text-sm text-[#8B95A8] mb-4">Best for extremely tight spaces where you only want the price and percentage.</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
          <div className="bg-[#141B2D] border border-[#ffffff]/5 p-2 rounded-xl"><TVSingleTicker symbol="NASDAQ:AAPL" /></div>
          <div className="bg-[#141B2D] border border-[#ffffff]/5 p-2 rounded-xl"><TVSingleTicker symbol="NASDAQ:NVDA" /></div>
          <div className="bg-[#141B2D] border border-[#ffffff]/5 p-2 rounded-xl"><TVSingleTicker symbol="NASDAQ:TSLA" /></div>
          <div className="bg-[#141B2D] border border-[#ffffff]/5 p-2 rounded-xl"><TVSingleTicker symbol="NASDAQ:MSFT" /></div>
        </div>

        <h2 className="text-xl font-bold mb-6 text-[#00D4AA]">2. Mini Chart (Premium Card)</h2>
        <p className="text-sm text-[#8B95A8] mb-4">Best for dashboard cards. Striking visuals with the custom Aura neon green trendline.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          <div className="bg-[#141B2D] border border-[#ffffff]/5 p-4 rounded-xl shadow-lg"><TVMiniChart symbol="NASDAQ:AAPL" /></div>
          <div className="bg-[#141B2D] border border-[#ffffff]/5 p-4 rounded-xl shadow-lg"><TVMiniChart symbol="NASDAQ:NVDA" /></div>
          <div className="bg-[#141B2D] border border-[#ffffff]/5 p-4 rounded-xl shadow-lg"><TVMiniChart symbol="NASDAQ:TSLA" /></div>
        </div>

        <h2 className="text-xl font-bold mb-6 text-[#00D4AA]">3. Symbol Info (Fundamentals)</h2>
        <p className="text-sm text-[#8B95A8] mb-4">Great for dedicated stock pages where users want to see market cap, volume, and P/E ratios.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
          <div className="bg-[#141B2D] border border-[#ffffff]/5 p-4 rounded-xl shadow-lg"><TVSymbolInfo symbol="NASDAQ:NVDA" /></div>
          <div className="bg-[#141B2D] border border-[#ffffff]/5 p-4 rounded-xl shadow-lg"><TVSymbolInfo symbol="NASDAQ:TSLA" /></div>
        </div>

        <h2 className="text-xl font-bold mb-6 text-[#00D4AA]">4. Advanced Terminal Chart</h2>
        <p className="text-sm text-[#8B95A8] mb-4">The ultimate "Bloomberg" feature. A fully interactive, zoomable candlestick chart.</p>
        <div className="bg-[#141B2D] border border-[#ffffff]/5 p-4 rounded-xl shadow-lg w-full">
          <TVAdvancedChart symbol="NASDAQ:NVDA" />
        </div>
      </div>
    </div>
  );
}
