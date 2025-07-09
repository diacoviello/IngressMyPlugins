// ==UserScript==
// @id           enlarge-bookmark-star@yourname
// @author       DiabloEnMusica
// @name         Enlarge IITC Bookmark Star (Mobile)
// @category     Diablo
// @version      0.1.0
// @downloadURL    https://raw.githubusercontent.com/diacoviello/IngressMyPlugins/main/myVersion/star-resize.user.js
// @uploadURL    https://raw.githubusercontent.com/diacoviello/IngressMyPlugins/main/myVersion/star-resize.user.js
// @match        https://intel.ingress.com/*
// @grant        none
// ==/UserScript==

function wrapper( plugin_info ) {
	window.plugin.enlargeBookmarkStar=function() { };
	// load or default to 2.5em
	const cfgKey='enlargeBookmarkStar_size';
	window.plugin.enlargeBookmarkStar.size=parseFloat( localStorage[ cfgKey ]||2.5 );

	function applyCSS() {
		const sz=window.plugin.enlargeBookmarkStar.size;
		const pad=( sz*0.2 ).toFixed( 2 );
		const mgn=( sz*0.2 ).toFixed( 2 );
		const css=`
      .bkmrksStar {
        font-size: ${sz}em !important;
        padding: ${pad}em !important;
        margin: ${mgn}em !important;
      }
      #updatestatus {
        bottom: 12px !important;
        right: 12px !important;
      }
    `;
		// replace old if any
		const old=document.getElementById( 'enlargeBookmarkStar-style' );
		if ( old ) old.remove();
		const style=document.createElement( 'style' );
		style.id='enlargeBookmarkStar-style';
		style.innerHTML=css;
		document.head.appendChild( style );
	}

	function addSliderToOptions( pluginId ) {
		// only when opening Bookmarks options
		if ( pluginId!=='bookmarks' ) return;

		// IITC renders a DIV#plugin-options-bookmarks
		const panel=document.querySelector( '#plugin-options-bookmarks' );
		if ( !panel||panel.querySelector( '.star-size-control' ) ) return;

		const wrapper=document.createElement( 'div' );
		wrapper.className='star-size-control';
		wrapper.style.margin='0.5em 0';

		const label=document.createElement( 'label' );
		label.textContent='Star size: ';
		label.style.marginRight='0.5em';

		const slider=document.createElement( 'input' );
		slider.type='range';
		slider.min='1';
		slider.max='5';
		slider.step='0.1';
		slider.value=window.plugin.enlargeBookmarkStar.size;
		slider.oninput=() => {
			const v=parseFloat( slider.value );
			window.plugin.enlargeBookmarkStar.size=v;
			localStorage[ cfgKey ]=v;
			applyCSS();
		};

		wrapper.appendChild( label );
		wrapper.appendChild( slider );
		panel.appendChild( wrapper );
	}

	function setup() {
		applyCSS();
		// run once if options already open
		if ( window.iitcLoaded ) {
			addSliderToOptions( 'bookmarks' );
		}
		// hook into IITC’s pluginOptions event
		window.addHook( 'pluginOptions', addSliderToOptions );
	}
	setup.info=plugin_info;

	if ( window.iitcLoaded ) {
		setup();
	} else {
		document.addEventListener( 'iitcLoaded', setup, false );
	}
}

const script=document.createElement( 'script' );
script.textContent='('+wrapper+')( '+JSON.stringify( { name: 'enlargeBookmarkStar' } )+' );';
( document.body||document.documentElement ).appendChild( script );
