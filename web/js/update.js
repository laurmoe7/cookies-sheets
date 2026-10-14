// Checking for a newer release and installing it from inside the app. The server does the talking to GitHub (updater.py).
import { modal, esc, toast } from './ui.js';
import { api } from './api.js';
import { options } from './options.js';

let asked = false; // the start-up prompt shows once per launch

/** Asks the server for the newest release and offers it. `quiet` (the start-up check) says nothing unless there is an update. */
export async function checkForUpdate({ quiet = false } = {}) {
  let info;
  try { info = await api.updateCheck(); } catch (e) { if (!quiet) toast('Could not check for updates: ' + e.message, 'err'); return; }
  if (!info.available) { if (!quiet) toast(`You have the newest version (${info.current}).`); return; }
  if (quiet) { if (asked) return; asked = true; }
  showUpdate(info);
}

/** The start-up check, unless the player turned it off. Waits a little so it never competes with the page loading. */
export function initUpdateCheck() {
  if (options().updateCheck) setTimeout(() => checkForUpdate({ quiet: true }), 4000);
}

function showUpdate(info) {
  modal('Update available', (body, close) => {
    body.innerHTML = `<p>Version <b>${esc(info.latest)}</b> is out. You have ${esc(info.current)}.</p>
      ${info.notes ? `<pre class="small" style="white-space:pre-wrap;max-height:220px;overflow:auto;user-select:text">${esc(info.notes)}</pre>` : ''}
      <p class="small muted">${info.canInstall
        ? 'Update now downloads it, closes the app and opens it again. Your characters, sounds and options are not touched.'
        : 'This copy cannot update itself, so open the releases page and download the new version.'}</p>
      <div class="row end"><button class="btn" data-later>Later</button>
        ${info.canInstall ? '<button class="btn primary" data-go>Update now</button>' : `<a class="btn primary" href="${esc(info.page)}" target="_blank" rel="noopener">Open releases page</a>`}</div>`;
    body.onclick = async e => {
      if (e.target.closest('[data-later]')) return close();
      const go = e.target.closest('[data-go]');
      if (!go) return;
      go.disabled = true; go.textContent = 'Downloading…';
      try {
        await api.updateApply();
        body.innerHTML = '<p>Installing… the app closes now and opens again in a few seconds.</p>';
      } catch (err) { toast(err.message, 'err'); go.disabled = false; go.textContent = 'Update now'; }
    };
  });
}
