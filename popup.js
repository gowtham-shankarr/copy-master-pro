const qs = (s) => document.querySelector(s);

// Toast function for popup
function toast(message) {
  const toast = document.createElement("div");
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: var(--accent, #007bff);
    color: white;
    padding: 10px 20px;
    border-radius: 8px;
    z-index: 10001;
    font-size: 14px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  `;
  toast.textContent = message;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 2000);
}

function historyItemView(it) {
  const li = document.createElement("li");
  li.className = "hitem";
  const kind = document.createElement("div");
  kind.className = "kind";
  kind.textContent = it.kind;
  const prev = document.createElement("div");
  prev.className = "preview";
  prev.textContent = it.preview || "";
  const btn = document.createElement("button");
  btn.className = "copy";
  btn.textContent = "Copy";
  btn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(it.data || "");
      toast("Copied to clipboard!");
    } catch (e) {
      console.error(e);
      toast("Failed to copy");
    }
  });
  li.append(kind, prev, btn);
  return li;
}
async function refreshHistory() {
  const ul = qs("#historyList");
  ul.innerHTML = "";
  const { history = [] } = await chrome.storage.local.get({ history: [] });
  history.forEach((it) => ul.appendChild(historyItemView(it)));
}
async function send(mode) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    toast("No active tab found");
    return;
  }

  // Check if we can access this tab
  if (
    tab.url.startsWith("chrome://") ||
    tab.url.startsWith("chrome-extension://") ||
    tab.url.startsWith("moz-extension://") ||
    tab.url.startsWith("edge://") ||
    tab.url.startsWith("about:") ||
    tab.url.startsWith("view-source:")
  ) {
    toast("Cannot access browser pages. Try a regular website.");
    return;
  }

  try {
    await chrome.tabs.sendMessage(tab.id, { type: "OCCS_DO", mode });
  } catch (e) {
    // Check if it's a permission error
    if (e.message && e.message.includes("Cannot access contents")) {
      toast("Cannot access this page. Try a different website.");
      return;
    }

    // Try to inject content script and CSS, then retry
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"],
      });
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ["content.css"],
      });
      await chrome.tabs.sendMessage(tab.id, { type: "OCCS_DO", mode });
    } catch (injectError) {
      console.error("Failed to inject content script:", injectError);
      toast("Cannot access this page. Try a different website.");
    }
  }
}
document.addEventListener("DOMContentLoaded", async () => {
  // Check online status
  await checkOnlineStatus();
  
  // Initialize customizable layout
  await initializeCustomizableLayout();
  
  // Initialize accessibility features
  initializeAccessibility();
  
  // Initialize keyboard shortcuts
  initializeKeyboardShortcuts();
  qs("#tText").addEventListener("click", () => send("text"));
  qs("#tHtml").addEventListener("click", () => send("html"));
  qs("#tMd").addEventListener("click", () => send("markdown"));
  qs("#cleanCopy").addEventListener("click", () => send("clean_copy"));
  qs("#copyWithSource").addEventListener("click", () =>
    send("copy_with_source")
  );
  qs("#extractLinksEnhanced").addEventListener("click", () =>
    send("extract_links_enhanced")
  );
  qs("#tableExportEnhanced").addEventListener("click", () =>
    send("table_export_enhanced")
  );
  qs("#jsonFormat").addEventListener("click", () => send("json_format"));
  qs("#codeSyntax").addEventListener("click", () => send("code_syntax"));
  qs("#textStatistics").addEventListener("click", () => send("text_statistics"));
  qs("#base64Encode").addEventListener("click", () => send("base64_encode"));
  qs("#base64Decode").addEventListener("click", () => send("base64_decode"));
  qs("#colorPicker").addEventListener("click", () => send("color_picker"));
  qs("#imgCopy").addEventListener("click", () => send("image_clip"));
  qs("#imgSave").addEventListener("click", () => send("image_save"));

  // Text & Formatting buttons
  qs("#caseUppercase").addEventListener("click", () => send("case_uppercase"));
  qs("#caseLowercase").addEventListener("click", () => send("case_lowercase"));
  qs("#caseTitlecase").addEventListener("click", () => send("case_titlecase"));
  qs("#smartTitleCase").addEventListener("click", () =>
    send("smart_title_case")
  );
  qs("#caseCamelcase").addEventListener("click", () => send("case_camelcase"));
  qs("#caseSnakecase").addEventListener("click", () => send("case_snakecase"));
  qs("#caseKebabcase").addEventListener("click", () => send("case_kebabcase"));
  qs("#casePascalcase").addEventListener("click", () =>
    send("case_pascalcase")
  );
  qs("#slugify").addEventListener("click", () => send("slugify"));
  qs("#unicodeFix").addEventListener("click", () => send("unicode_fix"));

  // Content Helpers buttons
  qs("#metaOgScraper").addEventListener("click", () => send("meta_og_scraper"));
  qs("#imageDownloader").addEventListener("click", () =>
    send("image_downloader")
  );
  qs("#contrastChecker").addEventListener("click", () =>
    send("contrast_checker")
  );
  qs("#colorPalette").addEventListener("click", () => send("color_palette"));

  // Productivity buttons
  qs("#openClipboardHistory").addEventListener("click", () => {
    // This will open a modal or new tab with enhanced history
    chrome.tabs.create({ url: chrome.runtime.getURL("history.html") });
  });

  qs("#openSnippetsLibrary").addEventListener("click", () => {
    // This will open a modal or new tab with snippets
    chrome.tabs.create({ url: chrome.runtime.getURL("snippets.html") });
  });

  qs("#openQuickNotes").addEventListener("click", () => {
    // This will open a modal or new tab with quick notes
    chrome.tabs.create({ url: chrome.runtime.getURL("quick-notes.html") });
  });

  qs("#manageSiteRules").addEventListener("click", () => {
    // This will open a modal for site rules
    chrome.tabs.create({ url: chrome.runtime.getURL("site-rules.html") });
  });

  qs("#setFileNamePattern").addEventListener("click", async () => {
    const pattern = prompt(
      "Enter filename pattern (e.g., {title:slug}-{date:YYYYMMDD}-{w}x{h}.{ext}):",
      "{title:slug}-{date:YYYYMMDD}-{time:HHmmss}-{w}x{h}.{ext}"
    );
    if (pattern) {
      try {
        await chrome.storage.local.set({ filenamePattern: pattern });
        toast("Filename pattern updated");
      } catch (error) {
        console.error("Failed to save filename pattern:", error);
        toast("Failed to save pattern");
      }
    }
  });

  qs("#saveAsSnippet").addEventListener("click", () => send("save_as_snippet"));
  qs("#applySiteRules").addEventListener("click", () =>
    send("apply_site_rules")
  );

  qs("#encryptionSettings").addEventListener("click", async () => {
    const password = prompt("Enter encryption password (leave empty to disable):");
    if (password !== null) {
      try {
        const response = await chrome.runtime.sendMessage({
          type: "OCCS_SET_ENCRYPTION_KEY",
          key: password
        });
        if (response.ok) {
          toast(password ? "Encryption enabled" : "Encryption disabled");
        } else {
          toast("Failed to set encryption key");
        }
      } catch (error) {
        console.error("Failed to set encryption key:", error);
        toast("Failed to set encryption key");
      }
    }
  });

  qs("#viewErrorLogs").addEventListener("click", async () => {
    try {
      const { errorLogs = [] } = await chrome.storage.local.get({ errorLogs: [] });
      
      if (errorLogs.length === 0) {
        toast("No error logs found");
        return;
      }
      
      // Create error log viewer modal
      const modal = document.createElement("div");
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
      `;
      
      const content = document.createElement("div");
      content.style.cssText = `
        background: var(--card);
        border: 1px solid var(--line);
        border-radius: 12px;
        padding: 20px;
        max-width: 80%;
        max-height: 80%;
        overflow: auto;
        color: var(--ink);
      `;
      
      const header = document.createElement("div");
      header.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        padding-bottom: 15px;
        border-bottom: 1px solid var(--line);
      `;
      
      const title = document.createElement("h3");
      title.style.cssText = "margin: 0; font-size: 18px; font-weight: 600;";
      title.textContent = `Error Logs (${errorLogs.length})`;
      
      const closeBtn = document.createElement("button");
      closeBtn.style.cssText = `
        background: none;
        border: none;
        color: var(--ink);
        font-size: 24px;
        cursor: pointer;
        padding: 0;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
      `;
      closeBtn.textContent = "×";
      closeBtn.onclick = () => modal.remove();
      
      header.appendChild(title);
      header.appendChild(closeBtn);
      
      const logList = document.createElement("div");
      logList.style.cssText = "display: flex; flex-direction: column; gap: 10px;";
      
      errorLogs.slice(0, 20).forEach((log, index) => {
        const logItem = document.createElement("div");
        logItem.style.cssText = `
          background: var(--bg);
          border: 1px solid var(--line);
          border-radius: 8px;
          padding: 12px;
          font-size: 12px;
        `;
        
        const time = new Date(log.timestamp).toLocaleString();
        const type = log.type.toUpperCase();
        
        logItem.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="color: var(--accent); font-weight: 600;">${type}</span>
            <span style="color: var(--muted);">${time}</span>
          </div>
          <div style="color: var(--ink); margin-bottom: 4px;">${log.message}</div>
          <div style="color: var(--muted); font-size: 11px;">${log.context ? `Context: ${log.context}` : ''}</div>
        `;
        
        logList.appendChild(logItem);
      });
      
      content.appendChild(header);
      content.appendChild(logList);
      modal.appendChild(content);
      document.body.appendChild(modal);
      
      // Close on background click
      modal.addEventListener("click", (e) => {
        if (e.target === modal) modal.remove();
      });
      
    } catch (error) {
      console.error("Failed to view error logs:", error);
      toast("Failed to load error logs");
    }
  });

  // Help button
  qs("#helpBtn").addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("help.html") });
  });

  // Request Feature button
  qs("#requestFeatureBtn").addEventListener("click", () => {
    chrome.tabs.create({ url: "https://forms.fillout.com/t/2QMi7uSS59us" });
  });

  qs("#clear").addEventListener("click", async () => {
    await chrome.storage.local.set({ history: [] });
    await refreshHistory();
  });
  await refreshHistory();
});

