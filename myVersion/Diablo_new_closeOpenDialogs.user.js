// ==UserScript==
// @name         IITC Close Button Accesskey
// @author       DiabloEnMusica
// @version      0.1
// @description  Adds an accesskey to the IITC dialog close button
// @category       Diablo
// @updateURL      https://raw.githubusercontent.com/diacoviello/IngressMyPlugins/main/myVersion/Diablo_closeDialogMenus.user.js
// @downloadURL    https://raw.githubusercontent.com/diacoviello/IngressMyPlugins/main/myVersion/Diablo_closeDialogMenus.user.js
// @match        https://intel.ingress.com/*
// @match        http://intel.ingress.com/*
// @match        https://*.ingress.com/intel*
// @match        http://*.ingress.com/intel*
// @grant        none
// ==/UserScript==

( function() {
	const script=document.createElement( 'script' );
	script.textContent='('+function() {

		document.addEventListener( 'keydown', function( e ) {

			// ignore typing
			if ( e.target&&(
				e.target.tagName==='INPUT'||
				e.target.tagName==='TEXTAREA'||
				e.target.isContentEditable
			) ) return;

			// press ]
			if ( e.key===']' ) {

				// close ALL visible jQuery UI dialogs
				$( '.ui-dialog-content:visible' ).each( function() {
					try {
						$( this ).dialog( 'close' );
					} catch ( err ) { }
				} );
			}
		} );

	}+')();';

	( document.body||document.head||document.documentElement )
		.appendChild( script );
} )();
