// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 dschaefer79
// Written entirely with Claude Code (Anthropic).
// Window Tiling and Resolution menus for GNOME Shell 40 (RHEL 9), with
// legacy imports: the same as extension/extension.js, which needs GNOME
// Shell 45 or later. tiler.js and display.js are shared; the RHEL 9 build
// drops their ES module export line.

const {Clutter, Gio, GLib, GObject, Meta, Shell, St} = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

const Me = ExtensionUtils.getCurrentExtension();
const {DisplayConfig} = Me.imports.display;
const {Tiler} = Me.imports.tiler;

const DBUS_PATH = '/org/dschaefer/TileMenu';
const DBUS_XML = `<node>
  <interface name="org.dschaefer.TileMenu">
    <method name="Tile">
      <arg type="s" direction="in" name="action"/>
    </method>
    <method name="Toggle">
      <arg type="s" direction="in" name="key"/>
      <arg type="b" direction="out" name="on"/>
    </method>
    <method name="SetResolution">
      <arg type="s" direction="in" name="size"/>
    </method>
  </interface>
</node>`;

const SIZE_PATTERN = /^[1-9][0-9]{2,4}x[1-9][0-9]{2,4}$/;

// Shortcut settings keys and the tile action each runs.
const TILE_SHORTCUTS = {
    'shortcut-tile-auto': 'auto',
    'shortcut-tile-columns-4': '4',
    'shortcut-tile-columns-3': '3',
    'shortcut-tile-columns-2': '2',
    'shortcut-tile-rows-3': 'rows-3',
    'shortcut-tile-rows-2': 'rows-2',
    'shortcut-tile-grid-2x2': 'grid-2x2',
    'shortcut-tile-grid-3x2': 'grid-3x2',
    'shortcut-tile-grid-4x2': 'grid-4x2',
    'shortcut-restore': 'restore',
};

// Switches: settings key, the name gnome-tile-menu uses (plasma-tile-menu's)
// and its label.
const TOGGLES = {
    'snap': {key: 'snap', shortcut: 'shortcut-toggle-snap', label: 'Automatic tiling'},
    'tileNew': {key: 'tile-new', shortcut: 'shortcut-toggle-tile-new', label: 'Tile new windows'},
    'disabled': {key: 'disabled', shortcut: 'shortcut-toggle-disabled', label: 'Disable tiling'},
};

// A shortcut such as "<Super><Alt>4" as shown in the menu: "Super+Alt+4".
function accelLabel(accel) {
    if (!accel)
        return '';
    const mods = [];
    let rest = accel;
    for (let m; (m = /^<([^>]+)>/.exec(rest)); rest = rest.slice(m[0].length))
        mods.push(m[1].toLowerCase());
    const names = [
        ['Super', ['super', 'mod4']],
        ['Ctrl', ['primary', 'control', 'ctrl']],
        ['Alt', ['alt', 'mod1']],
        ['Shift', ['shift']],
    ];
    const parts = names.filter(([, ids]) => ids.some(id => mods.includes(id))).map(([name]) => name);
    parts.push(rest.length === 1 ? rest.toUpperCase() : rest);
    return parts.join('+');
}

// How dropping a window works with the current settings.
function snapHint(settings) {
    if (settings.get_boolean('disabled') || !settings.get_boolean('snap'))
        return '';
    const rows = settings.get_boolean('horizontal');
    const columns = settings.get_boolean('vertical') || !rows;
    const swapped = columns && rows ? 'with columns and rows swapped'
        : columns ? 'into rows' : 'into columns';
    const shiftOnly = settings.get_boolean('snap-shift-only');
    const shiftSwap = settings.get_boolean('snap-shift-swap');
    if (shiftOnly && shiftSwap)
        return `Hold Shift while dropping a window to snap it ${swapped}.`;
    if (shiftOnly)
        return 'Hold Shift while dropping a window to snap it.';
    if (shiftSwap)
        return `Drop a window to snap it; hold Shift to snap it ${swapped}.`;
    return 'Drop a window to snap it into place.';
}

