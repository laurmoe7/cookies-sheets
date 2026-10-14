"""Self-update from the releases repo, so a new version does not mean downloading and unzipping by hand.

check() asks GitHub for the newest release. apply() downloads its zip, checks it, and starts a small batch script that waits for
this program to close, copies the new files over the install folder and starts the app again. Characters, sounds and options
live outside the install folder, so they are untouched. Only the built .exe can install itself; from source, update with git.
"""
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
import threading
import urllib.request
import zipfile

REPO = 'laurmoe7/cookies-sheets-releases'
API = f'https://api.github.com/repos/{REPO}/releases/latest'
DOWNLOAD_PREFIX = f'https://github.com/{REPO}/releases/download/'
FOLDER = "Cookie's Sheets"  # the folder inside the zip, and the exe's name
MAX_ZIP = 400 * 1024 * 1024


def parse_version(text):
    """'v1.2.3' -> (1, 2, 3). Anything without a number is (0,), so it never counts as newer."""
    return tuple(int(n) for n in re.findall(r'\d+', str(text or ''))) or (0,)


def is_newer(latest, current):
    a, b = parse_version(latest), parse_version(current)
    n = max(len(a), len(b))
    return a + (0,) * (n - len(a)) > b + (0,) * (n - len(b))


def pick_asset(release):
    """The release's zip: {name, url, size, sha256 or ''}, or None. Only files GitHub serves from our own releases count."""
    for a in release.get('assets') or []:
        url = a.get('browser_download_url') or ''
        if str(a.get('name', '')).lower().endswith('.zip') and url.startswith(DOWNLOAD_PREFIX):
            digest = str(a.get('digest') or '')
            return {'name': a['name'], 'url': url, 'size': int(a.get('size') or 0),
                    'sha256': digest[7:].lower() if digest.startswith('sha256:') else ''}
    return None


def can_install():
    """True for the built .exe in a folder we may write to."""
    if not getattr(sys, 'frozen', False) or sys.platform != 'win32':
        return False
    return os.access(os.path.dirname(sys.executable), os.W_OK)


def latest_release(fetch=None):
    if fetch:
        return fetch()
    req = urllib.request.Request(API, headers={'Accept': 'application/vnd.github+json', 'User-Agent': "Cookie's Sheets"})
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read().decode('utf-8'))


def describe(release, current):
    """What the newest release is: {current, latest, available, notes, page, canInstall}."""
    latest = str(release.get('tag_name') or '').lstrip('vV')
    return {'current': current, 'latest': latest, 'available': bool(latest and pick_asset(release) and is_newer(latest, current)),
            'notes': str(release.get('body') or '')[:4000], 'page': release.get('html_url') or f'https://github.com/{REPO}/releases/latest',
            'canInstall': can_install()}


def check(current, fetch=None):
    return describe(latest_release(fetch), current)


def safe_extract(zip_path, dest):
    """Unzips into dest, refusing paths that climb out of it. Returns the folder holding the new app."""
    root = os.path.realpath(dest)
    with zipfile.ZipFile(zip_path) as z:
        for name in z.namelist():
            target = os.path.realpath(os.path.join(root, name))
            if os.path.isabs(name) or not (target == root or target.startswith(root + os.sep)):
                raise ValueError('The update file is not safe to unpack.')
        z.extractall(root)
    src = os.path.join(root, FOLDER)
    if not os.path.isfile(os.path.join(src, FOLDER + '.exe')):
        raise ValueError('The update file does not hold the app.')
    return src


def script_text(src, dest, work):
    """The batch file that swaps the files once the app has closed. robocopy retries while the old files are still locked."""
    exe = os.path.join(dest, FOLDER + '.exe')
    return ('@echo off\r\n'
            f'robocopy "{src}" "{dest}" /E /IS /IT /R:60 /W:1 /NFL /NDL /NJH /NJS /NP >nul\r\n'
            f'start "" "{exe}"\r\n'
            f'rmdir /s /q "{work}"\r\n')


def apply(current, fetch=None, opener=None, exit_after=True):
    """Downloads and installs the newest release, then closes the app so the script can replace it."""
    release = latest_release(fetch)
    info = describe(release, current)
    if not info['available']:
        raise ValueError('You already have the newest version.')
    if not info['canInstall']:
        raise ValueError('This copy cannot update itself. Download the new version from the releases page.')
    asset = pick_asset(release)
    work = tempfile.mkdtemp(prefix='cs-update-')
    zip_path = os.path.join(work, 'update.zip')
    try:
        h = hashlib.sha256()
        got = 0
        with (opener or urllib.request.urlopen)(urllib.request.Request(asset['url'], headers={'User-Agent': "Cookie's Sheets"}), timeout=60) as r, \
                open(zip_path, 'wb') as f:
            while True:
                chunk = r.read(1 << 20)
                if not chunk:
                    break
                got += len(chunk)
                if got > MAX_ZIP:
                    raise ValueError('The update file is too big.')
                h.update(chunk)
                f.write(chunk)
        if asset['sha256'] and h.hexdigest() != asset['sha256']:
            raise ValueError('The download did not match its checksum, so it was not installed. Try again.')
        src = safe_extract(zip_path, os.path.join(work, 'new'))
    except Exception:
        import shutil
        shutil.rmtree(work, ignore_errors=True)
        raise
    bat = os.path.join(work, 'update.bat')
    with open(bat, 'w', encoding='mbcs', newline='') as f:
        f.write(script_text(src, os.path.dirname(sys.executable), work))
    subprocess.Popen(['cmd', '/c', bat], creationflags=0x00000008 | 0x00000200 | 0x08000000, close_fds=True)  # detached, own group, no window
    if exit_after:
        threading.Timer(1.5, os._exit, [0]).start()
    return {'ok': True, 'version': info['latest']}
