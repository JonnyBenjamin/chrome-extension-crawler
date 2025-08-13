import React, { useState, useEffect } from 'react';

export default function App() {
  const [urls, setUrls] = useState(['']);
  const [selectors, setSelectors] = useState({
    sku: '',
    price: '',
    image: '',
    productName: '',
    attributeSection1: '',
    attributeSection2: ''
  });

  useEffect(() => {
    try {
      const storedUrls = JSON.parse(localStorage.getItem('crawler_urls'));
      if (Array.isArray(storedUrls)) setUrls(storedUrls);
    } catch (_) {}
    
    // Load selectors from chrome.storage
    chrome.storage.local.get(null, (result) => {
      const newSelectors = { ...selectors };
      Object.keys(result).forEach(key => {
        if (key.startsWith('selector_')) {
          const field = key.replace('selector_', '');
          newSelectors[field] = result[key];
        }
      });
      setSelectors(newSelectors);
    });
  }, []);

  useEffect(() => {
    localStorage.setItem('crawler_urls', JSON.stringify(urls));
  }, [urls]);

  useEffect(() => {
    // Store selectors in chrome.storage instead of localStorage
    const storageData = {};
    Object.keys(selectors).forEach(field => {
      if (selectors[field]) {
        storageData[`selector_${field}`] = selectors[field];
      }
    });
    chrome.storage.local.set(storageData);
  }, [selectors]);

  const handleSelectorChange = (field, value) => {
    setSelectors(prev => ({ ...prev, [field]: value }));
  };

  const handleSelectorTool = async (field) => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      console.log('[popup] Sending selection message to tab:', tab.id, 'for field:', field);

      // Send message to content script to start selection
      chrome.tabs.sendMessage(tab.id, {
        type: 'start-element-selection',
        field: field
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('[popup] Error sending message:', chrome.runtime.lastError);
          alert('Error: Content script not loaded. Please refresh the page and try again.');
        } else {
          console.log('[popup] Message sent successfully');
        }
      });
    } catch (error) {
      console.error('[popup] Error in handleSelectorTool:', error);
      alert('Error: Could not start selection. Please try again.');
    }
  };

  useEffect(() => {
    const handler = (message) => {
      console.log('[popup] Received message:', message);
      if (message.type === 'selector-captured') {
        const { field, selector } = message;
        console.log('[popup] Setting selector for', field, 'to', selector);
        setSelectors(prev => ({
          ...prev,
          [field]: selector
        }));
      }
    };
  
    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, []);

  const exportConfig = () => {
    const config = {
      urls: urls.filter(url => url.trim() !== ''),
      selectors
    };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'crawler-config.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearAllData = () => {
    setSelectors({
      sku: '',
      price: '',
      image: '',
      productName: '',
      attributeSection1: '',
      attributeSection2: ''
    });
    setUrls(['']);
    
    // Clear chrome.storage
    chrome.storage.local.clear();
    
    // Clear localStorage
    localStorage.removeItem('crawler_urls');
  };

  const crawlData = async () => {
    const validUrls = urls.filter(url => url.trim() !== '');
    const validSelectors = Object.keys(selectors).filter(key => selectors[key].trim() !== '');
    
    if (validUrls.length === 0) {
      alert('Please add at least one URL to crawl.');
      return;
    }
    
    if (validSelectors.length === 0) {
      alert('Please capture at least one selector before crawling.');
      return;
    }
    
    console.log('[popup] Starting crawl for', validUrls.length, 'URLs');
    console.log('[popup] Using selectors:', selectors);
    
    // For now, we'll crawl the current active tab
    // In a full implementation, we'd need to open each URL in a new tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Send message to content script to crawl current page
    chrome.tabs.sendMessage(tab.id, {
      type: 'crawl-current-page',
      selectors: selectors
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('[popup] Error crawling:', chrome.runtime.lastError);
        alert('Error: Could not crawl the current page. Please refresh and try again.');
      } else if (response && response.data) {
        console.log('[popup] Crawled data:', response.data);
        exportCrawledData(response.data);
      }
    });
  };

  const exportCrawledData = (data) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crawled-data-${timestamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 w-[480px] bg-gradient-to-br from-slate-50 to-white min-h-[550px]">
      <div className="flex items-center mb-8">
        <div className="mr-4">
          <img src="/logo-blue.svg" alt="Zoovu Logo" className="h-8 w-auto" />
        </div>
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
            Product Crawler
          </h1>
          <p className="text-sm text-slate-500 mt-1">Smart product data extraction tool</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 mb-6">
        <label className="block text-sm font-semibold text-slate-800 mb-4 flex items-center">
          <svg className="w-5 h-5 mr-3 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          Product URLs
        </label>
      {urls.map((url, idx) => (
        <div key={idx} className="flex gap-1 mb-1">
          <input
            type="text"
            value={url}
            onChange={(e) => {
              const updated = [...urls];
              updated[idx] = e.target.value;
              setUrls(updated);
            }}
            className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 bg-slate-50 focus:bg-white"
            placeholder="Enter product URL..."
          />
          <button
            onClick={() => setUrls(urls.filter((_, i) => i !== idx))}
            className="text-slate-500 hover:text-red-600 hover:bg-red-50 px-4 py-3 rounded-xl transition-all duration-200 border border-slate-200 hover:border-red-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      ))}
      <button
        onClick={() => setUrls([...urls, ''])}
        className="mt-4 text-sm text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 py-3 px-4 rounded-xl transition-all duration-200 flex items-center border border-indigo-200 hover:border-indigo-300"
      >
        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
        Add URL
      </button>

      </div>

      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 mb-6">
        <label className="block text-sm font-semibold text-slate-800 mb-4 flex items-center">
          <svg className="w-5 h-5 mr-3 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
          Data Selectors
        </label>
      {['sku', 'price', 'image', 'productName', 'attributeSection1', 'attributeSection2'].map((key) => (
        <div key={key} className="flex gap-3 mb-4 items-end">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-slate-600 mb-2 capitalize tracking-wide">
              {key === 'productName' ? 'Product Name' : 
               key === 'attributeSection1' ? 'Attribute Section 1' : 
               key === 'attributeSection2' ? 'Attribute Section 2' : 
               key}
            </label>
            <input
              type="text"
              placeholder={`Click "Select" to capture ${key} element`}
              value={selectors[key]}
              onChange={(e) => handleSelectorChange(key, e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 bg-slate-50 focus:bg-white"
            />
          </div>
          <button
            onClick={() => handleSelectorTool(key)}
            className="text-sm text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 px-4 py-2 rounded-xl transition-all duration-200 font-medium shadow-lg hover:shadow-xl flex items-center self-end"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.122 2.122" />
            </svg>
            Select
          </button>
        </div>
      ))}
      </div>

      <div className="mt-6 flex gap-4">
        <button
          onClick={crawlData}
          className="flex-1 bg-gradient-to-r from-green-500 to-green-600 text-white text-sm py-3 rounded-xl hover:from-green-600 hover:to-green-700 font-semibold shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Crawl Data
        </button>
        <button
          onClick={exportConfig}
          className="flex-1 bg-gradient-to-r from-slate-900 to-slate-800 text-white text-sm py-3 rounded-xl hover:from-slate-800 hover:to-slate-700 font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
        >
          Export Config
        </button>
      </div>
      
      <div className="mt-3">
        <button
          onClick={clearAllData}
          className="w-full bg-gradient-to-r from-red-500 to-red-600 text-white text-sm py-2 rounded-xl hover:from-red-600 hover:to-red-700 font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
        >
          Clear All
        </button>
      </div>
    </div>
  );
}
