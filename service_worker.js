// service_worker.js
const MAX_HISTORY = 100;
const SNAP_SCALE = 2; // upscale factor for crisper PNGs
const SNAP_MARGIN_PX = 24; // margin around output image (visible snaps)

// Data compression utilities
const COMPRESSION_THRESHOLD = 1024; // Compress data larger than 1KB

// Encryption utilities
const ENCRYPTION_KEY_PREFIX = 'cpm_enc_key_';
const SENSITIVE_KEYWORDS = ['password', 'secret', 'token', 'key', 'api', 'auth', 'login', 'credit', 'ssn', 'social'];

// Simple encryption using Web Crypto API
async function encryptData(data, password) {
  try {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    
    // Generate a random IV
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // Derive key from password
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );
    
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: iv,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );
    
    // Encrypt the data
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      dataBuffer
    );
    
    // Combine IV and encrypted data
    const result = new Uint8Array(iv.length + encrypted.byteLength);
    result.set(iv);
    result.set(new Uint8Array(encrypted), iv.length);
    
    return {
      encrypted: true,
      data: btoa(String.fromCharCode(...result))
    };
  } catch (error) {
    console.warn('Encryption failed:', error);
    return { encrypted: false, data };
  }
}

async function decryptData(encryptedData, password) {
  try {
    if (!encryptedData.encrypted) {
      return encryptedData.data;
    }
    
    const decoder = new TextDecoder();
    const data = atob(encryptedData.data);
    const dataBuffer = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) {
      dataBuffer[i] = data.charCodeAt(i);
    }
    
    // Extract IV and encrypted data
    const iv = dataBuffer.slice(0, 12);
    const encrypted = dataBuffer.slice(12);
    
    // Derive key from password
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );
    
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: iv,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
    
    // Decrypt the data
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      encrypted
    );
    
    return decoder.decode(decrypted);
  } catch (error) {
    console.warn('Decryption failed:', error);
    throw new Error('Failed to decrypt data. Check your password.');
  }
}

// Check if data contains sensitive information
function isSensitiveData(data) {
  const lowerData = data.toLowerCase();
  return SENSITIVE_KEYWORDS.some(keyword => lowerData.includes(keyword));
}

// Get or create encryption key for user
async function getEncryptionKey() {
  const { encryptionKey } = await chrome.storage.local.get({ encryptionKey: null });
  return encryptionKey;
}

async function setEncryptionKey(key) {
  await chrome.storage.local.set({ encryptionKey: key });
}

// Offline data management
async function getOfflineData() {
  const { offlineData = {} } = await chrome.storage.local.get({ offlineData: {} });
  return offlineData;
}

async function setOfflineData(data) {
  await chrome.storage.local.set({ offlineData: data });
}

// Sync data when online
async function syncOfflineData() {
  try {
    const offlineData = await getOfflineData();
    if (Object.keys(offlineData).length === 0) return;
    
    // Here you would sync with a server if you had one
    // For now, we'll just mark data as synced
    console.log('Syncing offline data:', offlineData);
    
    // Clear offline data after successful sync
    await chrome.storage.local.set({ offlineData: {} });
  } catch (error) {
    console.warn('Failed to sync offline data:', error);
  }
}

// Check online status
function isOnline() {
  return navigator.onLine;
}

// Handle online/offline events
chrome.runtime.onStartup.addListener(() => {
  if (isOnline()) {
    syncOfflineData();
  }
});

// Listen for online events
self.addEventListener('online', () => {
  syncOfflineData();
});

// Cache frequently used data
async function cacheFrequentData() {
  try {
    const { history = [], snippets = [], notes = [] } = await chrome.storage.local.get({
      history: [],
      snippets: [],
      notes: []
    });
    
    // Cache recent items for faster access
    const recentHistory = history.slice(0, 20);
    const frequentSnippets = snippets.slice(0, 10);
    
    await chrome.storage.local.set({
      cachedHistory: recentHistory,
      cachedSnippets: frequentSnippets,
      lastCacheUpdate: Date.now()
    });
  } catch (error) {
    console.warn('Failed to cache frequent data:', error);
  }
}

// Simple compression using LZ-string algorithm (lightweight)
function compressData(data) {
  if (typeof data !== 'string') {
    data = JSON.stringify(data);
  }
  
  if (data.length < COMPRESSION_THRESHOLD) {
    return { compressed: false, data };
  }
  
  try {
    // Simple run-length encoding for basic compression
    const compressed = simpleCompress(data);
    return { compressed: true, data: compressed };
  } catch (error) {
    console.warn('Compression failed, storing uncompressed:', error);
    return { compressed: false, data };
  }
}

