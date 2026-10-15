"""Remembers where the app window was: its position and size, kept inside the screen's usable area (not under the taskbar).

`fit` is pure and tested; `work_areas` asks Windows for the usable area of each monitor.
"""
import sys

DEFAULT_SIZE = (1400, 900)
MIN_SIZE = (1000, 650)


def work_areas():
    """[(x, y, width, height)] in physical pixels for each monitor, excluding the taskbar. [] when unknown (not Windows)."""
    if sys.platform != 'win32':
        return []
    try:
        import ctypes
        from ctypes import wintypes

        class MONITORINFO(ctypes.Structure):
            _fields_ = [('cbSize', wintypes.DWORD), ('rcMonitor', wintypes.RECT), ('rcWork', wintypes.RECT), ('dwFlags', wintypes.DWORD)]

        out = []
        proc_t = ctypes.WINFUNCTYPE(ctypes.c_int, wintypes.HMONITOR, wintypes.HDC, ctypes.POINTER(wintypes.RECT), wintypes.LPARAM)

        def cb(hmon, _hdc, _rect, _data):
            mi = MONITORINFO()
            mi.cbSize = ctypes.sizeof(MONITORINFO)
            if ctypes.windll.user32.GetMonitorInfoW(hmon, ctypes.byref(mi)):
                r = mi.rcWork
                primary = bool(mi.dwFlags & 1)
                out.insert(0, (r.left, r.top, r.right - r.left, r.bottom - r.top)) if primary else out.append((r.left, r.top, r.right - r.left, r.bottom - r.top))
            return 1

        ctypes.windll.user32.EnumDisplayMonitors(None, None, proc_t(cb), 0)
        return out
    except Exception:
        return []


def screen_scale():
    """Windows display scaling as a factor (1.25 for 125%); the window reports logical pixels, the monitors physical ones."""
    if sys.platform != 'win32':
        return 1.0
    try:
        import ctypes
        return max(1.0, ctypes.windll.user32.GetDpiForSystem() / 96)
    except Exception:
        return 1.0


def fit(saved, areas, scale=1.0, min_size=MIN_SIZE, default_size=DEFAULT_SIZE):
    """The window rectangle to open with, in logical pixels: {'x', 'y', 'width', 'height'} (x and y are None to let the system place it).

    `saved` is what was stored last time ({} if nothing); `areas` are the monitors' usable areas in physical pixels. The size is kept
    within the usable area and the position is pulled back inside the monitor the window mostly sits on, so it never opens under
    the taskbar or off screen (a monitor that was unplugged since is handled the same way)."""
    saved = saved if isinstance(saved, dict) else {}

    def num(k):
        v = saved.get(k)
        return v if isinstance(v, (int, float)) and not isinstance(v, bool) else None

    w = num('width') or default_size[0]
    h = num('height') or default_size[1]
    w, h = max(w, min_size[0]), max(h, min_size[1])
    if not areas:
        return dict(x=None if num('x') is None else int(num('x')), y=None if num('y') is None else int(num('y')), width=int(w), height=int(h))
    logical = [(ax / scale, ay / scale, aw / scale, ah / scale) for ax, ay, aw, ah in areas]
    x, y = num('x'), num('y')
    if x is None or y is None:
        area = logical[0]  # the primary monitor
    else:
        cx, cy = x + w / 2, y + h / 2

        def overlap(a):
            return max(0, min(x + w, a[0] + a[2]) - max(x, a[0])) * max(0, min(y + h, a[1] + a[3]) - max(y, a[1]))

        inside = [a for a in logical if a[0] <= cx < a[0] + a[2] and a[1] <= cy < a[1] + a[3]]
        area = inside[0] if inside else max(logical, key=overlap) if any(overlap(a) for a in logical) else logical[0]
    # Never bigger than the usable area (the minimum size yields to a very small screen).
    w, h = min(w, area[2]), min(h, area[3])
    if x is None or y is None:
        x, y = area[0] + (area[2] - w) / 2, area[1] + (area[3] - h) / 2
    x = min(max(x, area[0]), area[0] + area[2] - w)
    y = min(max(y, area[1]), area[1] + area[3] - h)
    return dict(x=int(x), y=int(y), width=int(w), height=int(h))
