"""Gives the app its name and icon in Windows Task Manager.

Task Manager reads a program's name and icon from the .exe file itself (its "file description" and icon resource), not from the window. So:

  python tools/brand.py launcher                 makes .launcher\\Cookie's Sheets.exe, a copy of this Python's pythonw.exe with the app's icon and name.
                                                 Run the app from source with it ("Cookie's Sheets.exe app.py") and Task Manager lists "Cookie's Sheets".
  python tools/brand.py version-file build\\v.txt  writes the version resource build_exe.ps1 hands to PyInstaller for the built .exe.

The launcher is a real copy (a venv's python.exe only starts the real one as a child, and the window would still belong to "Python") with its DLLs and a
pyvenv.cfg that points at the Python install, so it finds the standard library and the installed packages (pywebview). Run it again after a Python upgrade.
"""
import os
import re
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NAME = "Cookie's Sheets"
ICON = os.path.join(ROOT, 'web', 'icon.ico')
LAUNCHER_DIR = os.path.join(ROOT, '.launcher')
LAUNCHER = os.path.join(LAUNCHER_DIR, NAME + '.exe')


def app_version():
    """The version in web/js/version.js (the one place it is written)."""
    with open(os.path.join(ROOT, 'web', 'js', 'version.js'), encoding='utf-8') as f:
        m = re.search(r"VERSION\s*=\s*'([^']*)'", f.read())
    return m.group(1) if m else '0'


def version_text(version=None):
    """The text of a PyInstaller version resource: what Windows shows as the file's description, product name and version."""
    version = version or app_version()
    nums = ([int(x) for x in re.findall(r'\d+', version)] + [0, 0, 0, 0])[:4]
    t = tuple(nums)
    return f'''VSVersionInfo(
  ffi=FixedFileInfo(filevers={t}, prodvers={t}, mask=0x3f, flags=0x0, OS=0x40004, fileType=0x1, subtype=0x0, date=(0, 0)),
  kids=[
    StringFileInfo([StringTable('040904B0', [
      StringStruct('CompanyName', ''), StringStruct('FileDescription', "{NAME}"), StringStruct('FileVersion', '{version}'),
      StringStruct('InternalName', "{NAME}"), StringStruct('OriginalFilename', "{NAME}.exe"),
      StringStruct('ProductName', "{NAME}"), StringStruct('ProductVersion', '{version}')])]),
    VarFileInfo([VarStruct('Translation', [1033, 1200])])
  ])
'''


def write_version_file(path):
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(version_text())
    return path


def brand(exe):
    """Puts the app's icon and version resource into an .exe (one that is not running)."""
    from PyInstaller.utils.win32 import icon, versioninfo
    icon.CopyIcons_FromIco(exe, [ICON])
    tmp = write_version_file(os.path.join(os.path.dirname(exe), 'version_info.txt'))
    versioninfo.write_version_info_to_executable(exe, versioninfo.load_version_info_from_text_file(tmp))
    os.remove(tmp)


def make_launcher():
    base = sys.base_exec_prefix
    src = os.path.join(base, 'pythonw.exe')
    if not os.path.isfile(src):
        raise SystemExit(f'No pythonw.exe in {base}: this needs a normal Windows Python install.')
    if os.path.exists(LAUNCHER):  # Windows will not let a running program be replaced, and a half-deleted launcher cannot start the app
        try:
            open(LAUNCHER, 'r+b').close()
        except OSError:
            raise SystemExit(f"{NAME} is running from the launcher. Close it, then run this again.")
    new = LAUNCHER_DIR + '.new'  # built beside the old one, and swapped in only when it is complete
    shutil.rmtree(new, ignore_errors=True)
    os.makedirs(new)
    exe = os.path.join(new, NAME + '.exe')
    shutil.copy2(src, exe)
    for f in os.listdir(base):  # python3.dll, python314.dll, vcruntime140.dll...: the DLLs the interpreter loads from its own folder
        if re.match(r'^(python3\d*|vcruntime\d+(_\d+)?)\.dll$', f, re.I):
            shutil.copy2(os.path.join(base, f), new)
    with open(os.path.join(new, 'pyvenv.cfg'), 'w', encoding='utf-8') as f:
        f.write(f'home = {base}\ninclude-system-site-packages = true\nversion = {sys.version.split()[0]}\n')
    brand(exe)
    shutil.rmtree(LAUNCHER_DIR, ignore_errors=True)
    os.replace(new, LAUNCHER_DIR)
    print('made', LAUNCHER)
    return LAUNCHER


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'launcher'
    if cmd == 'launcher':
        make_launcher()
    elif cmd == 'version-file' and len(sys.argv) > 2:
        print('wrote', write_version_file(sys.argv[2]))
    else:
        raise SystemExit(__doc__)
