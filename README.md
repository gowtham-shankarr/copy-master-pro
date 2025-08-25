# One-Click Copy Snap (v3.2)

### What’s new
- **Professional popup UI**
- **Save Image**: pick any image on the page and download the original file
- **Copy Image → Clipboard**: tries blob copy; if the site blocks it, falls back to saving the image file
- **Snap Visible**: capture the on-screen element area (2× upscale)
- **Snap Full**: auto-scroll & stitch to capture the entire element beyond the viewport

### Notes
- Full stitch uses the page to scroll and capture segments; a tiny overlap removes seams. Some sites with heavy lazy-loading may require a short pause.
- Image copy can be blocked by cross-origin restrictions; we automatically fall back to **Save Image** so you never get just a link.
