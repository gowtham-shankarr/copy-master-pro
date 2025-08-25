// Site Rules Page JavaScript
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

// Toast function for site rules page
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

let allRules = {};

// Preset rules
const PRESET_RULES = {
  medium: {
    domain: "*.medium.com",
    description: "Clean Medium articles, remove tracking",
    copyFormat: "Plain",
    cleanText: {
      zeroWidth: true,
      smartQuotes: "straight",
      stripEmojis: false,
    },
    appendSource: true,
    urlParamsToRemove: ["utm_*", "ref", "fbclid", "source"],
  },
  twitter: {
    domain: "*.twitter.com,*.x.com",
    description: "Clean Twitter posts, remove tracking",
    copyFormat: "Markdown",
    cleanText: {
      zeroWidth: true,
      smartQuotes: "straight",
      stripEmojis: true,
    },
    appendSource: true,
    urlParamsToRemove: ["utm_*", "ref", "fbclid", "s", "t"],
  },
  github: {
    domain: "*.github.com",
    description: "Clean GitHub content, preserve code",
    copyFormat: "Plain",
    cleanText: {
      zeroWidth: true,
      smartQuotes: "straight",
      stripEmojis: false,
    },
    appendSource: true,
    urlParamsToRemove: ["utm_*"],
  },
  stackoverflow: {
    domain: "*.stackoverflow.com",
    description: "Clean Stack Overflow answers",
    copyFormat: "Markdown",
    cleanText: {
      zeroWidth: true,
      smartQuotes: "straight",
      stripEmojis: false,
    },
    appendSource: true,
    urlParamsToRemove: ["utm_*", "rq"],
  },
  reddit: {
    domain: "*.reddit.com",
    description: "Clean Reddit posts and comments",
    copyFormat: "Plain",
    cleanText: {
      zeroWidth: true,
      smartQuotes: "straight",
      stripEmojis: true,
    },
    appendSource: true,
    urlParamsToRemove: ["utm_*", "ref", "st", "sh"],
  },
  youtube: {
    domain: "*.youtube.com",
    description: "Clean YouTube descriptions",
    copyFormat: "Plain",
    cleanText: {
      zeroWidth: true,
      smartQuotes: "straight",
      stripEmojis: false,
    },
    appendSource: true,
    urlParamsToRemove: ["utm_*", "feature", "si"],
  },
};

// Initialize the page
document.addEventListener("DOMContentLoaded", async () => {
  await loadRules();
  setupEventListeners();
  renderRules();
});

// Load rules from storage
async function loadRules() {
  try {
    const { siteRules = {} } = await chrome.storage.local.get({
      siteRules: {},
    });
    allRules = siteRules;
  } catch (error) {
    console.error("Failed to load rules:", error);
    allRules = {};
  }
}

// Setup event listeners
function setupEventListeners() {
  // Add rule
  qs("#addRuleBtn").addEventListener("click", () => {
    showRuleModal();
  });

  // Help button
  qs("#helpBtn").addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("help.html") });
  });

  // Request Feature button
  qs("#requestFeatureBtn").addEventListener("click", () => {
    chrome.tabs.create({ url: "https://forms.fillout.com/t/2QMi7uSS59us" });
  });

  // Event delegation for dynamically created elements
  qs("#rulesGrid").addEventListener("click", (e) => {
    const target = e.target;

    // Handle edit rule button clicks
    if (target.classList.contains("edit-rule-btn")) {
      const domain = target.dataset.domain;
      if (domain) editRule(domain);
    }

    // Handle test rule button clicks
    if (target.classList.contains("test-rule-btn")) {
      const domain = target.dataset.domain;
      if (domain) testRule(domain);
    }

    // Handle delete rule button clicks
    if (target.classList.contains("delete-rule-btn")) {
      const domain = target.dataset.domain;
      if (domain) deleteRule(domain);
    }
  });

  // Event delegation for preset buttons
  qs(".preset-grid").addEventListener("click", (e) => {
    const target = e.target;
    if (target.classList.contains("preset-btn")) {
      const preset = target.dataset.preset;
      if (preset) loadPreset(preset);
    }
  });
}

// Load preset rule
function loadPreset(presetName) {
  const preset = PRESET_RULES[presetName];
  if (!preset) return;

  showRuleModal(preset);
}

