// content.js
console.log('[content.js] Loaded and listening...');

let currentSelectorTarget = null;
let isSelecting = false;
let clickListenerAdded = false;
let hoverListenersAdded = false;
let selectedElements = new Map(); // Track selected elements by field
let overlayContainer = null; // Container for labels
let labelElements = new Map(); // Track label elements by field

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log('[content.js] Received message:', msg);
  
  if (msg.type === 'start-element-selection') {
    // Send response to confirm message received
    sendResponse({ success: true, field: msg.field });
    // Clean up any existing listeners first
    if (clickListenerAdded) {
      document.removeEventListener('click', captureElement, true);
      clickListenerAdded = false;
    }
    if (hoverListenersAdded) {
      removeHoverHighlight();
    }
    
    // Clear any existing hover outlines but preserve selected element outlines
    clearHoverOutlines();
    debugOutlines(); // Debug what outlines exist
    
    // Create overlay container if it doesn't exist
    if (!overlayContainer) {
      overlayContainer = document.createElement('div');
      overlayContainer.id = 'crawler-overlay-container';
      overlayContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 999999;
      `;
      document.body.appendChild(overlayContainer);
      
      // Add scroll listener to update label positions
      window.addEventListener('scroll', updateLabelPositions);
      window.addEventListener('resize', updateLabelPositions);
    }
    
    currentSelectorTarget = msg.field;
    isSelecting = true;
    document.addEventListener('click', captureElement, true);
    clickListenerAdded = true;
    highlightOnHover();
    console.log('[content.js] Started selection for field:', currentSelectorTarget);
  }
  
  if (msg.type === 'clear-selections') {
    // Clear all selections and overlay
    selectedElements.clear();
    clearAllHighlights();
    clearOverlay();
    console.log('[content.js] Cleared all selections');
  }
  
  if (msg.type === 'crawl-current-page') {
    console.log('[content.js] Crawling current page with selectors:', msg.selectors);
    const crawledData = crawlPageData(msg.selectors);
    console.log('[content.js] Crawled data:', crawledData);
    sendResponse({ data: crawledData });
  }
});

function captureElement(e) {
  e.preventDefault();
  e.stopPropagation();
  
  if (!isSelecting) return;
  
  const selector = getUniqueSelector(e.target);
  
  console.log('[content.js] Captured selector:', selector, 'for field:', currentSelectorTarget);
  
  // Store the selected element
  selectedElements.set(currentSelectorTarget, {
    element: e.target,
    selector: selector
  });
  
  // Keep the element highlighted with a permanent green outline
  e.target.style.outline = '3px solid #10b981';
  e.target.style.outlineOffset = '2px';
  e.target.setAttribute('data-crawler-selected', currentSelectorTarget); // Mark as selected
  console.log('[content.js] Added green outline to element for', currentSelectorTarget);
  
  // Create a label in the overlay instead of modifying the target element
  const label = document.createElement('div');
  label.textContent = `Selected: ${currentSelectorTarget}`;
  label.style.cssText = `
    position: fixed;
    background: #10b981;
    color: white;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: bold;
    pointer-events: none;
    white-space: nowrap;
    z-index: 1000000;
  `;
  
  // Position the label above the selected element (viewport-relative)
  const rect = e.target.getBoundingClientRect();
  label.style.left = rect.left + 'px';
  label.style.top = (rect.top - 25) + 'px';
  
  overlayContainer.appendChild(label);
  labelElements.set(currentSelectorTarget, { label, element: e.target });
  
  const fieldName = currentSelectorTarget; // Store the field name before clearing
  
  // Store the selector in chrome.storage for the popup to access
  chrome.storage.local.set({
    [`selector_${fieldName}`]: selector
  }, () => {
    console.log('[content.js] Stored selector for', fieldName, ':', selector);
  });
  
  // Also try sending message to popup
  chrome.runtime.sendMessage({
    type: 'selector-captured',
    field: fieldName,
    selector: selector
  });
  
  // Clean up event listeners but keep the visual feedback
  removeHoverHighlight();
  clearHoverOutlines(); // Only clear blue hover outlines
  if (clickListenerAdded) {
    document.removeEventListener('click', captureElement, true);
    clickListenerAdded = false;
  }
  isSelecting = false;
  currentSelectorTarget = null;
}

function highlightOnHover() {
  if (!hoverListenersAdded) {
    document.addEventListener('mouseover', addOutline);
    document.addEventListener('mouseout', removeOutline);
    hoverListenersAdded = true;
  }
}

function removeHoverHighlight() {
  if (hoverListenersAdded) {
    document.removeEventListener('mouseover', addOutline);
    document.removeEventListener('mouseout', removeOutline);
    hoverListenersAdded = false;
  }
  // Clear any remaining hover outlines
  clearHoverOutlines();
}

function clearHoverOutlines() {
  // Only remove blue hover outlines, not green selected outlines
  const allElements = document.querySelectorAll('*');
  let clearedCount = 0;
  allElements.forEach(el => {
    // Check if this element is a selected element by checking the data attribute
    const isSelected = el.hasAttribute('data-crawler-selected');
    
    // Only clear if it's not a selected element and has blue outline
    if (!isSelected && el.style.outline && el.style.outline.includes('#3b82f6')) {
      console.log('[content.js] Clearing blue outline from:', el.tagName, el.className);
      el.style.outline = '';
      el.style.outlineOffset = '';
      clearedCount++;
    }
  });
  console.log('[content.js] Cleared', clearedCount, 'hover outlines');
}

function clearAllHighlights() {
  // Remove all outlines including selected ones
  const allElements = document.querySelectorAll('*');
  allElements.forEach(el => {
    el.style.outline = '';
    el.style.outlineOffset = '';
    el.removeAttribute('data-crawler-selected');
  });
}

function clearOverlay() {
  if (overlayContainer) {
    overlayContainer.remove();
    overlayContainer = null;
  }
  labelElements.clear();
  
  // Remove scroll and resize listeners
  window.removeEventListener('scroll', updateLabelPositions);
  window.removeEventListener('resize', updateLabelPositions);
}

function updateLabelPositions() {
  labelElements.forEach((data, field) => {
    const { label, element } = data;
    if (element && element.isConnected) { // Check if element still exists in DOM
      const rect = element.getBoundingClientRect();
      label.style.left = rect.left + 'px';
      label.style.top = (rect.top - 25) + 'px';
    }
  });
}

function debugOutlines() {
  const greenOutlines = document.querySelectorAll('*[style*="#10b981"]');
  const blueOutlines = document.querySelectorAll('*[style*="#3b82f6"]');
  console.log('[content.js] Debug - Green outlines:', greenOutlines.length, 'Blue outlines:', blueOutlines.length);
  console.log('[content.js] Selected elements count:', selectedElements.size);
  
  greenOutlines.forEach((el, i) => {
    console.log('[content.js] Green outline', i, ':', el.tagName, el.className);
  });
  
  selectedElements.forEach((data, field) => {
    console.log('[content.js] Selected element for', field, ':', data.element.tagName, data.element.className);
  });
}

function findElementWithFallback(selector, field) {
  // First try the original selector
  let element = document.querySelector(selector);
  if (element) {
    return element;
  }

  console.log(`[content.js] Selector failed for ${field}:`, selector);

  // Fallback strategies based on field type
  if (field === 'price') {
    // Try common price selectors
    const priceSelectors = [
      '[data-testid*="price"]',
      '[class*="price"]',
      '[class*="Price"]',
      'span[class*="price"]',
      'div[class*="price"]',
      '[data-price]',
      '.price',
      '.Price',
      '[class*="cost"]',
      '[class*="Cost"]'
    ];
    
    for (const fallbackSelector of priceSelectors) {
      element = document.querySelector(fallbackSelector);
      if (element) {
        console.log(`[content.js] Found price with fallback selector:`, fallbackSelector);
        return element;
      }
    }
  } else if (field === 'image') {
    // Try common image selectors
    const imageSelectors = [
      'img[src*="product"]',
      'img[src*="image"]',
      'img[data-src*="product"]',
      'img[data-src*="image"]',
      '[class*="product-image"]',
      '[class*="ProductImage"]',
      '[class*="main-image"]',
      '[class*="MainImage"]',
      'img:first-of-type',
      'img'
    ];
    
    for (const fallbackSelector of imageSelectors) {
      element = document.querySelector(fallbackSelector);
      if (element) {
        console.log(`[content.js] Found image with fallback selector:`, fallbackSelector);
        return element;
      }
    }
  } else if (field === 'sku') {
    // Try common SKU selectors (more specific to avoid unrelated elements)
    const skuSelectors = [
      '[data-sku]',
      '[data-product-id]',
      '[data-item-id]',
      '[class*="sku"][class*="product"]',
      '[class*="SKU"][class*="product"]',
      '[class*="product-id"]',
      '[class*="ProductId"]',
      '[class*="sku-number"]',
      '[class*="SKU-number"]',
      '[class*="sku-id"]',
      '[class*="SKU-id"]'
    ];
    
    for (const fallbackSelector of skuSelectors) {
      element = document.querySelector(fallbackSelector);
      if (element) {
        console.log(`[content.js] Found SKU with fallback selector:`, fallbackSelector);
        return element;
      }
    }
  }

  return null;
}

function crawlPageData(selectors) {
  const data = {
    url: window.location.href,
    timestamp: new Date().toISOString(),
    pageTitle: document.title,
    extractedData: {}
  };
  
  Object.keys(selectors).forEach(field => {
    const selector = selectors[field];
    if (selector && selector.trim() !== '') {
      try {
        const element = findElementWithFallback(selector, field);
        if (element) {
          let extractedValue = '';
          
          // Handle different types of data extraction
          if (field === 'image') {
            // For images, try multiple sources for the image URL
            extractedValue = element.src || 
                           element.getAttribute('src') || 
                           element.getAttribute('data-src') || 
                           element.getAttribute('data-original') ||
                           element.getAttribute('data-lazy-src') ||
                           element.getAttribute('data-image') ||
                           element.getAttribute('href') || // For links to images
                           '';
            
            // If it's a relative URL, make it absolute
            if (extractedValue && extractedValue.startsWith('/')) {
              extractedValue = window.location.origin + extractedValue;
            }
            
            // If still no URL, try to find an img tag inside the selected element
            if (!extractedValue) {
              const imgElement = element.querySelector('img');
              if (imgElement) {
                extractedValue = imgElement.src || 
                               imgElement.getAttribute('src') || 
                               imgElement.getAttribute('data-src') || 
                               imgElement.getAttribute('data-original') || '';
                
                // Make relative URLs absolute
                if (extractedValue && extractedValue.startsWith('/')) {
                  extractedValue = window.location.origin + extractedValue;
                }
              }
            }
            
            console.log(`[content.js] Image extraction for ${field}:`, extractedValue);
          } else {
            // For text content, get the text and clean it
            extractedValue = element.textContent || element.innerText || '';
            // Remove the "Selected: field" text that our extension adds
            extractedValue = extractedValue.replace(new RegExp(`Selected: ${field}`, 'gi'), '').trim();
          }
          
          data.extractedData[field] = extractedValue;
          console.log(`[content.js] Extracted ${field}:`, extractedValue);
          console.log(`[content.js] Element for ${field}:`, element.tagName, element.className, element.textContent?.substring(0, 50));
        } else {
          data.extractedData[field] = null;
          console.log(`[content.js] No element found for ${field} selector:`, selector);
        }
      } catch (error) {
        console.error(`[content.js] Error extracting ${field}:`, error);
        data.extractedData[field] = null;
      }
    } else {
      data.extractedData[field] = null;
    }
  });
  
  // Always prioritize URL-based SKU detection for Best Buy
  const urlSku = autoDetectSKU();
  if (urlSku) {
    data.extractedData.sku = urlSku;
    console.log(`[content.js] Using URL-based SKU: ${urlSku}`);
  } else if (!data.extractedData.sku || data.extractedData.sku === '') {
    data.extractedData.sku = autoDetectSKU();
  }
  
  // Format attribute section 1 data into structured tech_specs
  if (data.extractedData.attributeSection1) {
    console.log('🔍 Raw attribute section 1 text:', data.extractedData.attributeSection1);
    console.log('🔍 Raw attribute section 1 length:', data.extractedData.attributeSection1.length);
    data.extractedData.tech_specs = formatSpecification(data.extractedData.attributeSection1);
    console.log('✅ Parsed tech_specs:', data.extractedData.tech_specs);
    delete data.extractedData.attributeSection1; // Remove the old unstructured field
  } else {
    console.log('❌ No attribute section 1 data found');
  }
  
  // Format attribute section 2 data into structured tech_specs_2
  if (data.extractedData.attributeSection2) {
    console.log('🔍 Raw attribute section 2 text:', data.extractedData.attributeSection2);
    console.log('🔍 Raw attribute section 2 length:', data.extractedData.attributeSection2.length);
    data.extractedData.tech_specs_2 = formatSpecification(data.extractedData.attributeSection2);
    console.log('✅ Parsed tech_specs_2:', data.extractedData.tech_specs_2);
    delete data.extractedData.attributeSection2; // Remove the old unstructured field
  } else {
    console.log('❌ No attribute section 2 data found');
  }
  
  return data;
}

function autoDetectSKU() {
  // Common SKU patterns across different websites
  const skuPatterns = [
    // URL patterns
    /sku[_-]?id[=:]\s*([a-zA-Z0-9\-_]+)/i,
    /product[_-]?id[=:]\s*([a-zA-Z0-9\-_]+)/i,
    /item[_-]?id[=:]\s*([a-zA-Z0-9\-_]+)/i,
    
    // Meta tags
    /"sku":\s*"([^"]+)"/i,
    /"productId":\s*"([^"]+)"/i,
    /"itemId":\s*"([^"]+)"/i,
    
    // Data attributes
    /data-sku[=:]\s*"([^"]+)"/i,
    /data-product-id[=:]\s*"([^"]+)"/i,
    /data-item-id[=:]\s*"([^"]+)"/i
  ];
  
  // Check URL first
  const url = window.location.href;
  for (const pattern of skuPatterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      console.log('[content.js] Auto-detected SKU from URL:', match[1]);
      return match[1];
    }
  }
  
  // Check meta tags
  const metaTags = document.querySelectorAll('meta');
  for (const meta of metaTags) {
    const content = meta.getAttribute('content') || meta.getAttribute('value') || '';
    for (const pattern of skuPatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        console.log('[content.js] Auto-detected SKU from meta tag:', match[1]);
        return match[1];
      }
    }
  }
  
  // Check data attributes on elements
  const elementsWithData = document.querySelectorAll('[data-sku], [data-product-id], [data-item-id]');
  for (const element of elementsWithData) {
    const sku = element.getAttribute('data-sku') || element.getAttribute('data-product-id') || element.getAttribute('data-item-id');
    if (sku) {
      console.log('[content.js] Auto-detected SKU from data attribute:', sku);
      return sku;
    }
  }
  
  console.log('[content.js] No SKU auto-detected');
  return null;
}

function formatSpecification(specText) {
  if (!specText) return {};
  
  console.log('🔍 Starting to parse specification text...');
  
  // Clean up the text first
  let cleaned = specText
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/\n/g, ' ') // Replace newlines with spaces
    .trim();
  
  console.log('🔍 Cleaned text:', cleaned);
  
  // Define the specification patterns we're looking for
  const specDefinitions = [
    { key: 'Display Type', pattern: /Display\s+Type\s*([^A-Z]+?)(?=Resolution|Screen|High|Panel|Backlight|Refresh|Smart|Featured|Number|TV|Works|Voice|$)/i },
    { key: 'Resolution', pattern: /Resolution\s*([^A-Z]+?)(?=Screen|High|Panel|Backlight|Refresh|Smart|Featured|Number|TV|Works|Voice|$)/i },
    { key: 'Screen Size Class', pattern: /Screen\s+Size\s+Class\s*([^A-Z]+?)(?=High|Panel|Backlight|Refresh|Smart|Featured|Number|TV|Works|Voice|$)/i },
    { key: 'High Dynamic Range (HDR)', pattern: /High\s+Dynamic\s+Range\s*\(HDR\)\s*([^A-Z]+?)(?=Panel|Backlight|Refresh|Smart|Featured|Number|TV|Works|Voice|$)/i },
    { key: 'Panel Type', pattern: /Panel\s+Type\s*([^A-Z]+?)(?=Backlight|Refresh|Smart|Featured|Number|TV|Works|Voice|$)/i },
    { key: 'Backlight Type', pattern: /Backlight\s+Type\s*([^A-Z]+?)(?=Refresh|Smart|Featured|Number|TV|Works|Voice|$)/i },
    { key: 'Refresh Rate', pattern: /Refresh\s+Rate\s*([^A-Z]+?)(?=Smart|Featured|Number|TV|Works|Voice|$)/i },
    { key: 'Smart Platform', pattern: /Smart\s+Platform\s*([^A-Z]+?)(?=Featured|Number|TV|Works|Voice|$)/i },
    { key: 'Featured Streaming Services', pattern: /Featured\s+Streaming\s+Services\s*([^A-Z]+?)(?=Number|TV|Works|Voice|$)/i },
    { key: 'Number of HDMI Inputs (Total)', pattern: /Number\s+of\s+HDMI\s+Inputs\s*\(Total\)\s*([^A-Z]+?)(?=TV|Works|Voice|$)/i },
    { key: 'TV Tuner Type', pattern: /TV\s+Tuner\s+Type\s*([^A-Z]+?)(?=Works|Voice|$)/i },
    { key: 'Works With', pattern: /Works\s+With\s*([^A-Z]+?)(?=Voice|$)/i },
    { key: 'Voice Assistant', pattern: /Voice\s+Assistant\s*([^A-Z]+?)(?=$)/i }
  ];
  
  const techSpecs = {};
  
  // Simple approach: Split the text and look for specific patterns
  const text = cleaned.replace('Key Specs', ''); // Remove the header
  
  // Define what we're looking for and their patterns
  const specs = [
    { name: 'Display Type', pattern: 'Display Type' },
    { name: 'Resolution', pattern: 'Resolution' },
    { name: 'Screen Size Class', pattern: 'Screen Size Class' },
    { name: 'High Dynamic Range (HDR)', pattern: 'High Dynamic Range (HDR)' },
    { name: 'Panel Type', pattern: 'Panel Type' },
    { name: 'Backlight Type', pattern: 'Backlight Type' },
    { name: 'Refresh Rate', pattern: 'Refresh Rate' },
    { name: 'Smart Platform', pattern: 'Smart Platform' },
    { name: 'Featured Streaming Services', pattern: 'Featured Streaming Services' },
    { name: 'Number of HDMI Inputs (Total)', pattern: 'Number of HDMI Inputs (Total)' },
    { name: 'TV Tuner Type', pattern: 'TV Tuner Type' },
    { name: 'Works With', pattern: 'Works With' },
    { name: 'Voice Assistant', pattern: 'Voice Assistant' }
  ];
  
  // Find each specification in the text
  specs.forEach(spec => {
    const index = text.indexOf(spec.pattern);
    if (index !== -1) {
      // Find the start of the next specification
      let nextIndex = text.length;
      for (const nextSpec of specs) {
        if (nextSpec.pattern !== spec.pattern) {
          const nextPos = text.indexOf(nextSpec.pattern, index + 1);
          if (nextPos !== -1 && nextPos < nextIndex) {
            nextIndex = nextPos;
          }
        }
      }
      
      // Extract the value (everything between this spec and the next one)
      const valueStart = index + spec.pattern.length;
      const value = text.substring(valueStart, nextIndex).trim();
      
      if (value) {
        // Clean up some common parsing issues
        let cleanValue = value;
        
        // Fix "NoLED" -> "No" for HDR
        if (spec.name === 'High Dynamic Range (HDR)' && value.includes('NoLED')) {
          cleanValue = 'No';
        }
        
        // Fix "Built-inAmazon Alexa" -> "Built-in Amazon Alexa"
        if (spec.name === 'Voice Assistant' && value.includes('Built-inAmazon')) {
          cleanValue = value.replace('Built-inAmazon', 'Built-in Amazon');
        }
        
        // Remove any trailing specification names that got included
        const nextSpecs = specs.filter(s => s.pattern !== spec.pattern);
        for (const nextSpec of nextSpecs) {
          if (cleanValue.endsWith(nextSpec.pattern)) {
            cleanValue = cleanValue.replace(nextSpec.pattern, '').trim();
          }
        }
        
        techSpecs[spec.name] = cleanValue;
        console.log(`✅ Extracted ${spec.name}: ${cleanValue}`);
      }
    }
  });
  
  console.log('📊 Final tech_specs:', techSpecs);
  return techSpecs;
}

function addOutline(e) {
  if (isSelecting) {
    // Don't highlight if this element is already selected
    if (selectedElements.has(currentSelectorTarget) && selectedElements.get(currentSelectorTarget).element === e.target) {
      return;
    }
    e.target.style.outline = '2px solid #3b82f6';
    e.target.style.outlineOffset = '2px';
  }
}

function removeOutline(e) {
  // Only remove outline if it's not a selected element
  if (!e.target.hasAttribute('data-crawler-selected')) {
    e.target.style.outline = '';
    e.target.style.outlineOffset = '';
  }
}

function getUniqueSelector(el) {
  if (!el) return '';
  
  // If element has an ID, use it
  if (el.id) {
    return `#${el.id}`;
  }
  
  // Try to find a unique class-based selector (single class first)
  if (el.className) {
    const classes = el.className.trim().split(/\s+/);
    for (let className of classes) {
      if (className && !className.match(/^(js-|react-|ng-|t3V0AOwowrTfUzPn|flex|py|px|pr|pl|pt|pb|text|bg|border|rounded|shadow|hover|focus|transition|duration|ease|transform|scale|rotate|translate|opacity|z|absolute|relative|fixed|sticky|block|inline|inline-block|grid|flex-col|flex-row|items|justify|gap|space|w|h|max|min|overflow|hidden|visible|scroll|auto|truncate|whitespace|break|hyphens|leading|tracking|font|italic|not|underline|line-through|uppercase|lowercase|capitalize|normal|bold|semibold|medium|light|thin|extralight|black|white|gray|red|green|blue|yellow|purple|pink|indigo|teal|orange|amber|emerald|cyan|sky|violet|fuchsia|rose|lime|slate|zinc|neutral|stone|orange|amber|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)/)) {
        const selector = `${el.nodeName.toLowerCase()}.${className}`;
        if (document.querySelectorAll(selector).length === 1) {
          return selector;
        }
      }
    }
  }
  
  // Try to find a unique selector with data attributes
  const dataAttrs = el.getAttributeNames().filter(attr => attr.startsWith('data-'));
  for (let attr of dataAttrs) {
    const value = el.getAttribute(attr);
    const selector = `${el.nodeName.toLowerCase()}[${attr}="${value}"]`;
    if (document.querySelectorAll(selector).length === 1) {
      return selector;
    }
  }
  
  // Try to find a unique selector with tag + class combination (filter out utility classes)
  if (el.className) {
    const classes = el.className.trim().split(/\s+/).filter(c => 
      c && !c.match(/^(js-|react-|ng-|t3V0AOwowrTfUzPn|flex|py|px|pr|pl|pt|pb|text|bg|border|rounded|shadow|hover|focus|transition|duration|ease|transform|scale|rotate|translate|opacity|z|absolute|relative|fixed|sticky|block|inline|inline-block|grid|flex-col|flex-row|items|justify|gap|space|w|h|max|min|overflow|hidden|visible|scroll|auto|truncate|whitespace|break|hyphens|leading|tracking|font|italic|not|underline|line-through|uppercase|lowercase|capitalize|normal|bold|semibold|medium|light|thin|extralight|black|white|gray|red|green|blue|yellow|purple|pink|indigo|teal|orange|amber|emerald|cyan|sky|violet|fuchsia|rose|lime|slate|zinc|neutral|stone|orange|amber|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)/)
    );
    if (classes.length > 0) {
      const selector = `${el.nodeName.toLowerCase()}.${classes.join('.')}`;
      if (document.querySelectorAll(selector).length === 1) {
        return selector;
      }
    }
  }
  
  // Try to find a unique selector with role or aria attributes
  const role = el.getAttribute('role');
  if (role) {
    const selector = `${el.nodeName.toLowerCase()}[role="${role}"]`;
    if (document.querySelectorAll(selector).length === 1) {
      return selector;
    }
  }
  
  // Build a path with nth-child for uniqueness (increased to 3 levels for better reliability)
  const path = [];
  let current = el;
  let level = 0;
  
  while (current && current.nodeType === Node.ELEMENT_NODE && level < 3) {
    let selector = current.nodeName.toLowerCase();
    
    // Add classes if they exist (filter out utility classes)
    if (current.className) {
      const classes = current.className.trim().split(/\s+/).filter(c => 
        c && !c.match(/^(js-|react-|ng-|t3V0AOwowrTfUzPn|flex|py|px|pr|pl|pt|pb|text|bg|border|rounded|shadow|hover|focus|transition|duration|ease|transform|scale|rotate|translate|opacity|z|absolute|relative|fixed|sticky|block|inline|inline-block|grid|flex-col|flex-row|items|justify|gap|space|w|h|max|min|overflow|hidden|visible|scroll|auto|truncate|whitespace|break|hyphens|leading|tracking|font|italic|not|underline|line-through|uppercase|lowercase|capitalize|normal|bold|semibold|medium|light|thin|extralight|black|white|gray|red|green|blue|yellow|purple|pink|indigo|teal|orange|amber|emerald|cyan|sky|violet|fuchsia|rose|lime|slate|zinc|neutral|stone|orange|amber|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)/)
      );
      if (classes.length > 0) {
        selector += '.' + classes.join('.');
      }
    }
    
    // Add nth-child for uniqueness
    let nth = 1;
    let sibling = current.previousElementSibling;
    while (sibling) {
      if (sibling.nodeName === current.nodeName) {
        nth++;
      }
      sibling = sibling.previousElementSibling;
    }
    selector += `:nth-child(${nth})`;
    
    path.unshift(selector);
    current = current.parentNode;
    level++;
  }
  
  return path.join(' > ');
}
