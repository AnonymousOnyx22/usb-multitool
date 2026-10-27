# USB Multitool

A sleek black and white USB toolkit in a single Windows executable.

**Live demo:** https://anonymousonyx22.github.io/usb-multitool/

## Features

- **Drive hub:** pick a target drive with live status indicators
- **Diagnostics:** health gauge, SMART readout, speed test, bad block scanner
- **Format and clean:** FAT32, NTFS, exFAT, EXT4, quick format or zero fill wipe, junk and autorun cleaner
- **Multiboot:** drag and drop ISO files, partition layout and boot menu preview
- **Action console:** expandable live terminal log

> The current build is a **simulation**. It never touches a real disk.

## Download

Grab `USBMultitool.exe` from the [latest release](../../releases/latest) and run it. Nothing to install.

## Build from source

```
build.bat
```

Needs Python 3.10+. Output lands in `dist/USBMultitool.exe`.

## Layout

```
src/main.py   window launcher (pywebview)
src/web/      HTML, CSS, JS interface
docs/         copy of the interface served by GitHub Pages
```
