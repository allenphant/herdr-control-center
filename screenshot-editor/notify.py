#!/usr/bin/env python3
"""Small, clickable screenshot notice for desktops without notification actions."""

import os
import shutil
import subprocess
import sys
import urllib.parse

import gi

gi.require_version("Gdk", "3.0")
gi.require_version("GLib", "2.0")
gi.require_version("Gtk", "3.0")
from gi.repository import Gdk, GLib, Gtk


SOURCE_FILE = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else ""
EDITOR_URL = "http://127.0.0.1:4123/?file=" + urllib.parse.quote(SOURCE_FILE, safe="")


def launch_editor() -> None:
    chrome = shutil.which("google-chrome")
    opener = [chrome, f"--app={EDITOR_URL}"] if chrome else [shutil.which("xdg-open"), EDITOR_URL]
    if opener[0]:
        subprocess.Popen(opener, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


class ScreenshotNotice:
    def __init__(self) -> None:
        self.window = Gtk.Window(title="Screenshot Editor")
        self.window.set_decorated(False)
        self.window.set_resizable(False)
        self.window.set_keep_above(True)
        self.window.set_type_hint(Gdk.WindowTypeHint.NOTIFICATION)
        self.window.connect("destroy", Gtk.main_quit)

        surface = Gtk.EventBox()
        surface.set_name("notice-surface")
        surface.set_visible_window(True)
        surface.add_events(Gdk.EventMask.BUTTON_PRESS_MASK)
        surface.connect("button-press-event", self.activate)

        outer = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=14)
        outer.set_border_width(14)
        icon = Gtk.Image.new_from_icon_name("camera-photo", Gtk.IconSize.DIALOG)
        icon.set_name("notice-icon")
        outer.pack_start(icon, False, False, 0)

        copy = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=3)
        title = Gtk.Label()
        title.set_markup("<b>截圖已完成</b>")
        title.set_xalign(0)
        title.set_name("notice-title")
        copy.pack_start(title, False, False, 0)

        body = Gtk.Label(label="直接點這則通知開啟編輯器；原始截圖會保留。")
        body.set_xalign(0)
        body.set_line_wrap(True)
        body.set_max_width_chars(30)
        body.set_name("notice-body")
        copy.pack_start(body, False, False, 0)
        outer.pack_start(copy, True, True, 0)
        surface.add(outer)
        self.window.add(surface)

        provider = Gtk.CssProvider()
        provider.load_from_data(
            b"""
            #notice-surface {
              background-color: #202825;
              border: 1px solid #506059;
              border-radius: 0;
              color: #edf3ef;
            }
            #notice-surface:hover { background-color: #252e2a; border-color: #71c6b8; }
            #notice-title { color: #edf3ef; font-size: 17px; }
            #notice-body { color: #b5c1bb; font-size: 13px; }
            #notice-icon { color: #f0a061; }
            """
        )
        Gtk.StyleContext.add_provider_for_screen(
            Gdk.Screen.get_default(), provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
        )

    def activate(self, *_args):
        launch_editor()
        self.window.destroy()
        return True

    def close_without_opening(self):
        self.window.destroy()
        return False

    def show(self) -> None:
        self.window.show_all()
        self.position_bottom_right()
        GLib.timeout_add_seconds(5, self.close_without_opening)
        Gtk.main()

    def position_bottom_right(self) -> None:
        screen = Gdk.Screen.get_default()
        monitor = screen.get_primary_monitor()
        geometry = screen.get_monitor_geometry(monitor)
        width, height = self.window.get_size()
        self.window.move(geometry.x + geometry.width - width - 24, geometry.y + geometry.height - height - 28)


if __name__ == "__main__":
    if SOURCE_FILE:
        ScreenshotNotice().show()
