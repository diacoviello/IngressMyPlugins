// ==UserScript==
// @id           star-resize@DiabloEnMusica
// @author       DiabloEnMusica
// @name         Enlarge IITC Bookmark Star (Mobile)
// @category     Diablo
// @version      0.1.0
// @downloadURL  https://raw.githubusercontent.com/diacoviello/IngressMyPlugins/main/myVersion/star-resize.user.js
// @uploadURL    https://raw.githubusercontent.com/diacoviello/IngressMyPlugins/main/myVersion/star-resize.user.js
// @match        https://intel.ingress.com/*
// @grant        none
// ==/UserScript==

( function() {
	function wrapper( plugin_info ) {
		plugin_info.pluginId='star-resize@DiabloEnMusica';
		const KEY='iitc_star_size';
		// load or default to 2.5em
		window.plugin.starSizeAdjust={
			size: parseFloat( localStorage[ KEY ]||2.5 )
		};

		// inject or update the CSS
		function applyCSS() {
			const s=window.plugin.starSizeAdjust.size;
			const pad=( s*0.2 ).toFixed( 2 );
			const css=`
        /* bottom-left bookmark star */
        #updatestatus .bkmrksStar {
          font-size: ${s}em !important;
          padding: ${pad}em !important;
          margin: 0 !important;
        }
      `;
			let st=document.getElementById( 'star-size-adjust-style' );
			if ( st ) st.remove();
			st=document.createElement( 'style' );
			st.id='star-size-adjust-style';
			st.innerHTML=css;
			document.head.appendChild( st );
		}

		// show our pane
		function showPane() {
			window.show( 'starSizePane' );
		}
		window.plugin.starSizeAdjust.showPane=showPane;

		// when the pane is opened, build its contents
		function onPaneChanged( pane ) {
			if ( pane!=='starSizePane' ) return;
			const pd=document.getElementById( 'pane-starSizePane' );
			if ( !pd||pd.dataset.init ) return;
			pd.dataset.init='yes';
			pd.innerHTML=`
        <div style="padding:0.5em">
          <h3 style="margin:0 0 0.5em">Bookmark Star Size</h3>
          <input id="ssa-slider" type="range" min="1" max="5" step="0.1"
                 value="${window.plugin.starSizeAdjust.size}">
          <span id="ssa-val">${window.plugin.starSizeAdjust.size.toFixed( 1 )} em</span>
        </div>`;
			const slider=pd.querySelector( '#ssa-slider' );
			const label=pd.querySelector( '#ssa-val' );
			slider.oninput=() => {
				const v=parseFloat( slider.value );
				window.plugin.starSizeAdjust.size=v;
				localStorage[ KEY ]=v;
				applyCSS();
				label.textContent=v.toFixed( 1 )+' em';
			};
		}

		function setup() {
			applyCSS();
			// only on mobile
			if ( window.useAndroidPanes&&window.useAndroidPanes() ) {
				android.addPane( 'starSizePane', 'Star Size', '⭐' );
				window.addHook( 'paneChanged', onPaneChanged );
			} else {
				// if you ever want a desktop button:
				const btn=document.createElement( 'a' );
				btn.innerHTML='⭐';
				btn.title='Star Size';
				btn.onclick=showPane;
				const tb=document.getElementById( 'toolbox' );
				if ( tb ) tb.appendChild( btn );
				// and you could addHook('paneChanged', onPaneChanged) after android.addPane if you also android.addPane on desktop
			}
		}

		if ( window.iitcLoaded ) {
			setup();
		} else {
			document.addEventListener( 'iitcLoaded', setup, false );
		}
	}

	// inject into page
	const s=document.createElement( 'script' );
	s.textContent='('+wrapper+')('+JSON.stringify( {} )+');';
	document.body.appendChild( s );
} )();
