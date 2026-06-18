// ==UserScript==
// @author         DiabloEnMusica
// @name           Show smaller portals
// @version        1.0.0.20220711.234400
// @updateURL      https://raw.githubusercontent.com/diacoviello/IngressMyPlugins/main/myVersion/Diablo_smallerportals.user.js
// @downloadURL    https://raw.githubusercontent.com/diacoviello/IngressMyPlugins/main/myVersion/Diablo_smallerportals.user.js
// @description    [DiabloEnMusica-1.0.0.20260602.0100] Show smaller portals when zooming out.
// @namespace      https://softspot.nl/ingress/
// @category       Diablo
// @id             smallerportals@DiabloEnMusica
// @match          https://intel.ingress.com/*
// @grant          none
// ==/UserScript==


function wrapper(plugin_info) {
    // ensure plugin framework is there, even if iitc is not yet loaded
    if(typeof window.plugin !== 'function') window.plugin = function() {};

    // use own namespace for plugin
    window.plugin.smallerportals = function() {};
    var self = window.plugin.smallerportals;
    self.id = 'smallerportals';
    self.title = 'Show smaller portals';
    self.version = '1.0.0.20220711.234400';
    self.author = 'DanielOnDiordna';
    self.changelog = `
Changelog:

version 1.0.0.20220711.234400
- made compatible with IITC-CE Beta 0.32.1.20211217.151857

version 0.0.3.20210724.002500
- prevent double plugin setup on hook iitcLoaded

version 0.0.3.20210421.190200
- minor fix for IITC CE where runHooks iitcLoaded is executed before addHook is defined in this plugin

version 0.0.3.20210121.221100
- version number fix
- default enabled

version 0.0.2.20210118.230600
- changed the portal size per zoom level
- updated plugin wrapper and userscript header formatting to match IITC-CE coding

version 0.0.1.20181030.203600
- intel URL changed from www.ingress.com to *.ingress.com

version 0.0.1.20161103.114400
- earlier release
`;
    self.namespace = 'window.plugin.' + self.id + '.';
    self.pluginname = 'plugin-' + self.id;

    self.enabled = true;

    self.restoresettings = function() {
        if (typeof localStorage[self.pluginname + '-settings'] === 'string') {
            var settings = JSON.parse(localStorage[self.pluginname + '-settings']);
            if (typeof settings === 'object' && settings instanceof Object) {
                if (typeof settings.enabled === 'boolean') self.enabled = settings.enabled;
            }
        }
    };
    self.storesettings = function() {
        var settings = {};
        settings.enabled = self.enabled;
        localStorage[self.pluginname + '-settings'] = JSON.stringify(settings);
    };

    self.set = function() {
        // backup function:
        if (!self.backup_portalMarkerScale) self.backup_portalMarkerScale = window.portalMarkerScale.toString();

        console.log('[smallerportals] set() called at zoom', window.map.getZoom());
        console.log('[smallerportals] BEFORE scale value:', window.portalMarkerScale());
        console.log('[smallerportals] BEFORE function body:', window.portalMarkerScale.toString());

        // override function:
        let portalMarkerScale_string = window.portalMarkerScale.toString();
        // zoom: higher is more zoomed in
        // Mobile:
        let after_mobile = portalMarkerScale_string.replace(/return zoom >= 16.*;/,'return zoom >= 16 ? 1.5 : zoom >= 15 ? 1.0 : zoom >= 14 ? 0.65 : zoom >= 13 ? 0.5 : zoom >= 12 ? 0.4 : zoom >= 11 ? 0.3 : zoom >= 10 ? 0.2 : zoom >= 8 ? 0.15 : 0.1;');
        console.log('[smallerportals] Mobile regex matched:', after_mobile !== portalMarkerScale_string);
        portalMarkerScale_string = after_mobile;
        // Desktop:
        let after_desktop = portalMarkerScale_string.replace(/return zoom >= 14.*;/,'return zoom >= 14 ? 1.0 : zoom >= 13 ? 0.75 : zoom >= 12 ? 0.6 : zoom >= 11 ? 0.5 : zoom >= 10 ? 0.4 : zoom >= 8 ? 0.28 : 0.15;');
        console.log('[smallerportals] Desktop regex matched:', after_desktop !== portalMarkerScale_string);
        portalMarkerScale_string = after_desktop;

        eval('window.portalMarkerScale = ' + portalMarkerScale_string);
        console.log('[smallerportals] AFTER scale value:', window.portalMarkerScale());

        // Watch for another script overwriting portalMarkerScale after we set it
        let ourFn = window.portalMarkerScale;
        let watchInterval = setInterval(function() {
            if (window.portalMarkerScale !== ourFn) {
                console.warn('[smallerportals] portalMarkerScale was OVERWRITTEN by another script!');
                console.warn('[smallerportals] New function body:', window.portalMarkerScale.toString());
                clearInterval(watchInterval);
            }
        }, 250);
        setTimeout(function() { clearInterval(watchInterval); }, 15000);

        window.resetHighlightedPortals();

        self.enabled = true;
        self.storesettings();
    };

    self.reset = function() {
        if (self.backup_portalMarkerScale) {
            // restore function:
            eval('window.portalMarkerScale = ' + self.backup_portalMarkerScale);
            self.backup_portalMarkerScale = undefined;
            window.resetHighlightedPortals();
        }

        self.enabled = false;
        self.storesettings();
    };

    self.setup = function() {
        console.time('smallerportals');
        if ('pluginloaded' in self) {
            console.log('IITC plugin already loaded: ' + self.title + ' version ' + self.version);
            return;
        } else {
            self.pluginloaded = true;
        }

        self.restoresettings();
        if (window.isLayerGroupDisplayed('Smaller Portals') != self.enabled) {
            if (typeof window.updateDisplayedLayerGroup == "function") { // IITC 0.32.1 Release
                window.updateDisplayedLayerGroup('Smaller Portals',self.enabled); // force start status
            } else if (typeof window.layerChooser._storeOverlayState == "function") { // IITC 0.32.1 Beta
                window.layerChooser._storeOverlayState('Smaller Portals',self.enabled); // force start status
            }
        }
        self.togglesmall = new window.L.LayerGroup();
        window.addLayerGroup('Smaller Portals', self.togglesmall);
        window.map.on('layeradd', function(obj) {
            if(obj.layer === self.togglesmall) {
                self.set();
            }
        });
        window.map.on('layerremove', function(obj) {
            if(obj.layer === self.togglesmall) {
                self.reset();
            }
        });

        if (self.enabled) {
            self.set();
        } else {
            self.reset();
        }
        console.log('IITC plugin loaded: ' + self.title + ' version ' + self.version);
        console.timeEnd('smallerportals');
    };

    var setup = function() {
        (window.iitcLoaded?self.setup():window.addHook('iitcLoaded',self.setup));
    };

    setup.info = plugin_info; //add the script info data to the function as a property
    if(!window.bootPlugins) window.bootPlugins = [];
    window.bootPlugins.push(setup);
    // if IITC has already booted, immediately run the 'setup' function
    if(window.iitcLoaded && typeof setup === 'function') setup();
} // wrapper end
// inject code into site context
var script = document.createElement('script');
var info = {};
if (typeof GM_info !== 'undefined' && GM_info && GM_info.script) info.script = { version: GM_info.script.version, name: GM_info.script.name, description: GM_info.script.description };
script.appendChild(document.createTextNode('('+ wrapper +')('+JSON.stringify(info)+');'));
(document.body || document.head || document.documentElement).appendChild(script);

