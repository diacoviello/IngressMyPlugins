// ==UserScript==
// @name         closeDialogMenus
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
	'use strict';

	function setup() {
		window._dialogs=[];
		window._activeDialogIndex=-1;

		// --- Helpers ---
		function getVisibleDialogs() {
			// Prioritize modal dialogs
			const modals=$( '.ui-dialog.ui-dialog-modal:visible' );
			const base=modals.length? modals:$( '.ui-dialog:visible' );

			return base
				.sort( ( a, b ) =>
					parseInt( $( a ).css( 'z-index' ) )-parseInt( $( b ).css( 'z-index' ) )
				)
				.toArray();
		}

		function outlineActiveDialog() {
			$( '.ui-dialog' ).css( 'outline', '' );
			if ( window._activeDialogIndex<0 ) return;

			const dlg=window._dialogs[ window._activeDialogIndex ];
			if ( !dlg ) return;

			$( dlg ).css( 'outline', '3px solid #00ffff' ); // bright cyan outline
		}

		function updateDialogs( evt ) {
			const prevIndex=window._activeDialogIndex;

			window._dialogs=getVisibleDialogs();

			if ( !window._dialogs.length ) {
				window._activeDialogIndex=-1;
			} else {
				// Keep previous active index if possible
				if ( prevIndex<0||prevIndex>=window._dialogs.length ) {
					window._activeDialogIndex=window._dialogs.length-1; // topmost
				}
			}

			outlineActiveDialog();

			if ( window._activeDialogIndex>=0 ) {
				console.log(
					'Active dialog:',
					$( window._dialogs[ window._activeDialogIndex ] )
						.find( '.ui-dialog-title' )
						.text()
				);
			}
		}

		function cycleDialogs() {
			if ( !window._dialogs.length ) return;

			window._activeDialogIndex=
				( window._activeDialogIndex+1 )%window._dialogs.length;

			const dlg=window._dialogs[ window._activeDialogIndex ];
			if ( !dlg ) return;

			// Bring to top visually
			$( dlg ).find( '.ui-dialog-content' ).dialog( 'moveToTop' );

			outlineActiveDialog();

			console.log(
				'Cycled to dialog:',
				$( dlg ).find( '.ui-dialog-title' ).text()
			);
		}

		function closeActiveDialog() {
			if ( window._activeDialogIndex<0 ) return;

			const dlg=window._dialogs[ window._activeDialogIndex ];
			if ( !dlg ) return;

			console.log(
				'Closing dialog:',
				$( dlg ).find( '.ui-dialog-title' ).text()
			);

			$( dlg ).find( '.ui-dialog-content' ).dialog( 'close' );
		}

		// --- Event hooks ---
		$( document ).on(
			'dialogopen dialogclose',
			'.ui-dialog-content',
			function( evt ) {
				setTimeout( updateDialogs, 0, evt ); // allow DOM updates
			}
		);

		// Initialize state if dialogs already exist
		updateDialogs();

		// --- Shortcuts ---
		window.registerShortcut( 'Tab', cycleDialogs, 'Cycle open dialogs' );
		window.registerShortcut( 'Escape', closeActiveDialog, 'Close active dialog' );
	}

	if ( window.iitcLoaded ) {
		setup();
	} else {
		window.addHook( 'iitcLoaded', setup );
	}
} )();
