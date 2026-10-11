// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 dschaefer79
// Written entirely with Claude Code (Anthropic).
// Settings window: the counterpart of the Plasma widgets' settings pages,
// plus the keyboard shortcuts, which GNOME keeps per extension.

import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const SHORTCUTS = [
    ['shortcut-tile-auto', 'Tile automatically'],
    ['shortcut-tile-columns-4', 'Tile in 4 columns'],
    ['shortcut-tile-columns-3', 'Tile in 3 columns'],
    ['shortcut-tile-columns-2', 'Tile in 2 columns'],
    ['shortcut-tile-rows-3', 'Tile in 3 rows'],
    ['shortcut-tile-rows-2', 'Tile in 2 rows'],
    ['shortcut-tile-grid-2x2', 'Tile in 2 × 2 grid'],
    ['shortcut-tile-grid-3x2', 'Tile in 3 × 2 grid'],
    ['shortcut-tile-grid-4x2', 'Tile in 4 × 2 grid'],
    ['shortcut-restore', 'Restore windows'],
    ['shortcut-toggle-snap', 'Turn automatic tiling on or off'],
    ['shortcut-toggle-tile-new', 'Turn tiling new windows on or off'],
    ['shortcut-toggle-disabled', 'Disable or enable tiling'],
];

function switchRow(settings, key, title, subtitle = '') {
    const row = new Adw.SwitchRow({title, subtitle});
    settings.bind(key, row, 'active', Gio.SettingsBindFlags.DEFAULT);
    return row;
}

function spinRow(settings, key, title, lower, upper) {
    const row = Adw.SpinRow.new_with_range(lower, upper, 1);
    row.title = title;
    settings.bind(key, row, 'value', Gio.SettingsBindFlags.DEFAULT);
    return row;
}

// Changes wait for Apply: the settings are in delay mode, and each page
// starts with a bar to apply or revert them, shown while there are any.
function applyGroup(window) {
    const group = new Adw.PreferencesGroup();
    const row = new Adw.ActionRow({
        title: 'Changes not applied yet',
        subtitle: 'Apply them to use them, or Revert to go back.',
    });
    const revert = new Gtk.Button({label: 'Revert', valign: Gtk.Align.CENTER});
    revert.connect('clicked', () => window._pending.revert());
    const apply = new Gtk.Button({
        label: 'Apply', valign: Gtk.Align.CENTER, css_classes: ['suggested-action'],
    });
    apply.connect('clicked', () => window._pending.apply());
    row.add_suffix(revert);
    row.add_suffix(apply);
    group.add(row);
    const update = () => (group.visible = window._pending.has());
    window._pending.watch(update);
    update();
    return group;
}

// Save or load the settings of both menus and the shortcuts, through
// gnome-tile-menu export|import; problems are shown at the window's bottom.
function settingsFileGroup(window) {
    const group = new Adw.PreferencesGroup({
        title: 'Settings file',
        description: 'The settings of both menus and the keyboard shortcuts, ' +
            'to keep a copy or to use them on another computer.',
    });
    const filter = new Gtk.FileFilter({name: 'Settings files'});
    filter.add_pattern('*.conf');
    const filters = new Gio.ListStore({item_type: Gtk.FileFilter});
    filters.append(filter);
    const run = (command, file) => {
        if (command === 'export')
            window._pending.apply();
        else
            window._pending.revert();
        const proc = Gio.Subprocess.new(['gnome-tile-menu', command, file.get_path()],
            Gio.SubprocessFlags.STDERR_PIPE);
        proc.communicate_utf8_async(null, null, (p, res) => {
            const [, , stderr] = p.communicate_utf8_finish(res);
            const text = p.get_successful()
                ? (command === 'export' ? `Saved to ${file.get_basename()}`
                    : `Loaded from ${file.get_basename()}`)
                : stderr.trim().replace(/^gnome-tile-menu: /, '');
            window.add_toast(new Adw.Toast({title: GLib.markup_escape_text(text, -1), timeout: 5}));
        });
    };
    const save = new Adw.ButtonRow({title: 'Save settings to file…'});
    save.connect('activated', () => {
        const dialog = new Gtk.FileDialog({
            title: 'Save Window Tiling settings', initial_name: 'tile-menu-settings.conf', filters,
        });
        dialog.save(window, null, (d, res) => {
            try {
                run('export', d.save_finish(res));
            } catch (e) {
                // Cancelled.
            }
        });
    });
    const load = new Adw.ButtonRow({title: 'Load settings from file…'});
    load.connect('activated', () => {
        const dialog = new Gtk.FileDialog({title: 'Load Window Tiling settings', filters});
        dialog.open(window, null, (d, res) => {
            try {
                run('import', d.open_finish(res));
            } catch (e) {
                // Cancelled.
            }
        });
    });
    group.add(save);
    group.add(load);
    return group;
}