function decompressData(compressedData) {
  if (!compressedData.compressed) {
    return compressedData.data;
  }
  
  try {
    return simpleDecompress(compressedData.data);
  } catch (error) {
    console.warn('Decompression failed:', error);
    return compressedData.data;
  }
}

// Simple compression algorithm
function simpleCompress(str) {
  let compressed = '';
  let count = 1;
  
  for (let i = 0; i < str.length; i++) {
    if (str[i] === str[i + 1] && count < 255) {
      count++;
    } else {
      if (count > 3) {
        compressed += `\x00${String.fromCharCode(count)}${str[i]}`;
      } else {
        compressed += str[i].repeat(count);
      }
      count = 1;
    }
  }
  
  return compressed;
}

function simpleDecompress(str) {
  let decompressed = '';
  let i = 0;
  
  while (i < str.length) {
    if (str[i] === '\x00' && i + 2 < str.length) {
      const count = str.charCodeAt(i + 1);
      const char = str[i + 2];
      decompressed += char.repeat(count);
      i += 3;
    } else {
      decompressed += str[i];
      i++;
    }
  }
  
  return decompressed;
}

// ---------- Offline Support & Caching ----------
const CACHE_NAME = 'copy-master-pro-v1';
const CACHE_MANIFEST = {
  "version": "1.0.0",
  "cache": [
    "popup.html",
    "popup.css", 
    "popup.js",
    "content.js",
    "content.css",
    "service_worker.js",
    "history.html",
    "history.js",
    "snippets.html",
    "snippets.js",
    "site-rules.html",
    "site-rules.js",
    "quick-notes.html",
    "quick-notes.js",
    "help.html",
    "help.js",
    "icons/icon128.png",
    "icons/icon32.png",
    "icons/icon16.png"
  ]
};

// Install event - cache resources
chrome.runtime.onInstalled.addListener(async () => {
  try {
    // Cache extension resources
    const cache = await caches.open(CACHE_NAME);
    const urlsToCache = CACHE_MANIFEST.cache.map(file => chrome.runtime.getURL(file));
    await cache.addAll(urlsToCache);
    console.log('Extension resources cached for offline use');
  } catch (error) {
    console.warn('Failed to cache resources:', error);
  }
});

// ---------- Install: context menus ----------
chrome.runtime.onInstalled.addListener(() => {
  try {
    chrome.contextMenus.create({
      id: "copy_text",
      title: "Copy as Text",
      contexts: ["action"],
    });
    chrome.contextMenus.create({
      id: "copy_html",
      title: "Copy as HTML",
      contexts: ["action"],
    });
    chrome.contextMenus.create({
      id: "copy_markdown",
      title: "Copy as Markdown",
      contexts: ["action"],
    });
    chrome.contextMenus.create({
      id: "copy_image_clip",
      title: "Copy Image to Clipboard",
      contexts: ["action"],
    });
    chrome.contextMenus.create({
      id: "save_image",
      title: "Save Image File",
      contexts: ["action"],
    });
    chrome.contextMenus.create({
      id: "clean_copy",
      title: "Clean Copy",
      contexts: ["action"],
    });
    chrome.contextMenus.create({
      id: "copy_with_source",
      title: "Copy with Source",
      contexts: ["action"],
    });
    chrome.contextMenus.create({
      id: "extract_links_enhanced",
      title: "Extract Links",
      contexts: ["action"],
    });
    chrome.contextMenus.create({
      id: "table_export_enhanced",
      title: "Table → CSV/TSV",
      contexts: ["action"],
    });
    chrome.contextMenus.create({
      id: "format_json",
      title: "Format JSON",
      contexts: ["action"],
    });
    chrome.contextMenus.create({
      id: "code_syntax",
      title: "Code Syntax Highlight",
      contexts: ["action"],
    });
    chrome.contextMenus.create({
      id: "text_statistics",
      title: "Text Statistics",
      contexts: ["action"],
    });
    chrome.contextMenus.create({
      id: "base64_encode",
      title: "Base64 Encode",
      contexts: ["action"],
    });
    chrome.contextMenus.create({
      id: "base64_decode",
      title: "Base64 Decode",
      contexts: ["action"],
    });
    chrome.contextMenus.create({
      id: "color_picker",
      title: "Color Picker",
      contexts: ["action"],
    });
    chrome.contextMenus.create({
      id: "meta_og_scraper",
      title: "Meta/OG Scraper",
      contexts: ["action"],
    });
    chrome.contextMenus.create({
      id: "image_downloader",
      title: "Image URL Extractor",
      contexts: ["action"],
    });
    chrome.contextMenus.create({
      id: "contrast_checker",
      title: "Contrast Checker",
      contexts: ["action"],
    });
    chrome.contextMenus.create({
      id: "color_palette",
      title: "Color Palette",
      contexts: ["action"],
    });
    chrome.contextMenus.create({
      id: "save_as_snippet",
      title: "Save as Snippet",
      contexts: ["action"],
    });
    chrome.contextMenus.create({
      id: "apply_site_rules",
      title: "Apply Site Rules",
      contexts: ["action"],
    });
  } catch (e) {
    console.warn("Context menu error:", e);
  }
});

