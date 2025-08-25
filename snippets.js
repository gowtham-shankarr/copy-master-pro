// Snippets Library Page JavaScript
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

// Toast function for snippets page
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

let allSnippets = [];
let filteredSnippets = [];
let selectedTags = [];

// Initialize the page
document.addEventListener("DOMContentLoaded", async () => {
  await loadSnippets();
  setupEventListeners();
  renderSnippets();
  renderTagFilter();
});

// Load snippets from storage
async function loadSnippets() {
  try {
    const { snippets = [] } = await chrome.storage.local.get({ snippets: [] });
    allSnippets = snippets;
    filteredSnippets = [...allSnippets];
  } catch (error) {
    console.error("Failed to load snippets:", error);
    allSnippets = [];
    filteredSnippets = [];
  }
}

// Setup event listeners
function setupEventListeners() {
  // Search functionality
  qs("#searchInput").addEventListener("input", (e) => {
    filterSnippets();
  });

  // Add snippet
  qs("#addSnippetBtn").addEventListener("click", () => {
    showSnippetModal();
  });

  // Import snippets
  qs("#importBtn").addEventListener("click", importSnippets);

  // Export snippets
  qs("#exportBtn").addEventListener("click", exportSnippets);

  // Help button
  qs("#helpBtn").addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("help.html") });
  });

  // Request Feature button
  qs("#requestFeatureBtn").addEventListener("click", () => {
    chrome.tabs.create({ url: "https://forms.fillout.com/t/2QMi7uSS59us" });
  });

  // Event delegation for dynamically created elements
  qs("#snippetsGrid").addEventListener("click", (e) => {
    const target = e.target;

    // Handle snippet content expansion
    if (target.classList.contains("snippet-content")) {
      toggleExpand(target);
    }

    // Handle copy snippet button clicks
    if (target.classList.contains("copy-snippet-btn")) {
      const id = target.dataset.id;
      if (id) copySnippet(id);
    }

    // Handle edit snippet button clicks
    if (target.classList.contains("edit-snippet-btn")) {
      const id = target.dataset.id;
      if (id) editSnippet(id);
    }

    // Handle delete snippet button clicks
    if (target.classList.contains("delete-snippet-btn")) {
      const id = target.dataset.id;
      if (id) deleteSnippet(id);
    }
  });

  // Event delegation for tag filter
  qs("#tagFilter").addEventListener("click", (e) => {
    const target = e.target;

    if (target.classList.contains("all-tags-btn")) {
      toggleTagFilter("");
    } else if (target.classList.contains("filter-tag-btn")) {
      const tag = target.dataset.tag;
      if (tag !== undefined) toggleTagFilter(tag);
    }
  });
}

// Filter snippets based on search and tags
function filterSnippets() {
  const searchTerm = qs("#searchInput").value.toLowerCase();

  filteredSnippets = allSnippets.filter((snippet) => {
    // Search filter
    const matchesSearch =
      !searchTerm ||
      snippet.name.toLowerCase().includes(searchTerm) ||
      snippet.content.toLowerCase().includes(searchTerm) ||
      snippet.tags.toLowerCase().includes(searchTerm);

    // Tag filter
    const matchesTags =
      selectedTags.length === 0 ||
      selectedTags.some((tag) =>
        snippet.tags.toLowerCase().includes(tag.toLowerCase())
      );

    return matchesSearch && matchesTags;
  });

  renderSnippets();
}

