// ==UserScript==
// @id             slower-zoom-slider
// @name           Slower Zoom Slider
// @category       Controls
// @version        0.3.2
// @description    Custom slower zoom slider plugin for IITC, merged into one file.
// ==/UserScript==

( function() {
	// Define namespace for the plugin
	var zoomSlider={};
	window.plugin=window.plugin||{};
	window.plugin.zoomSlider=zoomSlider;

	// Include L.Control.Zoomslider.js content here (wrapped in an IIFE to avoid conflicts)
	( function() {
		( function( factory ) {
			var L;
			if ( typeof define==='function'&&define.amd ) {
				define( [ 'leaflet' ], factory );
			} else if ( typeof module!=='undefined' ) {
				L=require( 'leaflet' );
				module.exports=factory( L );
			} else {
				if ( typeof window.L==='undefined' ) {
					throw new Error( 'Leaflet must be loaded first' );
				}
				factory( window.L );
			}
		}( function( L ) {
			'use strict';

			L.Control.Zoomslider=( function() {
				var Knob=L.Draggable.extend( {
					// Knob definition remains unchanged
				} );

				var Zoomslider=L.Control.extend( {
					options: {
						position: 'topleft',
						stepHeight: 8,
						knobHeight: 6,
						styleNS: 'leaflet-control-zoomslider'
					},

					onAdd: function( map ) {
						this._map=map;
						this._ui=this._createUI();
						this._knob=new Knob( this._ui.knob, this.options.stepHeight, this.options.knobHeight );

						map.whenReady( this._initKnob, this )
							.whenReady( this._initEvents, this )
							.whenReady( this._updateSize, this )
							.whenReady( this._updateKnobValue, this )
							.whenReady( this._updateDisabled, this );

						return this._ui.bar;
					},

					_zoomIn: function( e ) {
						this._map.zoomIn( e.shiftKey? 1.5:0.5 );
					},
					_zoomOut: function( e ) {
						this._map.zoomOut( e.shiftKey? 1.5:0.5 );
					},

					// Other methods...
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

	// Add CSS for the Zoomslider
	var css=`
        .leaflet-control-zoomslider { background: rgba(255, 255, 255, 0.8); border: 2px solid rgba(0, 0, 0, 0.2); }
        .leaflet-control-zoomslider-in:after { content: "\\002B"; font-size: 16px; }
        .leaflet-control-zoomslider-out:after { content: "\\2212"; font-size: 16px; }
        .leaflet-touch .leaflet-control-zoomslider { border: 2px solid rgba(0,0,0,0.2); }
    `;
	$( '<style>' ).html( css ).appendTo( 'head' );

	// Ensure setup is only called after the map is fully initialized
	function setup() {
		console.log( 'Map loaded, adding zoom slider' );
		var map=window.map;

		if ( !map ) {
			console.error( "Map is not available yet!" );
			return;
		}

		if ( map.zoomControl&&map.zoomControl._map ) {
			map.zoomControl.remove();
		}

		zoomSlider.control=L.control.zoomslider().addTo( map );
		console.log( window.map.zoomsliderControl );  // Check if zoomsliderControl is added

		// Override zoom-in and zoom-out methods
		zoomSlider.control._zoomIn=function( e ) {
			this._map.zoomIn( e.shiftKey? 1.5:0.5 );  // Custom zoom-in rates
		};

		zoomSlider.control._zoomOut=function( e ) {
			this._map.zoomOut( e.shiftKey? 1.5:0.5 );  // Custom zoom-out rates
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
