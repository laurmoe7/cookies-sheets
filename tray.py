"""A notification-area (system tray) icon with Open and Quit, for running the app in a web browser without its own window.

Windows only, plain ctypes (no extra packages). `run` blocks until Quit is chosen; it returns False at once if the icon could not be made.
"""
import ctypes
import os
import sys
import threading
from ctypes import wintypes

WM_DESTROY, WM_COMMAND, WM_CLOSE, WM_USER = 0x0002, 0x0111, 0x0010, 0x0400
WM_LBUTTONDBLCLK, WM_RBUTTONUP = 0x0203, 0x0205
NIM_ADD, NIM_DELETE = 0, 2
NIF_MESSAGE, NIF_ICON, NIF_TIP = 1, 2, 4
MF_STRING, MF_SEPARATOR = 0, 0x800
TPM_RIGHTBUTTON, TPM_RETURNCMD = 2, 0x100
IMAGE_ICON, LR_LOADFROMFILE, LR_DEFAULTSIZE = 1, 0x10, 0x40
IDI_APPLICATION = 32512
CALLBACK = WM_USER + 1
ID_OPEN, ID_QUIT = 1001, 1002
CLASS_NAME = 'CookiesSheetsTray'


def available():
    return sys.platform == 'win32'


if available():
    LRESULT = ctypes.c_ssize_t
    WNDPROC = ctypes.WINFUNCTYPE(LRESULT, wintypes.HWND, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM)

    class WNDCLASS(ctypes.Structure):
        _fields_ = [('style', wintypes.UINT), ('lpfnWndProc', WNDPROC), ('cbClsExtra', ctypes.c_int), ('cbWndExtra', ctypes.c_int),
                    ('hInstance', wintypes.HINSTANCE), ('hIcon', wintypes.HANDLE), ('hCursor', wintypes.HANDLE),
                    ('hbrBackground', wintypes.HANDLE), ('lpszMenuName', wintypes.LPCWSTR), ('lpszClassName', wintypes.LPCWSTR)]

    class NOTIFYICONDATA(ctypes.Structure):
        _fields_ = [('cbSize', wintypes.DWORD), ('hWnd', wintypes.HWND), ('uID', wintypes.UINT), ('uFlags', wintypes.UINT),
                    ('uCallbackMessage', wintypes.UINT), ('hIcon', wintypes.HANDLE), ('szTip', wintypes.WCHAR * 128)]

    user32, shell32, kernel32 = ctypes.windll.user32, ctypes.windll.shell32, ctypes.windll.kernel32
    user32.DefWindowProcW.restype = LRESULT
    user32.DefWindowProcW.argtypes = [wintypes.HWND, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM]
    user32.CreateWindowExW.restype = wintypes.HWND
    user32.CreateWindowExW.argtypes = [wintypes.DWORD, wintypes.LPCWSTR, wintypes.LPCWSTR, wintypes.DWORD, ctypes.c_int, ctypes.c_int,
                                       ctypes.c_int, ctypes.c_int, wintypes.HWND, wintypes.HANDLE, wintypes.HINSTANCE, wintypes.LPVOID]
    user32.RegisterClassW.argtypes = [ctypes.POINTER(WNDCLASS)]
    user32.LoadImageW.restype = wintypes.HANDLE
    user32.LoadImageW.argtypes = [wintypes.HINSTANCE, wintypes.LPCWSTR, wintypes.UINT, ctypes.c_int, ctypes.c_int, wintypes.UINT]
    user32.LoadIconW.restype = wintypes.HANDLE
    user32.LoadIconW.argtypes = [wintypes.HINSTANCE, ctypes.c_void_p]
    user32.CreatePopupMenu.restype = wintypes.HANDLE
    user32.AppendMenuW.argtypes = [wintypes.HANDLE, wintypes.UINT, ctypes.c_size_t, wintypes.LPCWSTR]
    user32.TrackPopupMenu.argtypes = [wintypes.HANDLE, wintypes.UINT, ctypes.c_int, ctypes.c_int, ctypes.c_int, wintypes.HWND, wintypes.LPVOID]
    user32.DestroyMenu.argtypes = [wintypes.HANDLE]
    user32.SetForegroundWindow.argtypes = [wintypes.HWND]
    user32.PostMessageW.argtypes = [wintypes.HWND, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM]
    user32.DestroyWindow.argtypes = [wintypes.HWND]
    user32.GetMessageW.argtypes = [ctypes.POINTER(wintypes.MSG), wintypes.HWND, wintypes.UINT, wintypes.UINT]
    user32.DispatchMessageW.argtypes = [ctypes.POINTER(wintypes.MSG)]
    user32.FindWindowW.restype = wintypes.HWND
    user32.FindWindowW.argtypes = [wintypes.LPCWSTR, wintypes.LPCWSTR]
    shell32.Shell_NotifyIconW.argtypes = [wintypes.DWORD, ctypes.POINTER(NOTIFYICONDATA)]
    kernel32.GetModuleHandleW.restype = wintypes.HINSTANCE
    kernel32.GetModuleHandleW.argtypes = [wintypes.LPCWSTR]


