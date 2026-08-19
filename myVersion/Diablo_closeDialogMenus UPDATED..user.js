// ==UserScript==
// @name         closeDialogMenus
// @author       DiabloEnMusica
// @version      0.2.20260819
// @description  Dialog close/cycle shortcuts (x, >, <) with input-field and modifier guards
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
		console.time('closeDialogMenus');
		window._dialogs=[];
		window._activeDialogIndex=-1;
		window._preferredActiveIndex=null;

		// Verify jQuery is available
		console.log( '=== setup() started ===' );
		console.log( 'jQuery available:', typeof $, '$===jQuery?', $===jQuery );
		console.log( 'document.querySelectorAll(".ui-dialog"):', document.querySelectorAll( '.ui-dialog' ).length );
		console.log( '$(".ui-dialog").length:', $( '.ui-dialog' ).length );

		// --- Helpers ---
		function getVisibleDialogs() {
			// Prioritize modal dialogs
			const modals=$( '.ui-dialog.ui-dialog-modal:visible' );
			const base=modals.length? modals:$( '.ui-dialog:visible' );

			const sorted=base
				.toArray()
				.sort( ( a, b ) =>
					( parseInt( $( a ).css( 'z-index' ), 10 )||0 )-
					( parseInt( $( b ).css( 'z-index' ), 10 )||0 )
				);

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

		// Register IITC hooks if available
		if ( window.addHook ) {
			window.addHook( 'dialog-opened', function() {
				console.log('hook: dialog-opened');
				setTimeout( () => updateDialogs( 'dialog-opened' ), 0 );
			} );

			window.addHook( 'dialog-closed', function() {
				console.log('hook: dialog-closed');
				setTimeout( () => updateDialogs( 'dialog-closed' ), 0 );
			} );
		}

		// Initialize state if dialogs already exist
		updateDialogs();

		// Fallback: listen to jQuery UI dialog events in case IITC hooks aren't fired
		$( document ).on( 'dialogopen', '.ui-dialog-content', function( e ) {
			console.log( 'jQuery event: dialogopen', $( this ).closest( '.ui-dialog' ).find( '.ui-dialog-title' ).text() );
			setTimeout( () => updateDialogs( 'dialogopen' ), 0 );
		} );
		console.log( '✓ dialogopen handler attached' );

		$( document ).on( 'dialogclose', '.ui-dialog-content', function( e ) {
			console.log( 'jQuery event: dialogclose', $( this ).closest( '.ui-dialog' ).find( '.ui-dialog-title' ).text() );
			setTimeout( () => updateDialogs( 'dialogclose' ), 0 );
		} );
		console.log( '✓ dialogclose handler attached' );

		// Catch clicks on the dialog close button
		$( document ).on( 'click', '.ui-dialog-titlebar-close', function( e ) {
			const $dlg = $( this ).closest( '.ui-dialog' );
			const title = $dlg.find( '.ui-dialog-title' ).text();
			const dialogs = getVisibleDialogs();
			const idx = dialogs.indexOf( $dlg[0] );
			console.log( 'close-button clicked for:', title, 'index=', idx );
			if ( idx>=0 ) {
				window._preferredActiveIndex = idx - 1;
				console.log( 'close-button -> set preferredActiveIndex=', window._preferredActiveIndex );
			}
			setTimeout( () => updateDialogs( 'close-button' ), 50 );
		} );
		console.log( '✓ close-button click handler attached' );

		// Bare-key shortcuts for x / > / <.
		//
		// Guards, in the order they matter:
		//  1. Bail on any modifier. Without this, e.key==='x' is still true while Ctrl is
		//     held, so the old capture-phase handler swallowed Ctrl+X (cut) page-wide and
		//     suppressed the draw-tools Alt+X accesskey via preventDefault().
		//  2. Bail while the user is typing in a field, so 'x' can still be typed into the
		//     IITC chat box, the location search, and any dialog input.
		//  3. Bail when no dialog is open — nothing to close or cycle, so leave the key alone.
		// Bound in the BUBBLE phase (false), not capture, so anything with a legitimate
		// prior claim on the key gets first refusal.
		function shouldIgnoreKeyEvent( e ) {
			if ( e.ctrlKey||e.altKey||e.metaKey||e.shiftKey&&e.key.length>1 ) return true;
			const el=e.target;
			if ( el&&typeof el.closest==='function'&&
				el.closest( 'input, textarea, select, [contenteditable="true"]' ) ) return true;
			if ( el&&el.isContentEditable ) return true;
			// only act when at least one dialog is actually on screen
			if ( !$( '.ui-dialog:visible' ).length ) return true;
			return false;
		}

		document.addEventListener( 'keydown', function( e ) {
			if ( shouldIgnoreKeyEvent( e ) ) return;

			if ( e.key === 'x' || e.key === 'X' ) {
				e.preventDefault();
				closeActiveDialog();
			} else if ( e.key === '>' ) {
				e.preventDefault();
				cycleDialogs( false );
			} else if ( e.key === '<' ) {
				e.preventDefault();
				cycleDialogs( true );
			}
		}, false );
		console.log( '✓ keydown handler attached for x, >, < (guarded, bubble phase)' );

		// NOTE: window.registerShortcut does not exist. It is not in IITC-CE core and not in
		// IITC-CE/Community-plugins — the only references anywhere are the calls that used to
		// live here, so the branch was permanently dead and the listener above was always the
		// one doing the work. Removed rather than left as misleading dead code. If IITC ever
		// ships a real shortcut registry, re-add it here and delete the listener above.
		console.log( '=== setup() complete ===' );
		console.timeEnd('closeDialogMenus');
	}

	if ( window.iitcLoaded ) {
		setup();
	} else if ( typeof window.addHook==='function' ) {
		window.addHook( 'iitcLoaded', setup );
	} else {
		// Fallback: wait for the window to load or IITC to inject
		window.addEventListener( 'load', () => {
			if ( typeof window.addHook==='function' ) setup();
		} );
	}
} )();