// ---------- Context menu → tell content script what to do ----------
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;
  const map = {
    copy_text: "text",
    copy_html: "html",
    copy_markdown: "markdown",
    copy_image_clip: "image_clip",
    save_image: "image_save",
    clean_copy: "clean_copy",
    copy_with_source: "copy_with_source",
    extract_links_enhanced: "extract_links_enhanced",
    table_export_enhanced: "table_export_enhanced",
    format_json: "json_format",
    code_syntax: "code_syntax",
    text_statistics: "text_statistics",
    base64_encode: "base64_encode",
    base64_decode: "base64_decode",
    color_picker: "color_picker",
    meta_og_scraper: "meta_og_scraper",
    image_downloader: "image_downloader",
    contrast_checker: "contrast_checker",
    color_palette: "color_palette",

    save_as_snippet: "save_as_snippet",
    apply_site_rules: "apply_site_rules",
  };
  const mode = map[info.menuItemId];
  if (!mode) return;
  await ensureContent(tab.id);
  chrome.tabs.sendMessage(tab.id, { type: "OCCS_DO", mode });
});

// ---------- Keyboard shortcuts ----------
chrome.commands.onCommand.addListener(async (command, tab) => {
  if (!tab?.id) return;
  await ensureContent(tab.id);
  if (command === "quick_copy")
    chrome.tabs.sendMessage(tab.id, { type: "OCCS_DO", mode: "clean_copy" });
  if (command === "quick_color")
    chrome.tabs.sendMessage(tab.id, { type: "OCCS_DO", mode: "color_picker" });
  if (command === "quick_unicode")
    chrome.tabs.sendMessage(tab.id, { type: "OCCS_DO", mode: "unicode_fix" });
  if (command === "quick_title")
    chrome.tabs.sendMessage(tab.id, {
      type: "OCCS_DO",
      mode: "smart_title_case",
    });
});

// ---------- Ensure content is injected ----------
async function ensureContent(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { ping: true });
  } catch (e) {
    try {
      // Inject both JS and CSS files
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["content.js"],
      });
      await chrome.scripting.insertCSS({
        target: { tabId },
        files: ["content.css"],
      });
    } catch (injectError) {
      // If we can't inject, the page is likely restricted
      throw new Error("Cannot access this page");
    }
  }
}

// ---------- HISTORY ----------
async function pushHistory(item) {
  const { history = [] } = await chrome.storage.local.get({ history: [] });
  
  let processedData = item.data;
  
  // Check if data is sensitive and should be encrypted
  const encryptionKey = await getEncryptionKey();
  if (encryptionKey && isSensitiveData(item.data)) {
    processedData = await encryptData(item.data, encryptionKey);
  } else {
    // Compress large data items
    processedData = compressData(item.data);
  }
  
  const processedItem = {
    ...item,
    data: processedData
  };
  
  history.unshift(processedItem);
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
  await chrome.storage.local.set({ history });
}

// ---------- Helpers ----------
async function blobToDataUrl(blob) {
  const ab = await blob.arrayBuffer();
  const b64 = btoa(String.fromCharCode(...new Uint8Array(ab)));
  return `data:${blob.type || "image/png"};base64,${b64}`;
}

// Add transparent margin around an OffscreenCanvas
function addMarginOffscreen(offscreenCanvas, marginPx = 0) {
  if (!marginPx) return offscreenCanvas;
  const w = offscreenCanvas.width + marginPx * 2;
  const h = offscreenCanvas.height + marginPx * 2;
  const out = new OffscreenCanvas(w, h);
  const ctx = out.getContext("2d");
  ctx.drawImage(offscreenCanvas, marginPx, marginPx);
  return out;
}