// Render snippets
function renderSnippets() {
  const grid = qs("#snippetsGrid");
  const emptyState = qs("#emptyState");

  // Update counts
  qs("#totalSnippets").textContent = allSnippets.length;
  qs("#filteredSnippets").textContent = filteredSnippets.length;

  if (filteredSnippets.length === 0) {
    grid.innerHTML = "";
    emptyState.style.display = "block";
    return;
  }

  emptyState.style.display = "none";

  grid.innerHTML = filteredSnippets
    .map(
      (snippet) => `
    <div class="snippet-item" data-id="${snippet.id}">
      <div class="snippet-header">
        <div>
          <div class="snippet-name">${escapeHtml(snippet.name)}</div>
          <div class="snippet-tags">
            ${snippet.tags
              .split(",")
              .map(
                (tag) =>
                  `<span class="snippet-tag">${escapeHtml(tag.trim())}</span>`
              )
              .join("")}
          </div>
        </div>
      </div>
      <div class="snippet-content" data-id="${snippet.id}">
        ${escapeHtml(snippet.content)}
      </div>
      <div class="snippet-meta">
        <span>Created: ${formatTime(snippet.created)}</span>
        <span>Last used: ${formatTime(snippet.lastUsed)}</span>
      </div>
      <div class="snippet-actions">
        <button class="action-btn primary copy-snippet-btn" data-id="${
          snippet.id
        }">Copy</button>
        <button class="action-btn edit-snippet-btn" data-id="${
          snippet.id
        }">Edit</button>
        <button class="action-btn delete-snippet-btn" data-id="${
          snippet.id
        }">Delete</button>
      </div>
    </div>
  `
    )
    .join("");
}

// Render tag filter
function renderTagFilter() {
  const tagFilter = qs("#tagFilter");
  const allTags = new Set();

  allSnippets.forEach((snippet) => {
    snippet.tags.split(",").forEach((tag) => {
      if (tag.trim()) allTags.add(tag.trim());
    });
  });

  tagFilter.innerHTML = `
    <button class="tag-btn all-tags-btn ${
      selectedTags.length === 0 ? "active" : ""
    }" data-tag="">
      All Tags
    </button>
    ${Array.from(allTags)
      .map(
        (tag) => `
      <button class="tag-btn filter-tag-btn ${
        selectedTags.includes(tag) ? "active" : ""
      }" data-tag="${escapeHtml(tag)}">
        ${escapeHtml(tag)}
      </button>
    `
      )
      .join("")}
  `;
}

// Toggle tag filter
function toggleTagFilter(tag) {
  if (tag === "") {
    selectedTags = [];
  } else {
    const index = selectedTags.indexOf(tag);
    if (index > -1) {
      selectedTags.splice(index, 1);
    } else {
      selectedTags.push(tag);
    }
  }

  renderTagFilter();
  filterSnippets();
}

// Copy snippet to clipboard
async function copySnippet(snippetId) {
  const snippet = allSnippets.find((s) => s.id === snippetId);
  if (!snippet) return;

  try {
    // Substitute variables
    const processedContent = substituteVariables(snippet.content);
    await navigator.clipboard.writeText(processedContent);

    // Update last used
    snippet.lastUsed = Date.now();
    await saveSnippets();

    toast("Snippet copied!");
  } catch (error) {
    console.error("Failed to copy snippet:", error);
    toast("Failed to copy snippet");
  }
}

// Substitute variables in snippet content
function substituteVariables(content) {
  return content
    .replace(/\{date\}/g, new Date().toLocaleDateString())
    .replace(/\{time\}/g, new Date().toLocaleTimeString())
    .replace(/\{host\}/g, window.location.hostname)
    .replace(/\{title\}/g, document.title || "")
    .replace(/\{url\}/g, window.location.href);
}

// Edit snippet
function editSnippet(snippetId) {
  const snippet = allSnippets.find((s) => s.id === snippetId);
  if (!snippet) return;

  showSnippetModal(snippet);
}

// Delete snippet
async function deleteSnippet(snippetId) {
  showDeleteDialog("Delete this snippet?", () => {
    allSnippets = allSnippets.filter((s) => s.id !== snippetId);
    saveSnippets();
    filterSnippets();
    renderTagFilter();
    toast("Snippet deleted");
  });
}

