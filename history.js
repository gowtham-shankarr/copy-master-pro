// Clipboard History Page JavaScript
const qs = (selector) => document.querySelector(selector);
const qsa = (selector) => document.querySelectorAll(selector);

// Custom delete dialog function
function showDeleteDialog(message, onConfirm) {
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
    background: #1a1f3a;
    border: 1px solid #2d3748;
    border-radius: 12px;
    padding: 24px;
    max-width: 400px;
    width: 90%;
    color: #e2e8f0;
    box-shadow: 0 10px 25px rgba(0,0,0,0.5);
  `;

  const icon = document.createElement("div");
  icon.style.cssText = `
    width: 48px;
    height: 48px;
    background: #f56565;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 16px;
    font-size: 24px;
  `;
  icon.textContent = "🗑️";

  const title = document.createElement("h3");
  title.style.cssText = `
    margin: 0 0 12px 0;
    font-size: 18px;
    font-weight: 600;
    text-align: center;
    color: #e2e8f0;
  `;
  title.textContent = "Confirm Delete";

  const messageEl = document.createElement("p");
  messageEl.style.cssText = `
    margin: 0 0 24px 0;
    font-size: 14px;
    line-height: 1.5;
    text-align: center;
    color: #a0aec0;
  `;
  messageEl.textContent = message;

  const buttons = document.createElement("div");
  buttons.style.cssText = `
    display: flex;
    gap: 12px;
    justify-content: center;
  `;

  const cancelBtn = document.createElement("button");
  cancelBtn.style.cssText = `
    background: #4a5568;
    color: #e2e8f0;
    border: none;
    border-radius: 8px;
    padding: 10px 20px;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;
    font-weight: 500;
  `;
  cancelBtn.textContent = "Cancel";
  cancelBtn.onclick = () => modal.remove();

  const deleteBtn = document.createElement("button");
  deleteBtn.style.cssText = `
    background: #f56565;
    color: white;
    border: none;
    border-radius: 8px;
    padding: 10px 20px;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;
    font-weight: 500;
  `;
  deleteBtn.textContent = "Delete";
  deleteBtn.onclick = () => {
    modal.remove();
    onConfirm();
  };

  // Add hover effects
  cancelBtn.addEventListener("mouseenter", () => {
    cancelBtn.style.background = "#2d3748";
  });
  cancelBtn.addEventListener("mouseleave", () => {
    cancelBtn.style.background = "#4a5568";
  });

  deleteBtn.addEventListener("mouseenter", () => {
    deleteBtn.style.background = "#e53e3e";
  });
  deleteBtn.addEventListener("mouseleave", () => {
    deleteBtn.style.background = "#f56565";
  });

  buttons.appendChild(cancelBtn);
  buttons.appendChild(deleteBtn);

  content.appendChild(icon);
  content.appendChild(title);
  content.appendChild(messageEl);
  content.appendChild(buttons);
  modal.appendChild(content);
  document.body.appendChild(modal);

  // Close on background click
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.remove();
  });

  // Close on Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") modal.remove();
  });
}

// Toast function for history page
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

let allHistory = [];
let filteredHistory = [];
let currentPage = 0;
const ITEMS_PER_PAGE = 20;
let isLoading = false;

// Initialize the page
document.addEventListener("DOMContentLoaded", async () => {
  await loadHistory();
  setupEventListeners();
  setupInfiniteScroll();
  renderHistory();
});

// Load history from storage
async function loadHistory() {
  try {
    const { history = [] } = await chrome.storage.local.get({ history: [] });
    allHistory = history;
    filteredHistory = [...allHistory];
  } catch (error) {
    console.error("Failed to load history:", error);
    allHistory = [];
    filteredHistory = [];
  }
}

// Setup event listeners
function setupEventListeners() {
  // Enhanced search functionality
  const searchInput = qs("#searchInput");
  let suggestionsContainer = null;
  
  searchInput.addEventListener("input", (e) => {
    const searchTerm = e.target.value;
    
    // Remove existing suggestions
    if (suggestionsContainer) {
      suggestionsContainer.remove();
      suggestionsContainer = null;
    }
    
    // Show suggestions for longer search terms
    if (searchTerm.length >= 2) {
      const suggestions = getSearchSuggestions(searchTerm);
      if (suggestions.length > 0) {
        suggestionsContainer = createSearchSuggestions(suggestions);
        searchInput.parentNode.style.position = 'relative';
        searchInput.parentNode.appendChild(suggestionsContainer);
        suggestionsContainer.style.display = 'block';
      }
    }
    
    filterHistory();
  });
  
  // Hide suggestions when clicking outside
  document.addEventListener('click', (e) => {
    if (suggestionsContainer && !searchInput.contains(e.target) && !suggestionsContainer.contains(e.target)) {
      suggestionsContainer.style.display = 'none';
    }
  });
  
  // Keyboard navigation for suggestions
  searchInput.addEventListener('keydown', (e) => {
    if (suggestionsContainer && suggestionsContainer.style.display !== 'none') {
      const items = suggestionsContainer.querySelectorAll('div');
      const currentIndex = Array.from(items).findIndex(item => item.style.background === 'var(--primary1)');
      
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
        items.forEach((item, index) => {
          item.style.background = index === nextIndex ? 'var(--primary1)' : 'transparent';
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
        items.forEach((item, index) => {
          item.style.background = index === prevIndex ? 'var(--primary1)' : 'transparent';
        });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selectedItem = items[currentIndex];
        if (selectedItem) {
          searchInput.value = selectedItem.textContent;
          filterHistory();
          suggestionsContainer.style.display = 'none';
        }
      } else if (e.key === 'Escape') {
        suggestionsContainer.style.display = 'none';
      }
    }
  });

  // Filter by type
  qs("#filterSelect").addEventListener("change", (e) => {
    filterHistory();
  });

  // Clear all history
  qs("#clearBtn").addEventListener("click", async () => {
    showDeleteDialog(
      "Are you sure you want to clear all history? This cannot be undone.",
      async () => {
        await chrome.storage.local.set({ history: [] });
        allHistory = [];
        filteredHistory = [];
        renderHistory();
        toast("All history cleared");
      }
    );
  });

  // Export history
  qs("#exportBtn").addEventListener("click", exportHistory);

  // Help button
  qs("#helpBtn").addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("help.html") });
  });

  // Request Feature button
  qs("#requestFeatureBtn").addEventListener("click", () => {
    chrome.tabs.create({ url: "https://forms.fillout.com/t/2QMi7uSS59us" });
  });

  // Event delegation for dynamically created elements
  qs("#historyGrid").addEventListener("click", (e) => {
    const target = e.target;

    // Handle source URL clicks
    if (target.classList.contains("item-source")) {
      const url = target.dataset.url;
      if (url) openSource(url);
    }

    // Handle copy button clicks
    if (target.classList.contains("copy-btn")) {
      const id = target.dataset.id;
      if (id) copyItem(id);
    }

    // Handle view button clicks
    if (target.classList.contains("view-btn")) {
      const id = target.dataset.id;
      if (id) viewFull(id);
    }

    // Handle delete button clicks
    if (target.classList.contains("delete-btn")) {
      const id = target.dataset.id;
      if (id) deleteItem(id);
    }
  });
}

// Setup infinite scroll
function setupInfiniteScroll() {
  const grid = qs("#historyGrid");
  
  // Add loading indicator
  const loadingIndicator = document.createElement("div");
  loadingIndicator.id = "loadingIndicator";
  loadingIndicator.style.cssText = `
    grid-column: 1 / -1;
    text-align: center;
    padding: 20px;
    color: var(--muted);
    display: none;
  `;
  loadingIndicator.innerHTML = `
    <div style="display: inline-block; width: 20px; height: 20px; border: 2px solid var(--line); border-top: 2px solid var(--accent); border-radius: 50%; animation: spin 1s linear infinite;"></div>
    <span style="margin-left: 10px;">Loading more items...</span>
  `;
  grid.appendChild(loadingIndicator);

  // Add CSS animation
  const style = document.createElement("style");
  style.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);

  // Intersection Observer for infinite scroll
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !isLoading && hasMoreItems()) {
        loadMoreItems();
      }
    });
  }, {
    root: null,
    rootMargin: '100px',
    threshold: 0.1
  });

  observer.observe(loadingIndicator);
}

// Check if there are more items to load
function hasMoreItems() {
  const startIndex = currentPage * ITEMS_PER_PAGE;
  return startIndex < filteredHistory.length;
}

// Load more items
async function loadMoreItems() {
  if (isLoading) return;
  
  isLoading = true;
  const loadingIndicator = qs("#loadingIndicator");
  loadingIndicator.style.display = "block";
  
  // Simulate loading delay for better UX
  await new Promise(resolve => setTimeout(resolve, 300));
  
  currentPage++;
  renderHistory();
  
  loadingIndicator.style.display = "none";
  isLoading = false;
}

// Enhanced search functionality
function highlightSearchTerm(text, searchTerm) {
  if (!searchTerm) return text;
  
  const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.replace(regex, '<mark style="background: #fef08a; color: #92400e; padding: 1px 2px; border-radius: 2px;">$1</mark>');
}

function getSearchSuggestions(searchTerm) {
  if (!searchTerm || searchTerm.length < 2) return [];
  
  const suggestions = new Set();
  
  allHistory.forEach(item => {
    // Extract words from preview and data
    const text = `${item.preview} ${item.data}`.toLowerCase();
    const words = text.split(/\s+/).filter(word => 
      word.length > 2 && word.includes(searchTerm.toLowerCase())
    );
    
    words.forEach(word => suggestions.add(word));
  });
  
  return Array.from(suggestions).slice(0, 5);
}

function createSearchSuggestions(suggestions) {
  const container = document.createElement("div");
  container.id = "searchSuggestions";
  container.style.cssText = `
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: var(--card);
    border: 1px solid var(--line);
    border-top: none;
    border-radius: 0 0 8px 8px;
    max-height: 200px;
    overflow-y: auto;
    z-index: 1000;
    display: none;
  `;
  
  suggestions.forEach(suggestion => {
    const item = document.createElement("div");
    item.style.cssText = `
      padding: 8px 12px;
      cursor: pointer;
      border-bottom: 1px solid var(--line);
      font-size: 12px;
    `;
    item.textContent = suggestion;
    
    item.addEventListener('click', () => {
      qs("#searchInput").value = suggestion;
      filterHistory();
      container.style.display = 'none';
    });
    
    item.addEventListener('mouseenter', () => {
      item.style.background = 'var(--primary1)';
    });
    
    item.addEventListener('mouseleave', () => {
      item.style.background = 'transparent';
    });
    
    container.appendChild(item);
  });
  
  return container;
}

// Filter history based on search and type
function filterHistory() {
  const searchTerm = qs("#searchInput").value.toLowerCase();
  const filterType = qs("#filterSelect").value;

  filteredHistory = allHistory.filter((item) => {
    // Enhanced search filter
    let matchesSearch = false;
    
    if (!searchTerm) {
      matchesSearch = true;
    } else {
      // Search in multiple fields
      const searchFields = [
        item.preview,
        item.data,
        item.kind,
        item.src,
        new Date(item.ts).toLocaleDateString()
      ];
      
      matchesSearch = searchFields.some(field => 
        field && field.toString().toLowerCase().includes(searchTerm)
      );
      
      // Fuzzy search for typos
      if (!matchesSearch && searchTerm.length > 3) {
        matchesSearch = searchFields.some(field => {
          if (!field) return false;
          const fieldStr = field.toString().toLowerCase();
          return levenshteinDistance(searchTerm, fieldStr) <= 2;
        });
      }
    }

    // Type filter
    const matchesType = !filterType || item.kind === filterType;

    return matchesSearch && matchesType;
  });

  // Reset pagination when filtering
  currentPage = 0;
  renderHistory();
}

// Levenshtein distance for fuzzy search
function levenshteinDistance(str1, str2) {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

// Render history items with pagination
function renderHistory() {
  const grid = qs("#historyGrid");
  const emptyState = qs("#emptyState");
  const loadingIndicator = qs("#loadingIndicator");

  // Update counts
  qs("#totalCount").textContent = allHistory.length;
  qs("#filteredCount").textContent = filteredHistory.length;

  if (filteredHistory.length === 0) {
    grid.innerHTML = "";
    emptyState.style.display = "block";
    return;
  }

  emptyState.style.display = "none";

  // Calculate items to show
  const startIndex = 0;
  const endIndex = (currentPage + 1) * ITEMS_PER_PAGE;
  const itemsToShow = filteredHistory.slice(startIndex, endIndex);

  // Clear existing items (except loading indicator)
  const existingItems = grid.querySelectorAll('.history-item');
  existingItems.forEach(item => item.remove());

  // Add new items
  const itemsHTML = itemsToShow
    .map(
      (item) => `
    <div class="history-item" data-id="${item.ts}">
      <div class="item-header">
        <span class="item-kind">${item.kind}</span>
        <span class="item-time">${formatTime(item.ts)}</span>
      </div>
      <div class="item-preview">${highlightSearchTerm(escapeHtml(item.preview), qs("#searchInput").value)}</div>
      <div class="item-source" data-url="${item.src}">${
        new URL(item.src).hostname
      }</div>
      <div class="item-actions">
        <button class="action-btn copy-btn" data-id="${item.ts}">Copy</button>
        <button class="action-btn view-btn" data-id="${
          item.ts
        }">View Full</button>
        <button class="action-btn delete-btn" data-id="${
          item.ts
        }">Delete</button>
      </div>
    </div>
  `
    )
    .join("");

  // Insert items before loading indicator
  if (loadingIndicator) {
    loadingIndicator.insertAdjacentHTML('beforebegin', itemsHTML);
  } else {
    grid.insertAdjacentHTML('beforeend', itemsHTML);
  }

  // Show/hide loading indicator
  if (loadingIndicator) {
    loadingIndicator.style.display = hasMoreItems() ? "block" : "none";
  }
}

// Copy item to clipboard
async function copyItem(timestamp) {
  const item = allHistory.find((h) => h.ts.toString() === timestamp);
  if (!item) return;

  try {
    let data = item.data;
    
    // Handle encrypted data
    if (typeof data === 'object' && data.encrypted) {
      const password = prompt("Enter password to decrypt this item:");
      if (!password) {
        toast("Password required to decrypt");
        return;
      }
      
      const response = await chrome.runtime.sendMessage({
        type: "OCCS_DECRYPT_DATA",
        data: data,
        password: password
      });
      
      if (response.ok) {
        data = response.data;
      } else {
        throw new Error(response.error || "Failed to decrypt data");
      }
    }
    // Decompress data if it's compressed
    else if (typeof data === 'object' && data.compressed) {
      const response = await chrome.runtime.sendMessage({
        type: "OCCS_DECOMPRESS_DATA",
        data: data
      });
      
      if (response.ok) {
        data = response.data;
      } else {
        throw new Error("Failed to decompress data");
      }
    }
    
    await navigator.clipboard.writeText(data);
    toast("Copied to clipboard!");
  } catch (error) {
    console.error("Failed to copy:", error);
    toast("Failed to copy: " + error.message);
  }
}

// View full item content
async function viewFull(timestamp) {
  const item = allHistory.find((h) => h.ts.toString() === timestamp);
  if (!item) return;

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

  // Show loading state
  content.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
      <h3 style="margin: 0;">${item.kind}</h3>
      <button class="modal-close" style="background: none; border: none; color: var(--ink); font-size: 20px; cursor: pointer;">×</button>
    </div>
    <div style="margin-bottom: 15px; color: var(--muted); font-size: 12px;">
      ${formatTime(item.ts)} • ${new URL(item.src).hostname}
    </div>
    <div style="text-align: center; padding: 20px;">
      <div style="display: inline-block; width: 20px; height: 20px; border: 2px solid var(--line); border-top: 2px solid var(--accent); border-radius: 50%; animation: spin 1s linear infinite;"></div>
      <span style="margin-left: 10px;">Loading content...</span>
    </div>
  `;

  modal.appendChild(content);
  modal.classList.add("modal");
  document.body.appendChild(modal);

  // Add event listener for modal close button
  modal.querySelector(".modal-close").addEventListener("click", () => {
    modal.remove();
  });

  // Close on background click
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.remove();
  });

  // Load and display content
  try {
    let data = item.data;
    
    // Handle encrypted data
    if (typeof data === 'object' && data.encrypted) {
      const password = prompt("Enter password to decrypt this item:");
      if (!password) {
        const errorDiv = document.createElement("div");
        errorDiv.style.cssText = "text-align: center; padding: 20px; color: #f56565;";
        errorDiv.textContent = "Password required to decrypt";
        
        const loadingDiv = content.querySelector('div[style*="text-align: center"]');
        loadingDiv.parentNode.replaceChild(errorDiv, loadingDiv);
        return;
      }
      
      const response = await chrome.runtime.sendMessage({
        type: "OCCS_DECRYPT_DATA",
        data: data,
        password: password
      });
      
      if (response.ok) {
        data = response.data;
      } else {
        throw new Error(response.error || "Failed to decrypt data");
      }
    }
    // Decompress data if it's compressed
    else if (typeof data === 'object' && data.compressed) {
      const response = await chrome.runtime.sendMessage({
        type: "OCCS_DECOMPRESS_DATA",
        data: data
      });
      
      if (response.ok) {
        data = response.data;
      } else {
        throw new Error("Failed to decompress data");
      }
    }
    
    // Update content with actual data
    const preElement = document.createElement("pre");
    preElement.style.cssText = "background: #1a1f3a; padding: 15px; border-radius: 8px; overflow-x: auto; white-space: pre-wrap; word-break: break-word;";
    preElement.textContent = data;
    
    // Replace loading content
    const loadingDiv = content.querySelector('div[style*="text-align: center"]');
    loadingDiv.parentNode.replaceChild(preElement, loadingDiv);
    
  } catch (error) {
    console.error("Failed to load content:", error);
    const errorDiv = document.createElement("div");
    errorDiv.style.cssText = "text-align: center; padding: 20px; color: #f56565;";
    errorDiv.textContent = "Failed to load content: " + error.message;
    
    const loadingDiv = content.querySelector('div[style*="text-align: center"]');
    loadingDiv.parentNode.replaceChild(errorDiv, loadingDiv);
  }
}

// Delete item
async function deleteItem(timestamp) {
  showDeleteDialog("Delete this item?", () => {
    allHistory = allHistory.filter((h) => h.ts.toString() !== timestamp);
    chrome.storage.local.set({ history: allHistory });
    filterHistory();
    toast("Item deleted");
  });
}

// Open source URL
function openSource(url) {
  chrome.tabs.create({ url });
}

// Export history
async function exportHistory() {
  const data = {
    exportDate: new Date().toISOString(),
    totalItems: allHistory.length,
    items: allHistory,
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `clipboard-history-${
    new Date().toISOString().split("T")[0]
  }.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  toast("History exported!");
}

// Utility functions
function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;

  return date.toLocaleDateString();
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Add CSS animations
const style = document.createElement("style");
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
  }
`;
document.head.appendChild(style);
