// ==UserScript==
// @author         DiabloEnMusica
// @name           Home Portals
// @category       Diablo
// @version        1.1.1
// @description    Store teammates' home portals as persistent "house" bookmarks. Each home portal has a customizable color (with Enlightened/Resistance/Machina/Neutral faction presets) and an Agent name (text input). Filter the map and list by faction or "My team". Stored data is never removed automatically - only via the Home Portals menu (delete/update). When a home portal is selected, the stored Agent name and the town it is located in are shown in the portal details.
// @id             home-portals@DiabloEnMusica
// @namespace      https://github.com/diacoviello/
// @match          https://intel.ingress.com/*
// @match          http://intel.ingress.com/*
// @match          https://*.ingress.com/intel*
// @match          http://*.ingress.com/intel*
// @grant          none
// ==/UserScript==

function wrapper(plugin_info) {
    // ensure plugin framework is there, even if iitc is not yet loaded
    if (typeof window.plugin !== 'function') window.plugin = function() {};

    // use own namespace for plugin
    window.plugin.homePortals = function() {};
    var self = window.plugin.homePortals;
    self.id = 'homePortals';
    self.title = 'Home Portals';
    self.version = '1.1.1';
    self.author = 'David Iacoviello';

    self.STORAGE_KEY = 'plugin-home-portals-data';
    self.GEOCACHE_KEY = 'plugin-home-portals-geocache';
    self.DEFAULT_COLOR = '#2e7d32'; // green house by default

    // Faction presets (codes match IITC: E/R/M/N) with their standard colors.
    self.FACTIONS = {
        E: { label: 'Enlightened', color: '#03DC03' },
        R: { label: 'Resistance', color: '#0088FF' },
        M: { label: 'Machina', color: '#FF0028' },
        N: { label: 'Neutral', color: '#FF6600' }
    };

    // data = { filter, portals: { <guid>: {guid, latlng, label, agent, color, town, faction} } }
    self.data = { filter: 'all', portals: {} };
    self.geocache = {}; // "lat,lng"(rounded) -> town string

    self.layerGroup = undefined;
    self.markers = {}; // guid -> L.marker

    /* ---------------------------------------------------*
     *  Storage
     * ---------------------------------------------------*/
    self.load = function() {
        try {
            let raw = localStorage[self.STORAGE_KEY];
            if (typeof raw === 'string' && raw !== '') {
                let parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object' && parsed.portals) self.data = parsed;
            }
        } catch (e) {
            console.warn('Home Portals: failed to parse stored data', e);
        }
        try {
            let raw = localStorage[self.GEOCACHE_KEY];
            if (typeof raw === 'string' && raw !== '') self.geocache = JSON.parse(raw) || {};
        } catch (e) {
            self.geocache = {};
        }
    };
    self.save = function() {
        localStorage[self.STORAGE_KEY] = JSON.stringify(self.data);
    };
    self.saveGeocache = function() {
        localStorage[self.GEOCACHE_KEY] = JSON.stringify(self.geocache);
    };

    /* ---------------------------------------------------*
     *  Helpers
     * ---------------------------------------------------*/
    self.escapeHtml = function(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    };

    self.getLatLng = function(record) {
        let parts = String(record.latlng).split(',');
        return window.L.latLng(parseFloat(parts[0]), parseFloat(parts[1]));
    };

    // Build a house-shaped div icon, colored by the given color.
    self.houseIcon = function(color) {
        color = color || self.DEFAULT_COLOR;
        let svg =
            '<svg viewBox="0 0 24 24" width="28" height="28" xmlns="http://www.w3.org/2000/svg">' +
            '<path d="M12 2 L1 11 H4 V22 H10 V15 H14 V22 H20 V11 H23 Z" ' +
            'fill="' + color + '" stroke="#000000" stroke-width="1" stroke-linejoin="round"/>' +
            '</svg>';
        return window.L.divIcon({
            className: 'home-portal-marker',
            iconSize: [28, 28],
            iconAnchor: [14, 22],
            html: svg
        });
    };

    /* ---------------------------------------------------*
     *  Town / reverse geocoding (OpenStreetMap Nominatim, cached)
     * ---------------------------------------------------*/
    self.geocacheKey = function(lat, lng) {
        // round to ~100m so nearby portals share a cache entry
        return parseFloat(lat).toFixed(3) + ',' + parseFloat(lng).toFixed(3);
    };

    // Returns a Promise that resolves to a town/city string (best effort).
    self.lookupTown = function(lat, lng) {
        let key = self.geocacheKey(lat, lng);
        if (self.geocache[key]) return Promise.resolve(self.geocache[key]);

        let url = 'https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=12&lat=' +
            encodeURIComponent(lat) + '&lon=' + encodeURIComponent(lng);
        return fetch(url, { headers: { 'Accept': 'application/json' } })
            .then(function(r) { return r.json(); })
            .then(function(j) {
                let a = (j && j.address) || {};
                let town = a.city || a.town || a.village || a.hamlet ||
                    a.suburb || a.municipality || a.county || a.state || '';
                if (town) {
                    self.geocache[key] = town;
                    self.saveGeocache();
                }
                return town;
            })
            .catch(function() { return ''; });
    };

    /* ---------------------------------------------------*
     *  CRUD
     * ---------------------------------------------------*/
    self.get = function(guid) { return self.data.portals[guid]; };

    self.addOrUpdate = function(guid, latlng, label, agent, color, town, faction) {
        let existing = self.data.portals[guid] || {};
        self.data.portals[guid] = {
            guid: guid,
            latlng: latlng != null ? latlng : existing.latlng,
            label: label != null ? label : (existing.label || ''),
            agent: agent != null ? agent : (existing.agent || ''),
            color: color != null ? color : (existing.color || self.DEFAULT_COLOR),
            town: town != null ? town : (existing.town || ''),
            faction: faction != null ? faction : (existing.faction || '')
        };
        self.save();
        self.drawAll();
        self.refreshManager();
        return self.data.portals[guid];
    };

    // Re-render the manager list in place, if the manager dialog is open.
    self.refreshManager = function() {
        if (self._managerRender && self._managerListEl &&
            self._managerListEl[0] && self._managerListEl[0].isConnected) {
            self._managerRender();
        }
    };

    /* ---------------------------------------------------*
     *  Faction filter
     * ---------------------------------------------------*/
    // Player's own faction as an E/R code (or '' if unknown).
    self.playerFaction = function() {
        let team = window.PLAYER && window.PLAYER.team;
        if (team === 'ENLIGHTENED') return 'E';
        if (team === 'RESISTANCE') return 'R';
        return '';
    };

    self.getFilter = function() { return self.data.filter || 'all'; };
    self.setFilter = function(filter) {
        self.data.filter = filter;
        self.save();
        self.drawAll();
    };

    // Does a record pass the currently active filter?
    self.passesFilter = function(record) {
        let filter = self.getFilter();
        if (filter === 'all') return true;
        if (filter === 'mine') {
            let mine = self.playerFaction();
            return !mine || record.faction === mine;
        }
        return record.faction === filter;
    };

    self.remove = function(guid) {
        delete self.data.portals[guid];
        self.save();
        self.drawAll();
        self.refreshManager();
    };

    /* ---------------------------------------------------*
     *  Map drawing
     * ---------------------------------------------------*/
    self.drawAll = function() {
        if (!self.layerGroup) return;
        self.layerGroup.clearLayers();
        self.markers = {};
        for (let guid in self.data.portals) {
            let record = self.data.portals[guid];
            if (!self.passesFilter(record)) continue;
            self.drawMarker(record);
        }
    };

    self.drawMarker = function(record) {
        let latlng = self.getLatLng(record);
        if (isNaN(latlng.lat) || isNaN(latlng.lng)) return;

        let marker = window.L.marker(latlng, {
            icon: self.houseIcon(record.color),
            title: (record.agent ? record.agent + ' - ' : '') + (record.label || ''),
            guid: record.guid
        });

        // Permanent label under the house showing the Agent name (so you can
        // see whose home portal it is at a glance on the map). The text is
        // colored to match the faction (falling back to the marker color).
        if (record.agent) {
            let labelColor = (record.faction && self.FACTIONS[record.faction]) ?
                self.FACTIONS[record.faction].color : (record.color || '#ffce00');
            marker.bindTooltip('<span style="color:' + labelColor + '">' + self.escapeHtml(record.agent) + '</span>', {
                permanent: true,
                direction: 'bottom',
                offset: window.L.point(0, 4),
                className: 'home-portal-label'
            });
        }

        marker.on('click', function() {
            if (window.renderPortalDetails) window.renderPortalDetails(record.guid);
        });

        marker.addTo(self.layerGroup);
        self.markers[record.guid] = marker;
    };

    /* ---------------------------------------------------*
     *  Portal details injection (shows Agent + Town when selected)
     * ---------------------------------------------------*/
    self.onPortalDetailsUpdated = function(data) {
        let guid = data.guid;
        let container = data.portalDetails ? $(data.portalDetails) : null;

        // Build a small info/action block appended to the portal details.
        let $details = $('#portaldetails');
        $details.find('.home-portal-info').remove();

        let record = self.get(guid);
        let $block = $('<div class="home-portal-info"></div>');

        if (record) {
            let info = '<div class="home-portal-tag">🏠 Home Portal</div>';
            if (record.agent) info += '<div><b>Agent:</b> ' + self.escapeHtml(record.agent) + '</div>';
            info += '<div><b>Town:</b> <span class="home-portal-town">' +
                (record.town ? self.escapeHtml(record.town) : '<i>looking up…</i>') + '</span></div>';
            $block.html(info);

            let $edit = $('<a class="home-portal-link">Edit Home Portal</a>');
            $edit.on('click', function() { self.openEditDialog(guid); });
            $block.append($edit);

            // Lazily fetch the town if we don't have it yet.
            if (!record.town) {
                let ll = self.getLatLng(record);
                self.lookupTown(ll.lat, ll.lng).then(function(town) {
                    if (town) {
                        record.town = town;
                        self.save();
                        if (window.selectedPortal === guid) {
                            $('#portaldetails .home-portal-town').text(town);
                        }
                    } else {
                        $('#portaldetails .home-portal-town').text('(unknown)');
                    }
                });
            }
        } else {
            let $add = $('<a class="home-portal-link">Add as Home Portal</a>');
            $add.on('click', function() { self.openEditDialog(guid); });
            $block.append($add);
        }

        $details.append($block);
    };

    /* ---------------------------------------------------*
     *  Add / Edit dialog
     * ---------------------------------------------------*/
    self.openEditDialog = function(guid) {
        let record = self.get(guid);
        let portal = window.portals[guid];

        // Determine label + latlng from existing record or live portal.
        let label = (record && record.label) || (portal && portal.options.data && portal.options.data.title) || '';
        let latlng;
        if (record) {
            latlng = record.latlng;
        } else if (portal) {
            let ll = portal.getLatLng();
            latlng = ll.lat + ',' + ll.lng;
        } else if (guid === window.selectedPortal) {
            latlng = '';
        }

        if (!latlng) {
            alert('Home Portals: cannot determine this portal\'s location. Select the portal on the map first.');
            return;
        }

        let agent = (record && record.agent) || '';
        let color = (record && record.color) || self.DEFAULT_COLOR;
        let town = (record && record.town) || '';
        let selectedFaction = (record && record.faction) || '';

        // For a new home portal, default the faction preset (and color) to the
        // live portal's current team, so capturing a teammate's portal is quick.
        if (!record && portal && portal.options.data && self.FACTIONS[portal.options.data.team]) {
            selectedFaction = portal.options.data.team;
            color = self.FACTIONS[selectedFaction].color;
        }

        // Build the faction preset buttons.
        let presetButtons = '';
        for (let code in self.FACTIONS) {
            let f = self.FACTIONS[code];
            presetButtons += '<button type="button" class="hp-preset" data-f="' + code + '"' +
                ' style="border-color:' + f.color + ';color:' + f.color + ';">' + f.label + '</button>';
        }
        presetButtons += '<button type="button" class="hp-preset" data-f="">Custom</button>';

        let html =
            '<div class="home-portal-dialog">' +
            '<p><b>Portal:</b> ' + self.escapeHtml(label || '(unnamed)') + '</p>' +
            '<label>Agent name:<br><input type="text" class="hp-agent" value="' + self.escapeHtml(agent) + '" placeholder="Agent codename"></label>' +
            '<label>Faction preset:</label><div class="hp-presets">' + presetButtons + '</div>' +
            '<label>Marker color:<br><input type="color" class="hp-color" value="' + self.escapeHtml(color) + '"></label>' +
            '<label>Town (auto-filled, editable):<br><input type="text" class="hp-town" value="' + self.escapeHtml(town) + '" placeholder="Looking up…"></label>' +
            '</div>';

        let $html = $(html);

        // Highlight the currently selected preset, and wire preset clicks to set
        // both the stored faction and the marker color.
        $html.find('.hp-preset[data-f="' + selectedFaction + '"]').addClass('selected');
        $html.find('.hp-preset').on('click', function() {
            let f = $(this).attr('data-f');
            selectedFaction = f;
            if (f && self.FACTIONS[f]) $html.find('.hp-color').val(self.FACTIONS[f].color);
            $html.find('.hp-preset').removeClass('selected');
            $(this).addClass('selected');
        });
        // Picking a custom color clears the faction preset selection.
        $html.find('.hp-color').on('input', function() {
            selectedFaction = '';
            $html.find('.hp-preset').removeClass('selected');
            $html.find('.hp-preset[data-f=""]').addClass('selected');
        });

        // Auto fill the town if empty.
        if (!town && latlng) {
            let parts = latlng.split(',');
            self.lookupTown(parts[0], parts[1]).then(function(t) {
                if (t && $html.find('.hp-town').val() === '') $html.find('.hp-town').val(t);
            });
        }

        let buttons = {};
        buttons[record ? 'Save changes' : 'Add Home Portal'] = function() {
            let newAgent = $html.find('.hp-agent').val().trim();
            let newColor = $html.find('.hp-color').val();
            let newTown = $html.find('.hp-town').val().trim();
            self.addOrUpdate(guid, latlng, label, newAgent, newColor, newTown, selectedFaction);
            $(this).dialog('close');
            if (window.selectedPortal === guid && window.renderPortalDetails) {
                window.renderPortalDetails(guid);
            }
        };
        if (record) {
            buttons['Delete'] = function() {
                if (confirm('Remove this home portal?\n\n' + (agent ? agent + ' - ' : '') + label)) {
                    self.remove(guid);
                    $(this).dialog('close');
                    if (window.selectedPortal === guid && window.renderPortalDetails) {
                        window.renderPortalDetails(guid);
                    }
                }
            };
        }
        buttons['Cancel'] = function() { $(this).dialog('close'); };

        // Set buttons AFTER creation so IITC's default "OK" button is replaced
        // (passing buttons in the options leaves the stray OK in place).
        window.dialog({
            html: $html,
            title: record ? 'Edit Home Portal' : 'Add Home Portal',
            id: 'plugin-home-portals-edit',
            width: 360
        }).dialog('option', 'buttons', buttons);
    };

    /* ---------------------------------------------------*
     *  Manager dialog (list of all home portals)
     * ---------------------------------------------------*/
    self.openManager = function() {
        let $container = $('<div class="home-portal-manager"></div>');

        // Filter control (All / each faction / My team).
        let mine = self.playerFaction();
        let filterOptions =
            '<option value="all">All</option>' +
            '<option value="E">Enlightened</option>' +
            '<option value="R">Resistance</option>' +
            '<option value="M">Machina</option>' +
            '<option value="N">Neutral</option>' +
            (mine ? '<option value="mine">My team (' + self.FACTIONS[mine].label + ')</option>' : '');
        let $filterBar = $('<div class="home-portal-filterbar">Show: <select class="hp-filter">' + filterOptions + '</select></div>');
        $filterBar.find('.hp-filter').val(self.getFilter());
        $container.append($filterBar);

        // Container the list re-renders into when the filter changes.
        let $list = $('<div class="home-portal-list"></div>');
        $container.append($list);

        // Expose for live refresh from add/edit/remove (see refreshManager).
        self._managerListEl = $list;
        self._managerRender = renderList;

        function renderList() {
            $list.empty();
            let guids = Object.keys(self.data.portals).filter(function(guid) {
                return self.passesFilter(self.data.portals[guid]);
            });

            if (guids.length === 0) {
                let total = Object.keys(self.data.portals).length;
                $list.append('<p>' + (total === 0 ?
                    'No home portals stored yet.<br>Select a portal on the map and use <b>"Add as Home Portal"</b> in its details, or the button below.' :
                    'No home portals match this filter.') + '</p>');
                return;
            }

            // Sort by agent name then label.
            guids.sort(function(a, b) {
                let ra = self.data.portals[a], rb = self.data.portals[b];
                return (ra.agent || '').localeCompare(rb.agent || '') ||
                    (ra.label || '').localeCompare(rb.label || '');
            });

            let $table = $('<table class="home-portal-table"><thead><tr>' +
                '<th></th><th>Agent</th><th>Portal</th><th>Town</th><th></th>' +
                '</tr></thead><tbody></tbody></table>');
            let $tbody = $table.find('tbody');

            guids.forEach(function(guid) {
                let r = self.data.portals[guid];
                let $row = $('<tr></tr>');
                $row.append('<td><span class="hp-swatch" style="background:' + self.escapeHtml(r.color || self.DEFAULT_COLOR) + '"></span></td>');
                $row.append('<td>' + self.escapeHtml(r.agent || '') + '</td>');

                let $name = $('<td class="hp-name">' + self.escapeHtml(r.label || '(unnamed)') + '</td>');
                $name.css('cursor', 'pointer').on('click', function() {
                    let ll = self.getLatLng(r);
                    window.map.setView(ll, 16);
                    if (window.renderPortalDetails) window.renderPortalDetails(guid);
                });
                $row.append($name);

                $row.append('<td>' + self.escapeHtml(r.town || '') + '</td>');

                let $actions = $('<td></td>');
                let $edit = $('<a class="home-portal-link">Edit</a>');
                $edit.on('click', function() { self.openEditDialog(guid); });
                let $del = $('<a class="home-portal-link" style="color:#f88;margin-left:6px;">Del</a>');
                $del.on('click', function() {
                    if (confirm('Remove this home portal?\n\n' + (r.agent ? r.agent + ' - ' : '') + (r.label || ''))) {
                        self.remove(guid);
                        $row.remove();
                    }
                });
                $actions.append($edit).append($del);
                $row.append($actions);

                $tbody.append($row);
            });
            $list.append($table);
        }

        $filterBar.find('.hp-filter').on('change', function() {
            self.setFilter($(this).val()); // persists + redraws the map layer
            renderList();
        });

        renderList();

        // Footer actions
        let $footer = $('<div class="home-portal-footer"></div>');
        let $addSel = $('<a class="home-portal-link">+ Add selected portal</a>');
        $addSel.on('click', function() {
            if (!window.selectedPortal) {
                alert('Select a portal on the map first.');
                return;
            }
            self.openEditDialog(window.selectedPortal);
        });
        $footer.append($addSel);

        let $export = $('<a class="home-portal-link" style="margin-left:12px;">Export</a>');
        $export.on('click', self.exportDialog);
        let $import = $('<a class="home-portal-link" style="margin-left:12px;">Import</a>');
        $import.on('click', self.importDialog);
        $footer.append($export).append($import);
        $container.append($footer);

        window.dialog({
            html: $container,
            title: 'Home Portals',
            id: 'plugin-home-portals-manager',
            width: 500
        });
    };

    /* ---------------------------------------------------*
     *  Export / Import (backup so the list survives reinstalls)
     * ---------------------------------------------------*/
    self.exportDialog = function() {
        let $c = $('<div></div>');
        $c.append('<p>Copy this text to back up your home portals:</p>');
        let $ta = $('<textarea readonly style="width:100%;height:180px;"></textarea>');
        $ta.val(JSON.stringify(self.data));
        $c.append($ta);
        window.dialog({ html: $c, title: 'Home Portals - Export', id: 'plugin-home-portals-export', width: 480 });
        $ta.select();
    };

    self.importDialog = function() {
        let $c = $('<div></div>');
        $c.append('<p>Paste previously exported home portals JSON. This <b>merges</b> with what you already have.</p>');
        let $ta = $('<textarea style="width:100%;height:180px;"></textarea>');
        $c.append($ta);
        window.dialog({
            html: $c,
            title: 'Home Portals - Import',
            id: 'plugin-home-portals-import',
            width: 480
        }).dialog('option', 'buttons', {
            'Import': function() {
                try {
                    let parsed = JSON.parse($ta.val());
                    if (parsed && parsed.portals) {
                        for (let guid in parsed.portals) {
                            self.data.portals[guid] = parsed.portals[guid];
                        }
                        self.save();
                        self.drawAll();
                        self.refreshManager();
                        alert('Imported. Total home portals: ' + Object.keys(self.data.portals).length);
                        $(this).dialog('close');
                    } else {
                        alert('That does not look like valid Home Portals data.');
                    }
                } catch (e) {
                    alert('Could not parse JSON: ' + e.message);
                }
            },
            'Cancel': function() { $(this).dialog('close'); }
        });
    };

    /* ---------------------------------------------------*
     *  Styles
     * ---------------------------------------------------*/
    self.setupCSS = function() {
        $('<style>').prop('type', 'text/css').html(`
.home-portal-marker svg { filter: drop-shadow(0 0 2px rgba(0,0,0,0.6)); }
.home-portal-label {
    background: rgba(8,48,78,0.85);
    border: 1px solid #20a8b1;
    border-radius: 3px;
    color: #ffce00;
    font-size: 11px;
    font-weight: bold;
    padding: 0 4px;
    white-space: nowrap;
    box-shadow: none;
}
.home-portal-label:before { display: none; }
.home-portal-info {
    margin-top: 6px;
    padding-top: 6px;
    border-top: 1px solid #20435c;
}
.home-portal-tag { color: #ffce00; font-weight: bold; margin-bottom: 2px; }
.home-portal-link {
    display: inline-block;
    margin-top: 4px;
    color: #ffce00;
    cursor: pointer;
    text-decoration: underline;
}
.home-portal-dialog label { display: block; margin: 8px 0 4px; }
.home-portal-dialog input[type=text] { width: 100%; box-sizing: border-box; }
.hp-presets { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 4px; }
.hp-preset {
    background: #1a3344;
    border: 1px solid #888;
    border-radius: 3px;
    color: #ccc;
    cursor: pointer;
    font-size: 11px;
    padding: 3px 7px;
}
.hp-preset.selected { background: #20435c; box-shadow: 0 0 0 1px currentColor inset; font-weight: bold; }
.home-portal-filterbar { margin-bottom: 8px; }
.home-portal-filterbar select { margin-left: 4px; }
.home-portal-table { width: 100%; border-collapse: collapse; }
.home-portal-table th, .home-portal-table td { text-align: left; padding: 3px 5px; border-bottom: 1px solid #20435c; vertical-align: middle; }
.hp-swatch { display: inline-block; width: 14px; height: 14px; border: 1px solid #000; border-radius: 2px; }
.home-portal-footer { margin-top: 10px; }
`).appendTo('head');
    };

    /* ---------------------------------------------------*
     *  Setup
     * ---------------------------------------------------*/
    self.setup = function() {
        self.load();
        self.setupCSS();

        // Map layer
        self.layerGroup = new window.L.LayerGroup();
        window.addLayerGroup(self.title, self.layerGroup, true);

        // Toolbox menu link
        let link = document.getElementById('toolbox').appendChild(document.createElement('a'));
        link.textContent = self.title;
        link.title = 'Manage your stored home portals';
        link.addEventListener('click', function(e) {
            self.openManager();
            e.preventDefault();
        }, false);

        // Portal details: show agent + town and add/edit link
        window.addHook('portalDetailsUpdated', self.onPortalDetailsUpdated);

        self.drawAll();

        console.log(`IITC plugin loaded: ${self.title} version ${self.version}`);
    };

    var setup = function() {
        (window.iitcLoaded ? self.setup() : window.addHook('iitcLoaded', self.setup));
    };

    setup.info = plugin_info; // add the script info data to the function as a property
    if (!window.bootPlugins) window.bootPlugins = [];
    window.bootPlugins.push(setup);
    // if IITC has already booted, immediately run the 'setup' function
    if (window.iitcLoaded && typeof setup === 'function') setup();
} // wrapper end

// inject code into site context
var script = document.createElement('script');
var info = {};
if (typeof GM_info !== 'undefined' && GM_info && GM_info.script) info.script = { version: GM_info.script.version, name: GM_info.script.name, description: GM_info.script.description };
script.appendChild(document.createTextNode('(' + wrapper + ')(' + JSON.stringify(info) + ');'));
(document.body || document.head || document.documentElement).appendChild(script);
