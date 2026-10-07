// Crop maths for the picture editor: which part of the source image fills a frame, given a zoom and a centre point.
// Pure functions, no DOM.

/** Source rectangle {sx, sy, sw, sh} shown in a frame of vw x vh. zoom 1 just covers the frame; cx, cy are the centre (0 to 1 of the image). */
export function cropRect(imgW, imgH, vw, vh, zoom = 1, cx = 0.5, cy = 0.5) {
  const base = Math.max(vw / imgW, vh / imgH);
  const scale = base * Math.max(1, zoom);
  const sw = vw / scale, sh = vh / scale;
  const sx = Math.min(imgW - sw, Math.max(0, cx * imgW - sw / 2));
  const sy = Math.min(imgH - sh, Math.max(0, cy * imgH - sh / 2));
  return { sx, sy, sw, sh, scale };
}

/** The new centre after dragging the picture by (dx, dy) screen pixels. */
export function panCentre(imgW, imgH, vw, vh, zoom, cx, cy, dx, dy) {
  const { sx, sy, sw, sh, scale } = cropRect(imgW, imgH, vw, vh, zoom, cx, cy);
  const nx = Math.min(imgW - sw, Math.max(0, sx - dx / scale)) + sw / 2;
  const ny = Math.min(imgH - sh, Math.max(0, sy - dy / scale)) + sh / 2;
  return { cx: nx / imgW, cy: ny / imgH };
}
