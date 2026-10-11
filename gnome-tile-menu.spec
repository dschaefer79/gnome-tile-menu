# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 dschaefer79
# Written entirely with Claude Code (Anthropic).

%global uuid tilemenu@dschaefer79

Name:           gnome-tile-menu
Version:        1.17
Release:        1%{?dist}
Summary:        GNOME Shell top bar menus for window tiling and screen resolution
License:        GPL-3.0-or-later
BuildArch:      noarch
Source0:        %{name}-%{version}.tar.gz

BuildRequires:  desktop-file-utils
BuildRequires:  /usr/bin/glib-compile-schemas
BuildRequires:  python3
Requires:       gnome-shell >= 48
Requires:       /usr/bin/gdbus
Requires:       /usr/bin/gsettings
Requires:       /usr/bin/gnome-extensions
Recommends:     libnotify

%description
The GNOME Shell counterpart of plasma-tile-menu: a GNOME Shell extension
with two menus in the top bar.

Window Tiling tiles the windows of the current workspace into side-by-side
columns, rows stacked top to bottom, or a grid of both: automatically (3
columns on screens at least 5120 pixels wide, such as 5120x1440, and 2
otherwise; rows follow the same rule by screen height), or into 4, 3 or 2
columns, 3 or 2 rows, or a 2x2, 3x2 or 4x2 grid directly, and puts them back with
Restore. New windows can be tiled automatically as they open, into the
layout last used on their screen. Its settings turn columns and rows on or
off, set the auto rules and the gap between windows (in pixels or
millimetres), and can turn on snapping: a window dragged with the mouse and
dropped fills the column, row or grid cell under the pointer. Snapping can
be limited to drops with Shift held, and Shift can swap columns and rows.
Every action can have a keyboard shortcut.

Resolution switches the screen resolution from a list you edit in the
settings (1920x1080, 1900x1000 and 5120x1440 by default). GNOME can only
use sizes the screen offers; others are shown greyed out.

The extension is turned on for each user at their next login, or right
away by running gnome-tile-menu setup. GNOME Shell only finds newly
installed extensions at login, so the menus appear after logging out and
back in.

This project was written entirely with Claude Code, Anthropic's AI coding assistant.

%prep
%autosetup

%build

