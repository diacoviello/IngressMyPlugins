// ==UserScript==
// @author         DiabloEnMusica
// @name           Portal XMP Ranges
// @category       Diablo
// @version        0.4.0.20260618
// @description    Draw concentric XMP attack range rings (L1-L8) centred on the selected portal, with a toggle control.
// @id             player-ranges@Diablo
// @namespace      https://github.com/IITC-CE/ingress-intel-total-conversion
// @match          https://intel.ingress.com/*
// @grant          none
// ==/UserScript==

function wrapper( plugin_info ) {
	// ensure plugin framework is there, even if iitc is not yet loaded
	if ( typeof window.plugin !== 'function' ) window.plugin = function () {};

	//PLUGIN AUTHORS: writing a plugin outside of the IITC build environment? if so, delete these lines!!
	plugin_info.buildName = 'ZasoItems';
	plugin_info.dateTimeVersion = '2026-06-18-000000';
	plugin_info.pluginId = 'player-ranges';
	//END PLUGIN AUTHORS NOTE

	// PLUGIN START ////////////////////////////////////////////////////////
	var pr = window.plugin.playerRanges = function () {};

	// XMP attack range (metres) for levels L1..L8
	pr.XMP_RANGES = [ 42, 48, 58, 72, 90, 112, 138, 168 ];

	// Drawing options
	pr.settings = { weight: 1.5, opacity: 0.7, fillOpacity: 0.28, steps: 60 };

	// Fallback ring colours if IITC's COLORS_LVL is unavailable (index 1..8 used)
	pr.FALLBACK_COLORS = [ '#000000', '#FF6600', '#FF9900', '#BBBB00', '#75BB00', '#00BBBB', '#00BBFF', '#9d9d9d', '#FF00FF' ];

	pr.layerGroup = null;   // overlay LayerGroup holding the range polygons
	pr.enabled = false;     // is the overlay currently shown?
	pr.lastGuid = null;     // portal the rings are currently drawn for

	//======================================================================
	// GEOMETRY
	//======================================================================
	// Build the lat/lng ring for a small circle. At XMP distances (<=168 m)
	// a local planar approximation is sub-metre accurate and avoids creating
	// throw-away geodesic layers just to read their coordinates back out.
	pr.circleRing = function ( center, radiusMetres, steps ) {
		var d2r = Math.PI / 180;
		var latDeg = radiusMetres / 111320;
		var lngDeg = radiusMetres / ( 111320 * Math.cos( center.lat * d2r ) );
		var ring = new Array( steps );
		for ( var i = 0; i < steps; i++ ) {
			var t = ( i / steps ) * 2 * Math.PI;
			ring[ i ] = [ center.lat + latDeg * Math.cos( t ), center.lng + lngDeg * Math.sin( t ) ];
		}
		return ring;
	};

	//======================================================================
	// DRAWING
	//======================================================================
	pr.drawAtPortal = function ( guid ) {
		var lg = pr.layerGroup;
		if ( !lg ) return;
		lg.clearLayers();
		pr.lastGuid = guid || null;
		if ( !guid ) return;

		var portal = window.portals && window.portals[ guid ];
		if ( !portal ) return;

		var center = portal.getLatLng();
		var s = pr.settings;
		var colors = window.COLORS_LVL || pr.FALLBACK_COLORS;

		// Innermost level is a solid disc; each higher level is an annulus
		// (a band between the previous radius and its own radius).
		var prevRing = null;
		for ( var i = 0; i < pr.XMP_RANGES.length; i++ ) {
			var lvl = i + 1;
			var clr = colors[ lvl ] || colors[ colors.length - 1 ];
			var outer = pr.circleRing( center, pr.XMP_RANGES[ i ], s.steps );
			// reverse the inner ring so the hole renders with the non-zero fill rule
			var rings = prevRing ? [ outer, prevRing.slice().reverse() ] : outer;
			L.polygon( rings, {
				weight: s.weight,
				opacity: s.opacity,
				color: clr,
				fill: true,
				fillColor: clr,
				fillOpacity: s.fillOpacity,
				interactive: false
			} ).addTo( lg );
			prevRing = outer;
		}
	};

	pr.onPortalSelected = function () {
		if ( pr.enabled ) pr.drawAtPortal( window.selectedPortal );
	};

	//======================================================================
	// CONTROL + TOGGLE
	//======================================================================
	pr.toggle = function () {
		var lg = pr.layerGroup;
		if ( !lg ) return;
		if ( window.map.hasLayer( lg ) ) window.map.removeLayer( lg );
		else window.map.addLayer( lg );
	};

	pr.addControl = function () {
		var PRControl = L.Control.extend( {
			options: { position: 'topleft' },
			onAdd: function () {
				var div = L.DomUtil.create( 'div', 'leaflet-playerranges playerRanges' );
				var bar = L.DomUtil.create( 'div', 'leaflet-bar', div );
				var btn = L.DomUtil.create( 'a', 'playerRanges playerRangesButton', bar );
				btn.title = 'Toggle Portal XMP Ranges overlay';
				btn.href = '#';
				L.DomEvent.on( btn, 'click', L.DomEvent.stop ).on( btn, 'click', pr.toggle );
				return div;
			}
		} );
		window.map.addControl( new PRControl() );
	};

	//======================================================================
	// CSS (only the toggle button is needed)
	//======================================================================
	pr.setupCSS = function () {
		$( '<style>' ).prop( 'type', 'text/css' ).html( ''
			+ '.playerRangesButton{'
			+ 'background-image:url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACYAAAAtCAMAAAD1JOlfAAAApVBMVEV0dHRNTU3i4uITExMBAQH9/f2oqKgVa5cKCgr+/v4NDQ3///+3t7cWcqITZI4VcJ8DeQAvLy8MTwt3d3cDfQDu7u4NDQ0BAQH///9oaGgCcAADewAUaZQCdgATZpEVbZsCcgABXwAWdKQ+Pj4oYEwxMTFylp8BAQEAAAADkAAZhbwDiQADgwD///8DpwAXfK8EtAADmgAdl9YbjsofoeQhrvYEvQA8FIAAAAAAKXRSTlOknJaVa4SLhdRW8Guy4CTFxbYdbPghvEE55lnkZ6NEo3019ekP/QX+AIHvNbUAAAJHSURBVHgBZNLNroMgEIZhd66sxriq4F8IKYAganv/l3Y+jkqFsmqaJ/MmzmSv8/HnK32chJ+BjdUP68pfRvWYst4+UsZaNaTNyeYpe2rRpk0ri5RR5dJqLzfbxYw1wikaKTbJTfYRQ9MZ0fI7I3Zb5cQjVglnnI4+XSnXHdU7qxthlrj6mMBWVG9sUM58jGhY1NzfqLIbqzDsE1fRfL9RJV82agybFyeqb9MPmzGu/DI0l3meUa0vloPhL1+9GG99c/bVa2G88M05VLOribeYUO180z9UL0bR9MyPq8OiDoZxj4MxNDFqWT74dEeVT2jC/LP8YH5RizHOGFTb0NzXdVt3VIuDoWmcUEoAnmfS+0Vt0srtWBiYPw6nNB1awGNhDE2gnhSAvgqGptAVhrChUeL/TIgFKjGE55OVsuBgldDtuSQPfbWUtujOvwBRzeoGKLyaaorjKMjtVHrbv7LnwKKjHSkjJLrPv+bopkViEAbAcOoXqr3YorbHwWry/3/hpjMsSFvYPc57DA+JIMMO9K++n72UKsdfTGUbY/ayP4Ep5/XNpDfauSBiLg+q1mpOpqxIxHUH+c5q2/XGrKPhY+XctEX1wGpaY4FSEytEXIiMvaq1tuZbyyAnoiMzk0QJj5vi6m4gMlN4xhf9clVs9lknmCSf/LR0PK5qn0NwRLBavoW+ecSjtH5T23sEqZYudHBBi27hrn5/Afzrs6PLuA1sVMwSoDqfVHJ0NLQPihltc0RrvYVBceJUA6PktDFC83AshWHwA4y5+fTEG+/4AAAAAElFTkSuQmCC);'
			+ 'background-repeat:no-repeat;'
			+ 'background-position:6px -25px !important;'
			+ 'outline:none !important;'
			+ '}'
		).appendTo( 'head' );
	};

	//======================================================================
	// SETUP
	//======================================================================
	var setup = function () {
		pr.setupCSS();

		pr.layerGroup = new L.LayerGroup();
		window.addLayerGroup( 'XMP Ranges (Portal)', pr.layerGroup, false );

		pr.addControl();
		window.addHook( 'portalSelected', pr.onPortalSelected );

		// Keep enabled-state in sync whether toggled via the button or the
		// layer chooser; only do drawing work while the overlay is visible.
		window.map.on( 'layeradd', function ( e ) {
			if ( e.layer !== pr.layerGroup ) return;
			pr.enabled = true;
			pr.drawAtPortal( window.selectedPortal );
		} );
		window.map.on( 'layerremove', function ( e ) {
			if ( e.layer !== pr.layerGroup ) return;
			pr.enabled = false;
			pr.layerGroup.clearLayers();
			pr.lastGuid = null;
		} );
	};
	// PLUGIN END //////////////////////////////////////////////////////////

	setup.info = plugin_info; //add the script info data to the function as a property
	if ( !window.bootPlugins ) window.bootPlugins = [];
	window.bootPlugins.push( setup );
	// if IITC has already booted, immediately run the 'setup' function
	if ( window.iitcLoaded && typeof setup === 'function' ) setup();
} // wrapper end

// inject code into site context
var script = document.createElement( 'script' );
var info = {};
if ( typeof GM_info !== 'undefined' && GM_info && GM_info.script ) info.script = { version: GM_info.script.version, name: GM_info.script.name, description: GM_info.script.description };
script.appendChild( document.createTextNode( '(' + wrapper + ')(' + JSON.stringify( info ) + ');' ) );
( document.body || document.head || document.documentElement ).appendChild( script );
