// ==UserScript==
// @author         DiabloEnMusica
// @name           QuickDrawLinks-FieldMU
// @category       Diablo
// @version        1.0.4.20260603.003000
// @updateURL      https://raw.githubusercontent.com/diacoviello/IngressMyPlugins/main/myVersion/Diablo_FieldMU.user.js
// @downloadURL    https://raw.githubusercontent.com/diacoviello/IngressMyPlugins/main/myVersion/Diablo_FieldMU.user.js
// @description    [diabloenmusica-1.0.4.20260603.003000] Calculate approximate MU for drawn fields using WorldPop population data and S2 level-13 cell coverage. MU = population x 2/3 (empirical Ingress formula). Falls back to loaded-portal count if the API is unavailable.
// @id             qdl-field-mu@DiabloEnMusica
// @namespace      https://softspot.nl/ingress/
// @match          https://intel.ingress.com/*
// @grant          GM_xmlhttpRequest
// @connect        api.worldpop.org
// ==/UserScript==

/* global unsafeWindow */

// Runs directly in the Tampermonkey sandbox. No script-tag injection.
// All IITC page-level APIs are accessed through unsafeWindow (aliased win).
// GM_xmlhttpRequest is available directly here — no bridge needed.

var win=( typeof unsafeWindow!=='undefined' ) ? unsafeWindow : window;

if ( typeof win.plugin!=='function' ) win.plugin=function() { };
win.plugin.qdlFieldMU=function() { };
var self=win.plugin.qdlFieldMU;
self.id='qdlfieldmu';
self.title='FieldMU';
self.version='1.0.4.20260603.003000';
self.author='DiabloEnMusica';

// ── Field detection ───────────────────────────────────────────────────────────
// Duck-types the draw-layer check (typeof .getLatLngs) to avoid cross-world
// instanceof failures between the Tampermonkey sandbox and the page context.
self.getDrawnFields=function() {
	var qdl=win.plugin.quickdrawlinks;
	if ( !qdl ) return [];
	var drawlayer=( qdl.getDrawlayer ? qdl.getDrawlayer() : qdl.drawnItems );
	if ( !drawlayer ) return [];

	var layers=[];
	drawlayer.eachLayer( function( layer ) {
		try {
			var ll=layer.getLatLngs();
			if ( ll&&ll.length===2 ) layers.push( layer );
		} catch ( e ) { }
	} );

	function findcornermatch( corner, layers, startcnt ) {
		for ( var cnt=startcnt;cnt<layers.length;cnt++ ) {
			var ll=layers[ cnt ].getLatLngs();
			if ( corner[ 0 ].lat===ll[ 0 ].lat&&corner[ 0 ].lng===ll[ 0 ].lng ) return [ 0, cnt, 0 ];
			else if ( corner[ 0 ].lat===ll[ 1 ].lat&&corner[ 0 ].lng===ll[ 1 ].lng ) return [ 0, cnt, 1 ];
			else if ( corner[ 1 ].lat===ll[ 0 ].lat&&corner[ 1 ].lng===ll[ 0 ].lng ) return [ 1, cnt, 0 ];
			else if ( corner[ 1 ].lat===ll[ 1 ].lat&&corner[ 1 ].lng===ll[ 1 ].lng ) return [ 1, cnt, 1 ];
		}
		return false;
	}

	function findlinkmatch( c1, c2, layers, startcnt ) {
		for ( var cnt=startcnt;cnt<layers.length;cnt++ ) {
			var ll=layers[ cnt ].getLatLngs();
			if ( c1.lat===ll[ 0 ].lat&&c1.lng===ll[ 0 ].lng&&c2.lat===ll[ 1 ].lat&&c2.lng===ll[ 1 ].lng ) return cnt;
			else if ( c1.lat===ll[ 1 ].lat&&c1.lng===ll[ 1 ].lng&&c2.lat===ll[ 0 ].lat&&c2.lng===ll[ 0 ].lng ) return cnt;
		}
		return false;
	}

	var raw=[];
	for ( var cnt=0;cnt<layers.length;cnt++ ) {
		var l1=layers[ cnt ].getLatLngs();
		var cm=findcornermatch( l1, layers, cnt+1 );
		do {
			if ( cm instanceof Array ) {
				var l2=layers[ cm[ 1 ] ].getLatLngs();
				if ( findlinkmatch( l1[ 1-cm[ 0 ] ], l2[ 1-cm[ 2 ] ], layers, cm[ 1 ]+1 )!==false ) {
					raw.push( [ l1[ 0 ], l1[ 1 ], l2[ 1-cm[ 2 ] ] ] );
				}
				cm=findcornermatch( l1, layers, cm[ 1 ]+1 );
			}
		} while ( cm instanceof Array );
	}

	var seen={};
	var fields=[];
	raw.forEach( function( verts ) {
		var sorted=verts.slice().sort( function( a, b ) {
			return a.lat!==b.lat ? a.lat-b.lat : a.lng-b.lng;
		} );
		var key=sorted.map( function( v ) { return v.lat+','+v.lng; } ).join( '|' );
		if ( !seen[ key ] ) { seen[ key ]=true; fields.push( verts ); }
	} );
	return fields;
};

