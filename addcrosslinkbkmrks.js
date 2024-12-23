// ==UserScript==
// @author         DanielOnDiordna
// @name           Quick Draw Links
// @category       Layer
// @version        0.0.9.20210724.002500
// @updateURL      https://raw.githubusercontent.com/IITC-CE/Community-plugins/master/dist/DanielOnDiordna/quick-draw-links.meta.js
// @downloadURL    https://raw.githubusercontent.com/IITC-CE/Community-plugins/master/dist/DanielOnDiordna/quick-draw-links.user.js
// @description    [danielondiordna-0.0.9.20210724.002500] Quickly draw and move links from portal to portal on the map. Show crosslinks, for links on the map, as well as for drawn links. Store/Restore your projects. Added great circle support. Added fields layer. Export list of used portals with link count. Integrated Spectrum Colorpicker 1.8.1
// @id             quick-draw-links@DanielOnDiordna
// @namespace      https://softspot.nl/ingress/
// @match          https://intel.ingress.com/*
// @grant          none
// ==/UserScript==


function wrapper( plugin_info ) {
	// ensure plugin framework is there, even if iitc is not yet loaded
	if ( typeof window.plugin!=='function' ) window.plugin=function() { };

	// use own namespace for plugin
	window.plugin.quickdrawlinks=function() { };
	var self=window.plugin.quickdrawlinks;
	self.id='quickdrawlinks+efficientcrosslinks';
	self.title='Quick Draw Links + Efficient CrossLinks Portals';
	self.version='0.0.1';
	self.author='DiabloEnMusica';
	self.changelog=`
Changelog:
`;

	self.namespace='window.plugin.'+self.id+'.';
	self.pluginname='plugin-'+self.id;

	self.panename='plugin-'+self.id;

	self.localstoragesettings=self.pluginname+'-settings';
	self.localstoragelayer=self.pluginname+'-layer';
	self.localstoragetitlecache=self.pluginname+'-titlecache';
	self.localstoragedata=self.pluginname+'-data';

	self.markerLayer=undefined;
	self.iconstyle='link';
	self.startguid=undefined;
	self.startpos=undefined;
	self.multistartpos=undefined;
	self.guidpos={};
	self.titlecache={};
	self.isSmartphone=null;
	self.settings={};
	self.settings.hidebuttons=false;
	self.settings.drawcolor='#E27000';
	self.settings.greatcirclecolor='#FF0000';
	self.settings.fieldcolor='#E27000';
	self.settings.crosslinkbookmarkcolor='#FF0000';
	self.settings.showcrosslinks=0; // 0 = Links, 1 = Drawn, 2 = Both
	self.settings.showlinkdirection=false;
	self.settings.fieldexistinglinks=false;
	self.requestid=undefined;
	self.selectedlink=undefined;
	self.movelinksposition=undefined;
	self.copylinksposition=undefined;
	self.linkstyle=[
		'10,5,5,5,5,5,5,5,100%',
	];
	self.crosslinklayerdisabled=false;
	self.highlightlinkoptions={
		color: "#C33",
		opacity: 1,
		weight: 5,
		fill: false,
		dashArray: "1,6",
		radius: 18,
	};

	// 120 x 60 - 4 buttons, 2 rows: link, move, star, copy
	self.menuicons="data:image/png;base64,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";
	// 350 x 50 - 7 buttons: trash, move, swap, zoom, list, confirm, cancel
	self.linkmenubuttonsicon="data:image/png;base64,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";

	//
	self.onLinkAdded=function( data ) {
		if ( self.crosslinklayerdisabled ) return;

		self.testLinkAndDrawCrosslinks( data.link );
	};

	self.checkAllLinksForCrosslinks=function() {
		if ( self.crosslinklayerdisabled ) return;


		self.crosslinkLayer.clearLayers();
		self.crosslinkLayerGuids={};

		$.each( window.links, function( guid, link ) {
			self.testLinkAndDrawCrosslinks( link );
		} );
	};

	// tests the drawn link and adds in crosslink dashes
	self.testLinkAndDrawCrosslinks=function( link ) {
		if ( self.settings.showcrosslinks===0 ) { // 0 = Links, 1 = Drawn, 2 = Both
			if ( self.crosslinkLayerGuids[ link.options.guid ] ) return; // crosslink for this link already drawn, skip check others to make it faster
		}

		var drawlayer=self.getDrawlayer();
		for ( var i in drawlayer._layers ) {
			var crosslinkfound=false;
			var layer=drawlayer._layers[ i ];
			if ( layer instanceof L.GeodesicPolygon ) {
				if ( self.testPolyLine( layer, link, true ) ) {
					crosslinkfound=true;
				}
			} else if ( layer instanceof L.GeodesicPolyline ) {
				if ( self.testPolyLine( layer, link ) ) {
					crosslinkfound=true;
				}
			} else if ( layer instanceof L.GeoJSON ) {
				if ( self.testPolyLine( layer, link ) ) {
					crosslinkfound=true;
				}
			}

			if ( crosslinkfound ) {
				if ( self.settings.showcrosslinks===0 ) { // 0 = Links, 1 = Drawn, 2 = Both
					self.drawCrossLink( link );
					break; // stop searching at first found crosslink (only draw crosslinks over existing Links)
				} else {
					if ( self.settings.showcrosslinks===2 ) {
						self.drawCrossLink( link );
					}
					self.drawCrossLink( layer );
				}
			}
		}
	};

	//
	self.drawCrossLink=function( link ) {
		if ( self.crosslinkLayerGuids[ link.options.guid ] ) return; // crosslink for this link already drawn, skip check

		/*
		var crosslink = L.geodesicPolyline(link.getLatLngs(), {
				color: '#d22',
				opacity: 0.7,
				weight: 5,
				clickable: false,
				dashArray: [8,8],

				guid: link.options.guid
		});

		*/

		var latLngs=link.getLatLngs();
		var startCoord=new self.arc.Coord( latLngs[ 0 ].lng, latLngs[ 0 ].lat );
		var stopCoord=new self.arc.Coord( latLngs[ 1 ].lng, latLngs[ 1 ].lat );

		var lineoptions={
			color: '#d22',
			opacity: 0.7,
			weight: 5,
			clickable: false,
			dashArray: [ 8, 28 ],

			guid: link.options.guid
		}

		var distance=self.distanceBetween( latLngs[ 0 ], latLngs[ 1 ] );

		var gc=new self.arc.GreatCircle( startCoord, stopCoord );
		var geojson_feature=gc.Arc( Math.round( distance ) ).json();
		var crosslink=L.geoJson( geojson_feature, {
			style: lineoptions
		} );

		// additions to Arc, to make it compatible for Quick Draw:
		crosslink.getLatLngs=function() {
			return [ L.latLng( latLngs[ 0 ] ), L.latLng( latLngs[ 1 ] ) ];
		};
		crosslink.options=L.extend( {}, lineoptions );

		crosslink.addTo( self.crosslinkLayer );
		self.crosslinkLayerGuids[ link.options.guid ]=crosslink;
	};

	// gets linked portals from selected portal
	self.overviewConnected=function() {
		var drawlayer=self.getDrawlayer();
		if ( !drawlayer ) return;
		if ( !window.selectedPortal ) return;
		var portal=window.portals[ window.selectedPortal ];

		var portalLinks={ in: [], out: [] };
		$.each( window.links, function( linkguid, link ) {
			if ( link.options.data.oGuid===window.selectedPortal ) portalLinks.out.push( link );
			if ( link.options.data.dGuid===window.selectedPortal ) portalLinks.in.push( link );
		} );

		var position=portal.getLatLng();
		var drawnLinks={ in: [], out: [] };
		drawlayer.eachLayer( function( layer ) {
			//if (layer instanceof L.GeodesicPolyline && layer.getLatLngs().length === 2) {
			if ( layer instanceof L.GeoJSON&&layer.getLatLngs().length===2 ) {
				var latLngs=layer.getLatLngs();
				if ( position.lat===latLngs[ 0 ].lat&&position.lng===latLngs[ 0 ].lng ) { // portal position matches first draw links position (base)
					drawnLinks.out.push( layer );
				} else if ( position.lat===latLngs[ 1 ].lat&&position.lng===latLngs[ 1 ].lng ) { // portal position matches second draw links position (target)
					drawnLinks.in.push( layer );
				}
			}
		} );

		var html='<div class="quickdrawlinksdialog">'+
			'<a href="#" onclick="if (window.useAndroidPanes()) window.show(\''+self.panename+'\'); else '+self.namespace+'menu(); return false;">&lt Main menu</a>'+
			'</div><div>'+
			'Selected portal (<a href="#" onclick="'+self.namespace+'overviewConnected(); return false;">refresh</a>):<br />\n'+
			'<a href="#" onclick="'+self.namespace+'focusportal(window.selectedPortal,'+position.lat+','+position.lng+'); return false;" title="Go to portal">'+portal.options.data.title+'</a><br />\n'+
			'<br />\n'+
			'<u><b>Drawn links:</b> '+( drawnLinks.in.length+drawnLinks.out.length )+' ('+drawnLinks.out.length+' out, '+drawnLinks.in.length+' in)</u><br />\n'+
			self.linkedportalshtml( drawnLinks.out, position, true )+
			self.linkedportalshtml( drawnLinks.in, position, true )+
			'<br />\n'+
			'<u><b>Existing links:</b> '+( portalLinks.in.length+portalLinks.out.length )+' ('+portalLinks.out.length+' out, '+portalLinks.in.length+' in)</u><br />\n'+
			self.linkedportalshtml( portalLinks.in, position, false )+
			self.linkedportalshtml( portalLinks.out, position, false )+
			'</div>';

		if ( window.useAndroidPanes() ) window.show( "map" );
		window.dialog( {
			html: html,
			id: self.pluginname+'-dialog',
			dialogClass: 'ui-dialog-quickdrawlinks',
			title: self.title+' Overview',
			width: 400
		} );
	};

	// gets portal GUID
	self.findPortalGuid=function( position ) {
		for ( var guid in window.portals ) {
			var portalposition=window.portals[ guid ].getLatLng();
			if ( portalposition.lat===position.lat&&portalposition.lng==position.lng ) {
				return guid;
			}
		}
		return undefined;
	};

	// link index
	self.linkindex=function( link ) {
		var drawlayer=self.getDrawlayer();
		if ( !link ) link=self.selectedlink;
		if ( !link ) return -1;
		var links=[];
		var selectedindex=-1;
		var selectedlatlngs=link.getLatLngs();
		drawlayer.eachLayer( function( layer ) {
			//if (layer instanceof L.GeodesicPolyline && layer.getLatLngs().length === 2) {
			if ( layer instanceof L.GeoJSON&&layer.getLatLngs().length===2 ) {
				links.push( layer );
				var latLngs=layer.getLatLngs();
				if ( selectedlatlngs&&selectedlatlngs[ 0 ].lat===latLngs[ 0 ].lat&&selectedlatlngs[ 0 ].lng===latLngs[ 0 ].lng&&selectedlatlngs[ 1 ].lat===latLngs[ 1 ].lat&&selectedlatlngs[ 1 ].lng===latLngs[ 1 ].lng ) {
					selectedindex=links.length-1;
				}
			}
		} );
		return selectedindex;
	};

	// add portals to bookmarks
	self.addPortalBookmarkSetup=function() {
		if ( !window.plugin.bookmarks ) return;
		if ( self.addPortalBookmark ) return;

		var addPortalBookmark_override=window.plugin.bookmarks.addPortalBookmark.toString();
		addPortalBookmark_override=addPortalBookmark_override.replace( 'window.runHooks', '//window.runHooks' ); // disable runHooks, just for this plugin
		eval( self.namespace+'addPortalBookmark = '+addPortalBookmark_override+';' );
	};

	// Adding the portals on each side of the crosslink as bookmarks
	self.addcrosslinkbookmarks=function() {
		if ( self.crosslinklayerdisabled ) {
			alert( 'Quick Draw Cross Links layer is disabled, unable to draw bookmarks' );
			return;
		}

		if ( self.linkcount()===0 ) {
			alert( 'No drawn links, so no cross links, no bookmarks drawn' );
			return;
		}
		var drawlayer=self.getDrawlayer();
		// getMapZoomTileParameters(getDataZoomForMapZoom(map.getZoom())).minLinkLength
		if ( Object.keys( self.crosslinkLayerGuids ).length===0 ) {
			alert( 'No crosslinks found: no bookmarks drawn.\n\nBe aware: Crosslinks must be in visible range (and zoom level set at: all portals or all links)!' );
			return;
		}

		var countmissingportals=0;
		var countnewbookmarks=0;
		var countexistingbookmarks=0;
		for ( var crosslinkguid in self.crosslinkLayerGuids ) {
			var latlngs=self.crosslinkLayerGuids[ crosslinkguid ].getLatLngs();
			for ( var cnt=0;cnt<latlngs.length;cnt++ ) {
				var portalguid=self.getportalguidbylatlng( latlngs[ cnt ] );
				if ( portalguid===null ) {
					countmissingportals++;
				} else {
					var bookmarktitle=window.portals[ portalguid ].options.data.title||'crosslink portal '+portalguid;
					// draw new bookmark for portalguid
					var bkmrkData=window.plugin.bookmarks.findByGuid( portalguid );
					if ( !bkmrkData ) {
						var colorbackup;
						if ( window.plugin.bookmarksAddon ) {
							colorbackup=window.plugin.bookmarksAddon.settings.color;
							window.plugin.bookmarksAddon.settings.color=self.settings.crosslinkbookmarkcolor;
						}
						self.addPortalBookmark( portalguid, latlngs[ cnt ].lat+','+latlngs[ cnt ].lng, bookmarktitle );
						countnewbookmarks++;
						window.plugin.bookmarks.addStar( portalguid, latlngs[ cnt ], bookmarktitle );
						if ( window.plugin.bookmarksAddon ) {
							window.plugin.bookmarksAddon.settings.color=colorbackup;
						}
					} else {
						countexistingbookmarks++;
					}
				}
			}
		}
		alert( 'Visible crosslinks count: '+Object.keys( self.crosslinkLayerGuids ).length+'\nNew bookmarks count: '+countnewbookmarks+'\nExisting bookmarks count: '+countexistingbookmarks+'\nSkipped portal count: '+countmissingportals+'\n\nBe aware: Crosslinks must be in visible range (and zoom level set at: all portals or all links)!' );
	};

	// arc for latlng to match earth curve
	self.setup_arc=function() {
		// source start: https://github.com/springmeyer/arc.js (Latest commit e30b63b on 6 Nov 2015)
		var D2R=Math.PI/180;
		var R2D=180/Math.PI;
		var Coord=function( lon, lat ) {
			this.lon=lon;
			this.lat=lat;
			this.x=D2R*lon;
			this.y=D2R*lat;
		};
		Coord.prototype.view=function() {
			return String( this.lon ).slice( 0, 4 )+','+String( this.lat ).slice( 0, 4 );
		};
		Coord.prototype.antipode=function() {
			var anti_lat=-1*this.lat;
			var anti_lon=( this.lon<0 )? 180+this.lon:( 180-this.lon )*-1;
			return new Coord( anti_lon, anti_lat );
		};

		var LineString=function() {
			this.coords=[];
			this.length=0;
		};
		LineString.prototype.move_to=function( coord ) {
			this.length++;
			this.coords.push( coord );
		};

		var Arc=function( properties ) {
			this.properties=properties||{};
			this.geometries=[];
		};
		Arc.prototype.json=function() {
			if ( this.geometries.length<=0 ) {
				return {
					'geometry': { 'type': 'LineString', 'coordinates': null },
					'type': 'Feature', 'properties': this.properties
				};
			} else if ( this.geometries.length==1 ) {
				return {
					'geometry': { 'type': 'LineString', 'coordinates': this.geometries[ 0 ].coords },
					'type': 'Feature', 'properties': this.properties
				};
			} else {
				var multiline=[];
				for ( var i=0;i<this.geometries.length;i++ ) {
					multiline.push( this.geometries[ i ].coords );
				}
				return {
					'geometry': { 'type': 'MultiLineString', 'coordinates': multiline },
					'type': 'Feature', 'properties': this.properties
				};
			}
		};
		// TODO - output proper multilinestring
		Arc.prototype.wkt=function() {
			var wkt_string='';
			var wkt='LINESTRING(';
			var collect=function( c ) { wkt+=c[ 0 ]+' '+c[ 1 ]+','; };
			for ( var i=0;i<this.geometries.length;i++ ) {
				if ( this.geometries[ i ].coords.length===0 ) {
					return 'LINESTRING(empty)';
				} else {
					var coords=this.geometries[ i ].coords;
					coords.forEach( collect );
					wkt_string+=wkt.substring( 0, wkt.length-1 )+')';
				}
			}
			return wkt_string;
		};
		/*
		* http://en.wikipedia.org/wiki/Great-circle_distance
		*
		*/
		var GreatCircle=function( start, end, properties ) {
			if ( !start||start.x===undefined||start.y===undefined ) {
				throw new Error( "GreatCircle constructor expects two args: start and end objects with x and y properties" );
			}
			if ( !end||end.x===undefined||end.y===undefined ) {
				throw new Error( "GreatCircle constructor expects two args: start and end objects with x and y properties" );
			}
			this.start=start; //new Coord(start.x,start.y); // FIXED source to match plugin
			this.end=end; //new Coord(end.x,end.y); // FIXED source to match plugin
			this.properties=properties||{};

			var w=this.start.x-this.end.x;
			var h=this.start.y-this.end.y;
			var z=Math.pow( Math.sin( h/2.0 ), 2 )+
				Math.cos( this.start.y )*
				Math.cos( this.end.y )*
				Math.pow( Math.sin( w/2.0 ), 2 );
			this.g=2.0*Math.asin( Math.sqrt( z ) );

			if ( this.g==Math.PI ) {
				throw new Error( 'it appears '+start.view()+' and '+end.view()+" are 'antipodal', e.g diametrically opposite, thus there is no single route but rather infinite" );
			} else if ( isNaN( this.g ) ) {
				throw new Error( 'could not calculate great circle between '+start+' and '+end );
			}
		};
		/*
		* http://williams.best.vwh.net/avform.htm#Intermediate
		*/
		GreatCircle.prototype.interpolate=function( f ) {
			var A=Math.sin( ( 1-f )*this.g )/Math.sin( this.g );
			var B=Math.sin( f*this.g )/Math.sin( this.g );
			var x=A*Math.cos( this.start.y )*Math.cos( this.start.x )+B*Math.cos( this.end.y )*Math.cos( this.end.x );
			var y=A*Math.cos( this.start.y )*Math.sin( this.start.x )+B*Math.cos( this.end.y )*Math.sin( this.end.x );
			var z=A*Math.sin( this.start.y )+B*Math.sin( this.end.y );
			var lat=R2D*Math.atan2( z, Math.sqrt( Math.pow( x, 2 )+Math.pow( y, 2 ) ) );
			var lon=R2D*Math.atan2( y, x );
			return [ lon, lat ];
		};
		/*
		* Generate points along the great circle
		*/
		GreatCircle.prototype.Arc=function( npoints, options ) {
			var first_pass=[];
			if ( !npoints||npoints<=2 ) {
				first_pass.push( [ this.start.lon, this.start.lat ] );
				first_pass.push( [ this.end.lon, this.end.lat ] );
			} else {
				var delta=1.0/( npoints-1 );
				for ( var i=0;i<npoints;++i ) {
					var step=delta*i;
					var pair=this.interpolate( step );
					first_pass.push( pair );
				}
			}
			/* partial port of dateline handling from:
				gdal/ogr/ogrgeometryfactory.cpp

				TODO - does not handle all wrapping scenarios yet
			*/
			var bHasBigDiff=false;
			var dfMaxSmallDiffLong=0;
			// from http://www.gdal.org/ogr2ogr.html
			// -datelineoffset:
			// (starting with GDAL 1.10) offset from dateline in degrees (default long. = +/- 10deg, geometries within 170deg to -170deg will be splited)
			var dfDateLineOffset=options&&options.offset? options.offset:10;
			var dfLeftBorderX=180-dfDateLineOffset;
			var dfRightBorderX=-180+dfDateLineOffset;
			var dfDiffSpace=360-dfDateLineOffset;

			// https://github.com/OSGeo/gdal/blob/7bfb9c452a59aac958bff0c8386b891edf8154ca/gdal/ogr/ogrgeometryfactory.cpp#L2342
			for ( var j=1;j<first_pass.length;++j ) {
				var dfPrevX=first_pass[ j-1 ][ 0 ];
				var dfX=first_pass[ j ][ 0 ];
				var dfDiffLong=Math.abs( dfX-dfPrevX );
				if ( dfDiffLong>dfDiffSpace&&
					( ( dfX>dfLeftBorderX&&dfPrevX<dfRightBorderX )||( dfPrevX>dfLeftBorderX&&dfX<dfRightBorderX ) ) ) {
					bHasBigDiff=true;
				} else if ( dfDiffLong>dfMaxSmallDiffLong ) {
					dfMaxSmallDiffLong=dfDiffLong;
				}
			}

			var poMulti=[];
			if ( bHasBigDiff&&dfMaxSmallDiffLong<dfDateLineOffset ) {
				var poNewLS=[];
				poMulti.push( poNewLS );
				for ( var k=0;k<first_pass.length;++k ) {
					var dfX0=parseFloat( first_pass[ k ][ 0 ] );
					if ( k>0&&Math.abs( dfX0-first_pass[ k-1 ][ 0 ] )>dfDiffSpace ) {
						var dfX1=parseFloat( first_pass[ k-1 ][ 0 ] );
						var dfY1=parseFloat( first_pass[ k-1 ][ 1 ] );
						var dfX2=parseFloat( first_pass[ k ][ 0 ] );
						var dfY2=parseFloat( first_pass[ k ][ 1 ] );
						if ( dfX1>-180&&dfX1<dfRightBorderX&&dfX2==180&&
							k+1<first_pass.length&&
							first_pass[ k-1 ][ 0 ]>-180&&first_pass[ k-1 ][ 0 ]<dfRightBorderX ) {
							poNewLS.push( [ -180, first_pass[ k ][ 1 ] ] );
							k++;
							poNewLS.push( [ first_pass[ k ][ 0 ], first_pass[ k ][ 1 ] ] );
							continue;
						} else if ( dfX1>dfLeftBorderX&&dfX1<180&&dfX2==-180&&
							k+1<first_pass.length&&
							first_pass[ k-1 ][ 0 ]>dfLeftBorderX&&first_pass[ k-1 ][ 0 ]<180 ) {
							poNewLS.push( [ 180, first_pass[ k ][ 1 ] ] );
							k++;
							poNewLS.push( [ first_pass[ k ][ 0 ], first_pass[ k ][ 1 ] ] );
							continue;
						}

						if ( dfX1<dfRightBorderX&&dfX2>dfLeftBorderX ) {
							// swap dfX1, dfX2
							var tmpX=dfX1;
							dfX1=dfX2;
							dfX2=tmpX;
							// swap dfY1, dfY2
							var tmpY=dfY1;
							dfY1=dfY2;
							dfY2=tmpY;
						}
						if ( dfX1>dfLeftBorderX&&dfX2<dfRightBorderX ) {
							dfX2+=360;
						}

						if ( dfX1<=180&&dfX2>=180&&dfX1<dfX2 ) {
							var dfRatio=( 180-dfX1 )/( dfX2-dfX1 );
							var dfY=dfRatio*dfY2+( 1-dfRatio )*dfY1;
							poNewLS.push( [ first_pass[ k-1 ][ 0 ]>dfLeftBorderX? 180:-180, dfY ] );
							poNewLS=[];
							poNewLS.push( [ first_pass[ k-1 ][ 0 ]>dfLeftBorderX? -180:180, dfY ] );
							poMulti.push( poNewLS );
						}
						else {
							poNewLS=[];
							poMulti.push( poNewLS );
						}
						poNewLS.push( [ dfX0, first_pass[ k ][ 1 ] ] );
					} else {
						poNewLS.push( [ first_pass[ k ][ 0 ], first_pass[ k ][ 1 ] ] );
					}
				}
			} else {
				// add normally
				var poNewLS0=[];
				poMulti.push( poNewLS0 );
				for ( var l=0;l<first_pass.length;++l ) {
					poNewLS0.push( [ first_pass[ l ][ 0 ], first_pass[ l ][ 1 ] ] );
				}
			}

			var arc=new Arc( this.properties );
			for ( var m=0;m<poMulti.length;++m ) {
				var line=new LineString();
				arc.geometries.push( line );
				var points=poMulti[ m ];
				for ( var j0=0;j0<points.length;++j0 ) {
					line.move_to( points[ j0 ] );
				}
			}
			return arc;
		};
		// source arc.js end

		self.arc={};
		self.arc.Coord=Coord;
		self.arc.Arc=Arc;
		self.arc.GreatCircle=GreatCircle;
	}; // end setup_arc

	self.setupColorpickerSpectrum=function() {
		// source: https://github.com/bgrins/spectrum
		// minified with https://www.minifier.org/

		// Spectrum Colorpicker v1.8.1
		// https://github.com/bgrins/spectrum
		// Author: Brian Grinstead
		// License: MIT

		( function( factory ) { "use strict"; if ( typeof define==='function'&&define.amd ) { define( [ 'jquery' ], factory ) } else if ( typeof exports=="object"&&typeof module=="object" ) { module.exports=factory( require( 'jquery' ) ) } else { factory( jQuery ) } } )( function( $, undefined ) {
			"use strict"; var defaultOpts={ beforeShow: noop, move: noop, change: noop, show: noop, hide: noop, color: !1, flat: !1, showInput: !1, allowEmpty: !1, showButtons: !0, clickoutFiresChange: !0, showInitial: !1, showPalette: !1, showPaletteOnly: !1, hideAfterPaletteSelect: !1, togglePaletteOnly: !1, showSelectionPalette: !0, localStorageKey: !1, appendTo: "body", maxSelectionSize: 7, cancelText: "cancel", chooseText: "choose", togglePaletteMoreText: "more", togglePaletteLessText: "less", clearText: "Clear Color Selection", noColorSelectedText: "No Color Selected", preferredFormat: !1, className: "", containerClassName: "", replacerClassName: "", showAlpha: !1, theme: "sp-light", palette: [ [ "#ffffff", "#000000", "#ff0000", "#ff8000", "#ffff00", "#008000", "#0000ff", "#4b0082", "#9400d3" ] ], selectionPalette: [], disabled: !1, offset: null }, spectrums=[], IE=!!/msie/i.exec( window.navigator.userAgent ), rgbaSupport=( function() {
				function contains( str, substr ) { return !!~( ''+str ).indexOf( substr ) }
				var elem=document.createElement( 'div' ); var style=elem.style; style.cssText='background-color:rgba(0,0,0,.5)'; return contains( style.backgroundColor, 'rgba' )||contains( style.backgroundColor, 'hsla' )
			} )(), replaceInput=[ "<div class='sp-replacer'>", "<div class='sp-preview'><div class='sp-preview-inner'></div></div>", "<div class='sp-dd'>&#9660;</div>", "</div>" ].join( '' ), markup=( function() {
				var gradientFix=""; if ( IE ) { for ( var i=1;i<=6;i++ ) { gradientFix+="<div class='sp-"+i+"'></div>" } }
				return [ "<div class='sp-container sp-hidden'>", "<div class='sp-palette-container'>", "<div class='sp-palette sp-thumb sp-cf'></div>", "<div class='sp-palette-button-container sp-cf'>", "<button type='button' class='sp-palette-toggle'></button>", "</div>", "</div>", "<div class='sp-picker-container'>", "<div class='sp-top sp-cf'>", "<div class='sp-fill'></div>", "<div class='sp-top-inner'>", "<div class='sp-color'>", "<div class='sp-sat'>", "<div class='sp-val'>", "<div class='sp-dragger'></div>", "</div>", "</div>", "</div>", "<div class='sp-clear sp-clear-display'>", "</div>", "<div class='sp-hue'>", "<div class='sp-slider'></div>", gradientFix, "</div>", "</div>", "<div class='sp-alpha'><div class='sp-alpha-inner'><div class='sp-alpha-handle'></div></div></div>", "</div>", "<div class='sp-input-container sp-cf'>", "<input class='sp-input' type='text' spellcheck='false'  />", "</div>", "<div class='sp-initial sp-thumb sp-cf'></div>", "<div class='sp-button-container sp-cf'>", "<a class='sp-cancel' href='#'></a>", "<button type='button' class='sp-choose'></button>", "</div>", "</div>", "</div>" ].join( "" )
			} )(); function paletteTemplate( p, color, className, opts ) {
				var html=[]; for ( var i=0;i<p.length;i++ ) { var current=p[ i ]; if ( current ) { var tiny=tinycolor( current ); var c=tiny.toHsl().l<0.5? "sp-thumb-el sp-thumb-dark":"sp-thumb-el sp-thumb-light"; c+=( tinycolor.equals( color, current ) )? " sp-thumb-active":""; var formattedString=tiny.toString( opts.preferredFormat||"rgb" ); var swatchStyle=rgbaSupport? ( "background-color:"+tiny.toRgbString() ):"filter:"+tiny.toFilter(); html.push( '<span title="'+formattedString+'" data-color="'+tiny.toRgbString()+'" class="'+c+'"><span class="sp-thumb-inner" style="'+swatchStyle+';"></span></span>' ) } else { var cls='sp-clear-display'; html.push( $( '<div />' ).append( $( '<span data-color="" style="background-color:transparent;" class="'+cls+'"></span>' ).attr( 'title', opts.noColorSelectedText ) ).html() ) } }
				return "<div class='sp-cf "+className+"'>"+html.join( '' )+"</div>"
			}
			function hideAll() { for ( var i=0;i<spectrums.length;i++ ) { if ( spectrums[ i ] ) { spectrums[ i ].hide() } } }
			function instanceOptions( o, callbackContext ) { var opts=$.extend( {}, defaultOpts, o ); opts.callbacks={ 'move': bind( opts.move, callbackContext ), 'change': bind( opts.change, callbackContext ), 'show': bind( opts.show, callbackContext ), 'hide': bind( opts.hide, callbackContext ), 'beforeShow': bind( opts.beforeShow, callbackContext ) }; return opts }
			function spectrum( element, o ) {
				var opts=instanceOptions( o, element ), flat=opts.flat, showSelectionPalette=opts.showSelectionPalette, localStorageKey=opts.localStorageKey, theme=opts.theme, callbacks=opts.callbacks, resize=throttle( reflow, 10 ), visible=!1, isDragging=!1, dragWidth=0, dragHeight=0, dragHelperHeight=0, slideHeight=0, slideWidth=0, alphaWidth=0, alphaSlideHelperWidth=0, slideHelperHeight=0, currentHue=0, currentSaturation=0, currentValue=0, currentAlpha=1, palette=[], paletteArray=[], paletteLookup={}, selectionPalette=opts.selectionPalette.slice( 0 ), maxSelectionSize=opts.maxSelectionSize, draggingClass="sp-dragging", shiftMovementDirection=null; var doc=element.ownerDocument, body=doc.body, boundElement=$( element ), disabled=!1, container=$( markup, doc ).addClass( theme ), pickerContainer=container.find( ".sp-picker-container" ), dragger=container.find( ".sp-color" ), dragHelper=container.find( ".sp-dragger" ), slider=container.find( ".sp-hue" ), slideHelper=container.find( ".sp-slider" ), alphaSliderInner=container.find( ".sp-alpha-inner" ), alphaSlider=container.find( ".sp-alpha" ), alphaSlideHelper=container.find( ".sp-alpha-handle" ), textInput=container.find( ".sp-input" ), paletteContainer=container.find( ".sp-palette" ), initialColorContainer=container.find( ".sp-initial" ), cancelButton=container.find( ".sp-cancel" ), clearButton=container.find( ".sp-clear" ), chooseButton=container.find( ".sp-choose" ), toggleButton=container.find( ".sp-palette-toggle" ), isInput=boundElement.is( "input" ), isInputTypeColor=isInput&&boundElement.attr( "type" )==="color"&&inputTypeColorSupport(), shouldReplace=isInput&&!flat, replacer=( shouldReplace )? $( replaceInput ).addClass( theme ).addClass( opts.className ).addClass( opts.replacerClassName ):$( [] ), offsetElement=( shouldReplace )? replacer:boundElement, previewElement=replacer.find( ".sp-preview-inner" ), initialColor=opts.color||( isInput&&boundElement.val() ), colorOnShow=!1, currentPreferredFormat=opts.preferredFormat, clickoutFiresChange=!opts.showButtons||opts.clickoutFiresChange, isEmpty=!initialColor, allowEmpty=opts.allowEmpty&&!isInputTypeColor; function applyOptions() {
					if ( opts.showPaletteOnly ) { opts.showPalette=!0 }
					toggleButton.text( opts.showPaletteOnly? opts.togglePaletteMoreText:opts.togglePaletteLessText ); if ( opts.palette ) { palette=opts.palette.slice( 0 ); paletteArray=Array.isArray( palette[ 0 ] )? palette:[ palette ]; paletteLookup={}; for ( var i=0;i<paletteArray.length;i++ ) { for ( var j=0;j<paletteArray[ i ].length;j++ ) { var rgb=tinycolor( paletteArray[ i ][ j ] ).toRgbString(); paletteLookup[ rgb ]=!0 } } }
					container.toggleClass( "sp-flat", flat ); container.toggleClass( "sp-input-disabled", !opts.showInput ); container.toggleClass( "sp-alpha-enabled", opts.showAlpha ); container.toggleClass( "sp-clear-enabled", allowEmpty ); container.toggleClass( "sp-buttons-disabled", !opts.showButtons ); container.toggleClass( "sp-palette-buttons-disabled", !opts.togglePaletteOnly ); container.toggleClass( "sp-palette-disabled", !opts.showPalette ); container.toggleClass( "sp-palette-only", opts.showPaletteOnly ); container.toggleClass( "sp-initial-disabled", !opts.showInitial ); container.addClass( opts.className ).addClass( opts.containerClassName ); reflow()
				}
				function initialize() {
					if ( IE ) { container.find( "*:not(input)" ).attr( "unselectable", "on" ) }
					applyOptions(); if ( shouldReplace ) { boundElement.after( replacer ).hide() }
					if ( !allowEmpty ) { clearButton.hide() }
					if ( flat ) { boundElement.after( container ).hide() } else {
						var appendTo=opts.appendTo==="parent"? boundElement.parent():$( opts.appendTo ); if ( appendTo.length!==1 ) { appendTo=$( "body" ) }
						appendTo.append( container )
					}
					updateSelectionPaletteFromStorage(); offsetElement.on( "click.spectrum touchstart.spectrum", function( e ) {
						if ( !disabled ) { toggle() }
						e.stopPropagation(); if ( !$( e.target ).is( "input" ) ) { e.preventDefault() }
					} ); if ( boundElement.is( ":disabled" )||( opts.disabled===!0 ) ) { disable() }
					container.on( "click", stopPropagation ); textInput.on( "change", setFromTextInput ); textInput.on( "paste", function() { setTimeout( setFromTextInput, 1 ) } ); textInput.on( "keydown", function( e ) { if ( e.keyCode==13 ) { setFromTextInput() } } ); cancelButton.text( opts.cancelText ); cancelButton.on( "click.spectrum", function( e ) { e.stopPropagation(); e.preventDefault(); revert(); hide() } ); clearButton.attr( "title", opts.clearText ); clearButton.on( "click.spectrum", function( e ) { e.stopPropagation(); e.preventDefault(); isEmpty=!0; move(); if ( flat ) { updateOriginalInput( !0 ) } } ); chooseButton.text( opts.chooseText ); chooseButton.on( "click.spectrum", function( e ) {
						e.stopPropagation(); e.preventDefault(); if ( IE&&textInput.is( ":focus" ) ) { textInput.trigger( 'change' ) }
						if ( isValid() ) { updateOriginalInput( !0 ); hide() }
					} ); toggleButton.text( opts.showPaletteOnly? opts.togglePaletteMoreText:opts.togglePaletteLessText ); toggleButton.on( "click.spectrum", function( e ) {
						e.stopPropagation(); e.preventDefault(); opts.showPaletteOnly=!opts.showPaletteOnly; if ( !opts.showPaletteOnly&&!flat ) { container.css( 'left', '-='+( pickerContainer.outerWidth( !0 )+5 ) ) }
						applyOptions()
					} ); draggable( alphaSlider, function( dragX, dragY, e ) {
						currentAlpha=( dragX/alphaWidth ); isEmpty=!1; if ( e.shiftKey ) { currentAlpha=Math.round( currentAlpha*10 )/10 }
						move()
					}, dragStart, dragStop ); draggable( slider, function( dragX, dragY ) {
						currentHue=parseFloat( dragY/slideHeight ); isEmpty=!1; if ( !opts.showAlpha ) { currentAlpha=1 }
						move()
					}, dragStart, dragStop ); draggable( dragger, function( dragX, dragY, e ) {
						if ( !e.shiftKey ) { shiftMovementDirection=null } else if ( !shiftMovementDirection ) { var oldDragX=currentSaturation*dragWidth; var oldDragY=dragHeight-( currentValue*dragHeight ); var furtherFromX=Math.abs( dragX-oldDragX )>Math.abs( dragY-oldDragY ); shiftMovementDirection=furtherFromX? "x":"y" }
						var setSaturation=!shiftMovementDirection||shiftMovementDirection==="x"; var setValue=!shiftMovementDirection||shiftMovementDirection==="y"; if ( setSaturation ) { currentSaturation=parseFloat( dragX/dragWidth ) }
						if ( setValue ) { currentValue=parseFloat( ( dragHeight-dragY )/dragHeight ) }
						isEmpty=!1; if ( !opts.showAlpha ) { currentAlpha=1 }
						move()
					}, dragStart, dragStop ); if ( !!initialColor ) { set( initialColor ); updateUI(); currentPreferredFormat=opts.preferredFormat||tinycolor( initialColor ).format; addColorToSelectionPalette( initialColor ) } else { updateUI() }
					if ( flat ) { show() }
					function paletteElementClick( e ) {
						if ( e.data&&e.data.ignore ) { set( $( e.target ).closest( ".sp-thumb-el" ).data( "color" ) ); move() } else { set( $( e.target ).closest( ".sp-thumb-el" ).data( "color" ) ); move(); if ( opts.hideAfterPaletteSelect ) { updateOriginalInput( !0 ); hide() } else { updateOriginalInput() } }
						return !1
					}
					var paletteEvent=IE? "mousedown.spectrum":"click.spectrum touchstart.spectrum"; paletteContainer.on( paletteEvent, ".sp-thumb-el", paletteElementClick ); initialColorContainer.on( paletteEvent, ".sp-thumb-el:nth-child(1)", { ignore: !0 }, paletteElementClick )
				}
				function updateSelectionPaletteFromStorage() {
					if ( localStorageKey&&window.localStorage ) {
						try { var oldPalette=window.localStorage[ localStorageKey ].split( ",#" ); if ( oldPalette.length>1 ) { delete window.localStorage[ localStorageKey ]; $.each( oldPalette, function( i, c ) { addColorToSelectionPalette( c ) } ) } } catch ( e ) { }
						try { selectionPalette=window.localStorage[ localStorageKey ].split( ";" ) } catch ( e ) { }
					}
				}
				function addColorToSelectionPalette( color ) {
					if ( showSelectionPalette ) {
						var rgb=tinycolor( color ).toRgbString(); if ( !paletteLookup[ rgb ]&&$.inArray( rgb, selectionPalette )===-1 ) { selectionPalette.push( rgb ); while ( selectionPalette.length>maxSelectionSize ) { selectionPalette.shift() } }
						if ( localStorageKey&&window.localStorage ) { try { window.localStorage[ localStorageKey ]=selectionPalette.join( ";" ) } catch ( e ) { } }
					}
				}
				function getUniqueSelectionPalette() {
					var unique=[]; if ( opts.showPalette ) { for ( var i=0;i<selectionPalette.length;i++ ) { var rgb=tinycolor( selectionPalette[ i ] ).toRgbString(); if ( !paletteLookup[ rgb ] ) { unique.push( selectionPalette[ i ] ) } } }
					return unique.reverse().slice( 0, opts.maxSelectionSize )
				}
				function drawPalette() {
					var currentColor=get(); var html=$.map( paletteArray, function( palette, i ) { return paletteTemplate( palette, currentColor, "sp-palette-row sp-palette-row-"+i, opts ) } ); updateSelectionPaletteFromStorage(); if ( selectionPalette ) { html.push( paletteTemplate( getUniqueSelectionPalette(), currentColor, "sp-palette-row sp-palette-row-selection", opts ) ) }
					paletteContainer.html( html.join( "" ) )
				}
				function drawInitial() { if ( opts.showInitial ) { var initial=colorOnShow; var current=get(); initialColorContainer.html( paletteTemplate( [ initial, current ], current, "sp-palette-row-initial", opts ) ) } }
				function dragStart() {
					if ( dragHeight<=0||dragWidth<=0||slideHeight<=0 ) { reflow() }
					isDragging=!0; container.addClass( draggingClass ); shiftMovementDirection=null; boundElement.trigger( 'dragstart.spectrum', [ get() ] )
				}
				function dragStop() { isDragging=!1; container.removeClass( draggingClass ); boundElement.trigger( 'dragstop.spectrum', [ get() ] ) }
				function setFromTextInput() { var value=textInput.val(); if ( ( value===null||value==="" )&&allowEmpty ) { set( null ); move(); updateOriginalInput() } else { var tiny=tinycolor( value ); if ( tiny.isValid() ) { set( tiny ); move(); updateOriginalInput() } else { textInput.addClass( "sp-validation-error" ) } } }
				function toggle() { if ( visible ) { hide() } else { show() } }
				function show() {
					var event=$.Event( 'beforeShow.spectrum' ); if ( visible ) { reflow(); return }
					boundElement.trigger( event, [ get() ] ); if ( callbacks.beforeShow( get() )===!1||event.isDefaultPrevented() ) { return }
					hideAll(); visible=!0; $( doc ).on( "keydown.spectrum", onkeydown ); $( doc ).on( "click.spectrum", clickout ); $( window ).on( "resize.spectrum", resize ); replacer.addClass( "sp-active" ); container.removeClass( "sp-hidden" ); reflow(); updateUI(); colorOnShow=get(); drawInitial(); callbacks.show( colorOnShow ); boundElement.trigger( 'show.spectrum', [ colorOnShow ] )
				}
				function onkeydown( e ) { if ( e.keyCode===27 ) { hide() } }
				function clickout( e ) {
					if ( e.button==2 ) { return }
					if ( isDragging ) { return }
					if ( clickoutFiresChange ) { updateOriginalInput( !0 ) } else { revert() }
					hide()
				}
				function hide() {
					if ( !visible||flat ) { return }
					visible=!1; $( doc ).off( "keydown.spectrum", onkeydown ); $( doc ).off( "click.spectrum", clickout ); $( window ).off( "resize.spectrum", resize ); replacer.removeClass( "sp-active" ); container.addClass( "sp-hidden" ); callbacks.hide( get() ); boundElement.trigger( 'hide.spectrum', [ get() ] )
				}
				function revert() { set( colorOnShow, !0 ); updateOriginalInput( !0 ) }
				function set( color, ignoreFormatChange ) {
					if ( tinycolor.equals( color, get() ) ) { updateUI(); return }
					var newColor, newHsv; if ( !color&&allowEmpty ) { isEmpty=!0 } else { isEmpty=!1; newColor=tinycolor( color ); newHsv=newColor.toHsv(); currentHue=( newHsv.h%360 )/360; currentSaturation=newHsv.s; currentValue=newHsv.v; currentAlpha=newHsv.a }
					updateUI(); if ( newColor&&newColor.isValid()&&!ignoreFormatChange ) { currentPreferredFormat=opts.preferredFormat||newColor.getFormat() }
				}
				function get( opts ) {
					opts=opts||{}; if ( allowEmpty&&isEmpty ) { return null }
					return tinycolor.fromRatio( { h: currentHue, s: currentSaturation, v: currentValue, a: Math.round( currentAlpha*1000 )/1000 }, { format: opts.format||currentPreferredFormat } )
				}
				function isValid() { return !textInput.hasClass( "sp-validation-error" ) }
				function move() { updateUI(); callbacks.move( get() ); boundElement.trigger( 'move.spectrum', [ get() ] ) }
				function updateUI() {
					textInput.removeClass( "sp-validation-error" ); updateHelperLocations(); var flatColor=tinycolor.fromRatio( { h: currentHue, s: 1, v: 1 } ); dragger.css( "background-color", flatColor.toHexString() ); var format=currentPreferredFormat; if ( currentAlpha<1&&!( currentAlpha===0&&format==="name" ) ) { if ( format==="hex"||format==="hex3"||format==="hex6"||format==="name" ) { format="rgb" } }
					var realColor=get( { format: format } ), displayColor=''; previewElement.removeClass( "sp-clear-display" ); previewElement.css( 'background-color', 'transparent' ); if ( !realColor&&allowEmpty ) { previewElement.addClass( "sp-clear-display" ) } else {
						var realHex=realColor.toHexString(), realRgb=realColor.toRgbString(); if ( rgbaSupport||realColor.alpha===1 ) { previewElement.css( "background-color", realRgb ) } else { previewElement.css( "background-color", "transparent" ); previewElement.css( "filter", realColor.toFilter() ) }
						if ( opts.showAlpha ) { var rgb=realColor.toRgb(); rgb.a=0; var realAlpha=tinycolor( rgb ).toRgbString(); var gradient="linear-gradient(left, "+realAlpha+", "+realHex+")"; if ( IE ) { alphaSliderInner.css( "filter", tinycolor( realAlpha ).toFilter( { gradientType: 1 }, realHex ) ) } else { alphaSliderInner.css( "background", "-webkit-"+gradient ); alphaSliderInner.css( "background", "-moz-"+gradient ); alphaSliderInner.css( "background", "-ms-"+gradient ); alphaSliderInner.css( "background", "linear-gradient(to right, "+realAlpha+", "+realHex+")" ) } }
						displayColor=realColor.toString( format )
					}
					if ( opts.showInput ) { textInput.val( displayColor ) }
					if ( opts.showPalette ) { drawPalette() }
					drawInitial()
				}
				function updateHelperLocations() { var s=currentSaturation; var v=currentValue; if ( allowEmpty&&isEmpty ) { alphaSlideHelper.hide(); slideHelper.hide(); dragHelper.hide() } else { alphaSlideHelper.show(); slideHelper.show(); dragHelper.show(); var dragX=s*dragWidth; var dragY=dragHeight-( v*dragHeight ); dragX=Math.max( -dragHelperHeight, Math.min( dragWidth-dragHelperHeight, dragX-dragHelperHeight ) ); dragY=Math.max( -dragHelperHeight, Math.min( dragHeight-dragHelperHeight, dragY-dragHelperHeight ) ); dragHelper.css( { "top": dragY+"px", "left": dragX+"px" } ); var alphaX=currentAlpha*alphaWidth; alphaSlideHelper.css( { "left": ( alphaX-( alphaSlideHelperWidth/2 ) )+"px" } ); var slideY=( currentHue )*slideHeight; slideHelper.css( { "top": ( slideY-slideHelperHeight )+"px" } ) } }
				function updateOriginalInput( fireCallback ) {
					var color=get(), displayColor='', hasChanged=!tinycolor.equals( color, colorOnShow ); if ( color ) { displayColor=color.toString( currentPreferredFormat ); addColorToSelectionPalette( color ) }
					if ( isInput ) { boundElement.val( displayColor ) }
					if ( fireCallback&&hasChanged ) { callbacks.change( color ); boundElement.trigger( 'change', [ color ] ) }
				}
				function reflow() {
					if ( !visible ) { return }
					dragWidth=dragger.width(); dragHeight=dragger.height(); dragHelperHeight=dragHelper.height(); slideWidth=slider.width(); slideHeight=slider.height(); slideHelperHeight=slideHelper.height(); alphaWidth=alphaSlider.width(); alphaSlideHelperWidth=alphaSlideHelper.width(); if ( !flat ) { container.css( "position", "absolute" ); if ( opts.offset ) { container.offset( opts.offset ) } else { container.offset( getOffset( container, offsetElement ) ) } }
					updateHelperLocations(); if ( opts.showPalette ) { drawPalette() }
					boundElement.trigger( 'reflow.spectrum' )
				}
				function destroy() { boundElement.show(); offsetElement.off( "click.spectrum touchstart.spectrum" ); container.remove(); replacer.remove(); spectrums[ spect.id ]=null }
				function option( optionName, optionValue ) {
					if ( optionName===undefined ) { return $.extend( {}, opts ) }
					if ( optionValue===undefined ) { return opts[ optionName ] }
					opts[ optionName ]=optionValue; if ( optionName==="preferredFormat" ) { currentPreferredFormat=opts.preferredFormat }
					applyOptions()
				}
				function enable() { disabled=!1; boundElement.attr( "disabled", !1 ); offsetElement.removeClass( "sp-disabled" ) }
				function disable() { hide(); disabled=!0; boundElement.attr( "disabled", !0 ); offsetElement.addClass( "sp-disabled" ) }
				function setOffset( coord ) { opts.offset=coord; reflow() }
				initialize(); var spect={ show: show, hide: hide, toggle: toggle, reflow: reflow, option: option, enable: enable, disable: disable, offset: setOffset, set: function( c ) { set( c ); updateOriginalInput() }, get: get, destroy: destroy, container: container }; spect.id=spectrums.push( spect )-1; return spect
			}
			function getOffset( picker, input ) { var extraY=0; var dpWidth=picker.outerWidth(); var dpHeight=picker.outerHeight(); var inputHeight=input.outerHeight(); var doc=picker[ 0 ].ownerDocument; var docElem=doc.documentElement; var viewWidth=docElem.clientWidth+$( doc ).scrollLeft(); var viewHeight=docElem.clientHeight+$( doc ).scrollTop(); var offset=input.offset(); var offsetLeft=offset.left; var offsetTop=offset.top; offsetTop+=inputHeight; offsetLeft-=Math.min( offsetLeft, ( offsetLeft+dpWidth>viewWidth&&viewWidth>dpWidth )? Math.abs( offsetLeft+dpWidth-viewWidth ):0 ); offsetTop-=Math.min( offsetTop, ( ( offsetTop+dpHeight>viewHeight&&viewHeight>dpHeight )? Math.abs( dpHeight+inputHeight-extraY ):extraY ) ); return { top: offsetTop, bottom: offset.bottom, left: offsetLeft, right: offset.right, width: offset.width, height: offset.height } }
			function noop() { }
			function stopPropagation( e ) { e.stopPropagation() }
			function bind( func, obj ) { var slice=Array.prototype.slice; var args=slice.call( arguments, 2 ); return function() { return func.apply( obj, args.concat( slice.call( arguments ) ) ) } }
			function draggable( element, onmove, onstart, onstop ) {
				onmove=onmove||function() { }; onstart=onstart||function() { }; onstop=onstop||function() { }; var doc=document; var dragging=!1; var offset={}; var maxHeight=0; var maxWidth=0; var hasTouch=( 'ontouchstart' in window ); var duringDragEvents={}; duringDragEvents.selectstart=prevent; duringDragEvents.dragstart=prevent; duringDragEvents[ "touchmove mousemove" ]=move; duringDragEvents[ "touchend mouseup" ]=stop; function prevent( e ) {
					if ( e.stopPropagation ) { e.stopPropagation() }
					if ( e.preventDefault ) { e.preventDefault() }
					e.returnValue=!1
				}
				function move( e ) {
					if ( dragging ) {
						if ( IE&&doc.documentMode<9&&!e.button ) { return stop() }
						var t0=e.originalEvent&&e.originalEvent.touches&&e.originalEvent.touches[ 0 ]; var pageX=t0&&t0.pageX||e.pageX; var pageY=t0&&t0.pageY||e.pageY; var dragX=Math.max( 0, Math.min( pageX-offset.left, maxWidth ) ); var dragY=Math.max( 0, Math.min( pageY-offset.top, maxHeight ) ); if ( hasTouch ) { prevent( e ) }
						onmove.apply( element, [ dragX, dragY, e ] )
					}
				}
				function start( e ) { var rightclick=( e.which )? ( e.which==3 ):( e.button==2 ); if ( !rightclick&&!dragging ) { if ( onstart.apply( element, arguments )!==!1 ) { dragging=!0; maxHeight=$( element ).height(); maxWidth=$( element ).width(); offset=$( element ).offset(); $( doc ).on( duringDragEvents ); $( doc.body ).addClass( "sp-dragging" ); move( e ); prevent( e ) } } }
				function stop() {
					if ( dragging ) { $( doc ).off( duringDragEvents ); $( doc.body ).removeClass( "sp-dragging" ); setTimeout( function() { onstop.apply( element, arguments ) }, 0 ) }
					dragging=!1
				}
				$( element ).on( "touchstart mousedown", start )
			}
			function throttle( func, wait, debounce ) { var timeout; return function() { var context=this, args=arguments; var throttler=function() { timeout=null; func.apply( context, args ) }; if ( debounce ) clearTimeout( timeout ); if ( debounce||!timeout ) timeout=setTimeout( throttler, wait ) } }
			function inputTypeColorSupport() { return $.fn.spectrum.inputTypeColorSupport() }
			var dataID="spectrum.id"; $.fn.spectrum=function( opts, extra ) {
				if ( typeof opts=="string" ) {
					var returnValue=this; var args=Array.prototype.slice.call( arguments, 1 ); this.each( function() {
						var spect=spectrums[ $( this ).data( dataID ) ]; if ( spect ) {
							var method=spect[ opts ]; if ( !method ) { throw new Error( "Spectrum: no such method: '"+opts+"'" ) }
							if ( opts=="get" ) { returnValue=spect.get() } else if ( opts=="container" ) { returnValue=spect.container } else if ( opts=="option" ) { returnValue=spect.option.apply( spect, args ) } else if ( opts=="destroy" ) { spect.destroy(); $( this ).removeData( dataID ) } else { method.apply( spect, args ) }
						}
					} ); return returnValue
				}
				return this.spectrum( "destroy" ).each( function() { var options=$.extend( {}, $( this ).data(), opts ); var spect=spectrum( this, options ); $( this ).data( dataID, spect.id ) } )
			}; $.fn.spectrum.load=!0; $.fn.spectrum.loadOpts={}; $.fn.spectrum.draggable=draggable; $.fn.spectrum.defaults=defaultOpts; $.fn.spectrum.inputTypeColorSupport=function inputTypeColorSupport() {
				if ( typeof inputTypeColorSupport._cachedResult==="undefined" ) { var colorInput=$( "<input type='color'/>" )[ 0 ]; inputTypeColorSupport._cachedResult=colorInput.type==="color"&&colorInput.value!=="" }
				return inputTypeColorSupport._cachedResult
			}; $.spectrum={}; $.spectrum.localization={}; $.spectrum.palettes={}; $.fn.spectrum.processNativeColorInputs=function() { var colorInputs=$( "input[type=color]" ); if ( colorInputs.length&&!inputTypeColorSupport() ) { colorInputs.spectrum( { preferredFormat: "hex6" } ) } }; ( function() {
				var trimLeft=/^[\s,#]+/, trimRight=/\s+$/, tinyCounter=0, math=Math, mathRound=math.round, mathMin=math.min, mathMax=math.max, mathRandom=math.random; var tinycolor=function( color, opts ) {
					color=( color )? color:''; opts=opts||{}; if ( color instanceof tinycolor ) { return color }
					if ( !( this instanceof tinycolor ) ) { return new tinycolor( color, opts ) }
					var rgb=inputToRGB( color ); this._originalInput=color; this._r=rgb.r; this._g=rgb.g; this._b=rgb.b; this._a=rgb.a; this._roundA=mathRound( 1000*this._a )/1000; this._format=opts.format||rgb.format; this._gradientType=opts.gradientType; if ( this._r<1 ) { this._r=mathRound( this._r ) }
					if ( this._g<1 ) { this._g=mathRound( this._g ) }
					if ( this._b<1 ) { this._b=mathRound( this._b ) }
					this._ok=rgb.ok; this._tc_id=tinyCounter++
				}; tinycolor.prototype={
					isDark: function() { return this.getBrightness()<128 }, isLight: function() { return !this.isDark() }, isValid: function() { return this._ok }, getOriginalInput: function() { return this._originalInput }, getFormat: function() { return this._format }, getAlpha: function() { return this._a }, getBrightness: function() { var rgb=this.toRgb(); return ( rgb.r*299+rgb.g*587+rgb.b*114 )/1000 }, setAlpha: function( value ) { this._a=boundAlpha( value ); this._roundA=mathRound( 1000*this._a )/1000; return this }, toHsv: function() { var hsv=rgbToHsv( this._r, this._g, this._b ); return { h: hsv.h*360, s: hsv.s, v: hsv.v, a: this._a } }, toHsvString: function() { var hsv=rgbToHsv( this._r, this._g, this._b ); var h=mathRound( hsv.h*360 ), s=mathRound( hsv.s*100 ), v=mathRound( hsv.v*100 ); return ( this._a==1 )? "hsv("+h+", "+s+"%, "+v+"%)":"hsva("+h+", "+s+"%, "+v+"%, "+this._roundA+")" }, toHsl: function() { var hsl=rgbToHsl( this._r, this._g, this._b ); return { h: hsl.h*360, s: hsl.s, l: hsl.l, a: this._a } }, toHslString: function() { var hsl=rgbToHsl( this._r, this._g, this._b ); var h=mathRound( hsl.h*360 ), s=mathRound( hsl.s*100 ), l=mathRound( hsl.l*100 ); return ( this._a==1 )? "hsl("+h+", "+s+"%, "+l+"%)":"hsla("+h+", "+s+"%, "+l+"%, "+this._roundA+")" }, toHex: function( allow3Char ) { return rgbToHex( this._r, this._g, this._b, allow3Char ) }, toHexString: function( allow3Char ) { return '#'+this.toHex( allow3Char ) }, toHex8: function() { return rgbaToHex( this._r, this._g, this._b, this._a ) }, toHex8String: function() { return '#'+this.toHex8() }, toRgb: function() { return { r: mathRound( this._r ), g: mathRound( this._g ), b: mathRound( this._b ), a: this._a } }, toRgbString: function() { return ( this._a==1 )? "rgb("+mathRound( this._r )+", "+mathRound( this._g )+", "+mathRound( this._b )+")":"rgba("+mathRound( this._r )+", "+mathRound( this._g )+", "+mathRound( this._b )+", "+this._roundA+")" }, toPercentageRgb: function() { return { r: mathRound( bound01( this._r, 255 )*100 )+"%", g: mathRound( bound01( this._g, 255 )*100 )+"%", b: mathRound( bound01( this._b, 255 )*100 )+"%", a: this._a } }, toPercentageRgbString: function() { return ( this._a==1 )? "rgb("+mathRound( bound01( this._r, 255 )*100 )+"%, "+mathRound( bound01( this._g, 255 )*100 )+"%, "+mathRound( bound01( this._b, 255 )*100 )+"%)":"rgba("+mathRound( bound01( this._r, 255 )*100 )+"%, "+mathRound( bound01( this._g, 255 )*100 )+"%, "+mathRound( bound01( this._b, 255 )*100 )+"%, "+this._roundA+")" }, toName: function() {
						if ( this._a===0 ) { return "transparent" }
						if ( this._a<1 ) { return !1 }
						return hexNames[ rgbToHex( this._r, this._g, this._b, !0 ) ]||!1
					}, toFilter: function( secondColor ) {
						var hex8String='#'+rgbaToHex( this._r, this._g, this._b, this._a ); var secondHex8String=hex8String; var gradientType=this._gradientType? "GradientType = 1, ":""; if ( secondColor ) { var s=tinycolor( secondColor ); secondHex8String=s.toHex8String() }
						return "progid:DXImageTransform.Microsoft.gradient("+gradientType+"startColorstr="+hex8String+",endColorstr="+secondHex8String+")"
					}, toString: function( format ) {
						var formatSet=!!format; format=format||this._format; var formattedString=!1; var hasAlpha=this._a<1&&this._a>=0; var needsAlphaFormat=!formatSet&&hasAlpha&&( format==="hex"||format==="hex6"||format==="hex3"||format==="name" ); if ( needsAlphaFormat ) {
							if ( format==="name"&&this._a===0 ) { return this.toName() }
							return this.toRgbString()
						}
						if ( format==="rgb" ) { formattedString=this.toRgbString() }
						if ( format==="prgb" ) { formattedString=this.toPercentageRgbString() }
						if ( format==="hex"||format==="hex6" ) { formattedString=this.toHexString() }
						if ( format==="hex3" ) { formattedString=this.toHexString( !0 ) }
						if ( format==="hex8" ) { formattedString=this.toHex8String() }
						if ( format==="name" ) { formattedString=this.toName() }
						if ( format==="hsl" ) { formattedString=this.toHslString() }
						if ( format==="hsv" ) { formattedString=this.toHsvString() }
						return formattedString||this.toHexString()
					}, _applyModification: function( fn, args ) { var color=fn.apply( null, [ this ].concat( [].slice.call( args ) ) ); this._r=color._r; this._g=color._g; this._b=color._b; this.setAlpha( color._a ); return this }, lighten: function() { return this._applyModification( lighten, arguments ) }, brighten: function() { return this._applyModification( brighten, arguments ) }, darken: function() { return this._applyModification( darken, arguments ) }, desaturate: function() { return this._applyModification( desaturate, arguments ) }, saturate: function() { return this._applyModification( saturate, arguments ) }, greyscale: function() { return this._applyModification( greyscale, arguments ) }, spin: function() { return this._applyModification( spin, arguments ) }, _applyCombination: function( fn, args ) { return fn.apply( null, [ this ].concat( [].slice.call( args ) ) ) }, analogous: function() { return this._applyCombination( analogous, arguments ) }, complement: function() { return this._applyCombination( complement, arguments ) }, monochromatic: function() { return this._applyCombination( monochromatic, arguments ) }, splitcomplement: function() { return this._applyCombination( splitcomplement, arguments ) }, triad: function() { return this._applyCombination( triad, arguments ) }, tetrad: function() { return this._applyCombination( tetrad, arguments ) }
				}; tinycolor.fromRatio=function( color, opts ) {
					if ( typeof color=="object" ) {
						var newColor={}; for ( var i in color ) { if ( color.hasOwnProperty( i ) ) { if ( i==="a" ) { newColor[ i ]=color[ i ] } else { newColor[ i ]=convertToPercentage( color[ i ] ) } } }
						color=newColor
					}
					return tinycolor( color, opts )
				}; function inputToRGB( color ) {
					var rgb={ r: 0, g: 0, b: 0 }; var a=1; var ok=!1; var format=!1; if ( typeof color=="string" ) { color=stringInputToObject( color ) }
					if ( typeof color=="object" ) {
						if ( color.hasOwnProperty( "r" )&&color.hasOwnProperty( "g" )&&color.hasOwnProperty( "b" ) ) { rgb=rgbToRgb( color.r, color.g, color.b ); ok=!0; format=String( color.r ).substr( -1 )==="%"? "prgb":"rgb" } else if ( color.hasOwnProperty( "h" )&&color.hasOwnProperty( "s" )&&color.hasOwnProperty( "v" ) ) { color.s=convertToPercentage( color.s ); color.v=convertToPercentage( color.v ); rgb=hsvToRgb( color.h, color.s, color.v ); ok=!0; format="hsv" } else if ( color.hasOwnProperty( "h" )&&color.hasOwnProperty( "s" )&&color.hasOwnProperty( "l" ) ) { color.s=convertToPercentage( color.s ); color.l=convertToPercentage( color.l ); rgb=hslToRgb( color.h, color.s, color.l ); ok=!0; format="hsl" }
						if ( color.hasOwnProperty( "a" ) ) { a=color.a }
					}
					a=boundAlpha( a ); return { ok: ok, format: color.format||format, r: mathMin( 255, mathMax( rgb.r, 0 ) ), g: mathMin( 255, mathMax( rgb.g, 0 ) ), b: mathMin( 255, mathMax( rgb.b, 0 ) ), a: a }
				}
				function rgbToRgb( r, g, b ) { return { r: bound01( r, 255 )*255, g: bound01( g, 255 )*255, b: bound01( b, 255 )*255 } }
				function rgbToHsl( r, g, b ) {
					r=bound01( r, 255 ); g=bound01( g, 255 ); b=bound01( b, 255 ); var max=mathMax( r, g, b ), min=mathMin( r, g, b ); var h, s, l=( max+min )/2; if ( max==min ) { h=s=0 } else {
						var d=max-min; s=l>0.5? d/( 2-max-min ):d/( max+min ); switch ( max ) { case r: h=( g-b )/d+( g<b? 6:0 ); break; case g: h=( b-r )/d+2; break; case b: h=( r-g )/d+4; break }
						h/=6
					}
					return { h: h, s: s, l: l }
				}
				function hslToRgb( h, s, l ) {
					var r, g, b; h=bound01( h, 360 ); s=bound01( s, 100 ); l=bound01( l, 100 ); function hue2rgb( p, q, t ) { if ( t<0 ) t+=1; if ( t>1 ) t-=1; if ( t<1/6 ) return p+( q-p )*6*t; if ( t<1/2 ) return q; if ( t<2/3 ) return p+( q-p )*( 2/3-t )*6; return p }
					if ( s===0 ) { r=g=b=l } else { var q=l<0.5? l*( 1+s ):l+s-l*s; var p=2*l-q; r=hue2rgb( p, q, h+1/3 ); g=hue2rgb( p, q, h ); b=hue2rgb( p, q, h-1/3 ) }
					return { r: r*255, g: g*255, b: b*255 }
				}
				function rgbToHsv( r, g, b ) {
					r=bound01( r, 255 ); g=bound01( g, 255 ); b=bound01( b, 255 ); var max=mathMax( r, g, b ), min=mathMin( r, g, b ); var h, s, v=max; var d=max-min; s=max===0? 0:d/max; if ( max==min ) { h=0 } else {
						switch ( max ) { case r: h=( g-b )/d+( g<b? 6:0 ); break; case g: h=( b-r )/d+2; break; case b: h=( r-g )/d+4; break }
						h/=6
					}
					return { h: h, s: s, v: v }
				}
				function hsvToRgb( h, s, v ) { h=bound01( h, 360 )*6; s=bound01( s, 100 ); v=bound01( v, 100 ); var i=math.floor( h ), f=h-i, p=v*( 1-s ), q=v*( 1-f*s ), t=v*( 1-( 1-f )*s ), mod=i%6, r=[ v, q, p, p, t, v ][ mod ], g=[ t, v, v, q, p, p ][ mod ], b=[ p, p, t, v, v, q ][ mod ]; return { r: r*255, g: g*255, b: b*255 } }
				function rgbToHex( r, g, b, allow3Char ) {
					var hex=[ pad2( mathRound( r ).toString( 16 ) ), pad2( mathRound( g ).toString( 16 ) ), pad2( mathRound( b ).toString( 16 ) ) ]; if ( allow3Char&&hex[ 0 ].charAt( 0 )==hex[ 0 ].charAt( 1 )&&hex[ 1 ].charAt( 0 )==hex[ 1 ].charAt( 1 )&&hex[ 2 ].charAt( 0 )==hex[ 2 ].charAt( 1 ) ) { return hex[ 0 ].charAt( 0 )+hex[ 1 ].charAt( 0 )+hex[ 2 ].charAt( 0 ) }
					return hex.join( "" )
				}
				function rgbaToHex( r, g, b, a ) { var hex=[ pad2( convertDecimalToHex( a ) ), pad2( mathRound( r ).toString( 16 ) ), pad2( mathRound( g ).toString( 16 ) ), pad2( mathRound( b ).toString( 16 ) ) ]; return hex.join( "" ) }
				tinycolor.equals=function( color1, color2 ) {
					if ( !color1||!color2 ) { return !1 }
					return tinycolor( color1 ).toRgbString()==tinycolor( color2 ).toRgbString()
				}; tinycolor.random=function() { return tinycolor.fromRatio( { r: mathRandom(), g: mathRandom(), b: mathRandom() } ) }; function desaturate( color, amount ) { amount=( amount===0 )? 0:( amount||10 ); var hsl=tinycolor( color ).toHsl(); hsl.s-=amount/100; hsl.s=clamp01( hsl.s ); return tinycolor( hsl ) }
				function saturate( color, amount ) { amount=( amount===0 )? 0:( amount||10 ); var hsl=tinycolor( color ).toHsl(); hsl.s+=amount/100; hsl.s=clamp01( hsl.s ); return tinycolor( hsl ) }
				function greyscale( color ) { return tinycolor( color ).desaturate( 100 ) }
				function lighten( color, amount ) { amount=( amount===0 )? 0:( amount||10 ); var hsl=tinycolor( color ).toHsl(); hsl.l+=amount/100; hsl.l=clamp01( hsl.l ); return tinycolor( hsl ) }
				function brighten( color, amount ) { amount=( amount===0 )? 0:( amount||10 ); var rgb=tinycolor( color ).toRgb(); rgb.r=mathMax( 0, mathMin( 255, rgb.r-mathRound( 255*-( amount/100 ) ) ) ); rgb.g=mathMax( 0, mathMin( 255, rgb.g-mathRound( 255*-( amount/100 ) ) ) ); rgb.b=mathMax( 0, mathMin( 255, rgb.b-mathRound( 255*-( amount/100 ) ) ) ); return tinycolor( rgb ) }
				function darken( color, amount ) { amount=( amount===0 )? 0:( amount||10 ); var hsl=tinycolor( color ).toHsl(); hsl.l-=amount/100; hsl.l=clamp01( hsl.l ); return tinycolor( hsl ) }
				function spin( color, amount ) { var hsl=tinycolor( color ).toHsl(); var hue=( mathRound( hsl.h )+amount )%360; hsl.h=hue<0? 360+hue:hue; return tinycolor( hsl ) }
				function complement( color ) { var hsl=tinycolor( color ).toHsl(); hsl.h=( hsl.h+180 )%360; return tinycolor( hsl ) }
				function triad( color ) { var hsl=tinycolor( color ).toHsl(); var h=hsl.h; return [ tinycolor( color ), tinycolor( { h: ( h+120 )%360, s: hsl.s, l: hsl.l } ), tinycolor( { h: ( h+240 )%360, s: hsl.s, l: hsl.l } ) ] }
				function tetrad( color ) { var hsl=tinycolor( color ).toHsl(); var h=hsl.h; return [ tinycolor( color ), tinycolor( { h: ( h+90 )%360, s: hsl.s, l: hsl.l } ), tinycolor( { h: ( h+180 )%360, s: hsl.s, l: hsl.l } ), tinycolor( { h: ( h+270 )%360, s: hsl.s, l: hsl.l } ) ] }
				function splitcomplement( color ) { var hsl=tinycolor( color ).toHsl(); var h=hsl.h; return [ tinycolor( color ), tinycolor( { h: ( h+72 )%360, s: hsl.s, l: hsl.l } ), tinycolor( { h: ( h+216 )%360, s: hsl.s, l: hsl.l } ) ] }
				function analogous( color, results, slices ) {
					results=results||6; slices=slices||30; var hsl=tinycolor( color ).toHsl(); var part=360/slices; var ret=[ tinycolor( color ) ]; for ( hsl.h=( ( hsl.h-( part*results>>1 ) )+720 )%360;--results; ) { hsl.h=( hsl.h+part )%360; ret.push( tinycolor( hsl ) ) }
					return ret
				}
				function monochromatic( color, results ) {
					results=results||6; var hsv=tinycolor( color ).toHsv(); var h=hsv.h, s=hsv.s, v=hsv.v; var ret=[]; var modification=1/results; while ( results-- ) { ret.push( tinycolor( { h: h, s: s, v: v } ) ); v=( v+modification )%1 }
					return ret
				}
				tinycolor.mix=function( color1, color2, amount ) {
					amount=( amount===0 )? 0:( amount||50 ); var rgb1=tinycolor( color1 ).toRgb(); var rgb2=tinycolor( color2 ).toRgb(); var p=amount/100; var w=p*2-1; var a=rgb2.a-rgb1.a; var w1; if ( w*a==-1 ) { w1=w } else { w1=( w+a )/( 1+w*a ) }
					w1=( w1+1 )/2; var w2=1-w1; var rgba={ r: rgb2.r*w1+rgb1.r*w2, g: rgb2.g*w1+rgb1.g*w2, b: rgb2.b*w1+rgb1.b*w2, a: rgb2.a*p+rgb1.a*( 1-p ) }; return tinycolor( rgba )
				}; tinycolor.readability=function( color1, color2 ) { var c1=tinycolor( color1 ); var c2=tinycolor( color2 ); var rgb1=c1.toRgb(); var rgb2=c2.toRgb(); var brightnessA=c1.getBrightness(); var brightnessB=c2.getBrightness(); var colorDiff=( Math.max( rgb1.r, rgb2.r )-Math.min( rgb1.r, rgb2.r )+Math.max( rgb1.g, rgb2.g )-Math.min( rgb1.g, rgb2.g )+Math.max( rgb1.b, rgb2.b )-Math.min( rgb1.b, rgb2.b ) ); return { brightness: Math.abs( brightnessA-brightnessB ), color: colorDiff } }; tinycolor.isReadable=function( color1, color2 ) { var readability=tinycolor.readability( color1, color2 ); return readability.brightness>125&&readability.color>500 }; tinycolor.mostReadable=function( baseColor, colorList ) {
					var bestColor=null; var bestScore=0; var bestIsReadable=!1; for ( var i=0;i<colorList.length;i++ ) { var readability=tinycolor.readability( baseColor, colorList[ i ] ); var readable=readability.brightness>125&&readability.color>500; var score=3*( readability.brightness/125 )+( readability.color/500 ); if ( ( readable&&!bestIsReadable )||( readable&&bestIsReadable&&score>bestScore )||( ( !readable )&&( !bestIsReadable )&&score>bestScore ) ) { bestIsReadable=readable; bestScore=score; bestColor=tinycolor( colorList[ i ] ) } }
					return bestColor
				}; var names=tinycolor.names={ aliceblue: "f0f8ff", antiquewhite: "faebd7", aqua: "0ff", aquamarine: "7fffd4", azure: "f0ffff", beige: "f5f5dc", bisque: "ffe4c4", black: "000", blanchedalmond: "ffebcd", blue: "00f", blueviolet: "8a2be2", brown: "a52a2a", burlywood: "deb887", burntsienna: "ea7e5d", cadetblue: "5f9ea0", chartreuse: "7fff00", chocolate: "d2691e", coral: "ff7f50", cornflowerblue: "6495ed", cornsilk: "fff8dc", crimson: "dc143c", cyan: "0ff", darkblue: "00008b", darkcyan: "008b8b", darkgoldenrod: "b8860b", darkgray: "a9a9a9", darkgreen: "006400", darkgrey: "a9a9a9", darkkhaki: "bdb76b", darkmagenta: "8b008b", darkolivegreen: "556b2f", darkorange: "ff8c00", darkorchid: "9932cc", darkred: "8b0000", darksalmon: "e9967a", darkseagreen: "8fbc8f", darkslateblue: "483d8b", darkslategray: "2f4f4f", darkslategrey: "2f4f4f", darkturquoise: "00ced1", darkviolet: "9400d3", deeppink: "ff1493", deepskyblue: "00bfff", dimgray: "696969", dimgrey: "696969", dodgerblue: "1e90ff", firebrick: "b22222", floralwhite: "fffaf0", forestgreen: "228b22", fuchsia: "f0f", gainsboro: "dcdcdc", ghostwhite: "f8f8ff", gold: "ffd700", goldenrod: "daa520", gray: "808080", green: "008000", greenyellow: "adff2f", grey: "808080", honeydew: "f0fff0", hotpink: "ff69b4", indianred: "cd5c5c", indigo: "4b0082", ivory: "fffff0", khaki: "f0e68c", lavender: "e6e6fa", lavenderblush: "fff0f5", lawngreen: "7cfc00", lemonchiffon: "fffacd", lightblue: "add8e6", lightcoral: "f08080", lightcyan: "e0ffff", lightgoldenrodyellow: "fafad2", lightgray: "d3d3d3", lightgreen: "90ee90", lightgrey: "d3d3d3", lightpink: "ffb6c1", lightsalmon: "ffa07a", lightseagreen: "20b2aa", lightskyblue: "87cefa", lightslategray: "789", lightslategrey: "789", lightsteelblue: "b0c4de", lightyellow: "ffffe0", lime: "0f0", limegreen: "32cd32", linen: "faf0e6", magenta: "f0f", maroon: "800000", mediumaquamarine: "66cdaa", mediumblue: "0000cd", mediumorchid: "ba55d3", mediumpurple: "9370db", mediumseagreen: "3cb371", mediumslateblue: "7b68ee", mediumspringgreen: "00fa9a", mediumturquoise: "48d1cc", mediumvioletred: "c71585", midnightblue: "191970", mintcream: "f5fffa", mistyrose: "ffe4e1", moccasin: "ffe4b5", navajowhite: "ffdead", navy: "000080", oldlace: "fdf5e6", olive: "808000", olivedrab: "6b8e23", orange: "ffa500", orangered: "ff4500", orchid: "da70d6", palegoldenrod: "eee8aa", palegreen: "98fb98", paleturquoise: "afeeee", palevioletred: "db7093", papayawhip: "ffefd5", peachpuff: "ffdab9", peru: "cd853f", pink: "ffc0cb", plum: "dda0dd", powderblue: "b0e0e6", purple: "800080", rebeccapurple: "663399", red: "f00", rosybrown: "bc8f8f", royalblue: "4169e1", saddlebrown: "8b4513", salmon: "fa8072", sandybrown: "f4a460", seagreen: "2e8b57", seashell: "fff5ee", sienna: "a0522d", silver: "c0c0c0", skyblue: "87ceeb", slateblue: "6a5acd", slategray: "708090", slategrey: "708090", snow: "fffafa", springgreen: "00ff7f", steelblue: "4682b4", tan: "d2b48c", teal: "008080", thistle: "d8bfd8", tomato: "ff6347", turquoise: "40e0d0", violet: "ee82ee", wheat: "f5deb3", white: "fff", whitesmoke: "f5f5f5", yellow: "ff0", yellowgreen: "9acd32" }; var hexNames=tinycolor.hexNames=flip( names ); function flip( o ) {
					var flipped={}; for ( var i in o ) { if ( o.hasOwnProperty( i ) ) { flipped[ o[ i ] ]=i } }
					return flipped
				}
				function boundAlpha( a ) {
					a=parseFloat( a ); if ( isNaN( a )||a<0||a>1 ) { a=1 }
					return a
				}
				function bound01( n, max ) {
					if ( isOnePointZero( n ) ) { n="100%" }
					var processPercent=isPercentage( n ); n=mathMin( max, mathMax( 0, parseFloat( n ) ) ); if ( processPercent ) { n=parseInt( n*max, 10 )/100 }
					if ( ( math.abs( n-max )<0.000001 ) ) { return 1 }
					return ( n%max )/parseFloat( max )
				}
				function clamp01( val ) { return mathMin( 1, mathMax( 0, val ) ) }
				function parseIntFromHex( val ) { return parseInt( val, 16 ) }
				function isOnePointZero( n ) { return typeof n=="string"&&n.indexOf( '.' )!=-1&&parseFloat( n )===1 }
				function isPercentage( n ) { return typeof n==="string"&&n.indexOf( '%' )!=-1 }
				function pad2( c ) { return c.length==1? '0'+c:''+c }
				function convertToPercentage( n ) {
					if ( n<=1 ) { n=( n*100 )+"%" }
					return n
				}
				function convertDecimalToHex( d ) { return Math.round( parseFloat( d )*255 ).toString( 16 ) }
				function convertHexToDecimal( h ) { return ( parseIntFromHex( h )/255 ) }
				var matchers=( function() { var CSS_INTEGER="[-\\+]?\\d+%?"; var CSS_NUMBER="[-\\+]?\\d*\\.\\d+%?"; var CSS_UNIT="(?:"+CSS_NUMBER+")|(?:"+CSS_INTEGER+")"; var PERMISSIVE_MATCH3="[\\s|\\(]+("+CSS_UNIT+")[,|\\s]+("+CSS_UNIT+")[,|\\s]+("+CSS_UNIT+")\\s*\\)?"; var PERMISSIVE_MATCH4="[\\s|\\(]+("+CSS_UNIT+")[,|\\s]+("+CSS_UNIT+")[,|\\s]+("+CSS_UNIT+")[,|\\s]+("+CSS_UNIT+")\\s*\\)?"; return { rgb: new RegExp( "rgb"+PERMISSIVE_MATCH3 ), rgba: new RegExp( "rgba"+PERMISSIVE_MATCH4 ), hsl: new RegExp( "hsl"+PERMISSIVE_MATCH3 ), hsla: new RegExp( "hsla"+PERMISSIVE_MATCH4 ), hsv: new RegExp( "hsv"+PERMISSIVE_MATCH3 ), hsva: new RegExp( "hsva"+PERMISSIVE_MATCH4 ), hex3: /^([0-9a-fA-F]{1})([0-9a-fA-F]{1})([0-9a-fA-F]{1})$/, hex6: /^([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/, hex8: /^([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/ } } )(); function stringInputToObject( color ) {
					color=color.replace( trimLeft, '' ).replace( trimRight, '' ).toLowerCase(); var named=!1; if ( names[ color ] ) { color=names[ color ]; named=!0 } else if ( color=='transparent' ) { return { r: 0, g: 0, b: 0, a: 0, format: "name" } }
					var match; if ( ( match=matchers.rgb.exec( color ) ) ) { return { r: match[ 1 ], g: match[ 2 ], b: match[ 3 ] } }
					if ( ( match=matchers.rgba.exec( color ) ) ) { return { r: match[ 1 ], g: match[ 2 ], b: match[ 3 ], a: match[ 4 ] } }
					if ( ( match=matchers.hsl.exec( color ) ) ) { return { h: match[ 1 ], s: match[ 2 ], l: match[ 3 ] } }
					if ( ( match=matchers.hsla.exec( color ) ) ) { return { h: match[ 1 ], s: match[ 2 ], l: match[ 3 ], a: match[ 4 ] } }
					if ( ( match=matchers.hsv.exec( color ) ) ) { return { h: match[ 1 ], s: match[ 2 ], v: match[ 3 ] } }
					if ( ( match=matchers.hsva.exec( color ) ) ) { return { h: match[ 1 ], s: match[ 2 ], v: match[ 3 ], a: match[ 4 ] } }
					if ( ( match=matchers.hex8.exec( color ) ) ) { return { a: convertHexToDecimal( match[ 1 ] ), r: parseIntFromHex( match[ 2 ] ), g: parseIntFromHex( match[ 3 ] ), b: parseIntFromHex( match[ 4 ] ), format: named? "name":"hex8" } }
					if ( ( match=matchers.hex6.exec( color ) ) ) { return { r: parseIntFromHex( match[ 1 ] ), g: parseIntFromHex( match[ 2 ] ), b: parseIntFromHex( match[ 3 ] ), format: named? "name":"hex" } }
					if ( ( match=matchers.hex3.exec( color ) ) ) { return { r: parseIntFromHex( match[ 1 ]+''+match[ 1 ] ), g: parseIntFromHex( match[ 2 ]+''+match[ 2 ] ), b: parseIntFromHex( match[ 3 ]+''+match[ 3 ] ), format: named? "name":"hex" } }
					return !1
				}
				window.tinycolor=tinycolor
			} )(); $( function() { if ( $.fn.spectrum.load ) { $.fn.spectrum.processNativeColorInputs() } } )
		} );

		$( 'head' ).append( '<style>.sp-container{position:absolute;top:0;left:0;display:inline-block;*display:inline;*zoom:1;z-index:9999994;overflow:hidden}.sp-container.sp-flat{position:relative}.sp-container,.sp-container *{-webkit-box-sizing:content-box;-moz-box-sizing:content-box;box-sizing:content-box}.sp-top{position:relative;width:100%;display:inline-block}.sp-top-inner{position:absolute;top:0;left:0;bottom:0;right:0}.sp-color{position:absolute;top:0;left:0;bottom:0;right:20%}.sp-hue{position:absolute;top:0;right:0;bottom:0;left:84%;height:100%}.sp-clear-enabled .sp-hue{top:33px;height:77.5%}.sp-fill{padding-top:80%}.sp-sat,.sp-val{position:absolute;top:0;left:0;right:0;bottom:0}.sp-alpha-enabled .sp-top{margin-bottom:18px}.sp-alpha-enabled .sp-alpha{display:block}.sp-alpha-handle{position:absolute;top:-4px;bottom:-4px;width:6px;left:50%;cursor:pointer;border:1px solid #000;background:#fff;opacity:.8}.sp-alpha{display:none;position:absolute;bottom:-14px;right:0;left:0;height:8px}.sp-alpha-inner{border:solid 1px #333}.sp-clear{display:none}.sp-clear.sp-clear-display{background-position:center}.sp-clear-enabled .sp-clear{display:block;position:absolute;top:0;right:0;bottom:0;left:84%;height:28px}.sp-container,.sp-replacer,.sp-preview,.sp-dragger,.sp-slider,.sp-alpha,.sp-clear,.sp-alpha-handle,.sp-container.sp-dragging .sp-input,.sp-container button{-webkit-user-select:none;-moz-user-select:-moz-none;-o-user-select:none;user-select:none}.sp-container.sp-input-disabled .sp-input-container{display:none}.sp-container.sp-buttons-disabled .sp-button-container{display:none}.sp-container.sp-palette-buttons-disabled .sp-palette-button-container{display:none}.sp-palette-only .sp-picker-container{display:none}.sp-palette-disabled .sp-palette-container{display:none}.sp-initial-disabled .sp-initial{display:none}.sp-sat{background-image:-webkit-gradient(linear,0 0,100% 0,from(#FFF),to(rgba(204,154,129,0)));background-image:-webkit-linear-gradient(left,#FFF,rgba(204,154,129,0));background-image:-moz-linear-gradient(left,#fff,rgba(204,154,129,0));background-image:-o-linear-gradient(left,#fff,rgba(204,154,129,0));background-image:-ms-linear-gradient(left,#fff,rgba(204,154,129,0));background-image:linear-gradient(to right,#fff,rgba(204,154,129,0));-ms-filter:"progid:DXImageTransform.Microsoft.gradient(GradientType = 1, startColorstr=#FFFFFFFF, endColorstr=#00CC9A81)";filter:progid:DXImageTransform.Microsoft.gradient(GradientType=1,startColorstr=\'#FFFFFFFF\',endColorstr=\'#00CC9A81\')}.sp-val{background-image:-webkit-gradient(linear,0 100%,0 0,from(#000000),to(rgba(204,154,129,0)));background-image:-webkit-linear-gradient(bottom,#000000,rgba(204,154,129,0));background-image:-moz-linear-gradient(bottom,#000,rgba(204,154,129,0));background-image:-o-linear-gradient(bottom,#000,rgba(204,154,129,0));background-image:-ms-linear-gradient(bottom,#000,rgba(204,154,129,0));background-image:linear-gradient(to top,#000,rgba(204,154,129,0));-ms-filter:"progid:DXImageTransform.Microsoft.gradient(startColorstr=#00CC9A81, endColorstr=#FF000000)";filter:progid:DXImageTransform.Microsoft.gradient(startColorstr=\'#00CC9A81\',endColorstr=\'#FF000000\')}.sp-hue{background:-moz-linear-gradient(top,#ff0000 0%,#ffff00 17%,#00ff00 33%,#00ffff 50%,#0000ff 67%,#ff00ff 83%,#ff0000 100%);background:-ms-linear-gradient(top,#ff0000 0%,#ffff00 17%,#00ff00 33%,#00ffff 50%,#0000ff 67%,#ff00ff 83%,#ff0000 100%);background:-o-linear-gradient(top,#ff0000 0%,#ffff00 17%,#00ff00 33%,#00ffff 50%,#0000ff 67%,#ff00ff 83%,#ff0000 100%);background:-webkit-gradient(linear,left top,left bottom,from(#ff0000),color-stop(.17,#ffff00),color-stop(.33,#00ff00),color-stop(.5,#00ffff),color-stop(.67,#0000ff),color-stop(.83,#ff00ff),to(#ff0000));background:-webkit-linear-gradient(top,#ff0000 0%,#ffff00 17%,#00ff00 33%,#00ffff 50%,#0000ff 67%,#ff00ff 83%,#ff0000 100%);background:linear-gradient(to bottom,#ff0000 0%,#ffff00 17%,#00ff00 33%,#00ffff 50%,#0000ff 67%,#ff00ff 83%,#ff0000 100%)}.sp-1{height:17%;filter:progid:DXImageTransform.Microsoft.gradient(startColorstr=\'#ff0000\',endColorstr=\'#ffff00\')}.sp-2{height:16%;filter:progid:DXImageTransform.Microsoft.gradient(startColorstr=\'#ffff00\',endColorstr=\'#00ff00\')}.sp-3{height:17%;filter:progid:DXImageTransform.Microsoft.gradient(startColorstr=\'#00ff00\',endColorstr=\'#00ffff\')}.sp-4{height:17%;filter:progid:DXImageTransform.Microsoft.gradient(startColorstr=\'#00ffff\',endColorstr=\'#0000ff\')}.sp-5{height:16%;filter:progid:DXImageTransform.Microsoft.gradient(startColorstr=\'#0000ff\',endColorstr=\'#ff00ff\')}.sp-6{height:17%;filter:progid:DXImageTransform.Microsoft.gradient(startColorstr=\'#ff00ff\',endColorstr=\'#ff0000\')}.sp-hidden{display:none!important}.sp-cf:before,.sp-cf:after{content:"";display:table}.sp-cf:after{clear:both}.sp-cf{*zoom:1}@media (max-device-width:480px){.sp-color{right:40%}.sp-hue{left:63%}.sp-fill{padding-top:60%}}.sp-dragger{border-radius:5px;height:5px;width:5px;border:1px solid #fff;background:#000;cursor:pointer;position:absolute;top:0;left:0}.sp-slider{position:absolute;top:0;cursor:pointer;height:3px;left:-1px;right:-1px;border:1px solid #000;background:#fff;opacity:.8}.sp-container{border-radius:0;background-color:#ECECEC;border:solid 1px #f0c49B;padding:0}.sp-container,.sp-container button,.sp-container input,.sp-color,.sp-hue,.sp-clear{font:normal 12px "Lucida Grande","Lucida Sans Unicode","Lucida Sans",Geneva,Verdana,sans-serif;-webkit-box-sizing:border-box;-moz-box-sizing:border-box;-ms-box-sizing:border-box;box-sizing:border-box}.sp-top{margin-bottom:3px}.sp-color,.sp-hue,.sp-clear{border:solid 1px #666}.sp-input-container{float:right;width:100px;margin-bottom:4px}.sp-initial-disabled .sp-input-container{width:100%}.sp-input{font-size:12px!important;border:1px inset;padding:4px 5px;margin:0;width:100%;background:transparent;border-radius:3px;color:#222}.sp-input:focus{border:1px solid orange}.sp-input.sp-validation-error{border:1px solid red;background:#fdd}.sp-picker-container,.sp-palette-container{float:left;position:relative;padding:10px;padding-bottom:300px;margin-bottom:-290px}.sp-picker-container{width:172px;border-left:solid 1px #fff}.sp-palette-container{border-right:solid 1px #ccc}.sp-palette-only .sp-palette-container{border:0}.sp-palette .sp-thumb-el{display:block;position:relative;float:left;width:24px;height:15px;margin:3px;cursor:pointer;border:solid 2px transparent}.sp-palette .sp-thumb-el:hover,.sp-palette .sp-thumb-el.sp-thumb-active{border-color:orange}.sp-thumb-el{position:relative}.sp-initial{float:left;border:solid 1px #333}.sp-initial span{width:30px;height:25px;border:none;display:block;float:left;margin:0}.sp-initial .sp-clear-display{background-position:center}.sp-palette-button-container,.sp-button-container{float:right}.sp-replacer{margin:0;overflow:hidden;cursor:pointer;padding:4px;display:inline-block;*zoom:1;*display:inline;border:solid 1px #91765d;background:#eee;color:#333;vertical-align:middle}.sp-replacer:hover,.sp-replacer.sp-active{border-color:#F0C49B;color:#111}.sp-replacer.sp-disabled{cursor:default;border-color:silver;color:silver}.sp-dd{padding:2px 0;height:16px;line-height:16px;float:left;font-size:10px}.sp-preview{position:relative;width:25px;height:20px;border:solid 1px #222;margin-right:5px;float:left;z-index:0}.sp-palette{*width:220px;max-width:220px}.sp-palette .sp-thumb-el{width:16px;height:16px;margin:2px 1px;border:solid 1px #d0d0d0}.sp-container{padding-bottom:0}.sp-container button{background-color:#eee;background-image:-webkit-linear-gradient(top,#eeeeee,#cccccc);background-image:-moz-linear-gradient(top,#eeeeee,#cccccc);background-image:-ms-linear-gradient(top,#eeeeee,#cccccc);background-image:-o-linear-gradient(top,#eeeeee,#cccccc);background-image:linear-gradient(to bottom,#eeeeee,#cccccc);border:1px solid #ccc;border-bottom:1px solid #bbb;border-radius:3px;color:#333;font-size:14px;line-height:1;padding:5px 4px;text-align:center;text-shadow:0 1px 0 #eee;vertical-align:middle}.sp-container button:hover{background-color:#ddd;background-image:-webkit-linear-gradient(top,#dddddd,#bbbbbb);background-image:-moz-linear-gradient(top,#dddddd,#bbbbbb);background-image:-ms-linear-gradient(top,#dddddd,#bbbbbb);background-image:-o-linear-gradient(top,#dddddd,#bbbbbb);background-image:linear-gradient(to bottom,#dddddd,#bbbbbb);border:1px solid #bbb;border-bottom:1px solid #999;cursor:pointer;text-shadow:0 1px 0 #ddd}.sp-container button:active{border:1px solid #aaa;border-bottom:1px solid #888;-webkit-box-shadow:inset 0 0 5px 2px #aaaaaa,0 1px 0 0 #eee;-moz-box-shadow:inset 0 0 5px 2px #aaaaaa,0 1px 0 0 #eee;-ms-box-shadow:inset 0 0 5px 2px #aaaaaa,0 1px 0 0 #eee;-o-box-shadow:inset 0 0 5px 2px #aaaaaa,0 1px 0 0 #eee;box-shadow:inset 0 0 5px 2px #aaaaaa,0 1px 0 0 #eee}.sp-cancel{font-size:11px;color:#d93f3f!important;margin:0;padding:2px;margin-right:5px;vertical-align:middle;text-decoration:none}.sp-cancel:hover{color:#d93f3f!important;text-decoration:underline}.sp-palette span:hover,.sp-palette span.sp-thumb-active{border-color:#000}.sp-preview,.sp-alpha,.sp-thumb-el{position:relative;background-image:url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMCAIAAADZF8uwAAAAGUlEQVQYV2M4gwH+YwCGIasIUwhT25BVBADtzYNYrHvv4gAAAABJRU5ErkJggg==)}.sp-preview-inner,.sp-alpha-inner,.sp-thumb-inner{display:block;position:absolute;top:0;left:0;bottom:0;right:0}.sp-palette .sp-thumb-inner{background-position:50% 50%;background-repeat:no-repeat}.sp-palette .sp-thumb-light.sp-thumb-active .sp-thumb-inner{background-image:url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABIAAAASCAYAAABWzo5XAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAIVJREFUeNpiYBhsgJFMffxAXABlN5JruT4Q3wfi/0DsT64h8UD8HmpIPCWG/KemIfOJCUB+Aoacx6EGBZyHBqI+WsDCwuQ9mhxeg2A210Ntfo8klk9sOMijaURm7yc1UP2RNCMbKE9ODK1HM6iegYLkfx8pligC9lCD7KmRof0ZhjQACDAAceovrtpVBRkAAAAASUVORK5CYII=)}.sp-palette .sp-thumb-dark.sp-thumb-active .sp-thumb-inner{background-image:url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABIAAAASCAYAAABWzo5XAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAadEVYdFNvZnR3YXJlAFBhaW50Lk5FVCB2My41LjEwMPRyoQAAAMdJREFUOE+tkgsNwzAMRMugEAahEAahEAZhEAqlEAZhEAohEAYh81X2dIm8fKpEspLGvudPOsUYpxE2BIJCroJmEW9qJ+MKaBFhEMNabSy9oIcIPwrB+afvAUFoK4H0tMaQ3XtlrggDhOVVMuT4E5MMG0FBbCEYzjYT7OxLEvIHQLY2zWwQ3D+9luyOQTfKDiFD3iUIfPk8VqrKjgAiSfGFPecrg6HN6m/iBcwiDAo7WiBeawa+Kwh7tZoSCGLMqwlSAzVDhoK+6vH4G0P5wdkAAAAASUVORK5CYII=)}.sp-clear-display{background-repeat:no-repeat;background-position:center;background-image:url(data:image/gif;base64,R0lGODlhFAAUAPcAAAAAAJmZmZ2dnZ6enqKioqOjo6SkpKWlpaampqenp6ioqKmpqaqqqqurq/Hx8fLy8vT09PX19ff39/j4+Pn5+fr6+vv7+wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACH5BAEAAP8ALAAAAAAUABQAAAihAP9FoPCvoMGDBy08+EdhQAIJCCMybCDAAYUEARBAlFiQQoMABQhKUJBxY0SPICEYHBnggEmDKAuoPMjS5cGYMxHW3IiT478JJA8M/CjTZ0GgLRekNGpwAsYABHIypcAgQMsITDtWJYBR6NSqMico9cqR6tKfY7GeBCuVwlipDNmefAtTrkSzB1RaIAoXodsABiZAEFB06gIBWC1mLVgBa0AAOw==)}</style>' );
	}; // end setupColorpickerSpectrum

	// setup the plugin
	self.setup=function() {
		if ( 'pluginloaded' in self ) {
			console.log( 'IITC plugin already loaded: '+self.title+' version '+self.version );
			return;
		} else {
			self.pluginloaded=true;
		}

		self.setup_arc();
		self.setupColorpickerSpectrum();

		self.isSmartphone=window.isSmartphone();

		self.restoresettings();

		self.lineOptions={
			stroke: true,
			color: self.settings.drawcolor,
			weight: 4,
			opacity: 0.8,
			fill: false,
			clickable: true
		};

		// START - Great Circles functionality
		/** Extend Number object with method to convert numeric degrees to radians */
		if ( typeof Number.prototype.toRadians=='undefined' ) {
			Number.prototype.toRadians=function() { return this*Math.PI/180; };
		}

		/** Extend Number object with method to convert radians to numeric (signed) degrees */
		if ( typeof Number.prototype.toDegrees=='undefined' ) {
			Number.prototype.toDegrees=function() { return this*180/Math.PI; };
		}
		// END - Great Circles functionality

		//create a leaflet FeatureGroup to hold drawn items
		self.drawnItems=new L.FeatureGroup();
		self.drawnItems._map=null;
		window.addLayerGroup( self.title, self.drawnItems, true );
		self.greatcircleslayer=new L.FeatureGroup();
		window.addLayerGroup( 'Quick Draw Great Circles', self.greatcircleslayer, true );
		self.fieldslayer=new L.FeatureGroup();
		window.addLayerGroup( 'Quick Draw Fields', self.fieldslayer, true );

		map.on( 'layeradd', function( obj ) { // show button
			if ( obj.layer===self.drawnItems ) {
				self.onPortalSelected();
			}
			if ( obj.layer===self.greatcircleslayer ) {
				self.updategreatcircleslayer();
			}
			if ( obj.layer===self.fieldslayer ) {
				self.updatefieldslayer();
			}
		} );
		map.on( 'layerremove', function( obj ) { // hide button
			if ( obj.layer===self.drawnItems ) {
				self.removeMarker();
				self.onPortalSelected();
			}
		} );
		//window.map.on('zoomend', function(obj) {
		//self.updategreatcircleslayer();
		//});

		//load any previously saved items
		self.load();
		self.restoretitles();
		self.storelinks(); // overwrite and update data

		window.addHook( 'portalSelected', self.onPortalSelected );

		self.createCrossLinksLayer();

		self.addPortalBookmarkSetup();

		window.addHook( 'linkAdded', self.onLinkAdded );
		window.addHook( 'linkAdded', function() { if ( !self.linktimerid ) self.linktimerid=window.setTimeout( function() { self.linktimerid=undefined; self.updatefieldslayer(); }, 1000 ); } );
		window.addHook( 'mapDataRefreshEnd', self.onMapDataRefreshEnd );

		window.addHook( 'portalDetailLoaded', function( data ) { if ( self.requestid===data.guid ) { self.requestid=undefined; window.renderPortalDetails( data.guid ); } } );

		//add options menu
		if ( window.useAndroidPanes() ) {
			android.addPane( self.panename, self.title, "ic_action_share" );
			addHook( "paneChanged", self.onPaneChanged );
		} else {
			$( '#toolbox' ).append( '<a onclick="if (window.useAndroidPanes()) window.show(\''+self.panename+'\'); else '+self.namespace+'menu(); return false;" href="#">'+self.title+'</a>' );
		}

		let titlebuttonwidth=23;
		let titlebuttonheight=23;
		let screenbuttonwidth=25;
		let screenbuttonheight=25;
		if ( self.isSmartphone ) {
			screenbuttonwidth=30;
			screenbuttonheight=30;
		}
		// Place buttons above the status-bar and add buttons to the portal details screen (in front of the portal title)
		let topoffset=-33;
		if ( self.isSmartphone&&window.plugin.miniMap ) { // place it above the miniMap, if enabled
			topoffset=-196;
		}
		let leftoffset=3;
		$( 'head' ).append(
			'<style>'+
			'.quickdrawlinksdialog a, a.quickdrawlinksdialog { display:block; color:#ffce00; border:1px solid #ffce00; padding:3px 0; margin:10px auto; width:80%; text-align:center; background:rgba(8,48,78,.9); }'+
			'#quickdrawlinksdialog.mobile { background: transparent; border: 0 none !important; height: 100% !important; width: 100% !important; left: 0 !important; top: 0 !important; position: absolute; overflow: auto; }'+
			'.ui-dialog-quickdrawlinks-export textarea { width:96%; height:250px; resize:vertical; }'+
			'.linkmenu {\n	background-image:url('+self.linkmenubuttonsicon+');\n	background-repeat: no-repeat;\n	background-size:175px 25px;\n	width:25px;\n	height:25px;\n\n	border: 1px solid #888;\n	box-shadow: 0 0 8px rgba(0,0,0,0.4);\n\n	background-color: rgba(255, 255, 255, 0.8);\n	-moz-border-radius: 4px;\n	-webkit-border-radius: 4px;\n	border-radius: 4px;\n}\n.linkmenutrash {\n	background-position: 0px 0px;\n}\n.linkmenumove {\n	background-position: -25px 0px;\n}\n.linkmenuswap {\n	background-position: -50px 0px;\n}\n.linkmenuzoom {\n	background-position: -75px 0px;\n}\n.linkmenulist {\n	background-position: -100px 0px;\n}\n.linkmenuconfirm {\n	background-position: -125px 0px;\n}\n.linkmenucancel {\n	background-position: -150px 0px;\n}'+
			'.titlebutton {\n    background-image:url('+self.menuicons+');\n	background-repeat: no-repeat;\n	background-size:'+( titlebuttonwidth*4 )+'px '+( titlebuttonheight*2 )+'px;\n\n	width:'+titlebuttonwidth+'px;\n	height:'+titlebuttonheight+'px;\n   float:left;\n}\n.titlelinkicon {\n	background-position: 0px top;\n}\n.titlemoveicon {\n	background-position: -'+( 1*titlebuttonwidth )+'px top;\n}\n.titlestaricon {\n	background-position: -'+( 2*titlebuttonwidth )+'px top;\n}\n.titlecopyicon {\n	background-position: -'+( 3*titlebuttonwidth )+'px top;\n}'+
			'.screenbuttonlink { float:right; margin:'+topoffset+'px '+( 0*screenbuttonwidth+leftoffset )+'px 0 0px; }'+
			'.screenbuttonmove { float:right; margin:'+topoffset+'px '+( 1*screenbuttonwidth+leftoffset )+'px 0 0px; }'+
			'.screenbuttonstar { float:right; margin:'+topoffset+'px '+( 2*screenbuttonwidth+leftoffset )+'px 0 0px; }'+
			'.screenbuttoncopy { float:right; margin:'+topoffset+'px '+( 3*screenbuttonwidth+leftoffset )+'px 0 0px; }'+
			'.screenbutton {\n    background-image:url('+self.menuicons+');\n	background-repeat: no-repeat;\n	background-size:'+( screenbuttonwidth*4 )+'px '+( screenbuttonheight*2 )+'px;\n\n	width:'+screenbuttonwidth+'px;\n	height:'+screenbuttonheight+'px;\n   float:left;\n   margin:3px 1px 0 4px;\n}\n.screenlinkicon {\n	background-position: 0px top;\n}\n.screenmoveicon {\n	background-position: -'+( 1*screenbuttonwidth )+'px top;\n}\n.screenstaricon {\n	background-position: -'+( 2*screenbuttonwidth )+'px top;\n}\n.screencopyicon {\n	background-position: -'+( 3*screenbuttonwidth )+'px top;\n}'+
			'</style>' );

		console.log( 'IITC plugin loaded: '+self.title+' version '+self.version );
	};
} // wrapper end

// inject code into site context
var script=document.createElement( 'script' );
var info={};
if ( typeof GM_info!=='undefined'&&GM_info&&GM_info.script ) info.script={ version: GM_info.script.version, name: GM_info.script.name, description: GM_info.script.description };
script.appendChild( document.createTextNode( '('+wrapper+')('+JSON.stringify( info )+');' ) );
( document.body||document.head||document.documentElement ).appendChild( script );