// Check online status and show indicator
async function checkOnlineStatus() {
  try {
    const response = await chrome.runtime.sendMessage({
      type: "OCCS_CHECK_ONLINE_STATUS"
    });
    
    const offlineIndicator = qs("#offlineIndicator");
    if (response.ok && !response.online) {
      offlineIndicator.style.display = "block";
    } else {
      offlineIndicator.style.display = "none";
    }
  } catch (error) {
    console.warn("Failed to check online status:", error);
  }
}

// Customizable Layout Functions
async function getLayoutSettings() {
  const { layoutSettings = {} } = await chrome.storage.local.get({ layoutSettings: {} });
  return layoutSettings;
}

async function saveLayoutSettings(settings) {
  await chrome.storage.local.set({ layoutSettings: settings });
}

async function initializeCustomizableLayout() {
  try {
    const settings = await getLayoutSettings();
    
    // Add edit mode toggle button
    const editModeBtn = document.createElement("button");
    editModeBtn.id = "editLayoutBtn";
    editModeBtn.className = "btn";
    editModeBtn.textContent = "✏️ Edit Layout";
    editModeBtn.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      z-index: 1000;
      font-size: 11px;
      padding: 4px 8px;
    `;
    
    editModeBtn.addEventListener("click", toggleEditMode);
    document.body.appendChild(editModeBtn);
    
    // Apply saved layout if exists
    if (settings.buttonOrder) {
      applyButtonOrder(settings.buttonOrder);
    }
    
    // Apply saved grid settings
    if (settings.gridColumns) {
      applyGridSettings(settings.gridColumns);
    }
    
  } catch (error) {
    console.warn("Failed to initialize customizable layout:", error);
  }
}

function toggleEditMode() {
  const editBtn = qs("#editLayoutBtn");
  const isEditMode = editBtn.textContent.includes("Save");
  
  if (isEditMode) {
    // Save layout
    saveCurrentLayout();
    editBtn.textContent = "✏️ Edit Layout";
    disableDragAndDrop();
    toast("Layout saved!");
  } else {
    // Enter edit mode
    editBtn.textContent = "💾 Save Layout";
    enableDragAndDrop();
    toast("Drag buttons to rearrange them");
  }
}

function enableDragAndDrop() {
  const buttons = document.querySelectorAll('.btn');
  buttons.forEach(button => {
    button.draggable = true;
    button.style.cursor = 'move';
    button.style.opacity = '0.8';
    
    button.addEventListener('dragstart', handleDragStart);
    button.addEventListener('dragover', handleDragOver);
    button.addEventListener('drop', handleDrop);
    button.addEventListener('dragend', handleDragEnd);
  });
}

function disableDragAndDrop() {
  const buttons = document.querySelectorAll('.btn');
  buttons.forEach(button => {
    button.draggable = false;
    button.style.cursor = 'pointer';
    button.style.opacity = '1';
    
    button.removeEventListener('dragstart', handleDragStart);
    button.removeEventListener('dragover', handleDragOver);
    button.removeEventListener('drop', handleDrop);
    button.removeEventListener('dragend', handleDragEnd);
  });
}

let draggedElement = null;

function handleDragStart(e) {
  draggedElement = e.target;
  e.target.style.opacity = '0.5';
}

function handleDragOver(e) {
  e.preventDefault();
}

function handleDrop(e) {
  e.preventDefault();
  if (draggedElement && e.target !== draggedElement) {
    // Swap elements
    const parent = e.target.parentNode;
    const draggedIndex = Array.from(parent.children).indexOf(draggedElement);
    const targetIndex = Array.from(parent.children).indexOf(e.target);
    
    if (draggedIndex < targetIndex) {
      parent.insertBefore(draggedElement, e.target.nextSibling);
    } else {
      parent.insertBefore(draggedElement, e.target);
    }
  }
}

function handleDragEnd(e) {
  e.target.style.opacity = '0.8';
  draggedElement = null;
}

async function saveCurrentLayout() {
  try {
    const buttonOrder = [];
    const grids = document.querySelectorAll('.grid');
    
    grids.forEach(grid => {
      const buttons = Array.from(grid.children).map(btn => btn.id);
      buttonOrder.push(buttons);
    });
    
    const settings = {
      buttonOrder,
      gridColumns: getGridColumns(),
      lastUpdated: Date.now()
    };
    
    await saveLayoutSettings(settings);
  } catch (error) {
    console.error("Failed to save layout:", error);
    toast("Failed to save layout");
  }
}

function applyButtonOrder(buttonOrder) {
  buttonOrder.forEach((buttonIds, gridIndex) => {
    const grid = document.querySelectorAll('.grid')[gridIndex];
    if (!grid) return;
    
    const buttons = Array.from(grid.children);
    const buttonMap = {};
    
    buttons.forEach(btn => {
      buttonMap[btn.id] = btn;
    });
    
    // Clear grid
    grid.innerHTML = '';
    
    // Add buttons in saved order
    buttonIds.forEach(id => {
      if (buttonMap[id]) {
        grid.appendChild(buttonMap[id]);
      }
    });
  });
}

function getGridColumns() {
  const grids = document.querySelectorAll('.grid');
  const columns = [];
  
  grids.forEach(grid => {
    const computedStyle = window.getComputedStyle(grid);
    const gridTemplateColumns = computedStyle.gridTemplateColumns;
    columns.push(gridTemplateColumns);
  });
  
  return columns;
}

function applyGridSettings(columns) {
  const grids = document.querySelectorAll('.grid');
  
  grids.forEach((grid, index) => {
    if (columns[index]) {
      grid.style.gridTemplateColumns = columns[index];
    }
  });
}

// Accessibility Features
function initializeAccessibility() {
  // Add ARIA labels and roles
  const buttons = document.querySelectorAll('.btn');
  buttons.forEach(button => {
    if (!button.getAttribute('aria-label')) {
      button.setAttribute('aria-label', button.textContent);
    }
    button.setAttribute('role', 'button');
  });
  
  // Add focus indicators
  const style = document.createElement('style');
  style.textContent = `
    .btn:focus {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
    
    .btn:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
    
    .search-input:focus {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
    
    /* High contrast mode support */
    @media (prefers-contrast: high) {
      .btn {
        border: 2px solid currentColor;
      }
    }
    
    /* Reduced motion support */
    @media (prefers-reduced-motion: reduce) {
      * {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
    }
  `;
  document.head.appendChild(style);
  
  // Add skip links
  const skipLink = document.createElement('a');
  skipLink.href = '#main-content';
  skipLink.textContent = 'Skip to main content';
  skipLink.style.cssText = `
    position: absolute;
    top: -40px;
    left: 6px;
    background: var(--accent);
    color: white;
    padding: 8px;
    text-decoration: none;
    border-radius: 4px;
    z-index: 1000;
    transition: top 0.3s;
  `;
  
  skipLink.addEventListener('focus', () => {
    skipLink.style.top = '6px';
  });
  
  skipLink.addEventListener('blur', () => {
    skipLink.style.top = '-40px';
  });
  
  document.body.insertBefore(skipLink, document.body.firstChild);
  
  // Add main content landmark
  const mainContent = document.querySelector('.wrap');
  if (mainContent) {
    mainContent.id = 'main-content';
    mainContent.setAttribute('role', 'main');
  }
}

// Keyboard Shortcuts
function initializeKeyboardShortcuts() {
  const shortcuts = {
    '1': () => qs("#tText")?.click(),
    '2': () => qs("#tHtml")?.click(),
    '3': () => qs("#tMd")?.click(),
    '4': () => qs("#cleanCopy")?.click(),
    '5': () => qs("#textStatistics")?.click(),
    '6': () => qs("#base64Encode")?.click(),
    '7': () => qs("#colorPicker")?.click(),
    '8': () => qs("#openClipboardHistory")?.click(),
    '9': () => qs("#openQuickNotes")?.click(),
    '0': () => qs("#openSnippetsLibrary")?.click(),
    'h': () => qs("#helpBtn")?.click(),
    'e': () => qs("#editLayoutBtn")?.click(),
    'Escape': () => {
      // Close any open modals or menus
      const modals = document.querySelectorAll('.modal');
      modals.forEach(modal => modal.remove());
    }
  };
  
  document.addEventListener('keydown', (e) => {
    // Don't trigger shortcuts when typing in inputs
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      return;
    }
    
    const key = e.key;
    if (shortcuts[key]) {
      e.preventDefault();
      shortcuts[key]();
    }
  });
  
  // Add keyboard shortcut hints
  addKeyboardShortcutHints();
}

function addKeyboardShortcutHints() {
  const shortcuts = {
    '#tText': '1',
    '#tHtml': '2', 
    '#tMd': '3',
    '#cleanCopy': '4',
    '#textStatistics': '5',
    '#base64Encode': '6',
    '#colorPicker': '7',
    '#openClipboardHistory': '8',
    '#openQuickNotes': '9',
    '#openSnippetsLibrary': '0',
    '#helpBtn': 'H',
    '#editLayoutBtn': 'E'
  };
  
  Object.entries(shortcuts).forEach(([selector, key]) => {
    const element = qs(selector);
    if (element) {
      const title = element.getAttribute('title') || element.textContent;
      element.setAttribute('title', `${title} (${key})`);
      
      // Only add tooltip, no visual indicators
    }
  });
}

// Enhanced Toast with Accessibility
function createAccessibleToast(message, type = 'info') {
  const toast = document.createElement("div");
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'polite');
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: ${type === 'error' ? '#f56565' : type === 'success' ? '#48bb78' : 'var(--accent, #007bff)'};
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    z-index: 10001;
    font-size: 14px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    max-width: 300px;
    word-wrap: break-word;
  `;
  toast.textContent = message;
  
  document.body.appendChild(toast);
  
  // Auto-remove after 3 seconds
  setTimeout(() => {
    toast.remove();
  }, 3000);
  
  return toast;
}

// Replace existing toast function
window.toast = createAccessibleToast;
