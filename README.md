# gnome-tile-menu

Two menus for the GNOME Shell top bar: **Window Tiling** arranges the windows
of the current workspace, and **Resolution** switches the screen resolution.
Works on Wayland and X11 (GNOME Shell 48 and later, and GNOME Shell 40 on
RHEL 9).

This project was written entirely with
[Claude Code](https://claude.com/claude-code), Anthropic's AI coding
assistant: all code, packaging and documentation.

## Window Tiling

- **Layouts:** tile automatically, or into 4, 3 or 2 columns, 3 or 2 rows, or a
  2 × 2, 3 × 2 or 4 × 2 grid. "Automatically" picks the number of columns and
  rows from the screen size (3 columns from 5120 pixels wide, otherwise 2, by
  default).
- **All windows are tiled:** the most recently used windows fill the layout,
  and the others go into the cell under their middle, behind them.
- **Restore windows** puts every window back where it was, maximized or
  fullscreen again if it was.
- **Tile new windows:** each window that opens is tiled with the others, in
  the layout last used on its screen.
- **Snapping:** a window dragged with the mouse and dropped fills the column,
  row or grid cell under the pointer. Optionally only with Shift held, or with
  Shift swapping columns and rows. A switch also turns GNOME's own edge
  snapping on or off.
- **Resize neighbouring windows together:** dragging the edge of a window also
  moves the edge of the window beside it.
- **Gap** between windows, in pixels or millimetres.
- **Keyboard shortcuts** for every action, shown in the menu. Default keys:
  Super+Alt+A (auto), Super+Alt+2/3/4 (columns), Super+Ctrl+Alt+2/3 (rows),
  Super+Ctrl+Shift+2/3/4 (grids), Super+Alt+R (restore). They avoid
  GNOME's own keys, such as Super+Ctrl+digit and Super+Alt+0.
- **Disable tiling** turns all tiling and snapping off; Restore still works.

## Resolution

- Switches to the resolutions in your list (1920 × 1080, 1900 × 1000 and
  5120 × 1440 by default). Sizes the screen does not offer are shown greyed out.
- Edit the list in the settings: add, remove, edit and reorder.

## Settings and menus

- The settings window (Extensions app, or "Settings…" in a menu) has pages
  for tiling, resolutions and shortcuts. Changes wait for **Apply**; Revert
  undoes them, and closing asks about changes not applied yet.
- **Save settings to file… / Load settings from file…** keep a copy of the
  settings of both menus and the shortcuts, or move them to another computer.
- **Quit** at the bottom of each menu takes it off the top bar. "Window Tiling
  Menu" in the applications menu brings both back.

## Command line

`gnome-tile-menu` runs the same actions: `tile auto|4|3|2|rows-3|rows-2|grid-2x2|grid-3x2|grid-4x2|restore`,
`resolution WIDTHxHEIGHT`, `toggle snap|tileNew|disabled`, `settings`,
`shortcuts`, `setup`, `remove`, `export FILE` and `import FILE`.

## Installing

From the [latest GitHub release](https://github.com/dschaefer79/gnome-tile-menu/releases/latest):

| System | Desktop | Package |
|---|---|---|
| Fedora 45 | GNOME 51 | `gnome-tile-menu-1.18-1.fc45.noarch.rpm` |
| Fedora 44 | GNOME 50 | `gnome-tile-menu-1.18-1.fc44.noarch.rpm` |
| Ubuntu 26.10 | GNOME 51 | `gnome-tile-menu_1.18-1_all.deb` |
| Ubuntu 26.04 | GNOME 50 | `gnome-tile-menu_1.18-1_all.deb` |
| Debian 13 (trixie) | GNOME 48 | `gnome-tile-menu_1.18-1_all.deb` |
| RHEL 9, Rocky Linux 9, AlmaLinux 9 | GNOME 40 | `gnome-tile-menu-1.18-1.el9.noarch.rpm` |

On Fedora:

```
sudo dnf install https://github.com/dschaefer79/gnome-tile-menu/releases/download/v1.18/gnome-tile-menu-1.18-1.fc45.noarch.rpm
```

(`fc44` instead of `fc45` on Fedora 44).

On RHEL 9 and its rebuilds (Rocky Linux, AlmaLinux):

```
sudo dnf install https://github.com/dschaefer79/gnome-tile-menu/releases/download/v1.18/gnome-tile-menu-1.18-1.el9.noarch.rpm
```

GNOME Shell 40 cannot load the extension in `extension/`, so the RHEL 9
package uses [extension-gnome40/](extension-gnome40/): the same menus and
settings window with GNOME 40's legacy imports and libadwaita 1.4.

On Ubuntu and Debian:

```
wget https://github.com/dschaefer79/gnome-tile-menu/releases/download/v1.18/gnome-tile-menu_1.18-1_all.deb
sudo apt install ./gnome-tile-menu_1.18-1_all.deb
```

Log out and back in afterwards: GNOME Shell only finds newly installed
extensions at login.

## Building the .deb

```
git archive --prefix=gnome-tile-menu-1.18/ -o gnome-tile-menu-1.18.tar.gz HEAD
packaging/build-deb.sh gnome-tile-menu-1.18.tar.gz 1.18 .
```

## Building the RPM

```
git archive --prefix=gnome-tile-menu-1.18/ -o ~/rpmbuild/SOURCES/gnome-tile-menu-1.18.tar.gz HEAD
rpmbuild -ba gnome-tile-menu.spec
```

Built on RHEL 9 (or Rocky or AlmaLinux 9), the same commands make the
package for GNOME Shell 40.

## License

GPL-3.0-or-later. See [LICENSE](LICENSE).
Copyright (C) 2026 dschaefer79.
