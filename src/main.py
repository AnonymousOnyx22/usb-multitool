import os
import sys

import webview


def web_root():
    base = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base, "web", "index.html")


if __name__ == "__main__":
    webview.create_window("USB Multitool", web_root(), width=1200, height=800,
                          min_size=(900, 600), background_color="#050505")
    webview.start()
