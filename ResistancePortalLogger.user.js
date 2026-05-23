// ==UserScript==
// @id             iitc-plugin-resistance-action-logger
// @name           Resistance Portal Interaction Logger
// @category       Info
// @version        1.0.1
// @description    Log Resistance agent actions within a radius and export driving distance/times via OSRM
// @match          https://intel.ingress.com/*
// @match          https://intel-x.ingress.com/*
// @grant          none
// ==/UserScript==

function wrapper( plugin_info ) {
	if ( typeof window.plugin!=='function' ) window.plugin=function() {};
	if ( window.plugin.resistanceActionLogger ) return;

	window.plugin.resistanceActionLogger=function() {};
	const self=window.plugin.resistanceActionLogger;

	const RADIUS_METERS=1000;
	let log=[];
	let lastActions={};
	let seenPortals={}; // guid -> { team, owner } — used to detect captures

	function haversineDistance( lat1, lon1, lat2, lon2 ) {
		function toRad( x ) { return x*Math.PI/180; }
		const R=6371000;
		const dLat=toRad( lat2-lat1 );
		const dLon=toRad( lon2-lon1 );
		const a=Math.sin( dLat/2 )**2+
		        Math.cos( toRad( lat1 ) )*Math.cos( toRad( lat2 ) )*
		        Math.sin( dLon/2 )**2;
		return R*2*Math.atan2( Math.sqrt( a ), Math.sqrt( 1-a ) );
	}

	function isWithinRadius( lat, lng ) {
		const center=window.map.getCenter();
		return haversineDistance( center.lat, center.lng, lat, lng )<=RADIUS_METERS;
	}

	function getPortalLink( lat, lng ) {
		return `https://intel.ingress.com/intel?ll=${lat},${lng}&z=17`;
	}

	function fetchDrivingData( lat1, lng1, lat2, lng2, callback ) {
		const url=`https://router.project-osrm.org/route/v1/driving/${lng1},${lat1};${lng2},${lat2}?overview=false`;
		fetch( url )
			.then( res => res.json() )
			.then( data => {
				if ( data.routes&&data.routes.length>0 ) {
					callback( data.routes[ 0 ].distance/1000, data.routes[ 0 ].duration );
				} else {
					callback( null, null );
				}
			} ).catch( () => callback( null, null ) );
	}

	function pushEntry( agent, type, lat, lng, name, distance, duration ) {
		const entry={
			time: new Date().toISOString(),
			agent, type,
			portalName: name,
			portalLink: getPortalLink( lat.toFixed( 6 ), lng.toFixed( 6 ) ),
			lat: lat.toFixed( 6 ),
			lng: lng.toFixed( 6 ),
			distance: distance!=null ? distance.toFixed( 2 ) : 'N/A',
			duration: duration!=null ? Math.round( duration ) : 'N/A'
		};
		log.push( entry );
		console.log( '[RES LOG]', entry );
	}

	function logAction( agent, type, lat, lng, name ) {
		if ( !isWithinRadius( lat, lng ) ) return;
		const last=lastActions[ agent ];
		lastActions[ agent ]={ lat, lng };
		if ( last ) {
			fetchDrivingData( last.lat, last.lng, lat, lng, ( distance, duration ) => {
				pushEntry( agent, type, lat, lng, name, distance, duration );
			} );
		} else {
			pushEntry( agent, type, lat, lng, name, null, null );
		}
	}

	function setupHooks() {
		// Detect captures and deployments: fires when portal data is loaded from server.
		// We track previous state per guid so we only log when ownership actually changes.
		window.addHook( 'portalDetailsUpdated', data => {
			const portal=window.portals[ data.guid ];
			if ( !portal||!portal.options||!portal.options.data ) return;
			const d=portal.options.data;

			const prev=seenPortals[ data.guid ];
			seenPortals[ data.guid ]={ team: d.team, owner: d.owner };

			if ( d.team!=='R'||!d.owner ) return;
			// Skip if nothing changed since we last saw this portal
			if ( prev&&prev.team==='R'&&prev.owner===d.owner ) return;

			const ll=portal.getLatLng();
			logAction( d.owner, 'Captured/Deployed', ll.lat, ll.lng, d.title );
		} );

		// Links — IITC hook is `linkAdded`, not `linkCreated`
		window.addHook( 'linkAdded', data => {
			const link=data.link;
			if ( !link||!link.options||!link.options.data ) return;
			const ld=link.options.data;
			if ( ld.team!=='R' ) return;
			const oPortal=window.portals[ ld.oGuid ];
			if ( !oPortal ) return;
			const ll=oPortal.getLatLng();
			const agent=( oPortal.options.data&&oPortal.options.data.owner )||'Unknown';
			const name=( oPortal.options.data&&oPortal.options.data.title )||ld.oGuid;
			logAction( agent, 'Linked', ll.lat, ll.lng, name );
		} );

		// Fields — IITC hook is `fieldAdded`, not `fieldCreated`
		window.addHook( 'fieldAdded', data => {
			const field=data.field;
			if ( !field||!field.options||!field.options.data ) return;
			const fd=field.options.data;
			if ( fd.team!=='R' ) return;
			const oPortal=window.portals[ fd.oGuid ];
			if ( !oPortal ) return;
			const ll=oPortal.getLatLng();
			const agent=( oPortal.options.data&&oPortal.options.data.owner )||'Unknown';
			const name=( oPortal.options.data&&oPortal.options.data.title )||fd.oGuid;
			logAction( agent, 'Fielded', ll.lat, ll.lng, name );
		} );
	}

	function exportCSV() {
		let csv='Time,Agent,Action,Portal Name,Portal Link,Latitude,Longitude,Distance (km),Time Between (s)\n';
		csv+=log.map( e =>
			`${e.time},"${e.agent}","${e.type}","${e.portalName}","${e.portalLink}",${e.lat},${e.lng},${e.distance},${e.duration}`
		).join( '\n' );

		const blob=new Blob( [ csv ], { type: 'text/csv;charset=utf-8;' } );
		const url=URL.createObjectURL( blob );
		const a=document.createElement( 'a' );
		a.href=url;
		a.download='res_portal_log.csv';
		a.click();
		URL.revokeObjectURL( url );
	}

	function setupControls() {
		const link=document.createElement( 'a' );
		link.textContent='RES Log CSV';
		link.style.cursor='pointer';
		link.addEventListener( 'click', exportCSV );
		$( '#toolbox' ).append( link );
	}

	const setup=function() {
		setupHooks();
		setupControls();
		console.log( '[ResistanceActionLogger] Plugin loaded.' );
	};

	setup.info=plugin_info;
	if ( !window.bootPlugins ) window.bootPlugins=[];
	window.bootPlugins.push( setup );
	if ( window.iitcLoaded&&typeof setup==='function' ) setup();
} // wrapper end

var script=document.createElement( 'script' );
var info={};
if ( typeof GM_info!=='undefined'&&GM_info&&GM_info.script ) info.script={ version: GM_info.script.version, name: GM_info.script.name, description: GM_info.script.description };
script.appendChild( document.createTextNode( '('+wrapper+')('+JSON.stringify( info )+');' ) );
( document.body||document.head||document.documentElement ).appendChild( script );
