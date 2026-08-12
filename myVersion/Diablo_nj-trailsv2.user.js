// ==UserScript==
// @id nj-trails-overlay-v2
// @author DiabloEnMusica
// @name Trails Overlay
// @category Diablo
// @version 2.3.0.8
// @namespace https://github.com/diacoviello
// @updateURL https://raw.githubusercontent.com/diacoviello/IngressMyPlugins/main/myVersion/Diablo_nj-trails.user.js
// @downloadURL https://raw.githubusercontent.com/diacoviello/IngressMyPlugins/main/myVersion/Diablo_nj-trails.user.js
// @description Hiking/biking trail overlay that sits on top of ANY base layer. Vector tiles from the OpenStreetMap US Tileservice by default, live Overpass as fallback. Real highway=trailhead markers, OpenTrailMap classification rules, use-type filter, styling, glow, portals-near-trail finder.
// @match https://intel.ingress.com/*
// @grant none
// ==/UserScript==

function wrapper ( plugin_info )
{
if ( typeof window.plugin!=='function' ) window.plugin=function() { };

window.plugin.trails=function() { };
var self=window.plugin.trails;

// ======================== CONFIG ========================================
// 'mvt'    -> OSM US vector tiles. Pre-baked, daily rebuild, planet-wide,
//             CDN-cached. No per-pan query, no rate limiting at walking speed.
// 'osm'    -> live Overpass query of the viewport. Kept as a fallback because
//             the tileservice is explicitly labelled experimental.
// 'static' -> one fixed GeoJSON file (legacy NJDEP path).
// On repeated MVT failure the script auto-falls-back to 'osm'.
self.SOURCE='mvt';

self.MVT_URL='https://tiles.openstreetmap.us/vector/sourdough/{z}/{x}/{y}.mvt';
self.MVT_MAXZOOM=15;   // sourdough's native max; above this we overzoom
self.MVT_MINZOOM=11;   // OpenTrailMap's own floor for drawing trails
self.MVT_MAXTILES=64;  // step the tile zoom down rather than exceed this
self.MVT_CONCURRENCY=6;// parallel tile requests in flight

self.STATIC_URL='https://raw.githubusercontent.com/diacoviello/iitc-data/main/nj_trails.geojson';

self.OVERPASS_URLS=[
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass-api.de/api/interpreter'
];

self.MIN_ZOOM=14;
self.DEBOUNCE_MS=400;   // shorter than Overpass mode — tiles are cached
self.TILE_CACHE_MAX=240;

self.NJDEP_FIELDS={ name: 'TRAILNAME', hike: 'HIKE', bike: 'BIKE', horse: 'EQUESTRIAN' };
// ========================================================================

self.LS_KEY='plugin-trails-settings';

self.defaults={
  uses:          { hiking: true, biking: false, horse: false, other: false },
  showInformal:  true,
  showRestricted:false,
  lineColor:     '#ffffff',
  lineOpacity:   0.9,
  lineWeight:    3,
  glow:          true,
  glowColor:     '#fbff00',
  glowOpacity:   0.4,
  glowSize:      4,
  heads:         true,   // real highway=trailhead points
  guideposts:    false,  // information=guidepost / route_marker
  proxMeters:    40,
  minZoom:       self.MIN_ZOOM
};

// ==========================================================================
// Minimal Mapbox Vector Tile reader. No dependencies, no Web Workers, no
// WebGL — so nothing here can trip intel.ingress.com's CSP or fail on an
// older IITC Mobile WebView.
// ==========================================================================
self.MVT=( function ()
{
  function Reader( buf ) { this.b=buf; this.p=0; this.end=buf.length; }

  Reader.prototype.varint=function ()
  {
    var b=this.b, p=this.p, val=0, shift=0, byte;
    do { byte=b[ p++ ]; val+=( byte&0x7f )*Math.pow( 2, shift ); shift+=7; } while ( byte>=0x80 );
    this.p=p; return val;
  };

  Reader.prototype.skip=function ( wire )
  {
    if ( wire===0 ) this.varint();
    else if ( wire===2 ) this.p+=this.varint();
    else if ( wire===5 ) this.p+=4;
    else if ( wire===1 ) this.p+=8;
    else throw new Error( 'MVT: bad wire type '+wire );
  };

  Reader.prototype.bytes=function ()
  {
    var len=this.varint(), start=this.p;
    this.p=start+len;
    return this.b.subarray( start, this.p );
  };

  Reader.prototype.string=function ()
  {
    var raw=this.bytes(), s='', i=0;
    while ( i<raw.length )
    {
      var c=raw[ i++ ];
      if ( c<0x80 ) s+=String.fromCharCode( c );
      else if ( c<0xe0 ) s+=String.fromCharCode( ( ( c&0x1f )<<6 )|( raw[ i++ ]&0x3f ) );
      else if ( c<0xf0 ) s+=String.fromCharCode( ( ( c&0x0f )<<12 )|( ( raw[ i++ ]&0x3f )<<6 )|( raw[ i++ ]&0x3f ) );
      else
      {
        var cp=( ( c&0x07 )<<18 )|( ( raw[ i++ ]&0x3f )<<12 )|( ( raw[ i++ ]&0x3f )<<6 )|( raw[ i++ ]&0x3f );
        cp-=0x10000;
        s+=String.fromCharCode( 0xd800+( cp>>10 ), 0xdc00+( cp&0x3ff ) );
      }
    }
    return s;
  };

  function sub( r ) { return new Reader( r.bytes() ); }

  function readValue( r )
  {
    var out=null;
    while ( r.p<r.end )
    {
      var tag=r.varint(), f=tag>>3, w=tag&7;
      if ( f===1 ) out=r.string();
      else if ( f===2 ) { out=new DataView( r.b.buffer, r.b.byteOffset+r.p, 4 ).getFloat32( 0, true ); r.p+=4; }
      else if ( f===3 ) { out=new DataView( r.b.buffer, r.b.byteOffset+r.p, 8 ).getFloat64( 0, true ); r.p+=8; }
      else if ( f===4||f===5 ) out=r.varint();
      else if ( f===6 ) { var v=r.varint(); out=( v>>>1 )^-( v&1 ); }
      else if ( f===7 ) out=r.varint()!==0;
      else r.skip( w );
    }
    return out;
  }

  function readGeometry( r )
  {
    var parts=[], cur=null, x=0, y=0;
    while ( r.p<r.end )
    {
      var cmdInt=r.varint(), cmd=cmdInt&0x7, count=cmdInt>>3;
      if ( cmd===1 )
      {
        for ( var i=0;i<count;i++ )
        {
          var dx=r.varint(), dy=r.varint();
          x+=( dx>>>1 )^-( dx&1 ); y+=( dy>>>1 )^-( dy&1 );
          cur=[ [ x, y ] ]; parts.push( cur );
        }
      }
      else if ( cmd===2 )
      {
        for ( var j=0;j<count;j++ )
        {
          var ex=r.varint(), ey=r.varint();
          x+=( ex>>>1 )^-( ex&1 ); y+=( ey>>>1 )^-( ey&1 );
          if ( cur ) cur.push( [ x, y ] );
        }
      }
      else if ( cmd===7 ) { if ( cur&&cur.length ) cur.push( [ cur[ 0 ][ 0 ], cur[ 0 ][ 1 ] ] ); }
      else break;
    }
    return parts;
  }

  function projector( z, tx, ty, extent )
  {
    var n=Math.pow( 2, z );
    return function ( px, py )
    {
      var wx=( tx+px/extent )/n, wy=( ty+py/extent )/n;
      return [ wx*360-180, 180/Math.PI*Math.atan( Math.sinh( Math.PI*( 1-2*wy ) ) ) ];
    };
  }

  function decode( arrayBuffer, z, tx, ty, opts )
  {
    opts=opts||{};
    var want=opts.layers||null;
    var keep=opts.filter||function () { return true; };
    var feats=[];
    var r=new Reader( new Uint8Array( arrayBuffer ) );

    while ( r.p<r.end )
    {
      var tag=r.varint(), f=tag>>3, w=tag&7;
      if ( f!==3 ) { r.skip( w ); continue; }
      var lr=sub( r );

      var name='', extent=4096, keys=[], values=[], rawFeatures=[];
      while ( lr.p<lr.end )
      {
        var lt=lr.varint(), lf=lt>>3, lw=lt&7;
        if ( lf===1 ) name=lr.string();
        else if ( lf===2 ) rawFeatures.push( lr.bytes() );
        else if ( lf===3 ) keys.push( lr.string() );
        else if ( lf===4 ) values.push( readValue( sub( lr ) ) );
        else if ( lf===5 ) extent=lr.varint();
        else lr.skip( lw );
      }

      if ( want&&want.indexOf( name )<0 ) continue;
      var project=projector( z, tx, ty, extent );

      for ( var i=0;i<rawFeatures.length;i++ )
      {
        var fr=new Reader( rawFeatures[ i ] );
        var props={}, gtype=0, geomBytes=null, id=null;
        while ( fr.p<fr.end )
        {
          var ft=fr.varint(), ff=ft>>3, fw=ft&7;
          if ( ff===1 ) id=fr.varint();
          else if ( ff===2 )
          {
            var tr=sub( fr );
            while ( tr.p<tr.end )
            {
              var ki=tr.varint(), vi=tr.varint();
              if ( keys[ ki ]!==undefined ) props[ keys[ ki ] ]=values[ vi ];
            }
          }
          else if ( ff===3 ) gtype=fr.varint();
          else if ( ff===4 ) geomBytes=fr.bytes();
          else fr.skip( fw );
        }
        if ( !geomBytes||gtype===0 ) continue;

        var kind=gtype===1? 'Point':gtype===2? 'LineString':'Polygon';
        if ( !keep( props, kind, name ) ) continue;

        var parts=readGeometry( new Reader( geomBytes ) );
        if ( !parts.length ) continue;

        var coords=parts.map( function ( part )
        {
          return part.map( function ( p ) { return project( p[ 0 ], p[ 1 ] ); } );
        } );

        var geom;
        if ( gtype===1 )
        {
          var pts=[];
          coords.forEach( function ( c ) { c.forEach( function ( p ) { pts.push( p ); } ); } );
          geom=pts.length===1? { type: 'Point', coordinates: pts[ 0 ] }
                             : { type: 'MultiPoint', coordinates: pts };
        }
        else if ( gtype===2 )
        {
          geom=coords.length===1? { type: 'LineString', coordinates: coords[ 0 ] }
                                : { type: 'MultiLineString', coordinates: coords };
        }
        else geom={ type: 'Polygon', coordinates: coords };

        props._layer=name;
        feats.push( { type: 'Feature', id: id, properties: props, geometry: geom } );
      }
    }
    return feats;
  }

  return { decode: decode };
} )();

// -- settings load/save ----------------------------------------------------
self.loadSettings=function()
{
  var s={};
  try { s=JSON.parse( localStorage.getItem( self.LS_KEY ) )||{}; } catch ( e ) { }
  self.s=Object.assign( {}, self.defaults, s );
  self.s.uses=Object.assign( {}, self.defaults.uses, s.uses||{} );
};

self.saveSettings=function()
{
  try { localStorage.setItem( self.LS_KEY, JSON.stringify( self.s ) ); } catch ( e ) { }
};

// ==========================================================================
// Classification — ported from OpenTrailMap's style.json filters.
//
// The old rule ("any highway=footway is hiking") painted every suburban
// sidewalk and crossing as a trail. OTM's rule is surface-aware: a path or
// bridleway counts unless it is explicitly paved; a footway or cycleway
// counts only when explicitly unpaved. That is the whole difference between
// signal and noise at z14 in a developed county.
// ==========================================================================
self.RESTRICTED=[ 'private', 'no', 'discouraged' ];

self.isTrail=function( p )
{
  p=p||{};
  var hw=p.highway;
  if ( hw==='via_ferrata' ) return true;
  if ( ( hw==='path'||hw==='bridleway' )&&p.surface!=='paved' ) return true;
  if ( ( hw==='footway'||hw==='cycleway' )&&p.surface==='unpaved' )
  {
    // sidewalks and crossings are never trails, however they're surfaced
    return p.footway!=='sidewalk'&&p.footway!=='crossing';
  }
  return false;
};

self.classifyOSM=function( tags )
{
  tags=tags||{};
  var hw=tags.highway||'';
  var foot=tags.foot, bike=tags.bicycle, horse=tags.horse, mtb=tags.mtb;
  var ok=function( v ) { return v==='yes'||v==='designated'||v==='permissive'; };
  var blocked=function( v ) { return self.RESTRICTED.indexOf( v )>=0; };
  var footHW=[ 'path', 'footway', 'steps', 'bridleway', 'via_ferrata', 'track' ];
  var uses=[];

  if ( !blocked( foot )&&( footHW.indexOf( hw )>=0||ok( foot ) ) ) uses.push( 'hiking' );
  if ( !blocked( bike )&&( hw==='cycleway'||ok( bike )||ok( mtb ) ) )  uses.push( 'biking' );
  if ( !blocked( horse )&&( hw==='bridleway'||ok( horse ) ) )          uses.push( 'horse' );
  if ( !uses.length ) uses.push( 'other' );
  return uses;
};

self.classifyNJDEP=function( p )
{
  p=p||{};
  var f=self.NJDEP_FIELDS, yes=function( v ) { return v==='Y'||v==='Yes'||v===1||v==='1'||v===true; };
  var uses=[];
  if ( yes( p[ f.hike ] ) ) uses.push( 'hiking' );
  if ( yes( p[ f.bike ] ) ) uses.push( 'biking' );
  if ( yes( p[ f.horse ] ) ) uses.push( 'horse' );
  if ( !uses.length ) uses.push( 'other' );
  return uses;
};

// -- normalize any source into a tagged FeatureCollection ------------------
self.tagFeature=function( f, tags )
{
  var p=f.properties||( f.properties={} );
  p._uses=self.classifyOSM( tags );
  p._name=tags.name||'Unnamed path';
  p._informal=tags.informal==='yes';
  p._restricted=self.RESTRICTED.indexOf( tags.access )>=0;
  return f;
};

self.osmToFc=function( osm )
{
  var feats=[];
  ( osm.elements||[] ).forEach( function( el )
  {
    if ( el.type!=='way'||!el.geometry||el.geometry.length<2 ) return;
    if ( !self.isTrail( el.tags ) ) return;
    var coords=el.geometry.map( function( g ) { return [ g.lon, g.lat ]; } );
    feats.push( self.tagFeature( {
      type: 'Feature', properties: {},
      geometry: { type: 'LineString', coordinates: coords }
    }, el.tags||{} ) );
  } );
  return { type: 'FeatureCollection', features: feats };
};

self.staticToFc=function( gj )
{
  ( gj.features||[] ).forEach( function( f )
  {
    var p=f.properties||( f.properties={} );
    p._uses=self.classifyNJDEP( p );
    p._name=p[ self.NJDEP_FIELDS.name ]||p.NAME||'Unnamed trail';
    p._informal=false; p._restricted=false;
  } );
  return gj;
};

self.passesFilter=function( f )
{
  var p=f.properties||{};
  if ( p._informal&&!self.s.showInformal ) return false;
  if ( p._restricted&&!self.s.showRestricted ) return false;
  var u=p._uses||[];
  return u.some( function( x ) { return self.s.uses[ x ]; } );
};

// -- styles (read live settings each render) -------------------------------
self.lineStyle=function( f )
{
  var p=( f&&f.properties )||{};
  var st={
    color: self.s.lineColor,
    opacity: p._restricted? self.s.lineOpacity*0.5:self.s.lineOpacity,
    weight: p._informal? Math.max( 1, self.s.lineWeight-1 ):self.s.lineWeight,
    lineCap: 'round', lineJoin: 'round'
  };
  if ( p._informal ) st.dashArray='2,6';
  else if ( p._restricted ) st.dashArray='8,4';
  return st;
};

self.glowStyle=function()
{
  return {
    color: self.s.glowColor, opacity: self.s.glowOpacity,
    weight: self.s.lineWeight+self.s.glowSize*2,
    lineCap: 'round', lineJoin: 'round'
  };
};

// ==========================================================================
// Vector tile fetching
// ==========================================================================
self._tiles={};      // 'z/x/y' -> { lines:[], heads:[] }
self._tileOrder=[];  // insertion order, for eviction

self.lon2tile=function( lon, z ) { return Math.floor( ( lon+180 )/360*Math.pow( 2, z ) ); };
self.lat2tile=function( lat, z )
{
  lat=Math.max( -85.0511, Math.min( 85.0511, lat ) );
  var r=lat*Math.PI/180;
  return Math.floor( ( 1-Math.log( Math.tan( r )+1/Math.cos( r ) )/Math.PI )/2*Math.pow( 2, z ) );
};

self.tilesAtZoom=function( bounds, z )
{
  var n=Math.pow( 2, z );
  var x0=self.lon2tile( bounds.getWest(), z ), x1=self.lon2tile( bounds.getEast(), z );
  var y0=self.lat2tile( bounds.getNorth(), z ), y1=self.lat2tile( bounds.getSouth(), z );
  var out=[];
  for ( var x=x0;x<=x1;x++ )
  {
    for ( var y=y0;y<=y1;y++ )
    {
      if ( y<0||y>=n ) continue;
      out.push( { z: z, x: ( ( x%n )+n )%n, y: y } );
    }
  }
  return out;
};

// Which tiles cover the current view?
//
// Two clamps, in both directions. Above the tileset's max zoom we overzoom —
// a z18 view reuses z15 tiles, and the geometry is identical. Below that, a
// wide desktop viewport at map zoom 14 wants ~22 z14 tiles, so we step the
// tile zoom down until the request count is sane. Sourdough culls small
// features by _minzoom on the way down, which is why the floor is 11: that's
// where OpenTrailMap itself starts drawing trails.
self.tilesForBounds=function( bounds, mapZoom )
{
  var z=Math.min( Math.floor( mapZoom ), self.MVT_MAXZOOM );
  var tiles=self.tilesAtZoom( bounds, z );
  while ( tiles.length>self.MVT_MAXTILES&&z>self.MVT_MINZOOM )
  {
    z--;
    tiles=self.tilesAtZoom( bounds, z );
  }
  return tiles;
};

self.cacheTile=function( key, val )
{
  if ( !self._tiles[ key ] ) self._tileOrder.push( key );
  self._tiles[ key ]=val;
  while ( self._tileOrder.length>self.TILE_CACHE_MAX )
  {
    delete self._tiles[ self._tileOrder.shift() ];
  }
};

self.fetchTile=function( t )
{
  var key=t.z+'/'+t.x+'/'+t.y;
  if ( self._tiles[ key ] ) return Promise.resolve( self._tiles[ key ] );

  var url=self.MVT_URL.replace( '{z}', t.z ).replace( '{x}', t.x ).replace( '{y}', t.y );
  return fetch( url, { cache: 'default' } )
    .then( function( r )
    {
      if ( r.status===204 ) return null;          // empty tile
      if ( !r.ok ) throw new Error( 'HTTP '+r.status );
      return r.arrayBuffer();
    } )
    .then( function( ab )
    {
      var out={ lines: [], heads: [] };
      if ( ab&&ab.byteLength )
      {
        var raw=self.MVT.decode( ab, t.z, t.x, t.y, {
          layers: [ 'highways', 'tourism' ],
          filter: function( p, kind, layer )
          {
            if ( layer==='highways' )
            {
              if ( kind==='Point' ) return p.highway==='trailhead';
              if ( kind==='LineString' ) return self.isTrail( p );
              return false;
            }
            // tourism: guideposts / route markers
            return kind==='Point'&&p.tourism==='information'
                && ( p.information==='guidepost'||p.information==='route_marker' );
          }
        } );

        raw.forEach( function( f )
        {
          var p=f.properties;
          if ( f.geometry.type==='Point'||f.geometry.type==='MultiPoint' )
          {
            out.heads.push( f );
          }
          else
          {
            out.lines.push( self.tagFeature( { type: 'Feature', properties: {}, geometry: f.geometry }, p ) );
          }
        } );
      }
      self.cacheTile( key, out );
      return out;
    } );
};

// Run fn over items with at most `limit` in flight. A full-screen desktop
// view at z15 is ~40 tiles; firing all of them at once is rude to a
// donation-funded tileserver and gains nothing over a small window.
self.pool=function( items, limit, fn )
{
  var i=0, out=new Array( items.length );
  return new Promise( function( resolve )
  {
    var active=0, done=0;
    if ( !items.length ) return resolve( out );
    var next=function()
    {
      while ( active<limit&&i<items.length )
      {
        ( function( idx )
        {
          active++; i++;
          fn( items[ idx ] ).then( function( r ) { out[ idx ]=r; } )
            .catch( function() { out[ idx ]=null; } )
            .then( function()
            {
              active--; done++;
              if ( done===items.length ) resolve( out ); else next();
            } );
        } )( i );
      }
    };
    next();
  } );
};

self.fetchMVT=function()
{
  if ( map.getZoom()<self.s.minZoom )
  {
    self.fc={ type: 'FeatureCollection', features: [] };
    self.heads=[];
    self.render();
    self.setStatus( 'Zoom in to load trails (zoom '+self.s.minZoom+'+)' );
    return;
  }

  var tiles=self.tilesForBounds( map.getBounds(), map.getZoom() );
  if ( tiles.length>self.MVT_MAXTILES )
  {
    self.setStatus( 'View too wide ('+tiles.length+' tiles) — zoom in' );
    return;
  }

  var gen=++self._gen;
  var tz=tiles[ 0 ].z;
  self.setStatus( 'Loading '+tiles.length+' tile'+( tiles.length===1? '':'s' )
    +( tz<Math.min( Math.floor( map.getZoom() ), self.MVT_MAXZOOM )? ' at z'+tz+' (reduced detail)':'' )+'…' );

  self.pool( tiles, self.MVT_CONCURRENCY, function( t )
  {
    return self.fetchTile( t ).catch( function( e )
    {
      console.warn( '[Trails] tile '+t.z+'/'+t.x+'/'+t.y+' failed:', e&&e.message||e );
      return null;
    } );
  } ).then( function( results )
  {
    if ( gen!==self._gen ) return;   // a newer pan superseded this one

    var ok=results.filter( Boolean );
    if ( !ok.length )
    {
      self._mvtFails=( self._mvtFails||0 )+1;
      if ( self._mvtFails>=2 )
      {
        console.warn( '[Trails] vector tiles unreachable — falling back to live Overpass' );
        self.setStatus( 'Tileservice unreachable — using live OSM' );
        self.SOURCE='osm';
        self.fetchOSM();
      }
      else self.setStatus( 'Tile request failed — retrying on next pan' );
      return;
    }
    self._mvtFails=0;

    // Deduplicate: a way clipped across a tile seam appears in both tiles.
    // Keying on name + rounded first/last coord is cheap and good enough to
    // stop double-drawn glow without a full geometry hash.
    var seen={}, lines=[], heads=[];
    ok.forEach( function( t )
    {
      t.lines.forEach( function( f )
      {
        var c=f.geometry.type==='LineString'? f.geometry.coordinates
            : ( f.geometry.coordinates[ 0 ]||[] );
        if ( !c.length ) return;
        var a=c[ 0 ], b=c[ c.length-1 ];
        var k=f.properties._name+'|'+a[ 0 ].toFixed( 5 )+','+a[ 1 ].toFixed( 5 )
             +'|'+b[ 0 ].toFixed( 5 )+','+b[ 1 ].toFixed( 5 );
        if ( seen[ k ] ) return;
        seen[ k ]=true;
        lines.push( f );
      } );
      t.heads.forEach( function( f ) { heads.push( f ); } );
    } );

    self.fc={ type: 'FeatureCollection', features: lines };
    self.heads=heads;
    self.render();
  } );
};

// ==========================================================================
// Trailhead / waypoint markers — real OSM points, not line endpoints.
//
// v2 painted a marker at the first and last vertex of every way. OSM splits
// a single trail at every surface change, bridge and boundary, so that drew
// a "trailhead" at each internal junction; and in Overpass mode the bbox clip
// manufactured phantom heads at the viewport edge that moved when you panned.
// highway=trailhead is an actual tag, and sourdough carries it as a point.
// ==========================================================================
self.HEAD_STYLES={
  trailhead:    { fill: '#1f9d55', radius: 6, label: 'Trailhead' },
  guidepost:    { fill: '#3490dc', radius: 4, label: 'Guidepost' },
  route_marker: { fill: '#6574cd', radius: 3, label: 'Route marker' }
};

self.headKind=function( p )
{
  if ( p.highway==='trailhead' ) return 'trailhead';
  if ( p.information==='route_marker' ) return 'route_marker';
  return 'guidepost';
};

self.renderHeads=function()
{
  self.headLayer.clearLayers();
  if ( !self.heads||!self.heads.length ) return;

  var seen={};
  self.heads.forEach( function( f )
  {
    var kind=self.headKind( f.properties );
    if ( kind==='trailhead'&&!self.s.heads ) return;
    if ( kind!=='trailhead'&&!self.s.guideposts ) return;

    var st=self.HEAD_STYLES[ kind ];
    var pts=f.geometry.type==='Point'? [ f.geometry.coordinates ]:f.geometry.coordinates;
    pts.forEach( function( c )
    {
      var key=kind+':'+c[ 1 ].toFixed( 6 )+','+c[ 0 ].toFixed( 6 );
      if ( seen[ key ] ) return;
      seen[ key ]=true;
      var name=f.properties.name||f.properties.ref||st.label;
      self.headLayer.addLayer(
        L.circleMarker( L.latLng( c[ 1 ], c[ 0 ] ), {
          pane: 'njHeads', radius: st.radius, color: '#111', weight: 1,
          fillColor: st.fill, fillOpacity: 0.95
        } ).bindPopup( '<b>'+name+'</b><br>'+st.label )
      );
    } );
  } );
};

// -- (re)render from the cached FeatureCollection --------------------------
self.render=function()
{
  self.glowLayer.clearLayers();
  self.lineLayer.clearLayers();
  self.headLayer.clearLayers();

  if ( map.getZoom()<self.s.minZoom )
  {
    self.setStatus( 'Zoom in to show trails (min zoom '+self.s.minZoom+')' );
    return;
  }
  if ( !self.fc ) return;

  var feats=self.fc.features.filter( self.passesFilter );
  var fc={ type: 'FeatureCollection', features: feats };

  console.log( '[Trails] render: '+self.fc.features.length+' fetched, '
    +feats.length+' pass filter', 'uses=', self.s.uses, 'zoom=', map.getZoom() );

  if ( self.s.glow ) self.glowLayer.addData( fc );
  self.lineLayer.addData( fc );
  self.renderHeads();
  self.applyGlowFilter();

  var nHeads=self.headLayer.getLayers().length;
  self.setStatus( feats.length+' segment(s), '+nHeads+' marker(s) shown' );
};

// -- soft glow via SVG blur on the glow renderer ---------------------------
self.applyGlowFilter=function()
{
  try { if ( self._blur ) self._blur.setAttribute( 'stdDeviation', String( Math.max( 0.01, self.s.glowSize/2 ) ) ); } catch ( e ) { }
  try
  {
    var g=self.glowRenderer&&self.glowRenderer._rootGroup;
    if ( g ) g.setAttribute( 'filter', self.s.glow? 'url(#njtrail-glow)':'' );
  } catch ( e ) { }
};

// -- portals-near-trail finder ---------------------------------------------
self.pointToSeg=function( p, a, b )
{
  var dx=b.x-a.x, dy=b.y-a.y, l2=dx*dx+dy*dy;
  if ( l2===0 ) return Math.sqrt( ( p.x-a.x )*( p.x-a.x )+( p.y-a.y )*( p.y-a.y ) );
  var t=( ( p.x-a.x )*dx+( p.y-a.y )*dy )/l2; t=t<0? 0:t>1? 1:t;
  var cx=a.x+t*dx, cy=a.y+t*dy, ex=p.x-cx, ey=p.y-cy;
  return Math.sqrt( ex*ex+ey*ey );
};

self.findNearbyPortals=function()
{
  self.nearLayer.clearLayers();
  self._results=[];
  if ( !self.fc||!window.portals ) { self.setStatus( 'No trail data / portals loaded' ); self.renderResults(); return; }

  var zoom=map.getZoom();
  var feats=self.fc.features.filter( self.passesFilter );

  var segs=[];
  feats.forEach( function( f )
  {
    var g=f.geometry;
    var lines=g.type==='LineString'? [ g.coordinates ]:g.type==='MultiLineString'? g.coordinates:[];
    lines.forEach( function( line )
    {
      var pts=line.map( function( c ) { return map.project( L.latLng( c[ 1 ], c[ 0 ] ), zoom ); } );
      for ( var i=0;i<pts.length-1;i++ ) segs.push( [ pts[ i ], pts[ i+1 ], f.properties._name ] );
    } );
  } );

  if ( !segs.length ) { self.setStatus( 'No trail segments match the current filter' ); self.renderResults(); return; }

  var thr=self.s.proxMeters, count=0, tested=0;
  for ( var guid in window.portals )
  {
    var pm=window.portals[ guid ], ll;
    try { ll=pm.getLatLng(); } catch ( e ) { continue; }
    if ( !ll ) continue;
    tested++;

    var pp=map.project( ll, zoom );
    var mpp=40075016.686*Math.cos( ll.lat*Math.PI/180 )/( 256*Math.pow( 2, zoom ) );
    var thrPx=thr/mpp;

    var best=Infinity, bestName=null;
    for ( var i=0;i<segs.length;i++ )
    {
      var a=segs[ i ][ 0 ], b=segs[ i ][ 1 ];
      if ( pp.x<Math.min( a.x, b.x )-thrPx||pp.x>Math.max( a.x, b.x )+thrPx ) continue;
      if ( pp.y<Math.min( a.y, b.y )-thrPx||pp.y>Math.max( a.y, b.y )+thrPx ) continue;
      var d=self.pointToSeg( pp, a, b );
      if ( d<best ) { best=d; bestName=segs[ i ][ 2 ]; }
    }

    if ( best<=thrPx )
    {
      var distM=best*mpp;
      var title=( pm.options&&pm.options.data&&pm.options.data.title )||'Portal';
      self._results.push( { guid: guid, ll: ll, distM: distM, title: title, trail: bestName } );
      L.circleMarker( ll, { renderer: self.nearRenderer, radius: 9, color: '#ff00ff', weight: 2, fill: false } )
        .bindPopup( '<b>'+title+'</b><br>'+Math.round( distM )+' m from '+( bestName||'trail' ) )
        .addTo( self.nearLayer );
      count++;
    }
  }

  self._results.sort( function( x, y ) { return x.distM-y.distM; } );
  self.setStatus( tested<5
    ? 'Only '+tested+' portals loaded — zoom in so IITC loads portals, then retry'
    : count+' portal(s) within '+thr+' m of a trail ('+tested+' tested)' );
  self.renderResults();
};

self.gotoPortal=function( guid, ll )
{
  map.setView( ll, Math.max( map.getZoom(), 17 ) );
  try { if ( window.renderPortalDetails ) window.renderPortalDetails( guid ); } catch ( e ) { }
};

self.renderResults=function()
{
  var box=document.getElementById( 'trails-results' );
  if ( !box ) return;
  box.innerHTML='';
  if ( !self._results||!self._results.length ) return;
  self._results.forEach( function( r )
  {
    var row=document.createElement( 'a' );
    row.href='#';
    row.style.cssText='display:block;padding:3px 0;border-bottom:1px solid #333;text-decoration:none;';
    row.textContent=Math.round( r.distM )+' m \u2014 '+r.title;
    row.title=r.trail||'';
    row.addEventListener( 'click', function( ev ) { ev.preventDefault(); self.gotoPortal( r.guid, r.ll ); } );
    box.appendChild( row );
  } );
};

// -- data loading ----------------------------------------------------------
self._gen=0;

self.reload=function()
{
  if ( self.SOURCE==='mvt' ) self.fetchMVT();
  else if ( self.SOURCE==='osm' ) self.fetchOSM();
  else self.fetchStatic();
};

self.scheduleUpdate=function()
{
  if ( self.SOURCE==='static' ) return;
  clearTimeout( self._t );
  self._t=setTimeout( self.reload, self.DEBOUNCE_MS );
};

self.fetchOSM=function()
{
  if ( map.getZoom()<self.s.minZoom )
  {
    self.fc={ type: 'FeatureCollection', features: [] }; self.heads=[]; self.render();
    self.setStatus( 'Zoom in to load trails (zoom '+self.s.minZoom+'+)' );
    return;
  }

  var b=map.getBounds();
  var q='[out:json][timeout:25];'
    +'way["highway"~"^(path|footway|track|cycleway|bridleway|steps|via_ferrata)$"]'
    +'('+b.getSouth()+','+b.getWest()+','+b.getNorth()+','+b.getEast()+');'
    +'out geom;';

  if ( self._ctrl ) self._ctrl.abort();
  self._ctrl=new AbortController();

  var urls=self.OVERPASS_URLS;
  var body='data='+encodeURIComponent( q );

  var attempt=function( i )
  {
    if ( i>=urls.length ) return;
    self.setStatus( 'Loading from OSM…'+( i? ' (mirror '+( i+1 )+'/'+urls.length+')':'' ) );
    return fetch( urls[ i ], { method: 'POST', body: body, signal: self._ctrl.signal } )
      .then( function( r ) { if ( !r.ok ) throw new Error( 'HTTP '+r.status ); return r.json(); } )
      .then( function( osm ) { self.fc=self.osmToFc( osm ); self.heads=[]; self.render(); } )
      .catch( function( e )
      {
        if ( e.name==='AbortError' ) throw e;
        if ( i+1<urls.length ) return attempt( i+1 );
        throw e;
      } );
  };

  attempt( 0 ).catch( function( e )
  {
    if ( e.name==='AbortError' ) return;
    console.error( '[Trails]', e );
    self.setStatus( ( ''+( e&&e.message||e ) ).indexOf( 'HTTP 429' )>=0
      ? 'Overpass rate-limited (429) — wait a moment and Refresh'
      : 'Overpass error: '+( e&&e.message||e ) );
  } );
};

self.fetchStatic=function()
{
  self.setStatus( 'Loading trail file…' );
  fetch( self.STATIC_URL, { cache: 'force-cache' } )
    .then( function( r ) { if ( !r.ok ) throw new Error( 'HTTP '+r.status ); return r.json(); } )
    .then( function( gj )
    {
      self.fc=self.staticToFc( gj ); self.heads=[];
      console.log( '[Trails] static: '+( ( self.fc.features||[] ).length )+' features from '+self.STATIC_URL );
      self.render();
    } )
    .catch( function( e )
    {
      console.warn( '[Trails] static file failed ('+( e&&e.message||e )+') — falling back to vector tiles' );
      self.setStatus( 'Trail file unavailable — using vector tiles' );
      self.SOURCE='mvt';
      self.fetchMVT();
    } );
};

// -- settings panel --------------------------------------------------------
self.setStatus=function( msg )
{
  self._status=msg;
  var el=document.getElementById( 'trails-status' );
  if ( el ) el.textContent=msg;
};

self.row=function( labelText, control )
{
  var d=document.createElement( 'div' );
  d.style.cssText='display:flex;align-items:center;justify-content:space-between;margin:6px 0;gap:8px;';
  var l=document.createElement( 'label' ); l.textContent=labelText; l.style.flex='1';
  d.appendChild( l ); d.appendChild( control ); return d;
};

self.checkbox=function( checked, onchange )
{
  var c=document.createElement( 'input' ); c.type='checkbox'; c.checked=checked;
  c.addEventListener( 'change', function() { onchange( c.checked ); } ); return c;
};

self.colorInput=function( val, onchange )
{
  var c=document.createElement( 'input' ); c.type='color'; c.value=val;
  c.addEventListener( 'input', function() { onchange( c.value ); } ); return c;
};

self.range=function( val, min, max, step, onchange )
{
  var c=document.createElement( 'input' ); c.type='range';
  c.min=min; c.max=max; c.step=step; c.value=val; c.style.width='130px';
  c.addEventListener( 'input', function() { onchange( parseFloat( c.value ) ); } ); return c;
};

self.header=function( text )
{
  var d=document.createElement( 'div' );
  d.textContent=text;
  d.style.cssText='font-weight:bold;margin-top:10px;';
  return d;
};

self.buildPanel=function()
{
  var s=self.s;
  var root=document.createElement( 'div' );
  root.style.cssText='min-width:250px;font-size:13px;';
  var commit=function() { self.saveSettings(); self.render(); };

  // -- data source
  var srcHdr=self.header( 'Data source' ); srcHdr.style.marginTop='2px';
  root.appendChild( srcHdr );
  var sel=document.createElement( 'select' );
  [ [ 'mvt', 'Vector tiles (OSM US)' ], [ 'osm', 'Live Overpass' ], [ 'static', 'Static file (NJDEP)' ] ]
    .forEach( function( o )
    {
      var opt=document.createElement( 'option' );
      opt.value=o[ 0 ]; opt.textContent=o[ 1 ];
      if ( self.SOURCE===o[ 0 ] ) opt.selected=true;
      sel.appendChild( opt );
    } );
  sel.addEventListener( 'change', function()
  {
    self.SOURCE=sel.value;
    self._mvtFails=0;
    map.off( 'moveend', self.scheduleUpdate );
    if ( self.SOURCE!=='static' ) map.on( 'moveend', self.scheduleUpdate );
    self.reload();
  } );
  root.appendChild( self.row( 'Source', sel ) );

  // -- use types
  root.appendChild( self.header( 'Show trail types' ) );
  [ [ 'hiking', 'Hiking / footpaths' ], [ 'biking', 'Biking / cycleways' ],
    [ 'horse', 'Equestrian' ], [ 'other', 'Other / unclassified' ] ].forEach( function( u )
  {
    root.appendChild( self.row( u[ 1 ], self.checkbox( s.uses[ u[ 0 ] ], function( v ) { s.uses[ u[ 0 ] ]=v; commit(); } ) ) );
  } );
  root.appendChild( self.row( 'Informal (dotted)', self.checkbox( s.showInformal, function( v ) { s.showInformal=v; commit(); } ) ) );
  root.appendChild( self.row( 'Restricted access (dashed)', self.checkbox( s.showRestricted, function( v ) { s.showRestricted=v; commit(); } ) ) );

  // -- visibility
  root.appendChild( self.header( 'Visibility' ) );
  var zoomVal=document.createElement( 'span' );
  zoomVal.textContent=s.minZoom;
  zoomVal.style.cssText='min-width:20px;text-align:right;';
  var zoomSlider=self.range( s.minZoom, 8, 19, 1, function( v )
  {
    s.minZoom=v; zoomVal.textContent=v; self.saveSettings(); self.reload();
  } );
  zoomSlider.style.width='105px';
  var zoomWrap=document.createElement( 'div' );
  zoomWrap.style.cssText='display:flex;align-items:center;gap:6px;';
  zoomWrap.appendChild( zoomSlider ); zoomWrap.appendChild( zoomVal );
  root.appendChild( self.row( 'Min zoom to show', zoomWrap ) );

  // -- line
  root.appendChild( self.header( 'Trail line' ) );
  root.appendChild( self.row( 'Color', self.colorInput( s.lineColor, function( v ) { s.lineColor=v; commit(); } ) ) );
  root.appendChild( self.row( 'Opacity', self.range( s.lineOpacity, 0.1, 1, 0.05, function( v ) { s.lineOpacity=v; commit(); } ) ) );
  root.appendChild( self.row( 'Weight', self.range( s.lineWeight, 1, 8, 0.5, function( v ) { s.lineWeight=v; commit(); } ) ) );

  // -- glow
  root.appendChild( self.header( 'Glow' ) );
  root.appendChild( self.row( 'Enabled', self.checkbox( s.glow, function( v ) { s.glow=v; commit(); } ) ) );
  root.appendChild( self.row( 'Color', self.colorInput( s.glowColor, function( v ) { s.glowColor=v; commit(); } ) ) );
  root.appendChild( self.row( 'Opacity', self.range( s.glowOpacity, 0.05, 1, 0.05, function( v ) { s.glowOpacity=v; commit(); } ) ) );
  root.appendChild( self.row( 'Size', self.range( s.glowSize, 1, 20, 1, function( v ) { s.glowSize=v; commit(); } ) ) );

  // -- markers
  root.appendChild( self.header( 'Markers' ) );
  root.appendChild( self.row( 'Trailheads', self.checkbox( s.heads, function( v ) { s.heads=v; commit(); } ) ) );
  root.appendChild( self.row( 'Guideposts & route markers', self.checkbox( s.guideposts, function( v ) { s.guideposts=v; commit(); } ) ) );
  var note=document.createElement( 'div' );
  note.textContent='Markers come from tagged OSM points and need the vector tile source.';
  note.style.cssText='color:#888;font-size:11px;margin:-2px 0 4px;';
  root.appendChild( note );

  // -- portal finder
  root.appendChild( self.header( 'Portal finder' ) );
  root.appendChild( self.row( 'Search radius (m)', self.range( s.proxMeters, 5, 150, 5, function( v ) { s.proxMeters=v; self.saveSettings(); } ) ) );
  var findBtn=document.createElement( 'button' ); findBtn.textContent='Find portals near trails';
  findBtn.style.cssText='width:100%;margin-top:4px;';
  findBtn.addEventListener( 'click', self.findNearbyPortals );
  root.appendChild( findBtn );

  var resultsBox=document.createElement( 'div' );
  resultsBox.id='trails-results';
  resultsBox.style.cssText='margin-top:8px;max-height:170px;overflow:auto;';
  root.appendChild( resultsBox );

  var status=document.createElement( 'div' );
  status.id='trails-status'; status.textContent=self._status||'';
  status.style.cssText='margin-top:10px;color:#aaa;font-style:italic;';
  root.appendChild( status );

  var btns=document.createElement( 'div' ); btns.style.cssText='margin-top:10px;display:flex;gap:8px;';
  var reset=document.createElement( 'button' ); reset.textContent='Reset';
  reset.addEventListener( 'click', function()
  {
    self.s=JSON.parse( JSON.stringify( self.defaults ) );
    self.saveSettings(); self.render();
    self.dialogApi&&self.dialogApi.dialog&&self.dialogApi.dialog( 'close' );
    self.openPanel();
  } );
  var refresh=document.createElement( 'button' ); refresh.textContent='Refresh data';
  refresh.addEventListener( 'click', function()
  {
    self._tiles={}; self._tileOrder=[]; self._mvtFails=0;
    self.reload();
  } );
  btns.appendChild( refresh ); btns.appendChild( reset );
  root.appendChild( btns );

  var attr=document.createElement( 'div' );
  attr.innerHTML='Trail data \u00a9 <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> '
    +'contributors. Tiles by <a href="https://openstreetmap.us/our-work/tileservice/" target="_blank">OpenStreetMap US</a>.';
  attr.style.cssText='margin-top:10px;color:#777;font-size:11px;line-height:1.4;';
  root.appendChild( attr );

  return root;
};

self.openPanel=function()
{
  self.dialogApi=window.dialog( {
    title: 'Trails Overlay',
    html: self.buildPanel(),
    id: 'plugin-trails-panel',
    width: 'auto'
  } );
  self.renderResults();
};

// -- setup -----------------------------------------------------------------
self.setup=function()
{
  self.loadSettings();

  // Panes keep order glow < lines < heads, all above the base tiles
  // (tilePane = 200) but below Leaflet's overlayPane (400) where IITC draws
  // portals, links and fields — so trails never cover or block a portal.
  map.createPane( 'njGlow' ).style.zIndex=210;
  map.createPane( 'njLines' ).style.zIndex=220;
  map.createPane( 'njHeads' ).style.zIndex=230;
  map.createPane( 'njNear' ).style.zIndex=590;

  self.glowRenderer=L.svg( { pane: 'njGlow' } ); self.glowRenderer.addTo( map );
  self.lineRenderer=L.svg( { pane: 'njLines' } ); self.lineRenderer.addTo( map );

  try
  {
    var ns='http://www.w3.org/2000/svg';
    var svg=self.glowRenderer._container;
    var defs=document.createElementNS( ns, 'defs' );
    var filt=document.createElementNS( ns, 'filter' );
    filt.setAttribute( 'id', 'njtrail-glow' );
    filt.setAttribute( 'x', '-50%' ); filt.setAttribute( 'y', '-50%' );
    filt.setAttribute( 'width', '200%' ); filt.setAttribute( 'height', '200%' );
    self._blur=document.createElementNS( ns, 'feGaussianBlur' );
    self._blur.setAttribute( 'stdDeviation', String( self.s.glowSize/2 ) );
    filt.appendChild( self._blur ); defs.appendChild( filt ); svg.appendChild( defs );
  } catch ( e ) { console.warn( '[Trails] glow filter unavailable, using flat glow', e ); }

  self.glowLayer=new L.GeoJSON( null, { renderer: self.glowRenderer, style: self.glowStyle, interactive: false } );
  self.lineLayer=new L.GeoJSON( null, {
    renderer: self.lineRenderer, style: self.lineStyle,
    onEachFeature: function( f, layer )
    {
      var p=f.properties||{};
      var extra=[];
      if ( p._informal ) extra.push( 'informal' );
      if ( p._restricted ) extra.push( 'restricted access' );
      layer.bindPopup( '<b>'+( p._name||'Trail' )+'</b>'
        +( extra.length? '<br><i>'+extra.join( ', ' )+'</i>':'' ) );
    }
  } );
  self.headLayer=new L.LayerGroup();

  self.nearRenderer=L.svg( { pane: 'njNear' } ); self.nearRenderer.addTo( map );
  self.nearLayer=new L.LayerGroup();

  window.addLayerGroup( 'Trails (lines + glow)', L.layerGroup( [ self.glowLayer, self.lineLayer ] ), true );
  window.addLayerGroup( 'Trailheads & waypoints', self.headLayer, true );
  window.addLayerGroup( 'Portals near trails', self.nearLayer, true );

  // Attribution is a condition of using the tileservice, not a nicety.
  try
  {
    if ( map.attributionControl )
    {
      map.attributionControl.addAttribution(
        'Trails: <a href="https://www.openstreetmap.org/copyright" target="_blank">OSM</a>'
        +' / <a href="https://openstreetmap.us/our-work/tileservice/" target="_blank">OSM US</a>' );
    }
  } catch ( e ) { }

  $( '#toolbox' ).append( $( '<a>', { text: 'Trails', title: 'Trail overlay settings', click: self.openPanel } ) );

  if ( self.SOURCE!=='static' ) map.on( 'moveend', self.scheduleUpdate );
  map.on( 'zoomend', self.render );
  self.reload();
};

var setup=self.setup;
setup.info=plugin_info;
if ( !window.bootPlugins ) window.bootPlugins=[];
window.bootPlugins.push( setup );
if ( window.iitcLoaded ) setup();
}

var script=document.createElement( 'script' );
var info={};
if ( typeof GM_info!=='undefined'&&GM_info&&GM_info.script ) info.script=GM_info.script;
script.appendChild( document.createTextNode( '('+wrapper+')('+JSON.stringify( info )+');' ) );
( document.body||document.head||document.documentElement ).appendChild( script );