// ── Geometry ──────────────────────────────────────────────────────────────────

self.triangleAreaKm2=function( v1, v2, v3 ) {
	var R=6371.0;
	function rad( d ) { return d*Math.PI/180; }
	function haversineAngle( a, b ) {
		var dlat=rad( b.lat-a.lat ), dlng=rad( b.lng-a.lng );
		var sl=Math.sin( dlat/2 ), sg=Math.sin( dlng/2 );
		return 2*Math.asin( Math.sqrt( sl*sl+Math.cos( rad( a.lat ) )*Math.cos( rad( b.lat ) )*sg*sg ) );
	}
	var a=haversineAngle( v2, v3 ), b=haversineAngle( v1, v3 ), c=haversineAngle( v1, v2 );
	var s=( a+b+c )/2;
	var inner=Math.tan( s/2 )*Math.tan( ( s-a )/2 )*Math.tan( ( s-b )/2 )*Math.tan( ( s-c )/2 );
	return R*R*4*Math.atan( Math.sqrt( Math.max( 0, inner ) ) );
};

self.estimateS2Cells=function( v1, v2, v3 ) {
	return Math.max( 1, Math.round( self.triangleAreaKm2( v1, v2, v3 )/1.27 ) );
};

// ── Population data (WorldPop REST API via GM_xmlhttpRequest) ─────────────────
//
// Formula (empirically reverse-engineered by the Ingress community):
//   MU ~= round( sum_over_S2_L13_cells( cell_population x coverage_fraction ) x 2/3 )
//
// WorldPop stats API integrates population across the polygon, equivalent to
// that cell-coverage sum. Multiplying by 2/3 matches empirical MU values.
// Dataset: WPGP un-adjusted global population, 2020, ~1 km resolution.
// Source:  api.worldpop.org  (University of Southampton, open access)
//
// WorldPop can return an async taskid for larger polygons. _pollWorldPop()
// handles that case by polling until the result is ready.

self._extractPop=function( json ) {
	if ( !json||!json.data ) return 0;
	// Try known field names
	var pop=parseFloat( json.data.total_population||json.data.wpgppop||json.data.pop||json.data.population||0 );
	// Fallback: pick the first positive numeric value in the data object
	if ( !pop||isNaN( pop ) ) {
		for ( var k in json.data ) {
			var v=parseFloat( json.data[ k ] );
			if ( !isNaN( v )&&v>0 ) { pop=v; break; }
		}
	}
	return isNaN( pop ) ? 0 : pop;
};

self._pollWorldPop=function( taskId, resolve, reject, attempt ) {
	if ( attempt>12 ) { reject( new Error( 'WorldPop task timed out after 12 polls' ) ); return; }
	setTimeout( function() {
		GM_xmlhttpRequest( {
			method: 'GET',
			url: 'https://api.worldpop.org/v1/tasks/'+taskId,
			timeout: 20000,
			onload: function( r ) {
				try {
					var json=JSON.parse( r.responseText );
					console.log( '[FieldMU] WorldPop poll attempt '+attempt+' status='+json.status,
						JSON.stringify( json.data||{} ).substring( 0, 200 ) );
					var stillRunning=( json.status==='created'||json.status==='running'||( json.status==='OK'&&!json.data ) );
					if ( stillRunning ) {
						self._pollWorldPop( taskId, resolve, reject, attempt+1 );
					} else {
						var pop=self._extractPop( json );
						resolve( { population: Math.round( pop ), mu: Math.max( 1, Math.round( pop*2/3 ) ) } );
					}
				} catch ( e ) { reject( e ); }
			},
			onerror: function() { reject( new Error( 'poll request failed' ) ); },
			ontimeout: function() { self._pollWorldPop( taskId, resolve, reject, attempt+1 ); }
		} );
	}, 2000 );
};

