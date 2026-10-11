#!/bin/sh
# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 dschaefer79
# Written entirely with Claude Code (Anthropic).
# Build gnome-tile-menu as a .deb for Debian 13 (needs dpkg-deb).
#   build-deb.sh SOURCE_TARBALL VERSION OUTDIR
# The tarball is a git archive with the top directory gnome-tile-menu-VERSION.
set -eu
tarball=$1 version=$2 out=$3
name=gnome-tile-menu
uuid=tilemenu@dschaefer79
revision=1
work=$(mktemp -d)
tar xzf "$tarball" -C "$work"
src=$work/$name-$version
root=$work/root

# The files, where the RPM puts them.
install -Dm 0755 "$src/$name" "$root/usr/bin/$name"
# Debian wants the shell at /bin/sh.
sed -i '1s|^#!/usr/bin/sh$|#!/bin/sh|' "$root/usr/bin/$name"
install -Dm 0644 "$src/$name.desktop" "$root/usr/share/applications/$name.desktop"
install -Dm 0644 "$src/$name-setup.desktop" "$root/etc/xdg/autostart/$name-setup.desktop"
install -Dm 0644 "$src/org.gnome.shell.extensions.tilemenu.gschema.xml" \
    "$root/usr/share/glib-2.0/schemas/org.gnome.shell.extensions.tilemenu.gschema.xml"
ext=$root/usr/share/gnome-shell/extensions/$uuid
install -Dm 0644 -t "$ext" "$src"/extension/*.js "$src/extension/metadata.json" "$src/extension/stylesheet.css"
install -Dm 0644 -t "$ext/icons" "$src"/extension/icons/*.svg

# Documentation, as Debian wants it.
doc=$root/usr/share/doc/$name
install -Dm 0644 "$src/README.md" "$doc/README.md"
cat > "$doc/copyright" <<EOF
Format: https://www.debian.org/doc/packaging-manuals/copyright-format/1.0/
Upstream-Name: $name
Upstream-Contact: dschaefer79 <7472357+dschaefer79@users.noreply.github.com>
Source: https://github.com/dschaefer79/$name
Comment: Written entirely with Claude Code, Anthropic's AI coding assistant.

Files: *
Copyright: 2026 dschaefer79
License: GPL-3.0-or-later

License: GPL-3.0-or-later
 This program is free software: you can redistribute it and/or modify
 it under the terms of the GNU General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.
 .
 This program is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU General Public License for more details.
 .
 On Debian systems, the complete text of the GNU General Public License
 version 3 can be found in "/usr/share/common-licenses/GPL-3".
EOF
cat > "$work/changelog" <<EOF
$name ($version-$revision) stable; urgency=medium

  * Package for Debian 13 (trixie), built from
    https://github.com/dschaefer79/$name tag v$version.

 -- dschaefer79 <7472357+dschaefer79@users.noreply.github.com>  $(date -R)
EOF
gzip -9n -c "$work/changelog" > "$doc/changelog.Debian.gz"
chmod 0644 "$doc/changelog.Debian.gz"

# Control files. The schema is compiled by GLib's dpkg trigger.
mkdir -p "$root/DEBIAN"
size=$(du -sk --exclude=DEBIAN "$root" | cut -f1)
cat > "$root/DEBIAN/control" <<EOF
Package: $name
Version: $version-$revision
Architecture: all
Maintainer: dschaefer79 <7472357+dschaefer79@users.noreply.github.com>
Installed-Size: $size
Depends: gnome-shell (>= 48), libglib2.0-bin
Recommends: libnotify-bin
Section: gnome
Priority: optional
Homepage: https://github.com/dschaefer79/$name
Description: GNOME Shell top bar menus for window tiling and screen resolution
 A GNOME Shell extension with two menus in the top bar. Window Tiling tiles
 the windows of the current workspace into columns, rows or a grid
 (automatically, 2, 3 or 4 columns, 2 or 3 rows, a 2 x 2, 3 x 2 or 4 x 2
 grid), puts them back with Restore, can tile new windows as they open and
 snap dropped windows into place, with keyboard shortcuts for every action.
 Resolution switches the screen resolution from a list you edit.
 .
 The extension is turned on for each user at their next login, or right
 away by running gnome-tile-menu setup.
 .
 Written entirely with Claude Code, Anthropic's AI coding assistant.
EOF
echo /etc/xdg/autostart/$name-setup.desktop > "$root/DEBIAN/conffiles"

mkdir -p "$out"
dpkg-deb --root-owner-group --build "$root" "$out/${name}_${version}-${revision}_all.deb"
rm -rf "$work"