const TilingIndicator = GObject.registerClass(
class TilingIndicator extends PanelMenu.Button {
    _init(ext) {
        super._init(0.0, 'Window Tiling');
        this._ext = ext;
        this.add_child(new St.Icon({icon_name: 'view-grid-symbolic', style_class: 'system-status-icon'}));

        const icon = name => Gio.icon_new_for_string(`${ext.path}/icons/${name}-symbolic.svg`);
        // Each entry shows its keyboard shortcut on the right.
        this._accels = [];
        const tileItem = (text, gicon, action) => {
            const item = new PopupMenu.PopupImageMenuItem(text, gicon);
            item.connect('activate', () => ext.tiler.run(action));
            const shortcut = Object.keys(TILE_SHORTCUTS).find(k => TILE_SHORTCUTS[k] === action);
            const accel = new St.Label({
                style_class: 'tilemenu-accel', x_expand: true,
                x_align: Clutter.ActorAlign.END, y_align: Clutter.ActorAlign.CENTER,
            });
            item.add_child(accel);
            this._accels.push([accel, shortcut]);
            this.menu.addMenuItem(item);
            return item;
        };
        const switchItem = toggle => {
            const {key, label} = TOGGLES[toggle];
            const item = new PopupMenu.PopupSwitchMenuItem(label, ext.settings.get_boolean(key));
            item.connect('toggled', (i, state) => ext.settings.set_boolean(key, state));
            this.menu.addMenuItem(item);
            return item;
        };

        this._auto = tileItem('Tile automatically', 'view-app-grid-symbolic', 'auto');
        this._columns = [
            tileItem('Tile in 4 columns', icon('tilemenu-columns-4'), '4'),
            tileItem('Tile in 3 columns', icon('tilemenu-columns-3'), '3'),
            tileItem('Tile in 2 columns', icon('tilemenu-columns-2'), '2'),
        ];
        this._rows = [
            tileItem('Tile in 3 rows', icon('tilemenu-rows-3'), 'rows-3'),
            tileItem('Tile in 2 rows', icon('tilemenu-rows-2'), 'rows-2'),
        ];
        this._grids = [
            tileItem('Tile in 2 × 2 grid', icon('tilemenu-grid-2x2'), 'grid-2x2'),
            tileItem('Tile in 3 × 2 grid', icon('tilemenu-grid-3x2'), 'grid-3x2'),
            tileItem('Tile in 4 × 2 grid', icon('tilemenu-grid-4x2'), 'grid-4x2'),
        ];
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        tileItem('Restore windows', 'view-restore-symbolic', 'restore');
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        // Snap windows into place when they are dropped.
        this._snap = switchItem('snap');
        // Tile each window that opens together with the others.
        this._tileNew = switchItem('tileNew');
        this._disabled = switchItem('disabled');
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this._hint = new PopupMenu.PopupMenuItem('', {reactive: false, can_focus: false});
        this._hint.add_style_class_name('tilemenu-hint');
        this._hint.label.clutter_text.line_wrap = true;
        this.menu.addMenuItem(this._hint);
        const shortcuts = new PopupMenu.PopupImageMenuItem('Keyboard shortcuts…',
            'preferences-desktop-keyboard-shortcuts-symbolic');
        shortcuts.connect('activate', () => ext.openPage('shortcuts'));
        this.menu.addMenuItem(shortcuts);
        const settings = new PopupMenu.PopupImageMenuItem('Settings…', 'preferences-system-symbolic');
        settings.connect('activate', () => ext.openPage('tiling'));
        this.menu.addMenuItem(settings);
        // Take the menu off the top bar; tiling and its shortcuts keep
        // working. "Window Tiling menu" in the settings brings it back.
        const quit = new PopupMenu.PopupImageMenuItem('Quit', 'application-exit-symbolic');
        // Only once the menu has closed: this removes it.
        quit.connect('activate', () => GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            ext.settings.set_boolean('show-tiling-menu', false);
            return GLib.SOURCE_REMOVE;
        }));
        this.menu.addMenuItem(quit);

        this._changedId = ext.settings.connect('changed', () => this._update());
        this.connect('destroy', () => ext.settings.disconnect(this._changedId));
        this._update();
    }

    _update() {
        const s = this._ext.settings;
        const disabled = s.get_boolean('disabled');
        // With both off the tiling uses columns.
        const rows = s.get_boolean('horizontal');
        const columns = s.get_boolean('vertical') || !rows;
        this._auto.visible = s.get_boolean('show-auto');
        this._columns.forEach(item => (item.visible = columns));
        this._rows.forEach(item => (item.visible = rows));
        for (const item of [this._auto, ...this._columns, ...this._rows, ...this._grids,
            this._snap, this._tileNew])
            item.setSensitive(!disabled);
        for (const [accel, shortcut] of this._accels)
            accel.text = accelLabel(s.get_strv(shortcut)[0]);
        this._snap.setToggleState(s.get_boolean('snap'));
        this._tileNew.setToggleState(s.get_boolean('tile-new'));
        this._disabled.setToggleState(disabled);
        const hint = snapHint(s);
        this._hint.label.text = hint;
        this._hint.visible = hint !== '';
    }
});