self.fetchWorldPopMU=function( v1, v2, v3 ) {
	var geojson=JSON.stringify( {
		type: 'Polygon',
		coordinates: [ [
			[ v1.lng, v1.lat ],
			[ v2.lng, v2.lat ],
			[ v3.lng, v3.lat ],
			[ v1.lng, v1.lat ]
		] ]
	} );
	var url='https://api.worldpop.org/v1/services/stats' +
	        '?dataset=wpgppop&year=2020&geojson='+encodeURIComponent( geojson );

	return new Promise( function( resolve, reject ) {
		GM_xmlhttpRequest( {
			method: 'GET',
			url: url,
			timeout: 30000,
			onload: function( r ) {
				try {
					console.log( '[FieldMU] WorldPop initial response HTTP '+r.status+':', r.responseText.substring( 0, 500 ) );
					var json=JSON.parse( r.responseText );
					// WorldPop may queue the request as an async task
					var hasData=json.data&&Object.keys( json.data ).length>0;
					if ( json.taskid&&( json.status==='created'||!hasData ) ) {
						console.log( '[FieldMU] WorldPop queued async task '+json.taskid+', polling...' );
						self._pollWorldPop( json.taskid, resolve, reject, 0 );
						return;
					}
					var pop=self._extractPop( json );
					resolve( { population: Math.round( pop ), mu: Math.max( 1, Math.round( pop*2/3 ) ) } );
				} catch ( e ) {
					reject( e );
				}
			},
			onerror: function() { reject( new Error( 'request failed' ) ); },
			ontimeout: function() { reject( new Error( 'timeout' ) ); }
		} );
	} );
};

// ── Portal helpers ────────────────────────────────────────────────────────────

self.pointInTriangle=function( pt, v1, v2, v3 ) {
	function sign( p1, p2, p3 ) {
		return ( p1.lat-p3.lat )*( p2.lng-p3.lng )-( p2.lat-p3.lat )*( p1.lng-p3.lng );
	}
	var d1=sign( pt, v1, v2 ), d2=sign( pt, v2, v3 ), d3=sign( pt, v3, v1 );
	return !( ( d1<0||d2<0||d3<0 )&&( d1>0||d2>0||d3>0 ) );
};

self.countPortalsInside=function( v1, v2, v3 ) {
	var n=0;
	for ( var guid in win.portals ) {
		if ( self.pointInTriangle( win.portals[ guid ].getLatLng(), v1, v2, v3 ) ) n++;
	}
	return n;
};

self.getPortalName=function( latlng ) {
	for ( var guid in win.portals ) {
		var pll=win.portals[ guid ].getLatLng();
		if ( pll.lat===latlng.lat&&pll.lng===latlng.lng ) {
			return win.portals[ guid ].options.data.title||guid;
		}
	}
	var qdl=win.plugin.quickdrawlinks;
	if ( qdl&&qdl.guidpos&&qdl.titlecache ) {
		var key=latlng.lat+','+latlng.lng;
		var g=qdl.guidpos[ key ];
		if ( g&&qdl.titlecache[ g ] ) return qdl.titlecache[ g ];
	}
	return latlng.lat.toFixed( 5 )+', '+latlng.lng.toFixed( 5 );
};

// ── Dialog ────────────────────────────────────────────────────────────────────

