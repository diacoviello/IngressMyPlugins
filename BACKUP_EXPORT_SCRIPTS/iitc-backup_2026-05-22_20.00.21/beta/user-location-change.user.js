// ==UserScript==
// @name         IITC plugin: User Location Skins (add-on)
// @category     Tweaks
// @version      0.1.0
// @description  Add selectable shapes/icons for the user-location marker
// @match        https://intel.ingress.com/*
// @match        https://intel-x.ingress.com/*
// @grant        none
// ==/UserScript==

( function() {
	function install() {
		if ( !window.plugin?.userLocation||!window.plugin.userLocation.marker ) {
			// Defer until the stock plugin finishes setup.
			window.addHook&&window.addHook( 'pluginUserLocation', function( e ) {
				if ( e?.event==='setup' ) safeInit();
			} );
			return;
		}
		safeInit();
	}

	function safeInit() {
		const UL=window.plugin.userLocation;
		if ( !UL||!UL.marker ) return;

		// ----- CSS for extra shapes (inherits RES/ENL colors the same way) -----
		const css=`
.user-location .container.square .inner,
.user-location .container.square .outer{
  width: 28px; height: 28px; border-radius: 3px; left:2px; top:2px;
}
.user-location .container.square .inner{ transform: scale(0.65); }

.user-location .container.bullseye .outer,
.user-location .container.bullseye .inner{
  position:absolute; border-radius:50%;
}
.user-location .container.bullseye .outer{
  width:32px;height:32px; box-shadow: inset 0 0 0 4px currentColor;
  background: transparent; border-color: transparent;
}
.user-location .container.bullseye .inner{
  width:16px;height:16px; left:8px; top:8px; background: currentColor; border-color: currentColor;
}

/* “mushroom cloud” uses SVG so we just size the box */
.user-location .container.mushroom .outer,
.user-location .container.mushroom .inner{ width:32px;height:32px; }
.user-location .container.mushroom svg{ width:32px;height:32px; display:block; }

.user-location .neutral .inner,
.user-location .neutral .outer{ background-color:#aaa; border-color:#aaa; }

/* Map team to CSS currentColor so SVG can pick it up */
.user-location .res   { color:#03baf4; }
.user-location .enl   { color:#1ee681; }
.user-location .neutral { color:#aaa; }
    `;
		const styleEl=document.createElement( 'style' );
		styleEl.textContent=css;
		document.head.appendChild( styleEl );

		// ----- tiny renderer for each shape -----
		const shapeHTML=( teamClass, shape ) => {
			switch ( shape ) {
				case 'square':
					return `<div class="container ${teamClass} square"><div class="outer"></div><div class="inner"></div></div>`;
				case 'bullseye':
					return `<div class="container ${teamClass} bullseye"><div class="outer"></div><div class="inner"></div></div>`;
				case 'mushroom': {
					// Simple stylized cloud; fills with currentColor (RES/ENL set via .res/.enl)
					const fill='currentColor';
					return `<div class="container ${teamClass} mushroom">
  <div class="outer">
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <path fill="${fill}" d="M16 30c-6 0-10-4-10-9 0-6 6-12 18-12 4 0 8 1 12 3 3-2 7-3 11-3 10 0 17 5 17 12 0 7-6 11-14 11h-6c1 2 2 5 2 7 0 4-3 7-7 7h-8c-4 0-7-3-7-7 0-2 1-5 2-7h-10z"/>
      <rect x="28" y="38" width="8" height="10" rx="3" fill="${fill}"/>
      <rect x="26" y="48" width="12" height="6" rx="3" fill="${fill}"/>
    </svg>
  </div></div>`;
				}
				case 'arrow': // preserve default behavior; container rotates in user-location plugin
					return `<div class="container ${teamClass} arrow"><div class="outer"></div><div class="inner"></div></div>`;
				case 'circle':
				default:
					return `<div class="container ${teamClass} circle"><div class="outer"></div><div class="inner"></div></div>`;
			}
		};

		// Determine team CSS class same way as original plugin
		const getTeamClass=() => {
			const team=window.PLAYER?.team;
			if ( team==='RESISTANCE' ) return 'res';
			if ( team==='ENLIGHTENED' ) return 'enl';
			return 'neutral';
		};

		// Core: replace the marker's icon HTML without breaking follow/compass
		function applyShape( shape ) {
			const m=UL.marker;
			if ( !m ) return;

			// Preserve position/anchor/zIndex; just swap HTML
			const teamClass=getTeamClass();
			const icon=L.divIcon( {
				iconSize: L.point( 32, 32 ),
				iconAnchor: L.point( 16, 16 ),
				className: 'user-location',
				html: shapeHTML( teamClass, shape )
			} );
			m.setIcon( icon );

			// If orientation exists and shape is arrow or compass desired, let the stock plugin re-apply rotation
			if ( shape==='arrow' ) {
				UL.onOrientationChange( UL.user.direction??null );
			} else {
				// Reset any rotation the stock plugin might add
				const iconEl=m._icon;
				if ( iconEl ) {
					const cont=iconEl.querySelector( '.container' );
					if ( cont ) {
						cont.style.webkitTransform='';
						cont.style.transform='';
						cont.classList.remove( 'arrow' );
					}
				}
			}

			// remember
			localStorage.setItem( 'user-location-shape', shape );
		}

		// Public API
		window.plugin.userLocationSkin={
			setShape: ( shape ) => applyShape( String( shape||'' ).toLowerCase() ),
			getShape: () => localStorage.getItem( 'user-location-shape' )||'circle',
			shapes: [ 'circle', 'arrow', 'square', 'bullseye', 'mushroom' ]
		};

		// Auto-apply saved shape after stock plugin builds its marker
		const saved=window.plugin.userLocationSkin.getShape();
		if ( saved&&saved!=='circle' ) applyShape( saved );

		// Keep faction color in sync if they switch accounts/team
		window.addHook&&window.addHook( 'iitcLoaded', () => {
			const current=window.plugin.userLocationSkin.getShape();
			applyShape( current );
		} );

		// Make it easy to test from console:
		console.info( '[User Location Skins] Ready. Try: window.plugin.userLocationSkin.setShape("bullseye")' );
	}

	// Load after IITC finishes boot, but also try immediately in case plugins already loaded
	if ( window.iitcLoaded ) install();
	else ( window.bootPlugins=window.bootPlugins||[] ).push( install );
} )();