// Render rules
function renderRules() {
  const grid = qs("#rulesGrid");
  const emptyState = qs("#emptyState");

  // Update count
  qs("#totalRules").textContent = Object.keys(allRules).length;

  if (Object.keys(allRules).length === 0) {
    grid.innerHTML = "";
    emptyState.style.display = "block";
    return;
  }

  emptyState.style.display = "none";

  grid.innerHTML = Object.entries(allRules)
    .map(
      ([domain, rule]) => `
    <div class="rule-item" data-domain="${domain}">
      <div class="rule-header">
        <div>
          <div class="rule-domain">${escapeHtml(domain)}</div>
          <div class="rule-description">${escapeHtml(
            rule.description || "No description"
          )}</div>
        </div>
      </div>
      <div class="rule-settings">
        <div class="setting-item">
          <div class="setting-label">Copy Format</div>
          <div class="setting-value">${rule.copyFormat || "Default"}</div>
        </div>
        <div class="setting-item">
          <div class="setting-label">Clean Text</div>
          <div class="setting-value">${
            rule.cleanText ? "Enabled" : "Disabled"
          }</div>
        </div>
        <div class="setting-item">
          <div class="setting-label">Append Source</div>
          <div class="setting-value">${rule.appendSource ? "Yes" : "No"}</div>
        </div>
        <div class="setting-item">
          <div class="setting-label">URL Params</div>
          <div class="setting-value">${
            rule.urlParamsToRemove ? rule.urlParamsToRemove.length : 0
          }</div>
        </div>
      </div>
      <div class="rule-actions">
        <button class="action-btn edit-rule-btn" data-domain="${domain}">Edit</button>
        <button class="action-btn test-rule-btn" data-domain="${domain}">Test</button>
        <button class="action-btn danger delete-rule-btn" data-domain="${domain}">Delete</button>
      </div>
    </div>
  `
    )
    .join("");
}

// Show rule modal
function showRuleModal(rule = null) {
  const modal = document.createElement("div");
  modal.className = "modal";
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>${rule ? "Edit Rule" : "Add Rule"}</h3>
        <button class="modal-close">×</button>
      </div>
      <form id="ruleForm">
        <div class="form-group">
          <label class="form-label">Domain Pattern</label>
          <input type="text" id="ruleDomain" class="form-input" value="${
            rule ? escapeHtml(rule.domain) : ""
          }" placeholder="*.example.com" required>
          <small style="color: var(--muted);">Use wildcards: *.example.com, example.com, *.sub.example.com</small>
        </div>
        <div class="form-group">
          <label class="form-label">Description</label>
          <input type="text" id="ruleDescription" class="form-input" value="${
            rule ? escapeHtml(rule.description) : ""
          }" placeholder="What this rule does">
        </div>
        <div class="form-group">
          <label class="form-label">Copy Format</label>
          <select id="ruleCopyFormat" class="form-input">
            <option value="">Default</option>
            <option value="Plain" ${
              rule?.copyFormat === "Plain" ? "selected" : ""
            }>Plain Text</option>
            <option value="HTML" ${
              rule?.copyFormat === "HTML" ? "selected" : ""
            }>HTML</option>
            <option value="Markdown" ${
              rule?.copyFormat === "Markdown" ? "selected" : ""
            }>Markdown</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Text Cleaning</label>
          <div style="margin-bottom: 10px;">
            <label><input type="checkbox" id="cleanZeroWidth" class="form-checkbox" ${
              rule?.cleanText?.zeroWidth ? "checked" : ""
            }> Remove zero-width characters</label>
          </div>
          <div style="margin-bottom: 10px;">
            <label><input type="checkbox" id="cleanSmartQuotes" class="form-checkbox" ${
              rule?.cleanText?.smartQuotes === "straight" ? "checked" : ""
            }> Convert smart quotes to straight quotes</label>
          </div>
          <div style="margin-bottom: 10px;">
            <label><input type="checkbox" id="cleanStripEmojis" class="form-checkbox" ${
              rule?.cleanText?.stripEmojis ? "checked" : ""
            }> Strip emojis</label>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Append Source</label>
          <label><input type="checkbox" id="ruleAppendSource" class="form-checkbox" ${
            rule?.appendSource ? "checked" : ""
          }> Include page title and URL when copying</label>
        </div>
        <div class="form-group">
          <label class="form-label">URL Parameters to Remove</label>
          <textarea id="ruleUrlParams" class="form-textarea" placeholder="utm_*&#10;fbclid&#10;ref&#10;source">${
            rule?.urlParamsToRemove ? rule.urlParamsToRemove.join("\n") : ""
          }</textarea>
          <small style="color: var(--muted);">One parameter per line. Use * for wildcards (e.g., utm_*)</small>
        </div>
                  <div class="form-actions">
            <button type="button" class="btn btn-secondary modal-cancel">Cancel</button>
            <button type="submit" class="btn btn-primary">${
              rule ? "Update" : "Create"
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

  // Handle copy result button in test modal
  const copyResultBtn = modal.querySelector(".copy-result-btn");
  if (copyResultBtn) {
    copyResultBtn.addEventListener("click", () => {
      const result = copyResultBtn.dataset.result;
      if (result) copyToClipboard(result);
    });
  }

  // Handle form submission
  qs("#ruleForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = {
      domain: qs("#ruleDomain").value.trim(),
      description: qs("#ruleDescription").value.trim(),
      copyFormat: qs("#ruleCopyFormat").value || null,
      cleanText: {
        zeroWidth: qs("#cleanZeroWidth").checked,
        smartQuotes: qs("#cleanSmartQuotes").checked ? "straight" : null,
        stripEmojis: qs("#cleanStripEmojis").checked,
      },
      appendSource: qs("#ruleAppendSource").checked,
      urlParamsToRemove: qs("#ruleUrlParams")
        .value.split("\n")
        .map((p) => p.trim())
        .filter((p) => p),
    };

    if (!formData.domain) {
      toast("Domain is required");
      return;
    }

    // Remove empty cleanText properties
    if (
      !formData.cleanText.zeroWidth &&
      !formData.cleanText.smartQuotes &&
      !formData.cleanText.stripEmojis
    ) {
      formData.cleanText = null;
    }

    // Remove empty properties
    Object.keys(formData).forEach((key) => {
      if (
        formData[key] === null ||
        formData[key] === "" ||
        (Array.isArray(formData[key]) && formData[key].length === 0)
      ) {
        delete formData[key];
      }
    });

    allRules[formData.domain] = formData;
    await saveRules();
    renderRules();
    modal.remove();
    toast(rule ? "Rule updated" : "Rule created");
  });
}