self.showDialog=function() {
	var $=win.$;

	if ( !win.plugin.quickdrawlinks ) {
		win.dialog( {
			html: '<p style="color:#ffce00;">QuickDrawLinks plugin not found or not loaded yet.</p>',
			title: 'FieldMU', id: self.id+'-dialog', width: 340
		} );
		return;
	}

	var fields=self.getDrawnFields();

	var html='<div id="qdlfieldmu-content" style="font-size:13px;">';

	if ( fields.length===0 ) {
		html+='<p style="color:#aaa;">No fields detected from drawn links.</p>';
		html+='<p style="color:#aaa;">Draw links with QuickDrawLinks to form closed triangles, then open this menu.</p>';
	} else {
		html+='<p><strong>'+fields.length+' field'+(fields.length!==1 ? 's':'')+' detected</strong></p>';

		fields.forEach( function( verts, i ) {
			var v1=verts[ 0 ], v2=verts[ 1 ], v3=verts[ 2 ];
			var areaKm2=self.triangleAreaKm2( v1, v2, v3 );
			var s2count=self.estimateS2Cells( v1, v2, v3 );
			var portals=self.countPortalsInside( v1, v2, v3 );

			html+='<div id="qdlfieldmu-field-'+i+'" style="border:1px solid #ffce00;border-radius:3px;margin:6px 0;padding:6px;background:rgba(8,48,78,.9);">';
			html+='<div style="color:#ffce00;margin-bottom:4px;">';
			html+='<strong>Field '+(i+1)+'</strong> &mdash; ';
			html+='<span id="qdlfieldmu-mu-'+i+'">querying WorldPop...</span>';
			html+='</div>';
			html+='<ol style="margin:2px 0 4px 0;padding-left:20px;color:#ccc;line-height:1.5em;">';
			html+='<li>'+self.getPortalName( v1 )+'</li>';
			html+='<li>'+self.getPortalName( v2 )+'</li>';
			html+='<li>'+self.getPortalName( v3 )+'</li>';
			html+='</ol>';
			html+='<div style="color:#666;font-size:0.82em;">';
			html+=areaKm2.toFixed( 2 )+' km2';
			html+=' &nbsp;&middot;&nbsp; ~'+s2count+' S2 L13 cell'+(s2count!==1 ? 's':'');
			html+=' &nbsp;&middot;&nbsp; '+portals+' portal'+(portals!==1 ? 's':'')+' in view';
			html+='</div>';
			html+='</div>';
		} );

		html+='<div id="qdlfieldmu-total" style="border-top:1px solid #ffce00;margin-top:8px;padding-top:8px;color:#ffce00;">Computing total...</div>';
	}

	html+='<p style="color:#555;font-size:0.78em;margin-top:10px;">';
	html+='MU = population x 2/3 &middot; WorldPop 2020 (~1 km grid) over S2 L13 cell coverage. ';
	html+='Empirical formula (Ludlow). Actual MU is determined by Niantic\'s servers.';
	html+='</p>';
	html+='</div>';

	win.dialog( {
		html: html,
		title: 'FieldMU -- '+fields.length+' field'+(fields.length!==1 ? 's':''),
		id: self.id+'-dialog',
		dialogClass: 'ui-dialog-qdlfieldmu',
		width: 410
	} );

	if ( fields.length===0 ) return;

	var muResults=new Array( fields.length );
	var completed=0;

	function onAllDone() {
		var total=0, anySuccess=false;
		muResults.forEach( function( r ) {
			if ( r&&r.mu ) { total+=r.mu; anySuccess=true; }
		} );
		var $t=$( '#qdlfieldmu-total' );
		if ( anySuccess ) {
			$t.html( '<strong>Total: ~'+total.toLocaleString()+' MU</strong>' );
		} else {
			$t.html( '<span style="color:#888;">WorldPop API unavailable -- see portal counts above.</span>' );
		}
	}

	fields.forEach( function( verts, i ) {
		var v1=verts[ 0 ], v2=verts[ 1 ], v3=verts[ 2 ];
		self.fetchWorldPopMU( v1, v2, v3 )
			.then( function( result ) {
				muResults[ i ]=result;
				$( '#qdlfieldmu-mu-'+i ).html(
					'~<strong>'+result.mu.toLocaleString()+'</strong> MU'+
					' <span style="color:#555;font-size:0.85em;">(pop '+result.population.toLocaleString()+')</span>'
				);
				if ( ++completed===fields.length ) onAllDone();
			} )
			.catch( function() {
				muResults[ i ]=null;
				var p=self.countPortalsInside( v1, v2, v3 );
				$( '#qdlfieldmu-mu-'+i ).html(
					'<span style="color:#888;">API unavailable -- '+p+' portals in view</span>'
				);
				if ( ++completed===fields.length ) onAllDone();
			} );
	} );
};

// ── Setup ─────────────────────────────────────────────────────────────────────

function setup() {
	if ( win.useAndroidPanes() ) {
		win.android.addPane( self.id, self.title, 'ic_action_share' );
		win.addHook( 'paneChanged', function( pane ) {
			if ( pane===self.id ) self.showDialog();
		} );
	} else {
		win.$( '#toolbox' ).append(
			'<a onclick="window.plugin.qdlFieldMU.showDialog(); return false;" href="#">'+self.title+'</a>'
		);
	}
	console.log( 'IITC plugin loaded: QuickDrawLinks-FieldMU version '+self.version );
}

if ( win.iitcLoaded ) {
	setup();
} else {
	win.addHook( 'iitcLoaded', setup );
}
