// ==UserScript==
// @id             iitc-plugin-portal-alert
// @name           IITC Plugin: Portal Info Alert
// @category       AAAAA
// @version        0.1.1
// @namespace      https://github.com/yourusername/iitc-plugins
// @updateURL      https://github.com/yourusername/iitc-plugins/portal-alert.meta.js
// @downloadURL    https://github.com/yourusername/iitc-plugins/portal-alert.user.js
// @description    Alerts portal information when a portal is selected.
// @include        https://intel.ingress.com/*
// @match          https://intel.ingress.com/*
// @grant          none
// ==/UserScript==

( function() {
	let lastSelectedPortalGuid=null;

	const setup=function() {
		window.addHook( "portalSelected", async function( data ) {
			let portalGUID=data.selectedPortalGuid;

			if ( portalGUID===lastSelectedPortalGuid ) return;

			lastSelectedPortalGuid=portalGUID;

			if ( !portalGUID ) {
				alert( "No portal selected!" );
				return;
			}

			try {
				let portal=await waitForPortalData( portalGUID, 10 );
				let portalTitle=portal.options.data.title||"Unknown Title";
				let portalLevel=portal.options.data.level||"Unknown Level";
				let portalLocation=portal.getLatLng();

				let activeLinks=await getPortalLinks( portalGUID );
				let activeFields=getPortalFields( portalGUID );

				let linksInfo=activeLinks.length
					? activeLinks.map( link => `- ${link}` ).join( "\n" )
					:"No links attached.";
				let fieldsInfo=activeFields.length
					? activeFields.map( field => `- ${field}` ).join( "\n" )
					:"No fields attached.";

				alert( `Portal Selected:
GUID: ${portalGUID}
Title: ${portalTitle}
Level: ${portalLevel}
Location: ${portalLocation.lat}, ${portalLocation.lng}

Links: 
${linksInfo}

Fields: 
${fieldsInfo}` );
			} catch ( e ) {
				console.error( "Error retrieving portal data:", e );
				alert( `Failed to load portal data for GUID: ${portalGUID}` );
			}
		} );
	};

	function waitForPortalData( portalGUID, retries ) {
		return new Promise( ( resolve, reject ) => {
			let check=() => {
				let portal=window.portals[ portalGUID ];
				if ( portal&&portal.options.data.title ) {
					resolve( portal );
				} else if ( retries>0 ) {
					retries--;
					setTimeout( check, 200 );
				} else {
					reject( new Error( "Portal data not available" ) );
				}
			};
			check();
		} );
	}

	async function getPortalLinks( portalGUID ) {
		let links=[];
		let selectedPortal=await waitForPortalData( portalGUID, 10 );

		if ( !selectedPortal ) {
			console.warn( `Selected portal with GUID ${portalGUID} not found.` );
			return links;
		}

		let selectedLatLng=selectedPortal.getLatLng();

		for ( let guid in window.links ) {
			let link=window.links[ guid ];
			let otherPortalGUID=null;

			if ( link.options.data.oGuid===portalGUID ) {
				otherPortalGUID=link.options.data.dGuid;
				console.log( getPortalSummaryData( portalGUID ) );
			} else if ( link.options.data.dGuid===portalGUID ) {
				otherPortalGUID=link.options.data.oGuid;
			}

			if ( otherPortalGUID ) {
				try {
					let otherPortal=window.portals[ otherPortalGUID ];
					console.log( `Other Portal GUID: ${otherPortalGUID}`, otherPortal );

					let otherPortalTitle=otherPortal?.get.title||"Unknown Title";
					let otherPortalLatLng=otherPortal?.getLatLng();

					console.log( "title: ", otherPortalTitle );
					console.log( "latlng: ", otherPortalLatLng );

					if ( otherPortalLatLng ) {
						let direction=calculateDirection(
							selectedLatLng.lat,
							selectedLatLng.lng,
							otherPortalLatLng.lat,
							otherPortalLatLng.lng
						);

						links.push(
							`Link to ${otherPortalTitle} (${otherPortalLatLng.lat.toFixed( 6 )}, ${otherPortalLatLng.lng.toFixed( 6 )}) located ${direction} of ${selectedPortal.title}`
						);
					} else {
						links.push( `Link to ${otherPortalTitle} (Unknown Location)` );
					}
				} catch ( err ) {
					console.warn( `Failed to load data for linked portal GUID: ${otherPortalGUID}` );
					links.push( `Link to Unknown Portal (GUID: ${otherPortalGUID})` );
				}
			}
		}

		return links;
	}

	function getPortalFields( portalGUID ) {
		let fields=[];
		for ( let guid in window.fields ) {
			let field=window.fields[ guid ];
			if ( field.options.data.points.some( p => p.guid===portalGUID ) ) {
				fields.push( `Field connected to ${field.options.data.points.map( p => p.guid ).join( ", " )}` );
			}
		}
		return fields;
	}

	if ( typeof window.plugin!=="function" ) window.plugin=function() { };
	window.plugin.portalInfoAlert={ setup };

	if ( window.iitcLoaded ) setup();
	else window.addHook( "iitcLoaded", setup );
} )();