const ResolutionIndicator = GObject.registerClass(
class ResolutionIndicator extends PanelMenu.Button {
    _init(ext) {
        super._init(0.0, 'Resolution');
        this._ext = ext;
        this._sizes = null;
        this.add_child(new St.Icon({icon_name: 'video-display-symbolic', style_class: 'system-status-icon'}));

        this._section = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this._section);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        const settings = new PopupMenu.PopupImageMenuItem('Settings…', 'preferences-system-symbolic');
        settings.connect('activate', () => ext.openPage('resolutions'));
        this.menu.addMenuItem(settings);
        // Take the menu off the top bar; "Resolution menu" in the settings
        // or "Window Tiling Menu" in the applications brings it back.
        const quit = new PopupMenu.PopupImageMenuItem('Quit', 'application-exit-symbolic');
        // Only once the menu has closed: this removes it.
        quit.connect('activate', () => GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            ext.settings.set_boolean('show-resolution-menu', false);
            return GLib.SOURCE_REMOVE;
        }));
        this.menu.addMenuItem(quit);

        // Find out which sizes the screen offers each time the menu opens.
        this.menu.connect('open-state-changed', (menu, open) => {
            if (open)
                this._refresh();
        });
        this._changedId = ext.settings.connect('changed::resolutions', () => this._rebuild());
        this.connect('destroy', () => ext.settings.disconnect(this._changedId));
        this._rebuild();
    }

    async _refresh() {
        try {
            this._sizes = await this._ext.display.sizes();
        } catch (e) {
            this._sizes = null;
        }
        this._rebuild();
    }

    _rebuild() {
        this._section.removeAll();
        const sizes = this._ext.settings.get_strv('resolutions').filter(r => SIZE_PATTERN.test(r));
        for (const size of sizes) {
            const offered = !this._sizes || this._sizes.offered.has(size);
            const text = size.replace('x', ' × ') + (offered ? '' : ' (not offered by the screen)');
            const item = new PopupMenu.PopupImageMenuItem(text, 'video-display-symbolic');
            item.setSensitive(offered);
            if (this._sizes && this._sizes.current === size)
                item.setOrnament(PopupMenu.Ornament.DOT);
            // setResolution reports failures itself.
            item.connect('activate', () => this._ext.setResolution(size).catch(() => {}));
            this._section.addMenuItem(item);
        }
    }
});

class TileMenuExtension {
    enable() {
        this.path = Me.path;
        this.uuid = Me.uuid;
        this.settings = ExtensionUtils.getSettings();
        this.display = new DisplayConfig(Gio, GLib, 'org.gnome.Mutter.DisplayConfig');
        this.tiler = new Tiler({
            Meta, GLib, Clutter,
            config: () => this._config(),
        });
        this.tiler.enable();

        this._indicators = {};
        this._settingsIds = [
            this.settings.connect('changed::show-tiling-menu', () => this._updateIndicators()),
            this.settings.connect('changed::show-resolution-menu', () => this._updateIndicators()),
        ];
        this._updateIndicators();

        for (const [name, action] of Object.entries(TILE_SHORTCUTS)) {
            Main.wm.addKeybinding(name, this.settings, Meta.KeyBindingFlags.NONE,
                Shell.ActionMode.NORMAL, () => this.tiler.run(action));
        }
        for (const [toggle, {shortcut}] of Object.entries(TOGGLES)) {
            Main.wm.addKeybinding(shortcut, this.settings, Meta.KeyBindingFlags.NONE,
                Shell.ActionMode.NORMAL, () => this.toggle(toggle));
        }

        // A gap in millimetres needs the screens' physical sizes.
        this._monitorsId = Main.layoutManager.connect('monitors-changed', () => {
            this.tiler.monitorsChanged();
            this._updateWidths();
        });
        // At login the extension starts before Mutter offers DisplayConfig.
        this._displayWatch = Gio.bus_watch_name(Gio.BusType.SESSION,
            'org.gnome.Mutter.DisplayConfig', Gio.BusNameWatcherFlags.NONE,
            () => this._updateWidths(), null);

        this._dbus = Gio.DBusExportedObject.wrapJSObject(DBUS_XML, this);
        this._dbus.export(Gio.DBus.session, DBUS_PATH);
    }

