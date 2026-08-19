// ==UserScript==
// @id shortcuts-list
// @name shortcuts-list
// @category Diablo
// @version 0.2.20260819
// @updateURL    https://raw.githubusercontent.com/diacoviello/IngressMyPlugins/main/myVersion/Diablo_shortcuts-list.user.js
// @downloadURL  https://raw.githubusercontent.com/diacoviello/IngressMyPlugins/main/myVersion/Diablo_shortcuts-list.user.js
// @uploadURL    https://raw.githubusercontent.com/diacoviello/IngressMyPlugins/main/myVersion/Diablo_shortcuts-list.user.js
// @description Searchable keyboard shortcut reference for IITC core and installed plugins
// @match https://intel.ingress.com/*
// @grant none
// ==/UserScript==

window.plugin.shortcuts=function() { };

// Wrapper function that will be stringified and injected
// into the document. Because of this, normal closure rules
// do not apply here.
function wrapper( plugin_info ) {
	// Make sure that window.plugin exists. IITC defines it as a no-op function,
	// and other plugins assume the same.
	if ( typeof window.plugin!=='function' ) window.plugin=function() { };

	plugin_info.buildName='shortcuts-list';
	plugin_info.dateTimeVersion='20260819.12.00';
	plugin_info.pluginId='shortcuts';

	// ---------------------------------------------------------------------
	// KEY MAP
	//
	// Verified 2026-08-19 by grepping IITC-CE core, IITC-CE/Community-plugins
	// and diacoviello/IngressMyPlugins. See accesskey-audit.md in the repo.
	//
	// kind:
	//   'access' = HTML accesskey. Needs the browser's accesskey chord (see
	//              the legend at the top of the dialog).
	//   'bare'   = plain keydown listener. Press the key on its own, with no
	//              modifier. Suppressed while typing in a text field.
	//   'combo'  = an explicit modifier combination.
	//   'free'   = not assigned to anything.
	// ---------------------------------------------------------------------
	window.plugin.shortcuts.map=[
		{
			group: 'IITC Core',
			note: 'Always active. These cannot be reassigned.',
			keys: [
				[ '0', 'Toggle chat / comm window', 'access' ],
				[ 'c', 'Focus chat input box', 'access' ],
				[ 'i', 'Toggle sidebar', 'access' ],
				[ 'f', 'Focus location search', 'access' ],
				[ 'w', 'Close portal detail panel', 'access' ],
				[ 'o', 'Ornaments options', 'access' ],
				[ '1', 'Comm tab \u2014 All', 'access' ],
				[ '2', 'Comm tab \u2014 Faction', 'access' ],
				[ '3', 'Comm tab \u2014 Alerts', 'access' ],
				[ 'Esc', 'Unspiderfy overlapping markers', 'bare' ]
			]
		},
		{
			group: 'Core Plugins',
			note: 'Only live while that plugin is enabled.',
			keys: [
				[ 't', 'Portals list', 'access' ],
				[ 'v', 'Open / close bookmarks box', 'access' ],
				[ 'b', 'Star this portal (bookmark)', 'access' ],
				[ 'q', 'Auto draw between bookmarks', 'access' ],
				[ '9', 'Permalink / privacy view toggle', 'access' ],
				[ 'x', 'DrawTools options', 'access' ]
			]
		},
		{
			group: 'Comm History',
			note: 'IITC-Community/loadmorecommshistory. These extend the comm tab strip, so they sit right after core\u2019s 1/2/3.',
			keys: [
				[ '4', 'Comm \u2014 public', 'access' ],
				[ '5', 'Comm \u2014 load more history', 'access' ]
			]
		},
		{
			group: 'Draw Tools \u2014 toolbar',
			note: 'Assigned by button order and released when a button is hidden, so these come and go with the toolbar state.',
			keys: [
				[ 'l', 'Line', 'access' ],
				[ 'p', 'Polygon', 'access' ],
				[ 'o', 'Circle \u2014 overlaps core Ornaments while the toolbar is visible', 'access' ],
				[ 'm', 'Marker', 'access' ],
				[ 'e', 'Edit', 'access' ],
				[ 'd', 'Delete', 'access' ],
				[ 's', 'Save', 'access' ],
				[ 'a', 'Cancel', 'access' ]
			]
		},
		{
			group: 'Quick Draw Links',
			note: 'Diablo_crosslinkFix. Portal buttons sit on the portal detail pane and above the status bar.',
			keys: [
				[ '.', 'Copy all links from this portal', 'access' ],
				[ 'z', 'Start a link from this portal', 'access' ],
				[ '/', 'Move all links from this portal', 'access' ],
				[ 'n', 'Star \u2014 start multiple links to this portal', 'access' ],
				[ 'g', 'Mass copy-paste mode on / off', 'access' ],
				[ ',', 'Open Quick Draw Links menu (toolbox)', 'access' ],
				[ 'r', 'Back to main menu (inside a dialog)', 'access' ],
				[ 'y', 'Close the Quick Draw Links dialog', 'access' ],
				[ 'Esc', 'Cancel mass copy-paste mode', 'bare' ]
			]
		},
		{
			group: 'Destroy Links Sim',
			note: 'Diablo_destroyedLinks. Buttons sit under the portal image.',
			keys: [
				[ 'h', 'Destroy all bookmarked portals', 'access' ],
				[ 'j', 'Destroy selected portal', 'access' ],
				[ 'u', 'Regenerate selected portal', 'access' ],
				[ '6', 'Reset All', 'access' ],
				[ '7', 'Drawnize All', 'access' ]
			]
		},
		{
			group: 'Multi Maps Route Planner',
			keys: [
				[ 'k', 'Open route planner menu', 'access' ],
				[ ']', 'Toggle waypoint on selected portal', 'access' ],
				[ '8', 'Close the About dialog', 'access' ],
				[ 'Esc', 'Cancel add-point / home-pick / bulk select', 'bare' ]
			]
		},
		{
			group: 'Dialog Control',
			note: 'Diablo_closeDialogMenus. Bare keys \u2014 no modifier. Ignored while typing in any text field, and inert when no dialog is open.',
			keys: [
				[ 'x', 'Close the active dialog', 'bare' ],
				[ '>', 'Cycle dialogs forward', 'bare' ],
				[ '<', 'Cycle dialogs backward', 'bare' ]
			]
		},
		{
			group: 'Bookmarks Add-on',
			keys: [
				[ 'c', 'Reset ALL bookmarks + maps \u2014 destructive, asks first', 'bare' ]
			]
		},
		{
			group: 'Portal Route',
			keys: [
				[ 'Ctrl / Cmd + Z', 'Undo route edit', 'combo' ],
				[ 'Ctrl / Cmd + Shift + Z', 'Redo route edit', 'combo' ]
			]
		},
		{
			group: 'Street View',
			keys: [
				[ 'Esc', 'Close the Street View modal', 'bare' ]
			]
		},
		{
			group: 'This Plugin',
			keys: [
				[ ';', 'Open this shortcut reference', 'access' ]
			]
		},
		{
			group: 'Still Free',
			note: 'Every letter and digit is now spoken for. Anything new has to take punctuation, or reclaim a key from a plugin you do not actually run.',
			keys: [
				[ '[', 'unassigned', 'free' ],
				[ '\'', 'unassigned', 'free' ],
				[ '\\', 'unassigned', 'free' ],
				[ '-', 'unassigned', 'free' ],
				[ '=', 'unassigned', 'free' ],
				[ '`', 'unassigned', 'free' ]
			]
		}
	];

	// Work out the accesskey chord for whatever browser this is, so the legend
	// tells the truth instead of guessing.
	window.plugin.shortcuts.chord=function() {
		var ua=navigator.userAgent;
		var mac=/Mac|iPhone|iPad/.test( navigator.platform||ua );
		if ( /Firefox/.test( ua ) ) return mac? 'Control + Option':'Alt + Shift';
		if ( mac ) return 'Control + Option';
		return 'Alt';
	};

	window.plugin.shortcuts.escape=function( str ) {
		return String( str ).replace( /&/g, '&amp;' ).replace( /</g, '&lt;' ).replace( />/g, '&gt;' );
	};

	window.plugin.shortcuts.kindLabel={
		access: 'accesskey',
		bare: 'bare key',
		combo: 'combo',
		free: 'free'
	};

	window.plugin.shortcuts.render=function( filter ) {
		var esc=window.plugin.shortcuts.escape;
		var needle=( filter||'' ).trim().toLowerCase();
		var html='';
		var shown=0;

		window.plugin.shortcuts.map.forEach( function( section ) {
			var rows=section.keys.filter( function( k ) {
				if ( !needle ) return true;
				return ( k[ 0 ]+' '+k[ 1 ]+' '+section.group ).toLowerCase().indexOf( needle )>=0;
			} );
			if ( !rows.length ) return;
			shown+=rows.length;

			html+='<details'+( needle? ' open':'' )+'>';
			html+='<summary>'+esc( section.group )+' <span class="sc-count">'+rows.length+'</span></summary>';
			html+='<div class="sc-content">';
			if ( section.note ) html+='<p class="sc-note">'+esc( section.note )+'</p>';
			html+='<table class="sc-table">';
			rows.forEach( function( k ) {
				html+='<tr class="sc-'+k[ 2 ]+'">'+
					'<td class="sc-key"><kbd>'+esc( k[ 0 ] )+'</kbd></td>'+
					'<td class="sc-desc">'+esc( k[ 1 ] )+'</td>'+
					'<td class="sc-kind">'+window.plugin.shortcuts.kindLabel[ k[ 2 ] ]+'</td>'+
					'</tr>';
			} );
			html+='</table></div></details>';
		} );

		if ( !shown ) html='<p class="sc-note">Nothing matches that.</p>';
		$( '#sc-results' ).html( html );
	};

	window.plugin.shortcuts.showDialog=function() {
		var chord=window.plugin.shortcuts.chord();
		var html=''+
			'<div id="sc-wrap">'+
			'<p class="sc-legend">'+
			'<b>accesskey</b> \u2014 hold <kbd>'+chord+'</kbd> and press the key.<br>'+
			'<b>bare key</b> \u2014 press it on its own. Ignored while you are typing in a field.<br>'+
			'<b>combo</b> \u2014 press the whole combination as shown.'+
			'</p>'+
			'<input id="sc-filter" type="text" placeholder="Filter by key or action\u2026" autocomplete="off">'+
			'<div id="sc-results"></div>'+
			'</div>';

		window.dialog( {
			title: 'Shortcuts Reference',
			id: 'shortcuts-list-dialog',
			html: html,
			width: 460
		} );

		window.plugin.shortcuts.render( '' );
		$( '#sc-filter' ).on( 'input', function() {
			window.plugin.shortcuts.render( this.value );
		} ).focus();
	};

	window.plugin.shortcuts.addStyles=function() {
		$( 'head' ).append( '<style>'+
			'#sc-wrap { font-size: 13px; }'+
			'.sc-legend { margin: 0 0 8px; padding: 6px 8px; background: rgba(8,48,78,.6); border-left: 2px solid #ffce00; line-height: 1.5; }'+
			'#sc-filter { width: 100%; box-sizing: border-box; margin-bottom: 8px; padding: 4px 6px; background: #0b3a54; color: #eee; border: 1px solid #20a8b1; }'+
			'#sc-results details { margin-bottom: 4px; border: 1px solid rgba(32,168,177,.4); }'+
			'#sc-results summary { cursor: pointer; padding: 4px 6px; background: rgba(8,48,78,.9); color: #ffce00; font-weight: bold; }'+
			'#sc-results summary:hover { background: rgba(32,168,177,.35); }'+
			'.sc-count { float: right; color: #8ac; font-weight: normal; }'+
			'.sc-content { padding: 4px 6px 6px; }'+
			'.sc-note { margin: 2px 0 6px; color: #9bb; font-style: italic; font-size: 12px; line-height: 1.4; }'+
			'.sc-table { width: 100%; border-collapse: collapse; }'+
			'.sc-table td { padding: 2px 4px; vertical-align: top; border-bottom: 1px solid rgba(255,255,255,.07); }'+
			'.sc-key { width: 1%; white-space: nowrap; }'+
			'.sc-key kbd { display: inline-block; min-width: 14px; text-align: center; padding: 1px 5px; background: #12405c; border: 1px solid #ffce00; border-radius: 3px; color: #ffce00; font-family: monospace; }'+
			'.sc-kind { width: 1%; white-space: nowrap; color: #789; font-size: 11px; text-align: right; }'+
			'.sc-bare .sc-key kbd, .sc-combo .sc-key kbd { border-color: #7fd; color: #7fd; }'+
			'.sc-free .sc-key kbd { border-color: #667; color: #889; }'+
			'.sc-free .sc-desc { color: #778; font-style: italic; }'+
			'</style>' );
	};

	// The entry point for this plugin.
	function setup() {
		console.time( 'shortcuts-list' );
		window.plugin.shortcuts.addStyles();
		IITC.toolbox.addButton( {
			label: 'Shortcuts Ref',
			title: 'Keyboard shortcut reference [;]',
			accesskey: ';',
			action: window.plugin.shortcuts.showDialog
		} );
		console.timeEnd( 'shortcuts-list' );
	}

	// Add an info property for IITC's plugin system
	setup.info=plugin_info;

	// Make sure window.bootPlugins exists and is an array
	if ( !window.bootPlugins ) window.bootPlugins=[];
	// Add our startup hook
	window.bootPlugins.push( setup );
	// If IITC has already booted, immediately run the 'setup' function
	if ( window.iitcLoaded&&typeof setup==='function' ) setup();
}

// Create a script element to hold our content script
var script=document.createElement( 'script' );
var info={};

// GM_info is defined by the assorted monkey-themed browser extensions
// and holds information parsed from the script header.
if ( typeof GM_info!=='undefined'&&GM_info&&GM_info.script ) {
	info.script={
		version: GM_info.script.version,
		name: GM_info.script.name,
		description: GM_info.script.description
	};
}

// Create a text node and our IIFE inside of it
var textContent=document.createTextNode( '('+wrapper+')('+JSON.stringify( info )+')' );
// Add some content to the script element
script.appendChild( textContent );
// Finally, inject it... wherever.
( document.body||document.head||document.documentElement ).appendChild( script );
