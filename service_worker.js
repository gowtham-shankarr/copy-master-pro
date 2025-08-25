// service_worker.js
const MAX_HISTORY = 100;
const SNAP_SCALE = 2; // upscale factor for crisper PNGs
const SNAP_MARGIN_PX = 24; // margin around output image (visible snaps)

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
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["content.js"],
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
  history.unshift(item);
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
    } catch (e) {
      sendResponse({ ok: false, error: String(e) });
    }
  })();

  // Keep channel open for async sendResponse
  return true;
});