// Sizes the primary screen offers, as "WIDTHxHEIGHT", or null if unknown.
function offeredSizes() {
    try {
        const reply = Gio.DBus.session.call_sync('org.gnome.Mutter.DisplayConfig',
            '/org/gnome/Mutter/DisplayConfig', 'org.gnome.Mutter.DisplayConfig',
            'GetCurrentState', null, null, Gio.DBusCallFlags.NONE, 5000, null);
        const [, monitors, logical] = reply.recursiveUnpack();
        const primary = logical.find(l => l[4]) || logical[0];
        const monitor = primary && monitors.find(m => m[0][0] === primary[5][0][0]);
        return monitor ? new Set(monitor[1].map(m => `${m[1]}x${m[2]}`)) : null;
    } catch (e) {
        return null;
    }
}

// Ask for a new shortcut; done gets [] to turn it off, or [accelerator].
function captureShortcut(parent, title, done) {
    const label = new Gtk.Label({
        label: 'Press the new shortcut.\n\nEsc cancels, Backspace turns the shortcut off.',
        justify: Gtk.Justification.CENTER,
        wrap: true,
        vexpand: true,
        margin_start: 24,
        margin_end: 24,
        margin_bottom: 24,
    });
    const view = new Adw.ToolbarView({content: label});
    view.add_top_bar(new Adw.HeaderBar());
    const dialog = new Adw.Dialog({title, content_width: 420, content_height: 220, child: view});

    const keys = new Gtk.EventControllerKey();
    keys.connect('key-pressed', (controller, keyval, keycode, state) => {
        const mask = state & Gtk.accelerator_get_default_mod_mask();
        if (!mask && keyval === Gdk.KEY_Escape) {
            dialog.close();
        } else if (!mask && keyval === Gdk.KEY_BackSpace) {
            done([]);
            dialog.close();
        } else if (Gtk.accelerator_valid(keyval, mask) &&
                   // Plain keys would stop typing them; function keys are fine.
                   (mask || (keyval >= Gdk.KEY_F1 && keyval <= Gdk.KEY_F35))) {
            done([Gtk.accelerator_name_with_keycode(null, keyval, keycode, mask)]);
            dialog.close();
        }
        return Gdk.EVENT_STOP;
    });
    dialog.add_controller(keys);
    dialog.present(parent);
}

