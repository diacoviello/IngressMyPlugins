// ==UserScript==
// @author         DiabloEnMusica
// @name           CrossLinks Customizer
// @category       Draw
// @version        1.0.0
// @description    Add a customizable dashArray popup for the CrossLinks plugin.
// @id             crosslinks-customizer@diabloenmusica
// @match          https://intel.ingress.com/*
// @grant          none
// ==/UserScript==

function wrapper( plugin_info ) {
	// Ensure plugin framework exists
	if ( typeof window.plugin!=='function' ) window.plugin=function() { };

	// Define the plugin
	window.plugin.crossLinksCustomizer=function() { };
	var plugin=window.plugin.crossLinksCustomizer;

	// Default settings
	plugin.settings={
		dashArray: [ 8, 8 ], // Default dash pattern
	};

	// Function to apply the new dashArray settings
	plugin.applyDashArray=function() {
		var originalShowLink=window.plugin.crossLinks.showLink;

		window.plugin.crossLinks.showLink=function( link ) {
			var dashArrayStr=plugin.settings.dashArray.join( ',' );

			var poly=L.geodesicPolyline( link.getLatLngs(), {
				color: '#d22',
				opacity: 0.7,
				weight: 5,
				interactive: false,
				dashArray: dashArrayStr,
				guid: link.options.guid,
			} );

			poly.addTo( plugin.crossLinks.linkLayer );
			plugin.crossLinks.linkLayerGuids[ link.options.guid ]=poly;
		};

		console.log( 'CrossLinks dashArray customization applied:', plugin.settings.dashArray );
	};

	// Function to show settings popup
	plugin.showSettingsPopup=function() {
		var html=`
            <div>
                <label for="dashArrayInput">Dash Array (comma-separated):</label><br>
                <input type="text" id="dashArrayInput" value="${plugin.settings.dashArray.join( ',' )}" style="width: 100%;"><br><br>
                <button id="applyDashArrayButton">Apply</button>
            </div>
        `;

		dialog( {
			html: html,
			title: 'Customize CrossLinks Dash Array',
			id: 'plugin-crossLinks-customizer',
			width: 300,
		} );

		document.getElementById( 'applyDashArrayButton' ).addEventListener( 'click', function() {
			var input=document.getElementById( 'dashArrayInput' ).value;
			var newDashArray=input.split( ',' ).map( Number );

			if ( newDashArray.every( ( n ) => !isNaN( n )&&n>=0 ) ) {
				plugin.settings.dashArray=newDashArray;
				plugin.applyDashArray();
				alert( `Dash array updated to: ${newDashArray.join( ',' )}` );
			} else {
				alert( 'Invalid input. Please enter only positive numbers, separated by commas.' );
			}
		} );
	};

	// IITC plugin setup function
	plugin.setup=function() {
		if ( !window.plugin.crossLinks ) {
			console.warn( 'CrossLinks plugin not loaded.' );
			return;
		}

		plugin.applyDashArray();

		// Add menu item
		var menuItem='<a onclick="window.plugin.crossLinksCustomizer.showSettingsPopup()">CrossLinks Customizer</a>';
		$( '#toolbox' ).append( menuItem );
	};

	var setup=window.plugin.crossLinksCustomizer.setup;
	setup.info=plugin_info;

	// Make sure window.bootPlugins exists and is an array
	if ( !window.bootPlugins ) window.bootPlugins=[];

	// Add our startup hook
	window.bootPlugins.push( setup );
	if ( typeof window.iitcLoaded!=='undefined'&&window.iitcLoaded ) {
		setup();
	} else {
		window.addEventListener( 'iitcLoaded', setup );
	}
}

// Inject the script into IITC
var script=document.createElement( 'script' );
var info={
	script: {
		name: 'CrossLinks Customizer',
		version: '1.0.0',
	},
};

// GM_info is defined by the assorted monkey-themed browser extensions
// and holds information parsed from the script header.
if ( typeof GM_info!=='undefined'&&GM_info&&GM_info.script ) {
	info.script={
		version: GM_info.script.version,
		name: GM_info.script.name,
		description: GM_info.script.description
	};

}

// create text node
var textNode=document.createTextNode( '('+wrapper+')('+JSON.stringify( info )+')' );

script.appendChild( textNode );
( document.body||document.head||document.documentElement ).appendChild( script );
