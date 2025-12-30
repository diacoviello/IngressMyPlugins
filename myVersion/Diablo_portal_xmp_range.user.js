// ==UserScript==
// @author         DiabloEnMusica
// @name           Portal XMP Ranges
// @category       Diablo
// @version        0.3.1.20210103.154230
// @description    Add one or more player markers and his ranges (hack/deploy range and xmp ranges) on the map.
// @id             player-ranges@Diablo
// @namespace      https://github.com/IITC-CE/ingress-intel-total-conversion
// @downloadURL    https://raw.githubusercontent.com/IITC-CE/Community-plugins/master/dist/Zaso/player-ranges.user.js
// @updateURL      https://raw.githubusercontent.com/IITC-CE/Community-plugins/master/dist/Zaso/player-ranges.meta.js
// @match          https://intel.ingress.com/*
// @grant          none
// ==/UserScript==

function wrapper( plugin_info ) {
	// ensure plugin framework is there, even if iitc is not yet loaded
	if ( typeof window.plugin!=='function' ) window.plugin=function() { };
	//PLUGIN AUTHORS: writing a plugin outside of the IITC build environment? if so, delete these lines!!
	//(leaving them in place might break the 'About IITC' page or break update checks)
	plugin_info.buildName='DiabloEnMusica Plugins';
	plugin_info.dateTimeVersion='2025-12-30';
	plugin_info.pluginId='portal-xmp-ranges';
	//END PLUGIN AUTHORS NOTE

	// PLUGIN START ////////////////////////////////////////////////////////
	// History
	// 0.0.7 Headers changed. Ready for IITC-CE
	// 0.0.6 Original script
	// use own namespace for plugin
	window.plugin.playerRanges=function() { };
	window.plugin.playerRanges.storage={};
	window.plugin.playerRanges.obj={};
	window.plugin.playerRanges.data={};
	window.plugin.playerRanges.ui={};
	window.plugin.playerRanges.getHtml={};
	window.plugin.playerRanges.layer={};
	window.plugin.playerRanges.action={};
	window.plugin.playerRanges.control={};
	window.plugin.playerRanges.mpe={};
	window.plugin.playerRanges.override={};
	window.plugin.playerRanges.userLocation={};
	window.plugin.playerRanges.dialog={};
	window.plugin.playerRanges.hook={};
		// *****************************************************************
		var setup=function() {
			// this layer is added to the layer chooser, to be toggled on/off
			window.plugin.hackrange.rangeLayerGroup=new L.LayerGroup();
			// this layer is added into the above layer, and removed from it when we zoom out too far
			window.plugin.hackrange.hackCircleHolderGroup=new L.LayerGroup();
			window.plugin.hackrange.rangeLayerGroup.addLayer( window.plugin.hackrange.hackCircleHolderGroup );
			window.addLayerGroup( 'Hack Portal Ranges', window.plugin.hackrange.rangeLayerGroup, true );
			window.addHook( 'portalAdded', window.plugin.hackrange.portalAdded );
		}
		// PLUGIN END //////////////////////////////////////////////////////////
		setup.info=plugin_info; //add the script info data to the function as a property
		if ( !window.bootPlugins ) window.bootPlugins=[];
		window.bootPlugins.push( setup );
		// if IITC has already booted, immediately run the 'setup' function
		if ( window.iitcLoaded&&typeof setup==='function' ) setup();
	} // wrapper end
	// inject code into site context
	var script=document.createElement( 'script' );
	var info={};
	if ( typeof GM_info!=='undefined'&&GM_info&&GM_info.script ) info.script={ version: GM_info.script.version, name: GM_info.script.name, description: GM_info.script.description };
	script.appendChild( document.createTextNode( '('+wrapper+')('+JSON.stringify( info )+');' ) );
	( document.body||document.head||document.documentElement ).appendChild( script );