export default class TileMenuPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        // The page to show is passed through the settings right away.
        const live = this.getSettings();
        // Keep the settings objects alive as long as the window.
        window._settings = [settings, live];
        window.set_default_size(660, 760);

        // Settings whose changes wait for Apply, and who to tell when that
        // changes.
        const delayed = [];
        const watchers = [];
        window._pending = {
            add(s) {
                s.delay();
                delayed.push(s);
                s.connect('notify::has-unapplied', () => watchers.forEach(w => w()));
            },
            has: () => delayed.some(s => s.has_unapplied),
            apply: () => delayed.forEach(s => s.apply()),
            revert: () => delayed.forEach(s => s.revert()),
            watch: fn => watchers.push(fn),
        };
        window._pending.add(settings);
        window.add(this._tilingPage(settings, window));
        window.add(this._resolutionsPage(settings, window));
        window.add(this._shortcutsPage(settings, window));

        // The menus' "Settings…" and "Keyboard shortcuts…" ask for a page,
        // also while the window is already open.
        const showPage = () => {
            const page = live.get_string('prefs-page');
            if (page) {
                window.set_visible_page_name(page);
                live.set_string('prefs-page', '');
            }
        };
        const id = live.connect('changed::prefs-page', showPage);
        // Ask about changes not applied yet before closing.
        window.connect('close-request', () => {
            if (!window._pending.has()) {
                live.disconnect(id);
                return false;
            }
            const dialog = new Adw.AlertDialog({
                heading: 'Apply your changes?',
                body: 'Some settings were changed but not applied yet.',
            });
            dialog.add_response('cancel', 'Cancel');
            dialog.add_response('discard', 'Discard');
            dialog.add_response('apply', 'Apply');
            dialog.set_response_appearance('discard', Adw.ResponseAppearance.DESTRUCTIVE);
            dialog.set_response_appearance('apply', Adw.ResponseAppearance.SUGGESTED);
            dialog.set_default_response('apply');
            dialog.set_close_response('cancel');
            dialog.choose(window, null, (d, res) => {
                const response = d.choose_finish(res);
                if (response === 'apply')
                    window._pending.apply();
                else if (response === 'discard')
                    window._pending.revert();
                else
                    return;
                window.close();
            });
            return true;
        });
        showPage();
    }

    _tilingPage(settings, window) {
        const page = new Adw.PreferencesPage({name: 'tiling', title: 'Tiling', icon_name: 'view-grid-symbolic'});
        page.add(applyGroup(window));

        const bar = new Adw.PreferencesGroup({title: 'Top bar'});
        bar.add(switchRow(settings, 'show-tiling-menu', 'Window Tiling menu'));
        bar.add(switchRow(settings, 'show-resolution-menu', 'Resolution menu'));
        page.add(bar);

        const tiling = new Adw.PreferencesGroup({title: 'Tiling'});
        tiling.add(switchRow(settings, 'disabled', 'Disable tiling completely',
            'Nothing is tiled or snapped while this is on; Restore windows still works.'));
        const tileNew = switchRow(settings, 'tile-new', 'Tile new windows automatically',
            'Each window that opens is tiled together with the others on its screen, ' +
            'in the layout last used there (at first, “Tile automatically”).');
        tiling.add(tileNew);
        const showAuto = switchRow(settings, 'show-auto', 'Show “Tile automatically” in the menu',
            'Turn off to keep only the entries with a fixed number of columns or rows.');
        tiling.add(showAuto);
        page.add(tiling);

        // Snapping comes right after: it is what most people look for.
        const snapping = new Adw.PreferencesGroup({title: 'Snapping'});
        const snap = switchRow(settings, 'snap', 'Snap windows into the tiling layout',
            'A window dragged with the mouse and dropped fills the column, row or grid ' +
            'cell under the pointer. The same as “Automatic tiling” in the menu.');
        const shiftOnly = switchRow(settings, 'snap-shift-only', 'Only when Shift is held while dropping');
        const shiftSwap = switchRow(settings, 'snap-shift-swap', '');
        [snap, shiftOnly, shiftSwap].forEach(row => snapping.add(row));
        // GNOME's own snapping to half or all of the screen at its edges.
        const mutter = new Gio.Settings({schema_id: 'org.gnome.mutter'});
        window._settings.push(mutter);
        window._pending.add(mutter);
        const edge = new Adw.SwitchRow({
            title: 'GNOME’s own edge snapping',
            subtitle: 'A window dragged to the left or right edge of the screen fills that half, ' +
                'and to the top edge the whole screen. Independent of the tiling layout.',
        });
        mutter.bind('edge-tiling', edge, 'active', Gio.SettingsBindFlags.DEFAULT);
        page.connect('destroy', () => Gio.Settings.unbind(edge, 'active'));
        snapping.add(edge);
        page.add(snapping);

        const vertical = new Adw.PreferencesGroup({
            title: 'Vertical',
            description: 'With both vertical and horizontal on, windows are tiled into a grid of columns and rows.',
        });
        const verticalOn = switchRow(settings, 'vertical', 'Tile into columns side by side');
        vertical.add(verticalOn);
        const columnRows = [
            spinRow(settings, 'wide-min-width', 'Wide screen from (pixels wide)', 640, 32768),
            spinRow(settings, 'wide-columns', 'Columns on wide screens', 1, 8),
            spinRow(settings, 'normal-columns', 'Columns on other screens', 1, 8),
        ];
        columnRows.forEach(row => vertical.add(row));
        page.add(vertical);

        const horizontal = new Adw.PreferencesGroup({title: 'Horizontal'});
        const horizontalOn = switchRow(settings, 'horizontal', 'Tile into rows stacked top to bottom');
        horizontal.add(horizontalOn);
        const rowRows = [
            spinRow(settings, 'tall-min-height', 'Tall screen from (pixels high)', 480, 32768),
            spinRow(settings, 'tall-rows', 'Rows on tall screens', 1, 8),
            spinRow(settings, 'normal-rows', 'Rows on other screens', 1, 8),
        ];
        rowRows.forEach(row => horizontal.add(row));
        page.add(horizontal);

        const gapGroup = new Adw.PreferencesGroup({title: 'Gap between windows'});
        const unit = new Adw.ComboRow({
            title: 'Unit',
            model: Gtk.StringList.new(['pixels', 'millimetres']),
        });
        gapGroup.add(unit);
        const gapPx = spinRow(settings, 'gap', 'Gap in pixels', 0, 100);
        const gapMm = spinRow(settings, 'gap-mm', 'Gap in millimetres', 0, 50);
        gapMm.subtitle = 'Millimetres on the screen, worked out from its physical size.';
        gapGroup.add(gapPx);
        gapGroup.add(gapMm);
        unit.connect('notify::selected', () =>
            settings.set_string('gap-unit', unit.selected === 1 ? 'mm' : 'px'));
        page.add(gapGroup);

        const resizing = new Adw.PreferencesGroup({title: 'Resizing'});
        resizing.add(switchRow(settings, 'resize-neighbours', 'Resize neighbouring windows together',
            'Dragging the left or right edge of a window also moves the edge of the window ' +
            'next to it, so windows side by side stay together.'));
        page.add(resizing);

        const update = () => {
            const v = settings.get_boolean('vertical');
            const h = settings.get_boolean('horizontal');
            const disabled = settings.get_boolean('disabled');
            tileNew.sensitive = !disabled;
            showAuto.sensitive = !disabled;
            // Keep at least one direction on.
            verticalOn.sensitive = !v || h;
            horizontalOn.sensitive = !h || v;
            columnRows.forEach(row => (row.sensitive = v));
            rowRows.forEach(row => (row.sensitive = h));

            const mm = settings.get_string('gap-unit') === 'mm';
            if (unit.selected !== (mm ? 1 : 0))
                unit.selected = mm ? 1 : 0;
            gapPx.visible = !mm;
            gapMm.visible = mm;

            const on = settings.get_boolean('snap');
            const only = settings.get_boolean('snap-shift-only');
            const swap = settings.get_boolean('snap-shift-swap');
            shiftOnly.sensitive = on;
            shiftSwap.sensitive = on;
            shiftSwap.title = v && h ? 'Hold Shift to swap columns and rows'
                : v ? 'Hold Shift to snap into rows instead of columns'
                    : 'Hold Shift to snap into columns instead of rows';
            const other = v && h ? 'with columns and rows swapped'
                : v ? 'into the row' : 'into the column';
            const here = v && h ? 'the grid cell' : v ? 'the column' : 'the row';
            if (!on)
                snapping.description = 'Off: a dropped window stays where you leave it.';
            else if (only && swap)
                snapping.description = `A window dropped normally stays where it is. Hold Shift while dropping to snap it ${other} under the pointer.`;
            else if (only)
                snapping.description = `A window dropped normally stays where it is. Hold Shift while dropping to make it fill ${here} under the pointer.`;
            else if (swap)
                snapping.description = `A dropped window fills ${here} under the pointer. Hold Shift while dropping to snap it ${other} instead.`;
            else
                snapping.description = `A dropped window fills ${here} under the pointer.`;
        };
        const id = settings.connect('changed', update);
        page.connect('destroy', () => settings.disconnect(id));
        update();
        page.add(settingsFileGroup(window));
        return page;
    }

    _resolutionsPage(settings, window) {
        const page = new Adw.PreferencesPage({
            name: 'resolutions', title: 'Resolutions', icon_name: 'video-display-symbolic',
        });
        page.add(applyGroup(window));
        const list = new Adw.PreferencesGroup({
            title: 'Resolutions',
            description: 'Shown in the Resolution menu, top to bottom. GNOME can only switch ' +
                'to sizes the screen offers; unlike Plasma or an X11 session, it cannot add new ones.',
        });
        page.add(list);
        const offered = offeredSizes();
        let rows = [];
        // Row being edited in the fields below, or -1 while adding.
        let editing = -1;

        const button = (icon, tooltip, sensitive, action) => {
            const b = new Gtk.Button({
                icon_name: icon, tooltip_text: tooltip, sensitive,
                valign: Gtk.Align.CENTER, css_classes: ['flat'],
            });
            b.connect('clicked', action);
            return b;
        };
        const rebuild = () => {
            // Rows move, so an edit in progress ends.
            stopEditing();
            rows.forEach(row => list.remove(row));
            const sizes = settings.get_strv('resolutions');
            const store = next => settings.set_strv('resolutions', next);
            rows = sizes.map((size, i) => {
                const row = new Adw.ActionRow({title: size.replace('x', ' × ')});
                if (offered)
                    row.subtitle = offered.has(size) ? 'Offered by the screen' : 'Not offered by the screen';
                row.add_suffix(button('document-edit-symbolic', 'Edit', true, () => {
                    const [w, h] = size.split('x').map(Number);
                    width.value = w;
                    height.value = h;
                    editing = i;
                    add.title = `Edit ${size.replace('x', ' × ')}`;
                    addButton.label = 'Save';
                    cancelButton.visible = true;
                    width.grab_focus();
                }));
                row.add_suffix(button('go-up-symbolic', 'Move up', i > 0, () => {
                    const next = sizes.slice();
                    next.splice(i - 1, 0, next.splice(i, 1)[0]);
                    store(next);
                }));
                row.add_suffix(button('go-down-symbolic', 'Move down', i < sizes.length - 1, () => {
                    const next = sizes.slice();
                    next.splice(i + 1, 0, next.splice(i, 1)[0]);
                    store(next);
                }));
                row.add_suffix(button('list-remove-symbolic', 'Remove', sizes.length > 1, () => {
                    const next = sizes.slice();
                    next.splice(i, 1);
                    store(next);
                }));
                list.add(row);
                return row;
            });
        };
        const add = new Adw.PreferencesGroup({title: 'Add a resolution'});
        const width = Gtk.SpinButton.new_with_range(320, 32768, 1);
        const height = Gtk.SpinButton.new_with_range(200, 32768, 1);
        width.value = 1920;
        height.value = 1080;
        const box = new Gtk.Box({spacing: 6, valign: Gtk.Align.CENTER});
        box.append(width);
        box.append(new Gtk.Label({label: '×'}));
        box.append(height);
        const addButton = new Gtk.Button({label: 'Add', css_classes: ['suggested-action']});
        const cancelButton = new Gtk.Button({label: 'Cancel', visible: false});
        const stopEditing = () => {
            editing = -1;
            add.title = 'Add a resolution';
            addButton.label = 'Add';
            cancelButton.visible = false;
        };
        addButton.connect('clicked', () => {
            width.update();
            height.update();
            const size = `${width.get_value_as_int()}x${height.get_value_as_int()}`;
            const sizes = settings.get_strv('resolutions');
            const found = sizes.indexOf(size);
            if (editing >= 0) {
                // Replace the edited row, unless the size is listed already.
                if (found >= 0 && found !== editing) {
                    add.title = `${size.replace('x', ' × ')} is already in the list`;
                    return;
                }
                const next = sizes.slice();
                next[editing] = size;
                settings.set_strv('resolutions', next);
                stopEditing();
            } else if (found < 0) {
                settings.set_strv('resolutions', sizes.concat([size]));
            }
        });
        cancelButton.connect('clicked', stopEditing);
        box.append(addButton);
        box.append(cancelButton);
        const addRow = new Adw.ActionRow({title: 'Width × height'});
        addRow.add_suffix(box);
        add.add(addRow);
        page.add(add);

        const id = settings.connect('changed::resolutions', rebuild);
        page.connect('destroy', () => settings.disconnect(id));
        rebuild();
        page.add(settingsFileGroup(window));
        return page;
    }

    _shortcutsPage(settings, window) {
        const page = new Adw.PreferencesPage({
            name: 'shortcuts', title: 'Shortcuts',
            icon_name: 'preferences-desktop-keyboard-shortcuts-symbolic',
        });
        page.add(applyGroup(window));
        const group = new Adw.PreferencesGroup({
            title: 'Keyboard shortcuts',
            description: 'Work anywhere in GNOME. Click an entry to change its shortcut.',
        });
        page.add(group);
        const ids = [];
        for (const [key, title] of SHORTCUTS) {
            const row = new Adw.ActionRow({title, activatable: true});
            const label = new Gtk.Label({css_classes: ['dim-label']});
            row.add_suffix(label);
            const update = () => {
                const [accel] = settings.get_strv(key);
                const [ok, keyval, mods] = accel ? Gtk.accelerator_parse(accel) : [false];
                label.label = ok ? Gtk.accelerator_get_label(keyval, mods) : 'Disabled';
            };
            ids.push(settings.connect(`changed::${key}`, update));
            update();
            row.connect('activated', () =>
                captureShortcut(window, title, accels => settings.set_strv(key, accels)));
            group.add(row);
        }
        page.connect('destroy', () => ids.forEach(id => settings.disconnect(id)));

        const reset = new Adw.PreferencesGroup();
        const resetRow = new Adw.ButtonRow({title: 'Turn all shortcuts off'});
        resetRow.connect('activated', () => SHORTCUTS.forEach(([key]) => settings.set_strv(key, [])));
        reset.add(resetRow);
        page.add(reset);
        return page;
    }
}
