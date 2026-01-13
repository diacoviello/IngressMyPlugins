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
		window._preferredActiveIndex=null;

		// --- Helpers ---
		function getVisibleDialogs() {
			// Prioritize modal dialogs
			const modals=$( '.ui-dialog.ui-dialog-modal:visible' );
			const base=modals.length? modals:$( '.ui-dialog:visible' );

			const sorted = base
				.sort( ( a, b ) =>
					parseInt( $( a ).css( 'z-index' ) )-parseInt( $( b ).css( 'z-index' ) )
				)
				.toArray();

			console.log('getVisibleDialogs ->', sorted.length, 'dialogs', sorted.map( d => ({
				title: $( d ).find( '.ui-dialog-title' ).text(),
				z: $( d ).css( 'z-index' )
			}) ) );

			return sorted;
		}

		function outlineActiveDialog() {
			$( '.ui-dialog' ).css( 'outline', '' );
			if ( window._activeDialogIndex<0 ) return;

			const dlg=window._dialogs[ window._activeDialogIndex ];
			if ( !dlg ) return;

			$( dlg ).css( 'outline', '4px solid #ff0044' ); // bright red, not cyan
		}

		function updateDialogs( reason ) {
			window._dialogs=getVisibleDialogs();

			console.log( 'updateDialogs invoked', reason, 'preferredActiveIndex=', window._preferredActiveIndex );

			console.log(
				'Dialogs:',
				window._dialogs.map( d =>
					$( d ).find( '.ui-dialog-title' ).text()
				)
			);

			if ( !window._dialogs.length ) {
				window._activeDialogIndex=-1;
				outlineActiveDialog();
				console.log( 'No dialogs remain' );
				return;
			}

			// If a preferred index was set before a dialog closed, prefer that
			if ( window._preferredActiveIndex!==null && window._dialogs.length ) {
				const idx=Math.max( 0, Math.min( window._preferredActiveIndex, window._dialogs.length-1 ) );
				window._activeDialogIndex=idx;
			} else {
				window._activeDialogIndex=window._dialogs.length-1;
			}

			const dlg=window._dialogs[ window._activeDialogIndex ];

			$( dlg ).find( '.ui-dialog-content' ).dialog( 'moveToTop' );

			outlineActiveDialog();

			console.log(
				'Active dialog:',
				$( dlg ).find( '.ui-dialog-title' ).text(),
				reason? `(after ${reason})`:''
			);
			// clear any preference after use
			window._preferredActiveIndex=null;
		}

		function cycleDialogs( reverse=false ) {
			if ( !window._dialogs.length ) return;

			const len=window._dialogs.length;
			console.log('cycleDialogs called reverse=', reverse, 'currentIndex=', window._activeDialogIndex, 'len=', len );

			window._activeDialogIndex=
				( window._activeDialogIndex+( reverse? -1:1 )+len )%len;

			console.log('cycleDialogs -> new activeIndex=', window._activeDialogIndex );

			const dlg=window._dialogs[ window._activeDialogIndex ];
			if ( !dlg ) return;

			$( dlg ).find( '.ui-dialog-content' ).dialog( 'moveToTop' );

			outlineActiveDialog();

			console.log(
				reverse? 'Cycled backward to dialog:':'Cycled to dialog:',
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

			// Prefer the dialog directly beneath this one in the z-order
			window._preferredActiveIndex = window._activeDialogIndex - 1;
			console.log('closeActiveDialog -> set preferredActiveIndex=', window._preferredActiveIndex );

			$( dlg ).find( '.ui-dialog-content' ).dialog( 'close' );
		}

		window.addHook( 'dialog-opened', function() {
			console.log('hook: dialog-opened');
			setTimeout( () => updateDialogs( 'dialog-opened' ), 0 );
		} );

		window.addHook( 'dialog-closed', function() {
			console.log('hook: dialog-closed');
			setTimeout( () => updateDialogs( 'dialog-closed' ), 0 );
		} );

		// Initialize state if dialogs already exist
		updateDialogs();

		// Fallback: listen to jQuery UI dialog events in case IITC hooks aren't fired
		$( document ).on( 'dialogopen', '.ui-dialog-content', function( e ) {
			console.log( 'jQuery event: dialogopen', $( this ).closest( '.ui-dialog' ).find( '.ui-dialog-title' ).text() );
			setTimeout( () => updateDialogs( 'dialogopen' ), 0 );
		} );

		$( document ).on( 'dialogclose', '.ui-dialog-content', function( e ) {
			console.log( 'jQuery event: dialogclose', $( this ).closest( '.ui-dialog' ).find( '.ui-dialog-title' ).text() );
			setTimeout( () => updateDialogs( 'dialogclose' ), 0 );
		} );

		// Catch clicks on the dialog close button to set preferred index reliably
		$( document ).on( 'click', '.ui-dialog .ui-dialog-titlebar-close', function( e ) {
			const $dlg = $( this ).closest( '.ui-dialog' );
			const title = $dlg.find( '.ui-dialog-title' ).text();
			const dialogs = getVisibleDialogs();
			const idx = dialogs.indexOf( $dlg[0] );
			console.log( 'close-button clicked for', title, 'index=', idx );
			if ( idx>=0 ) {
				window._preferredActiveIndex = idx - 1;
				console.log( 'close-button -> set preferredActiveIndex=', window._preferredActiveIndex );
			}
			setTimeout( () => updateDialogs( 'close-button' ), 50 );
		} );

		// Observe DOM changes as a fallback if dialogs are removed without triggering dialogclose
		try {
			const mo = new MutationObserver( function( muts ) {
				let changed = false;
				for ( const m of muts ) {
					if ( m.addedNodes.length || m.removedNodes.length ) { changed = true; break; }
				}
				if ( changed ) {
					console.log( 'MutationObserver: DOM changed, checking dialogs' );
					setTimeout( () => updateDialogs( 'mutation' ), 0 );
				}
			} );
			mo.observe( document.body, { childList: true, subtree: true } );
		} catch (err) {
			console.warn( 'MutationObserver not available', err );
		}

		// Capturing keydown so 'g' always triggers close (works even when focus is inside inputs)
		document.addEventListener( 'keydown', function( e ) {
			if ( e.key === 'g' || e.key === 'G' ) {
				console.log( 'captured keydown: g' );
				e.stopImmediatePropagation();
				e.preventDefault();
				closeActiveDialog();
			}
		}, true );

		// --- Shortcuts ---
		window.registerShortcut( '>', () => cycleDialogs( false ), 'Cycle dialogs forward' );
		window.registerShortcut( '<', () => cycleDialogs( true ), 'Cycle dialogs backward' );
		window.registerShortcut( 'g', () => { console.log('shortcut: Escape'); closeActiveDialog(); }, 'Close active dialog' );
	}

	if ( window.iitcLoaded ) {
		setup();
	} else {
		window.addHook( 'iitcLoaded', setup );
	}
} )();