// Edit rule
function editRule(domain) {
  const rule = allRules[domain];
  if (!rule) return;

  showRuleModal(rule);
}

// Delete rule
async function deleteRule(domain) {
  showDeleteDialog(`Delete rule for ${domain}?`, async () => {
    delete allRules[domain];
    await saveRules();
    renderRules();
    toast("Rule deleted");
  });
}

// Test rule
function testRule(domain) {
  const rule = allRules[domain];
  if (!rule) return;

  const testText =
    "This is a test text with “smart quotes” and some emojis 😀 and zero-width characters\u200B";

  let result = testText;

  if (rule.cleanText) {
    if (rule.cleanText.zeroWidth) {
      result = result.replace(/[\u200B-\u200D\uFEFF]/g, "");
    }
    if (rule.cleanText.smartQuotes === "straight") {
      result = result.replace(/[""]/g, '"').replace(/['']/g, "'");
    }
    if (rule.cleanText.stripEmojis) {
      result = result.replace(
        /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu,
        ""
      );
    }
  }

  if (rule.appendSource) {
    result += `\n\nSource: Test Page\nURL: https://example.com`;
  }

  const modal = document.createElement("div");
  modal.className = "modal";
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>Rule Test: ${escapeHtml(domain)}</h3>
        <button class="modal-close">×</button>
      </div>
      <div style="margin-bottom: 15px;">
        <strong>Original:</strong>
        <pre style="background: var(--bg); padding: 10px; border-radius: 6px; margin-top: 5px; font-size: 12px;">${escapeHtml(
          testText
        )}</pre>
      </div>
      <div style="margin-bottom: 15px;">
        <strong>Processed:</strong>
        <pre style="background: var(--bg); padding: 10px; border-radius: 6px; margin-top: 5px; font-size: 12px;">${escapeHtml(
          result
        )}</pre>
      </div>
              <div class="form-actions">
          <button class="btn btn-secondary modal-cancel">Close</button>
          <button class="btn btn-primary copy-result-btn" data-result="${escapeHtml(
            result
          )}">Copy Result</button>
        </div>
    </div>
  `;

  document.body.appendChild(modal);
}

// Copy to clipboard
async function copyToClipboard(text) {
  if (!text || text.trim() === "") {
    toast("Nothing to copy");
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    toast("Copied to clipboard!");
  } catch (error) {
    console.error("Failed to copy:", error);
    toast("Failed to copy");
  }
}

// Save rules to storage
async function saveRules() {
  try {
    await chrome.storage.local.set({ siteRules: allRules });
  } catch (error) {
    console.error("Failed to save rules:", error);
  }
}

// Utility functions
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
