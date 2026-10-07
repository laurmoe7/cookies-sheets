"""Zips dist/Cookie's Sheets into "Cookie's Sheets.zip" for sharing, leaving out developer tools.

Usage: python tools/make_zip.py   (run build_exe.ps1 first)
Refuses to zip if a developer tool (web/dev) or test files ended up in the build.
"""
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'dist' / "Cookie's Sheets"
OUT = ROOT / "Cookie's Sheets.zip"
DEV_MARKERS = ('/web/dev/', '/tests/', '/tools/')


def main():
    if not SRC.is_dir():
        sys.exit('Nothing to zip: build the app first (powershell -ExecutionPolicy Bypass -File build_exe.ps1)')
    files = [p for p in SRC.rglob('*') if p.is_file()]
    rel = lambda p: p.relative_to(SRC).as_posix()
    bad = [rel(p) for p in files if any(m in '/' + rel(p) for m in DEV_MARKERS)]
    if bad:
        sys.exit('Developer files found in the build, not zipping:\n  ' + '\n  '.join(bad[:10]) + '\nRebuild with build_exe.ps1 (it leaves web/dev out).')
    OUT.unlink(missing_ok=True)
    with zipfile.ZipFile(OUT, 'w', zipfile.ZIP_DEFLATED) as z:
        for p in files:
            z.write(p, "Cookie's Sheets/" + rel(p))
    print(f'Wrote {OUT.name}: {len(files)} files, {OUT.stat().st_size / 1e6:.1f} MB, no developer tools')


if __name__ == '__main__':
    main()
