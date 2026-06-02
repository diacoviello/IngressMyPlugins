// ==UserScript==
// @author         DiabloEnMusica
// @name           QuickDrawLinks-FieldMU
// @category       Diablo
// @version        1.0.0.20260602.001000
// @updateURL      https://raw.githubusercontent.com/diacoviello/IngressMyPlugins/main/myVersion/Diablo_FieldMU.user.js
// @downloadURL    https://raw.githubusercontent.com/diacoviello/IngressMyPlugins/main/myVersion/Diablo_FieldMU.user.js
// @description    [diabloenmusica-1.0.0.20260602.001000] Calculate approximate MU for fields drawn with QuickDrawLinks. Shows drawn field count, each field's three corner portals, and estimated MU per field.
// @id             qdl-field-mu@DiabloEnMusica
// @namespace      https://softspot.nl/ingress/
// @match          https://intel.ingress.com/*
// @grant          none
// ==/UserScript==


function wrapper( plugin_info ) {
	if ( typeof window.plugin!=='function' ) window.plugin=function() { };

	window.plugin.qdlFieldMU=function() { };
	var self=window.plugin.qdlFieldMU;
	self.id='qdlfieldmu';
	self.title='FieldMU';
	self.version='1.0.0.20260602.001000';
	self.author='DiabloEnMusica';

	// Reproduce the field-detection algorithm from quickdrawlinks.updatefieldslayer.
	// Returns an array of [v1, v2, v3] latLng triples, one per unique detected field.
	self.getDrawnFields=function() {
		var qdl=window.plugin.quickdrawlinks;
		if ( !qdl ) return [];
		var drawlayer=( qdl.getDrawlayer ? qdl.getDrawlayer() : qdl.drawnItems );
		if ( !drawlayer ) return [];

		var layers=[];
		drawlayer.eachLayer( function( layer ) {
			if ( layer instanceof L.GeoJSON&&layer.getLatLngs().length===2 ) {
				layers.push( layer );
			}
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

		// Deduplicate: sort each field's three vertices into a canonical key.
		var seen={};
		var fields=[];
		raw.forEach( function( verts ) {
			var sorted=verts.slice().sort( function( a, b ) {
				return a.lat!==b.lat ? a.lat-b.lat : a.lng-b.lng;
			} );
			var key=sorted.map( function( v ) { return v.lat+','+v.lng; } ).join( '|' );
			if ( !seen[ key ] ) {
				seen[ key ]=true;
				fields.push( verts );
			}
		} );

		return fields;
	};

	// Sign-based point-in-triangle test.
	// Uses flat lat/lng coordinates — accurate enough for Ingress-scale fields.
	self.pointInTriangle=function( pt, v1, v2, v3 ) {
		function sign( p1, p2, p3 ) {
			return ( p1.lat-p3.lat )*( p2.lng-p3.lng )-( p2.lat-p3.lat )*( p1.lng-p3.lng );
		}
		var d1=sign( pt, v1, v2 );
		var d2=sign( pt, v2, v3 );
		var d3=sign( pt, v3, v1 );
		return !( ( d1<0||d2<0||d3<0 )&&( d1>0||d2>0||d3>0 ) );
	};

	// Resolve a portal name from its latLng.
	// Checks current window.portals first, then the quickdrawlinks title cache.
	self.getPortalName=function( latlng ) {
		for ( var guid in window.portals ) {
			var pll=window.portals[ guid ].getLatLng();
			if ( pll.lat===latlng.lat&&pll.lng===latlng.lng ) {
				return window.portals[ guid ].options.data.title||guid;
			}
		}
		var qdl=window.plugin.quickdrawlinks;
		if ( qdl&&qdl.guidpos&&qdl.titlecache ) {
			var key=latlng.lat+','+latlng.lng;
			var g=qdl.guidpos[ key ];
			if ( g&&qdl.titlecache[ g ] ) return qdl.titlecache[ g ];
		}
		return latlng.lat.toFixed(5)+', '+latlng.lng.toFixed(5);
	};

	// Count portals from the current map view that fall inside the triangle.
	// The 3 corner portals are included (they lie on the boundary).
	self.countPortalsInside=function( v1, v2, v3 ) {
		var count=0;
		for ( var guid in window.portals ) {
			if ( self.pointInTriangle( window.portals[ guid ].getLatLng(), v1, v2, v3 ) ) count++;
		}
		return count;
	};

	self.showDialog=function() {
		if ( !window.plugin.quickdrawlinks ) {
			window.dialog( {
				html: '<p style="color:#ffce00;">QuickDrawLinks plugin not found or not loaded yet.</p>',
				title: 'FieldMU',
				id: self.id+'-dialog',
				width: 340
			} );
			return;
		}

		var fields=self.getDrawnFields();
		var totalMU=0;
		var html='<div style="font-size:13px;">';

		if ( fields.length===0 ) {
			html+='<p style="color:#aaa;">No fields detected from drawn links.</p>';
			html+='<p style="color:#aaa;">Use QuickDrawLinks to draw links that form closed triangles, then check here.</p>';
		} else {
			html+='<p><strong>'+fields.length+' field'+(fields.length!==1 ? 's':'')+' detected</strong></p>';

			fields.forEach( function( verts, i ) {
				var v1=verts[ 0 ], v2=verts[ 1 ], v3=verts[ 2 ];
				var n1=self.getPortalName( v1 );
				var n2=self.getPortalName( v2 );
				var n3=self.getPortalName( v3 );
				var mu=self.countPortalsInside( v1, v2, v3 );
				totalMU+=mu;

				html+='<div style="border:1px solid #ffce00;border-radius:3px;margin:6px 0;padding:6px;background:rgba(8,48,78,.9);">';
				html+='<div style="color:#ffce00;margin-bottom:4px;"><strong>Field '+(i+1)+'</strong> &mdash; ~<strong>'+mu+' MU</strong></div>';
				html+='<ol style="margin:0;padding-left:20px;color:#ccc;line-height:1.5em;">';
				html+='<li>'+n1+'</li>';
				html+='<li>'+n2+'</li>';
				html+='<li>'+n3+'</li>';
				html+='</ol>';
				html+='<div style="color:#777;font-size:0.82em;margin-top:3px;">'+mu+' portal'+(mu!==1 ? 's':'')+' in view inside field</div>';
				html+='</div>';
			} );

			html+='<div style="border-top:1px solid #ffce00;margin-top:8px;padding-top:8px;color:#ffce00;">';
			html+='<strong>Total: ~'+totalMU+' MU</strong>';
			html+='</div>';
		}

		html+='<p style="color:#666;font-size:0.8em;margin-top:10px;">MU is estimated from portals visible in the current map view. Actual in-game MU depends on population density and may differ significantly.</p>';
		html+='</div>';

		window.dialog( {
			html: html,
			title: 'FieldMU — '+fields.length+' field'+(fields.length!==1 ? 's':''),
			id: self.id+'-dialog',
			dialogClass: 'ui-dialog-qdlfieldmu',
			width: 380
		} );
	};

	self.setup=function() {
		if ( window.useAndroidPanes() ) {
			android.addPane( self.id, self.title, 'ic_action_share' );
			addHook( 'paneChanged', function( pane ) {
				if ( pane===self.id ) self.showDialog();
			} );
		} else {
			$( '#toolbox' ).append(
				'<a onclick="window.plugin.qdlFieldMU.showDialog(); return false;" href="#">'+self.title+'</a>'
			);
		}
		console.log( 'IITC plugin loaded: QuickDrawLinks-FieldMU version '+self.version );
	};

	var setup=function() {
		( window.iitcLoaded ? self.setup() : window.addHook( 'iitcLoaded', self.setup ) );
	};

	setup.info=plugin_info;
	if ( !window.bootPlugins ) window.bootPlugins=[];
	window.bootPlugins.push( setup );
	if ( window.iitcLoaded&&typeof setup==='function' ) setup();
} // wrapper end

// inject code into site context
var script=document.createElement( 'script' );
var info={};
if ( typeof GM_info!=='undefined'&&GM_info&&GM_info.script ) info.script={ version: GM_info.script.version, name: GM_info.script.name, description: GM_info.script.description };
script.appendChild( document.createTextNode( '('+wrapper+')('+JSON.stringify( info )+');' ) );
( document.body||document.head||document.documentElement ).appendChild( script );
