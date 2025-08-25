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

// Initialize the page
document.addEventListener("DOMContentLoaded", async () => {
  await loadHistory();
  setupEventListeners();
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
  // Search functionality
  qs("#searchInput").addEventListener("input", (e) => {
    filterHistory();
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

// Filter history based on search and type
function filterHistory() {
  const searchTerm = qs("#searchInput").value.toLowerCase();
  const filterType = qs("#filterSelect").value;

  filteredHistory = allHistory.filter((item) => {
    // Search filter
    const matchesSearch =
      !searchTerm ||
      item.preview.toLowerCase().includes(searchTerm) ||
      item.data.toLowerCase().includes(searchTerm) ||
      item.kind.toLowerCase().includes(searchTerm);

    // Type filter
    const matchesType = !filterType || item.kind === filterType;

    return matchesSearch && matchesType;
  });

  renderHistory();
}

// Render history items
function renderHistory() {
  const grid = qs("#historyGrid");
  const emptyState = qs("#emptyState");

  // Update counts
  qs("#totalCount").textContent = allHistory.length;
  qs("#filteredCount").textContent = filteredHistory.length;

  if (filteredHistory.length === 0) {
    grid.innerHTML = "";
    emptyState.style.display = "block";
    return;
  }

  emptyState.style.display = "none";

  grid.innerHTML = filteredHistory
    .map(
      (item) => `
    <div class="history-item" data-id="${item.ts}">
      <div class="item-header">
        <span class="item-kind">${item.kind}</span>
        <span class="item-time">${formatTime(item.ts)}</span>
      </div>
      <div class="item-preview">${escapeHtml(item.preview)}</div>
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
}

// Copy item to clipboard
async function copyItem(timestamp) {
  const item = allHistory.find((h) => h.ts.toString() === timestamp);
  if (!item) return;

  try {
    await navigator.clipboard.writeText(item.data);
    toast("Copied to clipboard!");
  } catch (error) {
    console.error("Failed to copy:", error);
    toast("Failed to copy");
  }
}

// View full item content
function viewFull(timestamp) {
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

  content.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
      <h3 style="margin: 0;">${item.kind}</h3>
              <button class="modal-close" style="background: none; border: none; color: var(--ink); font-size: 20px; cursor: pointer;">×</button>
    </div>
    <div style="margin-bottom: 15px; color: var(--muted); font-size: 12px;">
      ${formatTime(item.ts)} • ${new URL(item.src).hostname}
    </div>
    <pre style="background: #1a1f3a; padding: 15px; border-radius: 8px; overflow-x: auto; white-space: pre-wrap; word-break: break-word;">${escapeHtml(
      item.data
    )}</pre>
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
