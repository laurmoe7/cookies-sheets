// Picture chooser with a position and zoom window: drag to recenter, slide or scroll to resize.
import { modal, toast, esc, $ } from './ui.js';
import { cropRect, panCentre } from './imagecrop.js';

const SRC_MAX = 1200; // the full picture is kept (downscaled to this) so it can be repositioned later

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read that image'));
    img.src = url;
  });
}

/** Ask for an image file; resolves with a downscaled data URL (null if cancelled). */
function chooseFile() {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return resolve(null);
      const obj = URL.createObjectURL(file);
      try {
        const img = await loadImage(obj);
        const k = Math.min(1, SRC_MAX / Math.max(img.width, img.height));
        const cv = document.createElement('canvas');
        cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        resolve(file.type === 'image/png' ? cv.toDataURL('image/png') : cv.toDataURL('image/jpeg', 0.88));
      } catch (e) { toast(e.message, 'err'); resolve(null); } finally { URL.revokeObjectURL(obj); }
    };
    input.click();
  });
}

/** The position window. Resolves {image} (the cropped data URL), or null if cancelled. opts: {w, h} aspect, {out} long side in px. */
async function cropDialog(srcUrl, { w = 1, h = 1, out = 600 } = {}) {
  let img;
  try { img = await loadImage(srcUrl); } catch (e) { toast(e.message, 'err'); return null; }
  const vw = w >= h ? 320 : Math.round(320 * w / h), vh = w >= h ? Math.round(320 * h / w) : 320;
  let zoom = 1, cx = 0.5, cy = 0.5;
  return modal('Position picture', (body, close) => {
    body.innerHTML = `<p class="small muted">Drag the picture to recenter it. Use the slider or the mouse wheel to resize.</p>
      <div class="crop-view" style="width:${vw}px;height:${vh}px"><img alt="" draggable="false"></div>
      <div class="row crop-controls"><span class="muted small">Smaller</span><input type="range" min="1" max="4" step="0.01" value="1" data-zoom><span class="muted small">Larger</span>
        <span class="grow"></span><button class="btn small ghost" data-reset>Reset</button></div>
      <div class="row end"><button class="btn" data-no>Cancel</button><button class="btn primary" data-yes>Use picture</button></div>`;
    const view = $('.crop-view', body), el = $('img', view), slider = $('[data-zoom]', body);
    const draw = () => {
      const r = cropRect(img.width, img.height, vw, vh, zoom, cx, cy);
      el.style.width = img.width * r.scale + 'px';
      el.style.height = img.height * r.scale + 'px';
      el.style.left = -r.sx * r.scale + 'px';
      el.style.top = -r.sy * r.scale + 'px';
      slider.value = zoom;
    };
    el.src = srcUrl;
    let drag = null;
    view.onpointerdown = e => { drag = { x: e.clientX, y: e.clientY }; view.setPointerCapture(e.pointerId); view.classList.add('grabbing'); };
    view.onpointermove = e => {
      if (!drag) return;
      ({ cx, cy } = panCentre(img.width, img.height, vw, vh, zoom, cx, cy, e.clientX - drag.x, e.clientY - drag.y));
      drag = { x: e.clientX, y: e.clientY };
      draw();
    };
    view.onpointerup = view.onpointercancel = () => { drag = null; view.classList.remove('grabbing'); };
    view.onwheel = e => { e.preventDefault(); zoom = Math.max(1, Math.min(4, zoom + (e.deltaY < 0 ? 0.1 : -0.1))); draw(); };
    slider.oninput = () => { zoom = +slider.value; draw(); };
    $('[data-reset]', body).onclick = () => { zoom = 1; cx = cy = 0.5; draw(); };
    $('[data-no]', body).onclick = () => close(null);
    $('[data-yes]', body).onclick = () => {
      const r = cropRect(img.width, img.height, vw, vh, zoom, cx, cy);
      const k = out / Math.max(vw, vh);
      const cv = document.createElement('canvas');
      cv.width = Math.round(vw * k); cv.height = Math.round(vh * k);
      cv.getContext('2d').drawImage(img, r.sx, r.sy, r.sw, r.sh, 0, 0, cv.width, cv.height);
      close({ image: srcUrl.startsWith('data:image/png') ? cv.toDataURL('image/png') : cv.toDataURL('image/jpeg', 0.88) });
    };
    draw();
  });
}

/** Choose a file, then position it. Resolves {image, src} (src = the full picture for later repositioning) or null. */
export async function choosePicture(opts) {
  const src = await chooseFile();
  if (!src) return null;
  const r = await cropDialog(src, opts);
  return r ? { image: r.image, src } : null;
}

/** Reposition an existing picture from its kept source. Resolves {image} or null. */
export const repositionPicture = (src, opts) => cropDialog(src, opts);

/**
 * Handle the picture buttons (data-pic, data-pic-edit, data-pic-clear) for an object holding `obj[key]` and `obj[key + 'Src']`.
 * Returns true when something changed.
 */
export async function picAction(t, obj, opts, key = 'image') {
  if (t.dataset.pic !== undefined) {
    const r = await choosePicture(opts);
    if (!r) return false;
    obj[key] = r.image; obj[key + 'Src'] = r.src;
    return true;
  }
  if (t.dataset.picEdit !== undefined) {
    const r = await repositionPicture(obj[key + 'Src'] || obj[key], opts);
    if (!r) return false;
    obj[key] = r.image;
    return true;
  }
  if (t.dataset.picClear !== undefined) { obj[key] = ''; obj[key + 'Src'] = ''; return true; }
  return false;
}

/** Picture block for a card. size 'lg' is a wide frame like the character portrait; 'sm' a small square. */
export function picFrame(image, size = 'sm', hint = 'Add a picture') {
  if (!image) return `<button class="pic-add ${size}" data-pic title="${esc(hint)}">${size === 'lg' ? '＋ Add a picture' : '＋'}</button>`;
  return `<div class="pic-frame ${size}"><img src="${esc(image)}" alt="">
    <span class="pic-tools"><button class="icon-btn" data-pic title="Choose another picture">✎</button><button class="icon-btn" data-pic-edit title="Recenter or resize">⤢</button><button class="icon-btn" data-pic-clear title="Remove picture">✕</button></span></div>`;
}
