// ==UserScript==
// @id             iitc-plugin-show-zoom-level@isnot
// @name           IITC plugin: show zoom level
// @category       Controls
// @version        0.4
// @namespace      https://isnot.jp/
// @author         isnot
// @updateURL      none
// @downloadURL    none
// @description    [iitc-plugins] Indicate zoom level on map.
// @match          https://intel.ingress.com/*
// @grant          none
// ==/UserScript==

function wrapper(plugin_info) {
  // ensure plugin framework is there, even if iitc is not yet loaded
  if (typeof window.plugin !== 'function') window.plugin = function() {};

  // PLUGIN START ////////////////////////////////////////////////////////

  var setup = function() {
    $('#updatestatus').append('<div title="Map Zoom Level" id="iitc-plugin-zoomLevel">z</div>');
    $('<style>')
      .prop('type', 'text/css')
      .html('#iitc-plugin-zoomLevel {text-align:right; height:15px; width:30px; bottom:0; padding:4px; position:fixed; right:0; z-index:3003; background:#ffd1d1; color:#663300}')
      .appendTo('head');

    window.addHook('mapDataEntityInject', function() {
      $("#iitc-plugin-zoomLevel").html('z' + window.map.getZoom());
    });
    window.addHook('mapDataRefreshEnd', function() {
      $("#iitc-plugin-zoomLevel").html('z' + window.map.getZoom());
    });
    if (window.map) {
      window.map.on('zoomend', function() {
        $("#iitc-plugin-zoomLevel").html('z' + window.map.getZoom());
      });
    }

  };

  // PLUGIN END //////////////////////////////////////////////////////////

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
