// ==UserScript==
// @id             iitc-plugin-portal-alert
// @name           IITC Plugin: Portal Info Alert with Links and Fields
// @category       Info
// @version        0.2.0
// @namespace      https://github.com/yourusername/iitc-plugins
// @updateURL      https://github.com/yourusername/iitc-plugins/portal-alert.meta.js
// @downloadURL    https://github.com/yourusername/iitc-plugins/portal-alert.user.js
// @description    Alerts portal information including links and fields when a portal is selected.
// @include        https://intel.ingress.com/*
// @match          https://intel.ingress.com/*
// @grant          none
// ==/UserScript==

( function() {
	const setup=function() {
		window.addHook( 'portalSelected', function( data ) {
			const portalGUID=data.selectedPortalGuid;
			if ( !portalGUID ) {
				alert( "No portal selected!" );
				return;
			}

			const portal=window.portals[ portalGUID ];
			if ( !portal ) {
				alert( `Portal with GUID ${portalGUID} not found.` );
				return;
			}

			// Extract details
			const portalTitle=portal.options.data.title||'Unknown Title';
			const portalLevel=portal.options.data.level||'Unknown Level';
			const portalLocation=portal.getLatLng();

			// Get links and fields
			const links=getPortalLinks( portalGUID );
			const fields=getPortalFields( portalGUID );

			// Format links and fields
			const linksInfo=links.length
				? links.map( link => `- ${link}` ).join( '\n' )
				:'No links attached.';
			const fieldsInfo=fields.length
				? fields.map( field => `- ${field}` ).join( '\n' )
				:'No fields attached.';

			// Display the information
			alert( `Portal Selected:\n
        GUID: ${portalGUID}\n
        Title: ${portalTitle}\n
        Level: ${portalLevel}\n
        Location: ${portalLocation.lat}, ${portalLocation.lng}\n\n
        Links:\n${linksInfo}\n\n
        Fields:\n${fieldsInfo}` );
		} );
	};

	// Utility functions to get portal links and fields
	function getPortalLinks( portalGUID ) {
		const links=[];
		for ( const guid in window.links ) {
			const link=window.links[ guid ];
			if ( link.options.data.oGuid===portalGUID||link.options.data.dGuid===portalGUID ) {
				links.push( `Link to ${link.options.data.oGuid===portalGUID? link.options.data.dGuid:link.options.data.oGuid}` );
			}
		}
		return links;
	}

	function getPortalFields( portalGUID ) {
		const fields=[];
		for ( const guid in window.fields ) {
			const field=window.fields[ guid ];
			if ( field.options.data.points.some( p => p.guid===portalGUID ) ) {
				fields.push( `Field connected to ${field.options.data.points.map( p => p.guid ).join( ', ' )}` );
			}
		}
		return fields;
	}

	// Plugin entry point
	setup.info={
		script: {
			version: '0.2.0',
			name: 'Portal Info Alert with Links and Fields',
			description: 'Alerts portal info, links, and fields when a portal is selected.',
		},
	};

	// Add the plugin to IITC
	if ( typeof window.plugin!=='function' ) window.plugin=function() { };
	window.plugin.portalInfoAlert=setup;
	if ( window.iitcLoaded ) setup();
	else window.addHook( 'iitcLoaded', setup );
} )();