%install
install -Dpm 0755 gnome-tile-menu %{buildroot}%{_bindir}/gnome-tile-menu
install -Dpm 0644 gnome-tile-menu.desktop %{buildroot}%{_datadir}/applications/gnome-tile-menu.desktop
install -Dpm 0644 gnome-tile-menu-setup.desktop %{buildroot}%{_sysconfdir}/xdg/autostart/gnome-tile-menu-setup.desktop
install -Dpm 0644 org.gnome.shell.extensions.tilemenu.gschema.xml %{buildroot}%{_datadir}/glib-2.0/schemas/org.gnome.shell.extensions.tilemenu.gschema.xml
install -dm 0755 %{buildroot}%{_datadir}/gnome-shell/extensions/%{uuid}/icons
install -pm 0644 extension/*.js extension/metadata.json extension/stylesheet.css %{buildroot}%{_datadir}/gnome-shell/extensions/%{uuid}/
install -pm 0644 extension/icons/*.svg %{buildroot}%{_datadir}/gnome-shell/extensions/%{uuid}/icons/

%check
desktop-file-validate %{buildroot}%{_datadir}/applications/gnome-tile-menu.desktop
desktop-file-validate %{buildroot}%{_sysconfdir}/xdg/autostart/gnome-tile-menu-setup.desktop
glib-compile-schemas --strict --dry-run %{buildroot}%{_datadir}/glib-2.0/schemas
python3 -m json.tool %{buildroot}%{_datadir}/gnome-shell/extensions/%{uuid}/metadata.json >/dev/null

%files
%license LICENSE
%doc README.md
%{_bindir}/gnome-tile-menu
%{_datadir}/applications/gnome-tile-menu.desktop
%config(noreplace) %{_sysconfdir}/xdg/autostart/gnome-tile-menu-setup.desktop
%{_datadir}/glib-2.0/schemas/org.gnome.shell.extensions.tilemenu.gschema.xml
%{_datadir}/gnome-shell/extensions/%{uuid}/

%changelog
* Sun Oct 11 2026 dschaefer79 <7472357+dschaefer79@users.noreply.github.com> - 1.17-1
- Works with GNOME Shell 48 (Debian 13) too
- packaging/build-deb.sh builds a .deb for Debian 13

* Sun Oct 11 2026 dschaefer79 <7472357+dschaefer79@users.noreply.github.com> - 1.16-1
- Default shortcuts no longer clash with GNOME 51's own: the grids are
  Super+Ctrl+Shift+2/3/4 (GNOME opens a new window of a dash app with
  Super+Ctrl+digit) and Restore is Super+Alt+R (Super+Alt+0 resets the
  magnifier). Tested on Fedora 45 with GNOME Shell 51

* Sun Oct 11 2026 dschaefer79 <7472357+dschaefer79@users.noreply.github.com> - 1.15-1
- License: GPL-3.0-or-later (was MIT), with the license text and a
  header in every source file
- README.md describing all features; the project was written entirely
  with Claude, Anthropic's AI assistant

* Sun Oct 11 2026 dschaefer79 <7472357+dschaefer79@users.noreply.github.com> - 1.14-1
- Wayland: a window move the compositor drops (for instance while an
  app is still leaving maximized) is noticed and the window placed
  again; Restore also makes windows fullscreen again that were

* Sat Oct 10 2026 dschaefer79 <7472357+dschaefer79@users.noreply.github.com> - 1.13-1
- Settings: changes wait for Apply. A bar at the top of each page offers
  Apply and Revert while there are changes; closing the window with
  changes not applied asks whether to apply or discard them

* Sat Oct 10 2026 dschaefer79 <7472357+dschaefer79@users.noreply.github.com> - 1.12-1
- Settings: Snapping moved up, right below Tiling; its switch is now
  called "Snap windows into the tiling layout" (the menu's Automatic
  tiling), and a new switch turns GNOME's own edge snapping on or off

* Sat Oct 10 2026 dschaefer79 <7472357+dschaefer79@users.noreply.github.com> - 1.11-1
- Resolution: "Quit" at the end of the menu takes it off the top bar;
  "Resolution menu" in the settings, "Window Tiling Menu" in the
  applications or gnome-tile-menu setup brings it back

* Sat Oct 10 2026 dschaefer79 <7472357+dschaefer79@users.noreply.github.com> - 1.10-1
- "Save settings to file…" and "Load settings from file…" in the settings
  window's Tiling and Resolutions pages: the settings of the tiling and
  resolution menus and the keyboard shortcuts in one file. New commands:
  gnome-tile-menu export|import FILE

* Sat Oct 10 2026 dschaefer79 <7472357+dschaefer79@users.noreply.github.com> - 1.9-1
- "Window Tiling Menu" in the applications menu (Utilities) puts the
  tiling menu on the panel, also after Quit

* Sat Oct 10 2026 dschaefer79 <7472357+dschaefer79@users.noreply.github.com> - 1.8-1
- Window Tiling: "Quit" at the end of the menu takes the menu off the top bar; tiling and
  its shortcuts keep working. "gnome-tile-menu setup" or "Window Tiling
  menu" in the settings brings it back

* Sat Oct 10 2026 dschaefer79 <7472357+dschaefer79@users.noreply.github.com> - 1.7-1
- Window Tiling: the menu shows the keyboard shortcut of each tiling
  entry and of Restore windows, on the right, and keeps it up to date

* Sat Oct 10 2026 dschaefer79 <7472357+dschaefer79@users.noreply.github.com> - 1.6-1
- Window Tiling: default keyboard shortcuts: Super+Alt+A tiles
  automatically, Super+Alt+2, 3 or 4 tiles in 2, 3 or 4 columns,
  Super+Ctrl+Alt+2 or 3 in 2 or 3 rows, Super+Ctrl+2, 3 or 4 in a 2 x 2,
  3 x 2 or 4 x 2 grid, and Super+Alt+0 restores the windows.
  Existing settings keep their own keys; "Turn all shortcuts off" now
  clears them instead of going back to the defaults

* Sat Oct 10 2026 dschaefer79 <7472357+dschaefer79@users.noreply.github.com> - 1.5-1
- Window Tiling: layouts keep their columns, rows and cells again (undoing
  the change of 1.4); the windows that do not fit are now tiled too,
  into the cell under their middle, behind the windows in front

* Sat Oct 10 2026 dschaefer79 <7472357+dschaefer79@users.noreply.github.com> - 1.4-1
- Window Tiling: the menu entries and shortcuts tile all windows on the
  screen, not only as many as the layout has cells; a column with more
  windows than rows splits its height among all of them

* Sat Oct 10 2026 dschaefer79 <7472357+dschaefer79@users.noreply.github.com> - 1.3-1
- Window Tiling: setting "Resize neighbouring windows together" (off by
  default): dragging the left or right edge of a window also moves the
  edge of the window beside it, keeping the gap, so windows side by side
  stay together

* Sat Oct 10 2026 dschaefer79 <7472357+dschaefer79@users.noreply.github.com> - 1.2-1
- Resolutions settings: an Edit button on each resolution loads it into the
  width and height fields to change it

* Sat Oct 10 2026 dschaefer79 <7472357+dschaefer79@users.noreply.github.com> - 1.1-1
- Window Tiling: menu entries and shortcuts to tile in 4 columns and in a
  4 x 2 grid

* Sat Oct 10 2026 dschaefer79 <7472357+dschaefer79@users.noreply.github.com> - 1.0-1
- Initial package: GNOME Shell port of plasma-tile-menu 1.12