def quit_running():
    """Ask a running tray icon (this process's) to quit, as the Quit menu item does. Used by tests."""
    hwnd = user32.FindWindowW(CLASS_NAME, None) if available() else None
    if hwnd:
        user32.PostMessageW(hwnd, WM_COMMAND, ID_QUIT, 0)
    return bool(hwnd)


def run(tip, on_open, icon_path=None, ready=None):
    """Show the icon until Quit. Double-click or Open calls `on_open()`. `ready` (a threading.Event) is set once the icon is up.
    Returns True after a Quit, False if the icon could not be created."""
    if not available():
        return False
    state = {'quit': False}
    hinst = kernel32.GetModuleHandleW(None)
    icon = None
    if icon_path and os.path.exists(icon_path):
        icon = user32.LoadImageW(None, icon_path, IMAGE_ICON, 0, 0, LR_LOADFROMFILE | LR_DEFAULTSIZE)
    if not icon:
        icon = user32.LoadIconW(None, IDI_APPLICATION)
    nid = NOTIFYICONDATA()
    nid.cbSize = ctypes.sizeof(NOTIFYICONDATA)

    def remove():
        shell32.Shell_NotifyIconW(NIM_DELETE, ctypes.byref(nid))

    def menu(hwnd):
        m = user32.CreatePopupMenu()
        user32.AppendMenuW(m, MF_STRING, ID_OPEN, "Open Cookie's Sheets")
        user32.AppendMenuW(m, MF_SEPARATOR, 0, None)
        user32.AppendMenuW(m, MF_STRING, ID_QUIT, 'Quit')
        pt = wintypes.POINT()
        user32.GetCursorPos(ctypes.byref(pt))
        user32.SetForegroundWindow(hwnd)  # without this the menu does not close when you click elsewhere
        cmd = user32.TrackPopupMenu(m, TPM_RIGHTBUTTON | TPM_RETURNCMD, pt.x, pt.y, 0, hwnd, None)
        user32.DestroyMenu(m)
        return cmd

    def proc(hwnd, msg, wparam, lparam):
        try:
            if msg == CALLBACK:
                if lparam == WM_LBUTTONDBLCLK:
                    on_open()
                elif lparam == WM_RBUTTONUP:
                    cmd = menu(hwnd)
                    if cmd == ID_OPEN:
                        on_open()
                    elif cmd == ID_QUIT:
                        user32.PostMessageW(hwnd, WM_CLOSE, 0, 0)
                return 0
            if msg == WM_COMMAND:
                if wparam & 0xFFFF == ID_OPEN:
                    on_open()
                elif wparam & 0xFFFF == ID_QUIT:
                    user32.PostMessageW(hwnd, WM_CLOSE, 0, 0)
                return 0
            if msg == WM_CLOSE:
                state['quit'] = True
                remove()
                user32.DestroyWindow(hwnd)
                return 0
            if msg == WM_DESTROY:
                user32.PostQuitMessage(0)
                return 0
        except Exception:
            return 0
        return user32.DefWindowProcW(hwnd, msg, wparam, lparam)

    cb = WNDPROC(proc)  # kept referenced for as long as the window lives
    wc = WNDCLASS()
    wc.lpfnWndProc, wc.hInstance, wc.lpszClassName = cb, hinst, CLASS_NAME
    user32.RegisterClassW(ctypes.byref(wc))  # registering twice (a second run in one process) fails harmlessly
    hwnd = user32.CreateWindowExW(0, CLASS_NAME, "Cookie's Sheets", 0, 0, 0, 0, 0, None, None, hinst, None)
    if not hwnd:
        return False
    nid.hWnd, nid.uID, nid.uFlags, nid.uCallbackMessage, nid.hIcon = hwnd, 1, NIF_MESSAGE | NIF_ICON | NIF_TIP, CALLBACK, icon
    nid.szTip = tip[:127]
    if not shell32.Shell_NotifyIconW(NIM_ADD, ctypes.byref(nid)):
        user32.DestroyWindow(hwnd)
        return False
    if isinstance(ready, threading.Event):
        ready.set()
    msg = wintypes.MSG()
    while user32.GetMessageW(ctypes.byref(msg), None, 0, 0) > 0:
        user32.TranslateMessage(ctypes.byref(msg))
        user32.DispatchMessageW(ctypes.byref(msg))
    return state['quit']