// Show snippet modal
function showSnippetModal(snippet = null) {
  const modal = document.createElement("div");
  modal.className = "modal";
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>${snippet ? "Edit Snippet" : "Add Snippet"}</h3>
        <button class="modal-close">×</button>
      </div>
      <form id="snippetForm">
        <div class="form-group">
          <label class="form-label">Name</label>
          <input type="text" id="snippetName" class="form-input" value="${
            snippet ? escapeHtml(snippet.name) : ""
          }" required>
        </div>
        <div class="form-group">
          <label class="form-label">Content</label>
          <textarea id="snippetContent" class="form-textarea" required>${
            snippet ? escapeHtml(snippet.content) : ""
          }</textarea>
          <small style="color: var(--muted);">Use variables: {date}, {time}, {host}, {title}, {url}</small>
        </div>
        <div class="form-group">
          <label class="form-label">Tags (comma-separated)</label>
          <input type="text" id="snippetTags" class="form-input" value="${
            snippet ? escapeHtml(snippet.tags) : ""
          }" placeholder="email, signature, professional">
        </div>
        <div class="form-group">
          <label class="form-label">Hotkey (optional)</label>
          <input type="text" id="snippetHotkey" class="form-input" value="${
            snippet ? escapeHtml(snippet.hotkey) : ""
          }" placeholder="Ctrl+Shift+S">
        </div>
                  <div class="form-actions">
            <button type="button" class="btn btn-secondary modal-cancel">Cancel</button>
            <button type="submit" class="btn btn-primary">${
              snippet ? "Update" : "Create"
            }</button>
          </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  // Add event listeners for modal buttons
  modal.querySelector(".modal-close").addEventListener("click", () => {
    modal.remove();
  });

  modal.querySelector(".modal-cancel").addEventListener("click", () => {
    modal.remove();
  });

  // Handle form submission
  qs("#snippetForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = {
      name: qs("#snippetName").value.trim(),
      content: qs("#snippetContent").value.trim(),
      tags: qs("#snippetTags").value.trim(),
      hotkey: qs("#snippetHotkey").value.trim(),
    };

    if (!formData.name || !formData.content) {
      toast("Name and content are required");
      return;
    }

    if (snippet) {
      // Update existing snippet
      Object.assign(snippet, formData);
    } else {
      // Create new snippet
      const newSnippet = {
        ...formData,
        id: Date.now().toString(),
        created: Date.now(),
        lastUsed: Date.now(),
      };
      allSnippets.unshift(newSnippet);
    }

    await saveSnippets();
    filterSnippets();
    renderTagFilter();
    modal.remove();
    toast(snippet ? "Snippet updated" : "Snippet created");
  });
}

// Save snippets to storage
async function saveSnippets() {
  try {
    await chrome.storage.local.set({ snippets: allSnippets });
  } catch (error) {
    console.error("Failed to save snippets:", error);
  }
}

// Import snippets
async function importSnippets() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";

  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (data.snippets && Array.isArray(data.snippets)) {
        const importedSnippets = data.snippets.map((s) => ({
          ...s,
          id: Date.now().toString() + Math.random(),
          created: Date.now(),
          lastUsed: Date.now(),
        }));

        allSnippets = [...importedSnippets, ...allSnippets];
        await saveSnippets();
        filterSnippets();
        renderTagFilter();
        toast(`${importedSnippets.length} snippets imported`);
      } else {
        toast("Invalid file format");
      }
    } catch (error) {
      console.error("Import failed:", error);
      toast("Import failed");
    }
  };

  input.click();
}

// Export snippets
async function exportSnippets() {
  const data = {
    exportDate: new Date().toISOString(),
    totalSnippets: allSnippets.length,
    snippets: allSnippets,
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `snippets-${new Date().toISOString().split("T")[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  toast("Snippets exported!");
}

// Toggle snippet content expansion
function toggleExpand(element) {
  element.classList.toggle("expanded");
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
