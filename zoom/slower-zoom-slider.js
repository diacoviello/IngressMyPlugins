// ==UserScript==
// @id             slower-zoom-slider
// @name           Slower Zoom Slider
// @category       Controls
// @version        0.3.0
// @description    Custom slower zoom slider plugin for IITC, merged into one file.
// ==/UserScript==

function wrapper( plugin_info ) {
  // ensure plugin framework is there, even if iitc is not yet loaded
  if ( typeof window.plugin!=='function' ) window.plugin=function() { };

( function() {
  // Define namespace for the plugin
  var zoomSlider={};
  window.plugin=window.plugin||{};
  window.plugin.zoomSlider=zoomSlider;

  zoomSlider.options={
    // Height of zoom-slider.png in px
    //stepHeight: 8,
    // Height of the knob div in px (including border)
    //knobHeight: 6,
    //styleNS: 'leaflet-control-zoomslider'
  };

  ( function() {

    // Include L.Control.Zoomslider.js content here (wrapped in an IIFE to avoid conflicts)
    ( function( factory ) {
      // Packaging/modules magic dance
      var L;
      if ( typeof define==='function'&&define.amd ) {
        // AMD
        define( [ 'leaflet' ], factory );
      } else if ( typeof module!=='undefined' ) {
        // Node/CommonJS
        L=require( 'leaflet' );
        module.exports=factory( L );
      } else {
        // Browser globals
        if ( typeof window.L==='undefined' ) {
          throw new Error( 'Leaflet must be loaded first' );
        }
        factory( window.L );
      }
    }( function( L ) {
      'use strict';

      L.Control.Zoomslider=( function() {

        var Knob=L.Draggable.extend( {
          initialize: function( element, stepHeight, knobHeight ) {
            L.Draggable.prototype.initialize.call( this, element, element );
            this._element=element;

            this._stepHeight=stepHeight;
            this._knobHeight=knobHeight;

            this.on( 'predrag', function() {
              this._newPos.x=0;
              this._newPos.y=this._adjust( this._newPos.y );
            }, this );
          },

          _adjust: function( y ) {
            var value=Math.round( this._toValue( y ) );
            value=Math.max( 0, Math.min( this._maxValue, value ) );
            return this._toY( value );
          },

          // y = k*v + m
          _toY: function( value ) {
            return this._k*value+this._m;
          },
          // v = (y - m) / k
          _toValue: function( y ) {
            return ( y-this._m )/this._k;
          },

          setSteps: function( steps ) {
            var sliderHeight=steps*this._stepHeight;
            this._maxValue=steps-1;

            // conversion parameters
            // the conversion is just a common linear function.
            this._k=-this._stepHeight;
            this._m=sliderHeight-( this._stepHeight+this._knobHeight )/2;
          },

          setPosition: function( y ) {
            L.DomUtil.setPosition( this._element,
              L.point( 0, this._adjust( y ) ) );
          },

          setValue: function( v ) {
            this.setPosition( this._toY( v ) );
          },

          getValue: function() {
            return this._toValue( L.DomUtil.getPosition( this._element ).y );
          }
        } );

        var Zoomslider=L.Control.extend( {
          options: {
            position: 'topleft',
            // Height of zoom-slider.png in px
            stepHeight: 8,
            // Height of the knob div in px (including border)
            knobHeight: 6,
            styleNS: 'leaflet-control-zoomslider'
          },

          onAdd: function( map ) {
            this._map=map;
            this._ui=this._createUI();
            this._knob=new Knob( this._ui.knob,
              this.options.stepHeight,
              this.options.knobHeight );

            map.whenReady( this._initKnob, this )
              .whenReady( this._initEvents, this )
              .whenReady( this._updateSize, this )
              .whenReady( this._updateKnobValue, this )
              .whenReady( this._updateDisabled, this );
            return this._ui.bar;
          },

          onRemove: function( map ) {
            map.off( 'zoomlevelschange', this._updateSize, this )
              .off( 'zoomend zoomlevelschange', this._updateKnobValue, this )
              .off( 'zoomend zoomlevelschange', this._updateDisabled, this );
          },

          _createUI: function() {
            var ui={}, ns=this.options.styleNS;

            ui.bar=L.DomUtil.create( 'div', ns+' leaflet-bar' );
            ui.zoomIn=this._createZoomBtn( 'in', 'top', ui.bar );
            ui.wrap=L.DomUtil.create( 'div', ns+'-wrap leaflet-bar-part', ui.bar );
            ui.zoomOut=this._createZoomBtn( 'out', 'bottom', ui.bar );
            ui.body=L.DomUtil.create( 'div', ns+'-body', ui.wrap );
            ui.knob=L.DomUtil.create( 'div', ns+'-knob' );

            L.DomEvent.disableClickPropagation( ui.bar );
            L.DomEvent.disableClickPropagation( ui.knob );

            return ui;
          },
          _createZoomBtn: function( zoomDir, end, container ) {
            var classDef=this.options.styleNS+'-'+zoomDir+
              ' leaflet-bar-part'+
              ' leaflet-bar-part-'+end, link=L.DomUtil.create( 'a', classDef, container );

            link.href='#';
            link.title='Zoom '+zoomDir;

            L.DomEvent.on( link, 'click', L.DomEvent.preventDefault );

            return link;
          },

          _initKnob: function() {
            this._knob.enable();
            this._ui.body.appendChild( this._ui.knob );
          },
          _initEvents: function() {
            this._map
              .on( 'zoomlevelschange', this._updateSize, this )
              .on( 'zoomend zoomlevelschange', this._updateKnobValue, this )
              .on( 'zoomend zoomlevelschange', this._updateDisabled, this );

            L.DomEvent.on( this._ui.body, 'click', this._onSliderClick, this );
            L.DomEvent.on( this._ui.zoomIn, 'click', this._zoomIn, this );
            L.DomEvent.on( this._ui.zoomOut, 'click', this._zoomOut, this );

            this._knob.on( 'dragend', this._updateMapZoom, this );
          },

          _onSliderClick: function( e ) {
            var first=( e.touches&&e.touches.length===1? e.touches[ 0 ]:e ), y=L.DomEvent.getMousePosition( first, this._ui.body ).y;

            this._knob.setPosition( y );
            this._updateMapZoom();
          },

          _zoomIn: function( e ) {
            this._map.zoomIn( e.shiftKey? 2:0.5 );
          },
          _zoomOut: function( e ) {
            this._map.zoomOut( e.shiftKey? 2:0.5 );
          },

          _zoomLevels: function() {
            var zoomLevels=this._map.getMaxZoom()-this._map.getMinZoom()+1;
            return zoomLevels<Infinity? zoomLevels:0;
          },
          _toZoomLevel: function( value ) {
            return value+this._map.getMinZoom();
          },
          _toValue: function( zoomLevel ) {
            return zoomLevel-this._map.getMinZoom();
          },

          _updateSize: function() {
            var steps=this._zoomLevels();

            this._ui.body.style.height=this.options.stepHeight*steps+'px';
            this._knob.setSteps( steps );
          },
          _updateMapZoom: function() {
            this._map.setZoom( this._toZoomLevel( this._knob.getValue() ) );
          },
          _updateKnobValue: function() {
            this._knob.setValue( this._toValue( this._map.getZoom() ) );
          },
          _updateDisabled: function() {
            var zoomLevel=this._map.getZoom(), className=this.options.styleNS+'-disabled';

            L.DomUtil.removeClass( this._ui.zoomIn, className );
            L.DomUtil.removeClass( this._ui.zoomOut, className );

            if ( zoomLevel===this._map.getMinZoom() ) {
              L.DomUtil.addClass( this._ui.zoomOut, className );
            }
            if ( zoomLevel===this._map.getMaxZoom() ) {
              L.DomUtil.addClass( this._ui.zoomIn, className );
            }
          }
        } );

        return Zoomslider;
      } )();

      L.Map.addInitHook( function() {
        if ( this.options.zoomsliderControl ) {
          this.zoomsliderControl=new L.Control.Zoomslider();
          this.addControl( this.zoomsliderControl );
        }
      } );

      L.control.zoomslider=function( options ) {
        return new L.Control.Zoomslider( options );
      };
    } ) );
  } )();

  var css=`
    .leaflet-control-zoomslider { background: rgba(255, 255, 255, 0.8); border: 2px solid rgba(0, 0, 0, 0.2); }
    .leaflet-control-zoomslider-in:after { content: "\\002B"; font-size: 16px; }
    .leaflet-control-zoomslider-out:after { content: "\\2212"; font-size: 16px; }
    .leaflet-touch .leaflet-control-zoomslider { border: 2px solid rgba(0,0,0,0.2); }
    /** Slider **/
    .leaflet-control-zoomslider-wrap {
      padding-top: 5px;
      padding-bottom: 5px;
      background-color: #fff;
      border-bottom: 1px solid #ccc;
    }
    .leaflet-control-zoomslider-body {
      width: 2px;
      border: solid #fff;
      border-width: 0px 9px 0px 9px;
      background-color: black;
      margin: 0 auto;
    }
    .leaflet-control-zoomslider-knob {
      position: relative;
      width: 12px;
      height: 4px;
      background-color: #efefef;
      -webkit-border-radius: 2px;
      border-radius: 2px;
      border: 1px solid #000;
      margin-left: -6px;
    }
    .leaflet-control-zoomslider-body:hover {
      cursor: pointer;
    }
    .leaflet-control-zoomslider-knob:hover {
      cursor: default;
      cursor: -webkit-grab;
      cursor:    -moz-grab;
    }

    .leaflet-dragging .leaflet-control-zoomslider,
    .leaflet-dragging .leaflet-control-zoomslider-wrap,
    .leaflet-dragging .leaflet-control-zoomslider-body,
    .leaflet-dragging .leaflet-control-zoomslider a,
    .leaflet-dragging .leaflet-control-zoomslider a.leaflet-control-zoomslider-disabled,
    .leaflet-dragging .leaflet-control-zoomslider-knob:hover  {
      cursor: move;
      cursor: -webkit-grabbing;
      cursor:    -moz-grabbing;
    }

    /** Leaflet Zoom Styles **/
    .leaflet-container .leaflet-control-zoomslider {
      margin-left: 10px;
      margin-top: 10px;
    }
    .leaflet-control-zoomslider a {
      width: 26px;
      height: 26px;
      text-align: center;
      text-decoration: none;
      color: black;
      display: block;
    }
    .leaflet-control-zoomslider a:hover {
      background-color: #f4f4f4;
    }
    .leaflet-control-zoomslider-in {
      font: bold 18px 'Lucida Console', Monaco, monospace;
    }
    .leaflet-control-zoomslider-in:after{
      content:"\\002B"
    }
    .leaflet-control-zoomslider-out {
      font: bold 22px 'Lucida Console', Monaco, monospace;
    }
    .leaflet-control-zoomslider-out:after{
      content:"\\2212"
    }
    .leaflet-control-zoomslider a.leaflet-control-zoomslider-disabled {
      cursor: default;
      color: #bbb;
    }

    /* Touch */
    .leaflet-touch .leaflet-control-zoomslider-body {
      background-position: 10px 0px;
    }
    .leaflet-touch .leaflet-control-zoomslider-knob {
      width: 16px;
      margin-left: -7px;
    }
    .leaflet-touch .leaflet-control-zoomslider a {
      width: 30px;
      line-height: 30px;
    }
    .leaflet-touch .leaflet-control-zoomslider a:hover {
      width: 30px;
      line-height: 30px;
    }
    .leaflet-touch .leaflet-control-zoomslider-in {
      font-size: 24px;
      line-height: 29px;
    }
    .leaflet-touch .leaflet-control-zoomslider-out {
      font-size: 28px;
      line-height: 30px;
    }
    .leaflet-touch .leaflet-control-zoomslider {
      box-shadow: none;
      border: 4px solid rgba(0,0,0,0.3);
    }

    /* Old IE */

    .leaflet-oldie .leaflet-control-zoomslider-wrap {
      width: 26px;
    }

    .leaflet-oldie .leaflet-control-zoomslider {
      border: 1px solid #999;
    }

    .leaflet-oldie .leaflet-control-zoomslider-in {
      *zoom: expression( this.runtimeStyle['zoom'] = '1', this.innerHTML = '\u002B');
    }
    .leaflet-oldie .leaflet-control-zoomslider-out {
      *zoom: expression( this.runtimeStyle['zoom'] = '1', this.innerHTML = '\u2212');
    }
    `;
  $( '<style>' ).html( css ).appendTo( 'head' );

  // Customize the zoom levels
  function setup() {
    var map=window.map;

    if ( !map ) {
      console.error( "Map is not available yet!" );
      return;
    }

    // Ensure no other zoom control exists
    if ( map.zoomControl&&map.zoomControl._map ) {
      map.zoomControl.remove();
    }

    // Add the custom zoom slider control
    zoomSlider.control=L.control.zoomslider().addTo( map );
    console.log( window.map.zoomsliderControl );

    // Override the zoom methods to change zoom rate
    zoomSlider.control._zoomIn=function( e ) {
      this._map.zoomIn( e.shiftKey? 1.5:0.5 ); // Custom zoom-in rates
    };

    zoomSlider.control._zoomOut=function( e ) {
      this._map.zoomOut( e.shiftKey? 1.5:0.5 ); // Custom zoom-out rates
    };
  }

  // Listen for when the map is fully loaded and initialized
  if ( window.map ) {
    setup();  // If map is already initialized, run setup
  } else {
    // Otherwise, wait for the map to be ready
    window.addEventListener( 'load', function() {
      setup();  // Trigger setup after map load
    } );
  }
} )();
