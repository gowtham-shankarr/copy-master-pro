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

    // Try to inject content script and retry
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"],
      });
      await chrome.tabs.sendMessage(tab.id, { type: "OCCS_DO", mode });
    } catch (injectError) {
      console.error("Failed to inject content script:", injectError);
      toast("Cannot access this page. Try a different website.");
    }
  }
}
document.addEventListener("DOMContentLoaded", async () => {
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
