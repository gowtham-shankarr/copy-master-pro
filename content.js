// content.js (hardened single-init, no re-entrant loops)
(() => {
  if (window.__OCCS_INIT__) return; // <-- prevent double init
  window.__OCCS_INIT__ = true;

  const S = {
    picking: false,
    busy: false, // <-- prevents re-entrancy
    hoverEl: null,
    overlay: null,
    toast: null,
  };

  // ---- Tunables ----

  // ---- UI helpers ----
  function toast(msg) {
    try {
      S.toast?.remove();
    } catch {}
    const t = document.createElement("div");
    t.className = "__occs_toast";
    Object.assign(t.style, {
      position: "fixed",
      left: "50%",
      bottom: "24px",
      transform: "translateX(-50%)",
      background: "rgba(0,0,0,.9)",
      color: "#fff",
      padding: "6px 12px",
      borderRadius: "20px",
      fontSize: "13px",
      fontWeight: "500",
      fontFamily:
        "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      lineHeight: "1.3",
      whiteSpace: "nowrap",
      maxWidth: "90vw",
      overflow: "hidden",
      textOverflow: "ellipsis",
      boxShadow: "0 4px 12px rgba(0,0,0,.3), 0 2px 4px rgba(0,0,0,.2)",
      backdropFilter: "blur(8px)",
      border: "1px solid rgba(255,255,255,.1)",
      zIndex: 2147483647,
      pointerEvents: "none",
      userSelect: "none",
      transition: "opacity 0.2s ease-in-out",
    });
    t.textContent = msg;
    document.documentElement.appendChild(t);
    S.toast = t;
    setTimeout(() => {
      try {
        t.style.opacity = "0";
        setTimeout(() => t.remove(), 200);
      } catch {}
    }, 1400);
  }

  function ensureOverlay() {
    if (S.overlay) return S.overlay;
    const el = document.createElement("div");
    el.className = "__occs_overlay";
    Object.assign(el.style, {
      position: "fixed",
      inset: "0",
      zIndex: 2147483646,
      pointerEvents: "none",
    });
    document.documentElement.appendChild(el);
    S.overlay = el;
    return el;
  }

  function outline(el, label = "Click to capture • Esc to cancel") {
    if (!el || !el.getBoundingClientRect) return;
    const r = el.getBoundingClientRect();
    if (!r || r.width <= 0 || r.height <= 0) return;
    const ov = ensureOverlay();
    ov.style.display = "block";
    ov.innerHTML = "";

    const rect = document.createElement("div");
    rect.className = "__occs_rect";
    Object.assign(rect.style, {
      position: "fixed",
      left: r.left - 6 + "px",
      top: r.top - 6 + "px",
      width: r.width + 12 + "px",
      height: r.height + 12 + "px",
      border: "2px solid #2dd4bf",
      background: "rgba(45,212,191,.12)",
      borderRadius: "6px",
      boxShadow: "0 8px 24px rgba(0,0,0,.25) inset, 0 0 0 1px rgba(0,0,0,.2)",
      pointerEvents: "none",
    });

    const hint = document.createElement("div");
    hint.className = "__occs_hint";
    Object.assign(hint.style, {
      position: "fixed",
      left: r.left + "px",
      top: Math.max(8, r.top - 32) + "px",
      background: "rgba(0,0,0,.75)",
      color: "#fff",
      font: "11px/1.2 -apple-system, Segoe UI, Roboto, Arial, sans-serif",
      padding: "4px 6px",
      borderRadius: "6px",
      pointerEvents: "none",
    });
    hint.textContent = label;

    ov.append(rect, hint);
  }

  // ---- Hit test (no hide/show) ----
  function isOurOverlayNode(el) {
    if (!el) return false;
    if (el === S.overlay) return true;
    const c = el.classList;
    return (
      !!c &&
      (c.contains("__occs_overlay") ||
        c.contains("__occs_rect") ||
        c.contains("__occs_hint"))
    );
  }
  function elementFromPointSafe(x, y) {
    const el = document.elementFromPoint(x, y);
    return isOurOverlayNode(el) ? null : el;
  }

  // ---- Text/Clipboard helpers ----
  function getSel() {
    const s = window.getSelection && window.getSelection();
    return !s || s.rangeCount === 0 ? "" : s.toString();
  }
  function textOf(el) {
    return (el?.innerText || el?.textContent || "")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
  const mdOf = textOf;

  // Text case conversion functions
  function convertCase(text, caseType) {
    switch (caseType) {
      case "uppercase":
        return text.toUpperCase();
      case "lowercase":
        return text.toLowerCase();
      case "titlecase":
        return text.replace(
          /\w\S*/g,
          (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
        );
      case "camelcase":
        return text
          .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
            index === 0 ? word.toLowerCase() : word.toUpperCase()
          )
          .replace(/\s+/g, "");
      case "snakecase":
        return text.toLowerCase().replace(/\s+/g, "_");
      case "kebabcase":
        return text.toLowerCase().replace(/\s+/g, "-");
      case "pascalcase":
        return text
          .replace(/(?:^\w|[A-Z]|\b\w)/g, (word) => word.toUpperCase())
          .replace(/\s+/g, "");
      default:
        return text;
    }
  }

  async function copyText(txt) {
    if (!txt) throw new Error("Nothing to copy");
    try {
      await navigator.clipboard.writeText(txt);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = txt;
      Object.assign(ta.style, {
        position: "fixed",
        opacity: "0",
        left: "-9999px",
      });
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
  }

  async function pushHistory(item) {
    try {
      const response = await chrome.runtime.sendMessage({
        type: "OCCS_HISTORY_PUSH",
        item,
      });
    } catch (error) {
      console.error("History push failed:", error);
    }
  }

  // ---- Image URLs Popup ----
  function showImageUrlsPopup(images) {
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
      background: #161828;
      border: 1px solid #27306b;
      border-radius: 12px;
      padding: 20px;
      max-width: 90%;
      max-height: 80%;
      overflow: auto;
      color: #e2e8f0;
      min-width: 500px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
    `;

    const header = document.createElement("div");
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 1px solid #27306b;
    `;

    const title = document.createElement("h3");
    title.style.cssText = `
      margin: 0;
      font-size: 18px;
      font-weight: 600;
    `;
    title.textContent = `Found ${images.length} Images`;

    const closeBtn = document.createElement("button");
    closeBtn.style.cssText = `
      background: none;
      border: none;
      color: #e2e8f0;
      font-size: 24px;
      cursor: pointer;
      padding: 0;
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: color 0.2s;
    `;
    closeBtn.textContent = "×";
    closeBtn.onclick = () => modal.remove();

    // Add hover effect for close button
    closeBtn.addEventListener("mouseenter", () => {
      closeBtn.style.color = "#f56565";
      closeBtn.style.background = "#2d3748";
    });
    closeBtn.addEventListener("mouseleave", () => {
      closeBtn.style.color = "#e2e8f0";
      closeBtn.style.background = "none";
    });

    header.appendChild(title);
    header.appendChild(closeBtn);

    const imageList = document.createElement("div");
    imageList.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 12px;
    `;

    images.forEach((img, index) => {
      const item = document.createElement("div");
      item.style.cssText = `
        background: #2d3748;
        border: 1px solid #4a5568;
        border-radius: 8px;
        padding: 12px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        transition: border-color 0.2s;
      `;

      const info = document.createElement("div");
      info.style.cssText = `
        flex: 1;
        min-width: 0;
      `;

      const name = document.createElement("div");
      name.style.cssText = `
        font-weight: 600;
        margin-bottom: 4px;
        color: #e2e8f0;
      `;
      name.textContent = img.title || img.alt || `Image ${index + 1}`;

      const details = document.createElement("div");
      details.style.cssText = `
        font-size: 12px;
        color: #a0aec0;
        margin-bottom: 6px;
      `;
      details.textContent = `(${img.width}×${img.height})`;

      const url = document.createElement("div");
      url.style.cssText = `
        font-size: 13px;
        color: #63b3ed;
        word-break: break-all;
        font-family: monospace;
        background: #1a1f3a;
        padding: 4px 6px;
        border-radius: 4px;
        border: 1px solid #4a5568;
      `;
      url.textContent = img.src;

      info.appendChild(name);
      info.appendChild(details);
      info.appendChild(url);

      const copyBtn = document.createElement("button");
      copyBtn.style.cssText = `
        background: #161828;
        color: white;
        border: none;
        border-radius: 6px;
        padding: 8px 12px;
        font-size: 12px;
        cursor: pointer;
        white-space: nowrap;
        transition: all 0.2s;
        font-weight: 500;
      `;
      copyBtn.textContent = "Copy URL";
      copyBtn.onclick = async () => {
        try {
          await copyText(img.src);
          copyBtn.textContent = "Copied!";
          copyBtn.style.background = "#48bb78";
          setTimeout(() => {
            copyBtn.textContent = "Copy URL";
            copyBtn.style.background = "#4299e1";
          }, 2000);
        } catch (error) {
          copyBtn.textContent = "Failed";
          copyBtn.style.background = "#f56565";
          setTimeout(() => {
            copyBtn.textContent = "Copy URL";
            copyBtn.style.background = "#4299e1";
          }, 2000);
        }
      };

      // Add hover effects
      item.addEventListener("mouseenter", () => {
        item.style.borderColor = "#63b3ed";
      });
      item.addEventListener("mouseleave", () => {
        item.style.borderColor = "#4a5568";
      });

      copyBtn.addEventListener("mouseenter", () => {
        copyBtn.style.background = "#3182ce";
        copyBtn.style.transform = "translateY(-1px)";
      });
      copyBtn.addEventListener("mouseleave", () => {
        copyBtn.style.background = "#4299e1";
        copyBtn.style.transform = "translateY(0)";
      });

      item.appendChild(info);
      item.appendChild(copyBtn);
      imageList.appendChild(item);
    });

    content.appendChild(header);
    content.appendChild(imageList);
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

  // ---- Core picker infra with rAF coalescing ----
  function makePicker({ cursor = "copy", label, onChoose }) {
    if (S.picking || S.busy) return;
    S.picking = true;
    document.documentElement.style.cursor = cursor;

    let raf = 0;
    const move = (e) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        try {
          if (!S.picking) return;
          const el = elementFromPointSafe(e.clientX, e.clientY);
          if (!el || el === S.hoverEl) return;
          S.hoverEl = el;
          outline(el, label);
        } catch {}
      });
    };

    const cleanup = () => {
      S.picking = false;
      document.removeEventListener("mousemove", move, true);
      document.removeEventListener("click", click, true);
      document.removeEventListener("keydown", key, true);
      document.documentElement.style.cursor = "";
      if (S.overlay) {
        try {
          S.overlay.remove();
        } catch {}
        S.overlay = null;
      }
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };

    const click = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!S.picking || S.busy) return;
      const el = S.hoverEl;
      if (!el || isOurOverlayNode(el)) {
        toast("Canceled");
        cleanup();
        return;
      }

      cleanup(); // stop move events BEFORE doing work
      S.busy = true; // lock while processing
      try {
        await onChoose(el);
      } catch (err) {
        console.error(err);
        toast("Action failed");
      } finally {
        S.busy = false;
      }
    };

    const key = (e) => {
      if (e.key === "Escape") {
        cleanup();
        toast("Canceled");
      }
    };

    document.addEventListener("mousemove", move, true);
    document.addEventListener("click", click, true);
    document.addEventListener("keydown", key, true);
  }

  // ---- Actions ----
  async function startPicker(mode) {
    makePicker({
      label: "Click to copy • Esc to cancel",
      onChoose: async (el) => {
        if (mode === "html") {
          const html = el.outerHTML || el.innerHTML || "";
          await copyText(html);
          await pushHistory({
            kind: "HTML",
            preview: html.slice(0, 300),
            data: html,
            src: location.href,
            ts: Date.now(),
          });
          toast("HTML copied");
        } else if (mode === "markdown") {
          const md = mdOf(el);
          await copyText(md);
          await pushHistory({
            kind: "Markdown",
            preview: md.slice(0, 300),
            data: md,
            src: location.href,
            ts: Date.now(),
          });
          toast("Markdown copied");
        } else if (mode === "table_csv") {
          const tbl = el.closest("table") || el.querySelector("table");
          if (!tbl) {
            toast("No table here");
            return;
          }
          const csv = toCSVFromTable(tbl);
          await copyText(csv);
          await pushHistory({
            kind: "CSV",
            preview: csv.slice(0, 300),
            data: csv,
            src: location.href,
            ts: Date.now(),
          });
          toast("CSV copied");
        } else if (mode === "links") {
          const links = extractLinks(el);
          if (!links) {
            toast("No links found");
            return;
          }
          await copyText(links);
          await pushHistory({
            kind: "Links",
            preview: links.split("\n")[0] || "Links extracted",
            data: links,
            src: location.href,
            ts: Date.now(),
          });
          toast("Links copied");
        } else if (mode === "json_format") {
          const text = textOf(el);
          const formatted = formatJSON(text);
          await copyText(formatted);
          await pushHistory({
            kind: "JSON",
            preview: formatted.slice(0, 300),
            data: formatted,
            src: location.href,
            ts: Date.now(),
          });
          toast("JSON formatted & copied");
        } else if (mode === "code_syntax") {
          const text = textOf(el);
          const language = detectLanguage(text);
          const highlighted = `\`\`\`${language}\n${text}\n\`\`\``;
          await copyText(highlighted);
          await pushHistory({
            kind: "Code",
            preview: `${language.toUpperCase()}: ${text.slice(0, 100)}`,
            data: highlighted,
            src: location.href,
            ts: Date.now(),
          });
          toast(`${language.toUpperCase()} code copied`);
        } else if (mode === "clean_copy") {
          const txt = textOf(el);
          const cleaned = cleanText(txt);
          await copyText(cleaned);
          await pushHistory({
            kind: "Clean Text",
            preview: cleaned.slice(0, 300),
            data: cleaned,
            src: location.href,
            ts: Date.now(),
          });
          toast("Clean text copied");
        } else if (mode === "smart_title_case") {
          const txt = textOf(el);
          const converted = smartTitleCase(txt);
          await copyText(converted);
          await pushHistory({
            kind: "Smart Title Case",
            preview: converted.slice(0, 300),
            data: converted,
            src: location.href,
            ts: Date.now(),
          });
          toast("Smart title case copied");
        } else if (mode === "unicode_fix") {
          const txt = textOf(el);
          const fixed = unicodeFix(txt);
          await copyText(fixed);
          await pushHistory({
            kind: "Unicode Fixed",
            preview: fixed.slice(0, 300),
            data: fixed,
            src: location.href,
            ts: Date.now(),
          });
          toast("Unicode fixed text copied");
        } else if (mode === "slugify") {
          const txt = textOf(el);
          const slug = slugify(txt);
          await copyText(slug);
          await pushHistory({
            kind: "Slug",
            preview: slug.slice(0, 300),
            data: slug,
            src: location.href,
            ts: Date.now(),
          });
          toast("Slug copied");
        } else if (mode === "extract_links_enhanced") {
          const links = extractLinksEnhanced(el);
          if (!links) {
            toast("No links found");
            return;
          }
          await copyText(links);
          await pushHistory({
            kind: "Enhanced Links",
            preview: links.split("\n")[0] || "Links extracted",
            data: links,
            src: location.href,
            ts: Date.now(),
          });
          toast("Enhanced links copied");
        } else if (mode === "copy_with_source") {
          const txt = textOf(el);
          const withSource = copyWithSource(txt);
          await copyText(withSource);
          await pushHistory({
            kind: "Text with Source",
            preview: txt.slice(0, 100),
            data: withSource,
            src: location.href,
            ts: Date.now(),
          });
          toast("Text with source copied");
        } else if (mode === "table_export_enhanced") {
          const tbl = el.closest("table") || el.querySelector("table");
          if (!tbl) {
            toast("No table here");
            return;
          }
          const csv = exportTableEnhanced(tbl, "csv");
          await copyText(csv);
          await pushHistory({
            kind: "Enhanced CSV",
            preview: csv.slice(0, 300),
            data: csv,
            src: location.href,
            ts: Date.now(),
          });
          toast("Enhanced CSV copied");
        } else if (mode === "meta_og_scraper") {
          const meta = extractMetaData();
          const formatted = formatMetaData(meta);
          await copyText(formatted);
          await pushHistory({
            kind: "Meta/OG Data",
            preview: `Title: ${meta.title}`,
            data: formatted,
            src: location.href,
            ts: Date.now(),
          });
          toast("Meta/OG data copied");
        } else if (mode === "image_downloader") {
          const images = downloadImages(256, 256, [
            "png",
            "jpg",
            "jpeg",
            "webp",
          ]);
          if (images.length === 0) {
            toast("No suitable images found");
            return;
          }

          // Show image URLs in a popup with copy buttons
          showImageUrlsPopup(images);
        } else if (mode === "contrast_checker") {
          // This will be handled by a special picker for two colors
          makePicker({
            cursor: "crosshair",
            label: "Click first color (foreground) • Esc to cancel",
            onChoose: async (el) => {
              const rect = el.getBoundingClientRect();
              const canvas = document.createElement("canvas");
              const ctx = canvas.getContext("2d");

              const dataUrl = await chrome.runtime.sendMessage({
                type: "OCCS_CAPTURE_VISIBLE",
              });

              if (!dataUrl?.ok) {
                toast("Color pick failed");
                return;
              }

              const img = await createImageBitmap(
                await (await fetch(dataUrl.dataUrl)).blob()
              );
              canvas.width = img.width;
              canvas.height = img.height;
              ctx.drawImage(img, 0, 0);

              const centerX = Math.floor(
                (rect.left + rect.width / 2) * window.devicePixelRatio
              );
              const centerY = Math.floor(
                (rect.top + rect.height / 2) * window.devicePixelRatio
              );
              const imageData = ctx.getImageData(centerX, centerY, 1, 1);
              const [r, g, b] = imageData.data;

              const fgColor = `#${r.toString(16).padStart(2, "0")}${g
                .toString(16)
                .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;

              // Now pick background color
              makePicker({
                cursor: "crosshair",
                label: "Click second color (background) • Esc to cancel",
                onChoose: async (el2) => {
                  const rect2 = el2.getBoundingClientRect();
                  const centerX2 = Math.floor(
                    (rect2.left + rect2.width / 2) * window.devicePixelRatio
                  );
                  const centerY2 = Math.floor(
                    (rect2.top + rect2.height / 2) * window.devicePixelRatio
                  );
                  const imageData2 = ctx.getImageData(centerX2, centerY2, 1, 1);
                  const [r2, g2, b2] = imageData2.data;

                  const bgColor = `#${r2.toString(16).padStart(2, "0")}${g2
                    .toString(16)
                    .padStart(2, "0")}${b2.toString(16).padStart(2, "0")}`;

                  const contrast = checkContrast(fgColor, bgColor);
                  if (!contrast) {
                    toast("Invalid colors");
                    return;
                  }

                  const result = `Contrast Ratio: ${
                    contrast.ratio
                  }:1\n\nWCAG Compliance:\nAA: ${
                    contrast.passes.AA ? "✅" : "❌"
                  }\nAA Large: ${
                    contrast.passes["AA Large"] ? "✅" : "❌"
                  }\nAAA: ${contrast.passes.AAA ? "✅" : "❌"}\nAAA Large: ${
                    contrast.passes["AAA Large"] ? "✅" : "❌"
                  }\n\nColors:\nForeground: ${fgColor}\nBackground: ${bgColor}`;

                  await copyText(result);
                  await pushHistory({
                    kind: "Contrast Check",
                    preview: `Ratio: ${contrast.ratio}:1`,
                    data: result,
                    src: location.href,
                    ts: Date.now(),
                  });
                  toast(`Contrast: ${contrast.ratio}:1`);
                },
              });
            },
          });
        } else if (mode === "color_palette") {
          makePicker({
            cursor: "crosshair",
            label: "Click color to generate palette • Esc to cancel",
            onChoose: async (el) => {
              const rect = el.getBoundingClientRect();
              const canvas = document.createElement("canvas");
              const ctx = canvas.getContext("2d");

              const dataUrl = await chrome.runtime.sendMessage({
                type: "OCCS_CAPTURE_VISIBLE",
              });

              if (!dataUrl?.ok) {
                toast("Color pick failed");
                return;
              }

              const img = await createImageBitmap(
                await (await fetch(dataUrl.dataUrl)).blob()
              );
              canvas.width = img.width;
              canvas.height = img.height;
              ctx.drawImage(img, 0, 0);

              const centerX = Math.floor(
                (rect.left + rect.width / 2) * window.devicePixelRatio
              );
              const centerY = Math.floor(
                (rect.top + rect.height / 2) * window.devicePixelRatio
              );
              const imageData = ctx.getImageData(centerX, centerY, 1, 1);
              const [r, g, b] = imageData.data;

              const baseColor = `#${r.toString(16).padStart(2, "0")}${g
                .toString(16)
                .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
              const palette = generateColorPalette(baseColor);

              if (!palette) {
                toast("Invalid color");
                return;
              }

              const paletteText = `Color Palette for ${baseColor}:\n\nBase: ${
                palette.base
              }\n\nTints (Lighter):\n${palette.tints.join(
                "\n"
              )}\n\nShades (Darker):\n${palette.shades.join(
                "\n"
              )}\n\nComplementary: ${
                palette.complementary
              }\n\nAnalogous:\n${palette.analogous.join("\n")}`;

              await copyText(paletteText);
              await pushHistory({
                kind: "Color Palette",
                preview: `Palette for ${baseColor}`,
                data: paletteText,
                src: location.href,
                ts: Date.now(),
              });
              toast("Color palette copied");
            },
          });
        } else if (mode === "save_as_snippet") {
          const text = textOf(el);
          if (!text.trim()) {
            toast("No text to save");
            return;
          }

          // Create snippet with default name
          const snippet = {
            name: `Snippet from ${getCurrentHost()}`,
            content: text,
            tags: getCurrentHost(),
            hotkey: "",
          };

          await addSnippet(snippet);
          toast("Snippet saved");
        } else if (mode === "apply_site_rules") {
          const text = textOf(el);
          const rules = await getSiteRules();
          const processed = applySiteRules(text, rules);
          await copyText(processed);
          await pushHistory({
            kind: "Site Rules Applied",
            preview: processed.slice(0, 300),
            data: processed,
            src: location.href,
            ts: Date.now(),
          });
          toast("Site rules applied");
        } else if (mode.startsWith("case_")) {
          const txt = textOf(el);
          const caseType = mode.replace("case_", "");
          const converted = convertCase(txt, caseType);
          await copyText(converted);
          await pushHistory({
            kind: `Text (${caseType})`,
            preview: converted.slice(0, 300),
            data: converted,
            src: location.href,
            ts: Date.now(),
          });
          toast(`${caseType} case copied`);
        } else {
          const txt = textOf(el);
          await copyText(txt);
          await pushHistory({
            kind: "Text",
            preview: txt.slice(0, 300),
            data: txt,
            src: location.href,
            ts: Date.now(),
          });
          toast("Text copied");
        }
      },
    });
  }

  function startImageSave() {
    makePicker({
      cursor: "crosshair",
      label: "Click to save image • Esc to cancel",
      onChoose: async (el) => {
        const img =
          el.tagName?.toLowerCase() === "img" ? el : el.querySelector?.("img");
        if (!img?.src && !img?.currentSrc) {
          toast("No image");
          return;
        }
        const url = img.currentSrc || img.src;
        const filename = buildFileName(img, "img") || "image-" + Date.now();
        const res = await chrome.runtime.sendMessage({
          type: "OCCS_DOWNLOAD_URL",
          url,
          filename,
        });
        if (!res?.ok) toast(res?.error || "Save failed");
        else toast("Image saved");
        await pushHistory({
          kind: "ImageSave",
          preview: url,
          data: url,
          src: location.href,
          ts: Date.now(),
        });
      },
    });
  }

  function startImageCopy() {
    makePicker({
      cursor: "copy",
      label: "Click to copy image • Esc to cancel",
      onChoose: async (el) => {
        const img =
          el.tagName?.toLowerCase() === "img" ? el : el.querySelector?.("img");
        if (!img?.src && !img?.currentSrc) {
          toast("No image");
          return;
        }
        const src = img.currentSrc || img.src;
        try {
          const resp = await fetch(src, { referrerPolicy: "no-referrer" });
          const blob = await resp.blob();
          await navigator.clipboard.write([
            new ClipboardItem({ [blob.type || "image/png"]: blob }),
          ]);
          toast("Image copied");
          await pushHistory({
            kind: "Image",
            preview: src,
            data: src,
            src: location.href,
            ts: Date.now(),
          });
        } catch {
          const filename = buildFileName(img, "img") || "image-" + Date.now();
          const d = await chrome.runtime.sendMessage({
            type: "OCCS_DOWNLOAD_URL",
            url: src,
            filename,
          });
          if (d?.ok) toast("Image saved");
          else toast("Copy blocked by site; save failed");
        }
      },
    });
  }

  function startColorPicker() {
    makePicker({
      cursor: "crosshair",
      label: "Click to pick color • Esc to cancel",
      onChoose: async (el) => {
        const rect = el.getBoundingClientRect();
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        // Capture the element area
        const dataUrl = await chrome.runtime.sendMessage({
          type: "OCCS_CAPTURE_VISIBLE",
        });

        if (!dataUrl?.ok) {
          toast("Color pick failed");
          return;
        }

        const img = await createImageBitmap(
          await (await fetch(dataUrl.dataUrl)).blob()
        );
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        // Get color at center of element
        const centerX = Math.floor(
          (rect.left + rect.width / 2) * window.devicePixelRatio
        );
        const centerY = Math.floor(
          (rect.top + rect.height / 2) * window.devicePixelRatio
        );
        const imageData = ctx.getImageData(centerX, centerY, 1, 1);
        const [r, g, b, a] = imageData.data;

        const hex = `#${r.toString(16).padStart(2, "0")}${g
          .toString(16)
          .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
        const rgb = `rgb(${r}, ${g}, ${b})`;
        const rgba = `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(2)})`;

        const colorData = `${hex}\n${rgb}\n${rgba}`;
        await copyText(colorData);

        toast(`Color copied: ${hex}`);
        await pushHistory({
          kind: "Color",
          preview: hex,
          data: colorData,
          src: location.href,
          ts: Date.now(),
        });
      },
    });
  }

  function toCSVFromTable(tbl) {
    const rows = Array.from(tbl.querySelectorAll("tr")).map((tr) =>
      Array.from(tr.children)
        .map((td) => `"${(td.innerText || "").replace(/"/g, '""').trim()}"`)
        .join(",")
    );
    return rows.join("\n");
  }

  function extractLinks(el) {
    const links = Array.from(el.querySelectorAll("a[href]"));
    const uniqueLinks = [...new Set(links.map((link) => link.href))];
    return uniqueLinks.join("\n");
  }

  function formatJSON(text) {
    try {
      const parsed = JSON.parse(text);
      return JSON.stringify(parsed, null, 2);
    } catch (e) {
      return text; // Return original if not valid JSON
    }
  }

  function detectLanguage(text) {
    // Simple language detection based on content patterns
    if (
      text.includes("function") ||
      text.includes("const ") ||
      text.includes("let ") ||
      text.includes("var ")
    ) {
      return "javascript";
    }
    if (
      text.includes("<?php") ||
      text.includes("echo ") ||
      text.includes("$")
    ) {
      return "php";
    }
    if (
      text.includes("def ") ||
      text.includes("import ") ||
      text.includes("print(")
    ) {
      return "python";
    }
    if (text.includes("public class") || text.includes("System.out.println")) {
      return "java";
    }
    if (text.includes("function") && text.includes("{") && text.includes("}")) {
      return "javascript";
    }
    if (
      text.includes("<html") ||
      text.includes("<div") ||
      text.includes("<span")
    ) {
      return "html";
    }
    if (
      text.includes("color:") ||
      text.includes("background:") ||
      text.includes("font-size:")
    ) {
      return "css";
    }
    return "text";
  }

  // Phase 1: Core text processing functions
  function cleanText(text) {
    return (
      text
        // Remove zero-width characters
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        // Remove common tracking patterns
        .replace(
          /\b(utm_|fbclid|gclid|msclkid|ref|source|campaign|medium|term|content)=[^\s&]+/gi,
          ""
        )
        // Normalize whitespace
        .replace(/\s+/g, " ")
        // Remove leading/trailing whitespace
        .trim()
    );
  }

  function smartTitleCase(text) {
    const stopwords = [
      "a",
      "an",
      "and",
      "as",
      "at",
      "but",
      "by",
      "for",
      "in",
      "is",
      "it",
      "of",
      "on",
      "or",
      "the",
      "to",
      "up",
      "yet",
    ];

    return text.toLowerCase().replace(/\b\w+/g, (word, index, string) => {
      // Always capitalize first and last word
      if (index === 0 || index + word.length === string.length) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      }
      // Capitalize if not a stopword
      if (!stopwords.includes(word)) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      }
      return word;
    });
  }

  function unicodeFix(text) {
    return (
      text
        // Smart quotes to straight quotes
        .replace(/[""]/g, '"')
        .replace(/['']/g, "'")
        // Em dashes and en dashes to hyphens
        .replace(/[—–]/g, "-")
        // Multiple spaces to single space
        .replace(/\s+/g, " ")
        // Remove zero-width characters
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        .trim()
    );
  }

  function slugify(text) {
    return (
      text
        .toLowerCase()
        .trim()
        // Replace spaces and special chars with hyphens
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_-]+/g, "-")
        // Remove leading/trailing hyphens
        .replace(/^-+|-+$/g, "")
    );
  }

  function extractLinksEnhanced(el) {
    const links = Array.from(el.querySelectorAll("a[href]"));
    const uniqueLinks = [
      ...new Set(
        links.map((link) => ({
          url: link.href,
          text: link.textContent.trim(),
          title: link.title || "",
        }))
      ),
    ];

    return uniqueLinks
      .map(
        (link) =>
          `${link.text} - ${link.url}${link.title ? ` (${link.title})` : ""}`
      )
      .join("\n");
  }

  function copyWithSource(text) {
    const title = document.title || "";
    const url = location.href;
    return `${text}\n\nSource: ${title}\nURL: ${url}`;
  }

  function exportTableEnhanced(tbl, format = "csv") {
    const rows = Array.from(tbl.querySelectorAll("tr")).map((tr) =>
      Array.from(tr.children)
        .map((td) => {
          const content = (td.innerText || "").replace(/"/g, '""').trim();
          return format === "csv" ? `"${content}"` : content;
        })
        .join(format === "csv" ? "," : "\t")
    );

    return rows.join("\n");
  }

  // Phase 2: Creator Helper functions
  function extractMetaData() {
    const meta = {
      title: document.title || "",
      description: "",
      keywords: "",
      author: "",
      og: {
        title: "",
        description: "",
        image: "",
        url: "",
        type: "",
      },
      twitter: {
        card: "",
        title: "",
        description: "",
        image: "",
      },
      canonical: "",
    };

    // Extract meta tags
    const metaTags = document.querySelectorAll("meta");
    metaTags.forEach((tag) => {
      const name =
        tag.getAttribute("name") || tag.getAttribute("property") || "";
      const content = tag.getAttribute("content") || "";

      if (name === "description") meta.description = content;
      if (name === "keywords") meta.keywords = content;
      if (name === "author") meta.author = content;
      if (name === "og:title") meta.og.title = content;
      if (name === "og:description") meta.og.description = content;
      if (name === "og:image") meta.og.image = content;
      if (name === "og:url") meta.og.url = content;
      if (name === "og:type") meta.og.type = content;
      if (name === "twitter:card") meta.twitter.card = content;
      if (name === "twitter:title") meta.twitter.title = content;
      if (name === "twitter:description") meta.twitter.description = content;
      if (name === "twitter:image") meta.twitter.image = content;
    });

    // Extract canonical URL
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) meta.canonical = canonical.href;

    return meta;
  }

  function formatMetaData(meta) {
    let output = `# Page Metadata\n\n`;
    output += `**Title:** ${meta.title}\n`;
    output += `**Description:** ${meta.description}\n`;
    output += `**Keywords:** ${meta.keywords}\n`;
    output += `**Author:** ${meta.author}\n`;
    output += `**Canonical URL:** ${meta.canonical}\n\n`;

    output += `## Open Graph\n\n`;
    output += `**OG Title:** ${meta.og.title}\n`;
    output += `**OG Description:** ${meta.og.description}\n`;
    output += `**OG Image:** ${meta.og.image}\n`;
    output += `**OG URL:** ${meta.og.url}\n`;
    output += `**OG Type:** ${meta.og.type}\n\n`;

    output += `## Twitter Card\n\n`;
    output += `**Card Type:** ${meta.twitter.card}\n`;
    output += `**Title:** ${meta.twitter.title}\n`;
    output += `**Description:** ${meta.twitter.description}\n`;
    output += `**Image:** ${meta.twitter.image}\n`;

    return output;
  }

  function downloadImages(
    minWidth = 100,
    minHeight = 100,
    types = ["png", "jpg", "jpeg", "webp"]
  ) {
    const images = Array.from(document.querySelectorAll("img[src]"));
    const validImages = images.filter((img) => {
      const src = img.src.toLowerCase();
      const type = src.split(".").pop().split("?")[0];
      return (
        types.includes(type) &&
        img.naturalWidth >= minWidth &&
        img.naturalHeight >= minHeight
      );
    });

    return validImages.map((img) => ({
      src: img.src,
      alt: img.alt || "",
      width: img.naturalWidth,
      height: img.naturalHeight,
      title: img.title || "",
    }));
  }

  function checkContrast(foreground, background) {
    // Convert hex to RGB
    const hexToRgb = (hex) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result
        ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16),
          }
        : null;
    };

    const fg = hexToRgb(foreground);
    const bg = hexToRgb(background);

    if (!fg || !bg) return null;

    // Calculate relative luminance
    const getLuminance = (r, g, b) => {
      const [rs, gs, bs] = [r, g, b].map((c) => {
        c = c / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
    };

    const l1 = getLuminance(fg.r, fg.g, fg.b);
    const l2 = getLuminance(bg.r, bg.g, bg.b);

    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

    return {
      ratio: Math.round(ratio * 100) / 100,
      passes: {
        AA: ratio >= 4.5,
        "AA Large": ratio >= 3,
        AAA: ratio >= 7,
        "AAA Large": ratio >= 4.5,
      },
    };
  }

  function generateColorPalette(baseColor) {
    // Convert hex to HSL
    const hexToHsl = (hex) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      if (!result) return null;

      const r = parseInt(result[1], 16) / 255;
      const g = parseInt(result[2], 16) / 255;
      const b = parseInt(result[3], 16) / 255;

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      let h,
        s,
        l = (max + min) / 2;

      if (max === min) {
        h = s = 0;
      } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r:
            h = (g - b) / d + (g < b ? 6 : 0);
            break;
          case g:
            h = (b - r) / d + 2;
            break;
          case b:
            h = (r - g) / d + 4;
            break;
        }
        h /= 6;
      }

      return [h * 360, s * 100, l * 100];
    };

    // Convert HSL to hex
    const hslToHex = (h, s, l) => {
      h /= 360;
      s /= 100;
      l /= 100;

      const c = (1 - Math.abs(2 * l - 1)) * s;
      const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
      const m = l - c / 2;
      let r = 0,
        g = 0,
        b = 0;

      if (0 <= h && h < 1 / 6) {
        r = c;
        g = x;
        b = 0;
      } else if (1 / 6 <= h && h < 1 / 3) {
        r = x;
        g = c;
        b = 0;
      } else if (1 / 3 <= h && h < 1 / 2) {
        r = 0;
        g = c;
        b = x;
      } else if (1 / 2 <= h && h < 2 / 3) {
        r = 0;
        g = x;
        b = c;
      } else if (2 / 3 <= h && h < 5 / 6) {
        r = x;
        g = 0;
        b = c;
      } else if (5 / 6 <= h && h <= 1) {
        r = c;
        g = 0;
        b = x;
      }

      const rHex = Math.round((r + m) * 255)
        .toString(16)
        .padStart(2, "0");
      const gHex = Math.round((g + m) * 255)
        .toString(16)
        .padStart(2, "0");
      const bHex = Math.round((b + m) * 255)
        .toString(16)
        .padStart(2, "0");

      return `#${rHex}${gHex}${bHex}`;
    };

    const hsl = hexToHsl(baseColor);
    if (!hsl) return null;

    const [h, s, l] = hsl;
    const palette = {
      base: baseColor,
      tints: [],
      shades: [],
      complementary: hslToHex((h + 180) % 360, s, l),
      analogous: [
        hslToHex((h + 30) % 360, s, l),
        hslToHex((h - 30 + 360) % 360, s, l),
      ],
    };

    // Generate tints (lighter versions)
    for (let i = 1; i <= 4; i++) {
      const newL = Math.min(100, l + i * 10);
      palette.tints.push(hslToHex(h, s, newL));
    }

    // Generate shades (darker versions)
    for (let i = 1; i <= 4; i++) {
      const newL = Math.max(0, l - i * 10);
      palette.shades.push(hslToHex(h, s, newL));
    }

    return palette;
  }

  // Phase 3: Productivity Suite functions
  function getCurrentHost() {
    return location.hostname;
  }

  function getSiteRules() {
    const host = getCurrentHost();
    return chrome.storage.local.get({ siteRules: {} }).then((data) => {
      return data.siteRules[host] || {};
    });
  }

  function applySiteRules(text, rules) {
    if (!rules || !text) return text;

    let processed = text;

    // Text cleaning
    if (rules.cleanText) {
      if (rules.cleanText.zeroWidth) {
        processed = processed.replace(/[\u200B-\u200D\uFEFF]/g, "");
      }
      if (rules.cleanText.smartQuotes === "straight") {
        processed = processed.replace(/[""]/g, '"').replace(/['']/g, "'");
      }
      if (rules.cleanText.stripEmojis) {
        processed = processed.replace(
          /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu,
          ""
        );
      }
    }

    // URL parameter removal
    if (rules.urlParamsToRemove && rules.urlParamsToRemove.length > 0) {
      const url = new URL(location.href);
      rules.urlParamsToRemove.forEach((param) => {
        if (param.endsWith("*")) {
          const prefix = param.slice(0, -1);
          Array.from(url.searchParams.keys()).forEach((key) => {
            if (key.startsWith(prefix)) {
              url.searchParams.delete(key);
            }
          });
        } else {
          url.searchParams.delete(param);
        }
      });
      // Update the page URL if needed
      if (url.toString() !== location.href) {
        history.replaceState(null, "", url.toString());
      }
    }

    return processed;
  }

  async function getFileNamePattern() {
    try {
      const { filenamePattern } = await chrome.storage.local.get({
        filenamePattern:
          "{title:slug}-{date:YYYYMMDD}-{time:HHmmss}-{w}x{h}.{ext}",
      });
      return filenamePattern;
    } catch (error) {
      return "{title:slug}-{date:YYYYMMDD}-{time:HHmmss}-{w}x{h}.{ext}";
    }
  }

  function generateFileName(pattern, data = {}) {
    const tokens = {
      title: data.title || document.title || "untitled",
      "title:slug": slugify(data.title || document.title || "untitled"),
      host: getCurrentHost(),
      path: location.pathname.replace(/[^\w\-]+/g, "-").replace(/^-|-$/g, ""),
      "date:YYYY-MM-DD": new Date().toISOString().split("T")[0],
      "date:YYYYMMDD": new Date().toISOString().split("T")[0].replace(/-/g, ""),
      "time:HHmmss": new Date().toTimeString().slice(0, 8).replace(/:/g, ""),
      w: data.width || "",
      h: data.height || "",
      dpi: data.dpi || "",
      seq: data.seq || "001",
      rand4: Math.random().toString(36).substring(2, 6),
      ext: data.ext || "png",
    };

    let filename = pattern;

    // Replace tokens
    Object.entries(tokens).forEach(([token, value]) => {
      const regex = new RegExp(
        `\\{${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\}`,
        "g"
      );
      filename = filename.replace(regex, value);
    });

    // Sanitize filename
    filename = filename.replace(/[<>:"/\\|?*]/g, "_");

    return filename;
  }

  function getSnippets() {
    return chrome.storage.local
      .get({ snippets: [] })
      .then((data) => data.snippets);
  }

  function addSnippet(snippet) {
    return getSnippets().then((snippets) => {
      if (snippets.length >= 200) {
        snippets.pop(); // Remove oldest if at limit
      }
      snippets.unshift({
        ...snippet,
        id: Date.now().toString(),
        created: Date.now(),
        lastUsed: Date.now(),
      });
      return chrome.storage.local.set({ snippets });
    });
  }

  function updateSnippetUsage(snippetId) {
    return getSnippets().then((snippets) => {
      const snippet = snippets.find((s) => s.id === snippetId);
      if (snippet) {
        snippet.lastUsed = Date.now();
        return chrome.storage.local.set({ snippets });
      }
    });
  }

  function substituteSnippetVariables(snippetText) {
    return snippetText
      .replace(/\{date\}/g, new Date().toLocaleDateString())
      .replace(/\{time\}/g, new Date().toLocaleTimeString())
      .replace(/\{host\}/g, getCurrentHost())
      .replace(/\{title\}/g, document.title || "")
      .replace(/\{url\}/g, location.href);
  }

  function buildFileName(el, prefix) {
    // Get custom filename pattern from storage
    return chrome.storage.local
      .get({
        filenamePattern:
          "{title:slug}-{date:YYYYMMDD}-{time:HHmmss}-{w}x{h}.{ext}",
      })
      .then((data) => {
        const pattern = data.filenamePattern;
        const rect = el?.getBoundingClientRect();

        return generateFileName(pattern, {
          title: (el?.innerText || el?.textContent || "").trim().slice(0, 40),
          width: rect ? Math.round(rect.width) : "",
          height: rect ? Math.round(rect.height) : "",
          ext: "png",
        });
      });
  }

  // ---- Dispatcher ----
  async function perform(mode) {
    if (S.busy) {
      toast("Please wait…");
      return;
    }
    if (mode === "image_save") return startImageSave();
    if (mode === "image_clip") return startImageCopy();
    if (mode === "color_picker") return startColorPicker();

    const sel = getSel();
    if (sel && sel.trim()) {
      let kind = "Text";
      let data = sel;

      if (mode === "html") {
        kind = "HTML";
      } else if (mode === "markdown") {
        kind = "Markdown";
      } else if (mode === "json_format") {
        kind = "JSON";
        data = formatJSON(sel);
      } else if (mode === "code_syntax") {
        const language = detectLanguage(sel);
        kind = "Code";
        data = `\`\`\`${language}\n${sel}\n\`\`\``;
      } else if (mode === "clean_copy") {
        kind = "Clean Text";
        data = cleanText(sel);
      } else if (mode === "smart_title_case") {
        kind = "Smart Title Case";
        data = smartTitleCase(sel);
      } else if (mode === "unicode_fix") {
        kind = "Unicode Fixed";
        data = unicodeFix(sel);
      } else if (mode === "slugify") {
        kind = "Slug";
        data = slugify(sel);
      } else if (mode === "copy_with_source") {
        kind = "Text with Source";
        data = copyWithSource(sel);
      } else if (mode === "meta_og_scraper") {
        kind = "Meta/OG Data";
        const meta = extractMetaData();
        data = formatMetaData(meta);
      } else if (mode === "apply_site_rules") {
        kind = "Site Rules Applied";
        const rules = await getSiteRules();
        data = applySiteRules(sel, rules);
      } else if (mode === "save_as_snippet") {
        // Save selected text as snippet
        const snippet = {
          name: `Snippet from ${getCurrentHost()}`,
          content: sel,
          tags: getCurrentHost(),
          hotkey: "",
        };
        await addSnippet(snippet);
        toast("Snippet saved");
        return;
      } else if (mode.startsWith("case_")) {
        const caseType = mode.replace("case_", "");
        kind = `Text (${caseType})`;
        data = convertCase(sel, caseType);
      }

      await copyText(data);
      await pushHistory({
        kind,
        preview: data.slice(0, 300),
        data: data,
        src: location.href,
        ts: Date.now(),
      });
      toast("Copied selection");
      return;
    }
    startPicker(mode);
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === "OCCS_DO") perform(msg.mode);
    if (msg?.ping) {
      sendResponse({ pong: true });
      return true;
    }
  });
})();
