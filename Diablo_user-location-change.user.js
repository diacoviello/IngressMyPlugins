// ==UserScript==
// @name         IITC plugin: User Location Skins (add-on)
// @category     Tweaks
// @version      0.1.0
// @description  Add selectable shapes/icons for the user-location marker
// @match        https://intel.ingress.com/*
// @match        https://intel-x.ingress.com/*
// @grant        none
// ==/UserScript==

function wrapper( plugin_info ) {
	if ( typeof window.plugin!=='function' ) window.plugin=function() {};

	window.plugin.userLocationSkin=function() {};
	var self=window.plugin.userLocationSkin;
	self.id='userLocationSkin';
	self.title='User Location Skins';
	self.version='0.1.0';

	self.setup=function() {
		function tryInit() {
			if ( !window.plugin?.userLocation||!window.plugin.userLocation.marker ) {
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

.user-location .container.mushroom .outer,
.user-location .container.mushroom .inner{ width:32px;height:32px; }
.user-location .container.mushroom svg{ width:32px;height:32px; display:block; }

.user-location .neutral .inner,
.user-location .neutral .outer{ background-color:#aaa; border-color:#aaa; }

.user-location .res   { color:#03baf4; }
.user-location .enl   { color:#1ee681; }
.user-location .neutral { color:#aaa; }
    `;
			const styleEl=document.createElement( 'style' );
			styleEl.textContent=css;
			document.head.appendChild( styleEl );

			const shapeHTML=( teamClass, shape ) => {
				switch ( shape ) {
					case 'square':
						return `<div class="container ${teamClass} square"><div class="outer"></div><div class="inner"></div></div>`;
					case 'bullseye':
						return `<div class="container ${teamClass} bullseye"><div class="outer"></div><div class="inner"></div></div>`;
					case 'mushroom': {
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
					case 'arrow':
						return `<div class="container ${teamClass} arrow"><div class="outer"></div><div class="inner"></div></div>`;
					case 'circle':
					default:
						return `<div class="container ${teamClass} circle"><div class="outer"></div><div class="inner"></div></div>`;
				}
			};

			const getTeamClass=() => {
				const team=window.PLAYER?.team;
				if ( team==='RESISTANCE' ) return 'res';
				if ( team==='ENLIGHTENED' ) return 'enl';
				return 'neutral';
			};

			function applyShape( shape ) {
				const m=UL.marker;
				if ( !m ) return;

				const teamClass=getTeamClass();
				const icon=L.divIcon( {
					iconSize: L.point( 32, 32 ),
					iconAnchor: L.point( 16, 16 ),
					className: 'user-location',
					html: shapeHTML( teamClass, shape )
				} );
				m.setIcon( icon );

				if ( shape==='arrow' ) {
					UL.onOrientationChange( UL.user.direction??null );
				} else {
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

				localStorage.setItem( 'user-location-shape', shape );
			}

			self.setShape=( shape ) => applyShape( String( shape||'' ).toLowerCase() );
			self.getShape=() => localStorage.getItem( 'user-location-shape' )||'circle';
			self.shapes=[ 'circle', 'arrow', 'square', 'bullseye', 'mushroom' ];

			const saved=self.getShape();
			if ( saved&&saved!=='circle' ) applyShape( saved );

			window.addHook&&window.addHook( 'iitcLoaded', () => {
				applyShape( self.getShape() );
			} );

			console.info( '[User Location Skins] Ready. Try: window.plugin.userLocationSkin.setShape("bullseye")' );
		}

		tryInit();
	};

	var setup=self.setup;
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