// Core: crop from current visible tab → download (no createObjectURL)
async function cropAndDownload(tab, rect, dpr, scale = SNAP_SCALE, filename) {
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: "png",
    });
    const blob = await (await fetch(dataUrl)).blob();
    const bmp = await createImageBitmap(blob);

    // Source crop in device pixels
    const sx = Math.max(0, Math.floor(rect.left * dpr));
    const sy = Math.max(0, Math.floor(rect.top * dpr));
    const sw = Math.min(bmp.width - sx, Math.floor(rect.width * dpr));
    const sh = Math.min(bmp.height - sy, Math.floor(rect.height * dpr));
    if (sw <= 0 || sh <= 0)
      return { ok: false, error: "Selection outside visible area" };

    // Output size
    const outW = Math.max(1, Math.floor(sw * scale));
    const outH = Math.max(1, Math.floor(sh * scale));

    // Crop + scale → OffscreenCanvas
    const oc = new OffscreenCanvas(outW, outH);
    const octx = oc.getContext("2d");
    octx.imageSmoothingEnabled = true;
    octx.imageSmoothingQuality = "high";
    octx.drawImage(bmp, sx, sy, sw, sh, 0, 0, outW, outH);

    // Margin
    const withMargin = addMarginOffscreen(oc, SNAP_MARGIN_PX);

    // To data URL (no createObjectURL)
    const finalBlob = await withMargin.convertToBlob({ type: "image/png" });
    const finalDataUrl = await blobToDataUrl(finalBlob);

    const id = await chrome.downloads.download({
      url: finalDataUrl,
      filename: filename || "snap-" + Date.now() + ".png",
      saveAs: true,
    });
    return { ok: true, id, width: withMargin.width, height: withMargin.height };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ---------- Message bridge ----------
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      if (msg?.type === "OCCS_HISTORY_PUSH") {
        await pushHistory(msg.item);
        sendResponse({ ok: true });
        return;
      }

      if (msg?.type === "OCCS_CAPTURE_VISIBLE") {
        const durl = await chrome.tabs.captureVisibleTab(sender.tab.windowId, {
          format: "png",
        });
        sendResponse({ ok: true, dataUrl: durl });
        return;
      }

      if (msg?.type === "OCCS_CROP_AND_DOWNLOAD") {
        const res = await cropAndDownload(
          sender.tab,
          msg.rect,
          msg.dpr,
          msg.scale || SNAP_SCALE,
          msg.filename
        );
        sendResponse(res);
        return;
      }

      if (msg?.type === "OCCS_DOWNLOAD_DATAURL") {
        try {
          const id = await chrome.downloads.download({
            url: msg.dataUrl,
            filename: msg.filename || "snap-" + Date.now() + ".png",
            saveAs: true,
          });
          sendResponse({ ok: true, id });
        } catch (e) {
          sendResponse({ ok: false, error: String(e) });
        }
        return;
      }

      if (msg?.type === "OCCS_DOWNLOAD_URL") {
        try {
          const id = await chrome.downloads.download({
            url: msg.url,
            filename: msg.filename || "image-" + Date.now(),
            saveAs: true,
          });
          sendResponse({ ok: true, id });
        } catch (e) {
          sendResponse({ ok: false, error: String(e) });
        }
        return;
      }

      if (msg?.type === "OCCS_DECOMPRESS_DATA") {
        try {
          const decompressed = decompressData(msg.data);
          sendResponse({ ok: true, data: decompressed });
        } catch (e) {
          sendResponse({ ok: false, error: String(e) });
        }
        return;
      }

      if (msg?.type === "OCCS_DECRYPT_DATA") {
        try {
          const decrypted = await decryptData(msg.data, msg.password);
          sendResponse({ ok: true, data: decrypted });
        } catch (e) {
          sendResponse({ ok: false, error: String(e) });
        }
        return;
      }

      if (msg?.type === "OCCS_SET_ENCRYPTION_KEY") {
        try {
          await setEncryptionKey(msg.key);
          sendResponse({ ok: true });
        } catch (e) {
          sendResponse({ ok: false, error: String(e) });
        }
        return;
      }

      if (msg?.type === "OCCS_GET_ENCRYPTION_KEY") {
        try {
          const key = await getEncryptionKey();
          sendResponse({ ok: true, key });
        } catch (e) {
          sendResponse({ ok: false, error: String(e) });
        }
        return;
      }

      if (msg?.type === "OCCS_CACHE_FREQUENT_DATA") {
        try {
          await cacheFrequentData();
          sendResponse({ ok: true });
        } catch (e) {
          sendResponse({ ok: false, error: String(e) });
        }
        return;
      }

      if (msg?.type === "OCCS_GET_CACHED_DATA") {
        try {
          const { cachedHistory = [], cachedSnippets = [], lastCacheUpdate = 0 } = await chrome.storage.local.get({
            cachedHistory: [],
            cachedSnippets: [],
            lastCacheUpdate: 0
          });
          sendResponse({ ok: true, data: { cachedHistory, cachedSnippets, lastCacheUpdate } });
        } catch (e) {
          sendResponse({ ok: false, error: String(e) });
        }
        return;
      }

      if (msg?.type === "OCCS_CHECK_ONLINE_STATUS") {
        sendResponse({ ok: true, online: isOnline() });
        return;
      }
    } catch (e) {
      sendResponse({ ok: false, error: String(e) });
    }
  })();

  // Keep channel open for async sendResponse
  return true;
});