    disable() {
        this._dbus.unexport();
        this._dbus = null;
        Gio.bus_unwatch_name(this._displayWatch);
        Main.layoutManager.disconnect(this._monitorsId);
        for (const name of Object.keys(TILE_SHORTCUTS))
            Main.wm.removeKeybinding(name);
        for (const {shortcut} of Object.values(TOGGLES))
            Main.wm.removeKeybinding(shortcut);
        this._settingsIds.forEach(id => this.settings.disconnect(id));
        for (const indicator of Object.values(this._indicators))
            indicator.destroy();
        this._indicators = null;
        this.tiler.disable();
        this.tiler = null;
        this.display = null;
        this.settings = null;
    }

    _config() {
        const s = this.settings;
        return {
            wideMinWidth: s.get_int('wide-min-width'),
            wideColumns: s.get_int('wide-columns'),
            normalColumns: s.get_int('normal-columns'),
            tallMinHeight: s.get_int('tall-min-height'),
            tallRows: s.get_int('tall-rows'),
            normalRows: s.get_int('normal-rows'),
            vertical: s.get_boolean('vertical'),
            horizontal: s.get_boolean('horizontal'),
            gap: s.get_int('gap'),
            gapUnit: s.get_string('gap-unit'),
            gapMm: s.get_int('gap-mm'),
            disabled: s.get_boolean('disabled'),
            tileNew: s.get_boolean('tile-new'),
            snap: s.get_boolean('snap'),
            snapShiftOnly: s.get_boolean('snap-shift-only'),
            snapShiftSwap: s.get_boolean('snap-shift-swap'),
            resizeNeighbours: s.get_boolean('resize-neighbours'),
        };
    }

    _updateIndicators() {
        const wanted = {
            tiling: [this.settings.get_boolean('show-tiling-menu'), TilingIndicator],
            resolution: [this.settings.get_boolean('show-resolution-menu'), ResolutionIndicator],
        };
        for (const [name, [show, Indicator]] of Object.entries(wanted)) {
            if (show && !this._indicators[name]) {
                this._indicators[name] = new Indicator(this);
                Main.panel.addToStatusArea(`${this.uuid}-${name}`, this._indicators[name]);
            } else if (!show && this._indicators[name]) {
                this._indicators[name].destroy();
                delete this._indicators[name];
            }
        }
    }

    async _updateWidths() {
        try {
            const byName = await this.display.widthsMm();
            if (!this.tiler)
                return;
            const manager = Meta.MonitorManager.get();
            const widths = new Map();
            for (const [connector, mm] of byName) {
                const index = manager.get_monitor_for_connector(connector);
                if (index >= 0)
                    widths.set(index, mm);
            }
            this.tiler.setScreenWidthsMm(widths);
        } catch (e) {
            log(`${this.uuid}: could not read the screen sizes: ${e.message}`);
        }
    }

    // Open the settings window on page (tiling, resolutions or shortcuts).
    openPage(page) {
        this.settings.set_string('prefs-page', page);
        ExtensionUtils.openPrefs();
    }

    // Flip a switch (a TOGGLES name), say so on screen and return its state.
    toggle(name) {
        const toggle = TOGGLES[name];
        if (!toggle)
            throw new Error(`unknown switch: ${name}`);
        const on = !this.settings.get_boolean(toggle.key);
        this.settings.set_boolean(toggle.key, on);
        // GNOME Shell 40 shows it on every screen for monitor -1.
        Main.osdWindowManager.show(-1, Gio.ThemedIcon.new('view-grid-symbolic'),
            `${toggle.label}: ${on ? 'on' : 'off'}`, null, null);
        return on;
    }

    async setResolution(size) {
        try {
            if (!SIZE_PATTERN.test(size))
                throw new Error(`invalid resolution: ${size}`);
            await this.display.setResolution(size);
        } catch (e) {
            Main.notifyError('Resolution', e.message);
            throw e;
        }
    }

    // D-Bus methods, for gnome-tile-menu.
    Tile(action) {
        this.tiler.run(action);
    }

    Toggle(key) {
        return this.toggle(key);
    }

    SetResolutionAsync([size], invocation) {
        this.setResolution(size).then(
            () => invocation.return_value(null),
            e => invocation.return_error_literal(Gio.DBusError, Gio.DBusError.FAILED, e.message));
    }
}

function init() {
    return new TileMenuExtension();
}
