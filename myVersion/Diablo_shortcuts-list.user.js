// ==UserScript==
// @id shortcuts-list
// @name shortcuts-list
// @category Diablo
// @version 0.0.1
// @namespace https://tempuri.org/iitc/shortcuts
// @description Shortcuts list for plugins
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

	// Name of the IITC build for first-party plugins
	plugin_info.buildName='shortcuts-list';

	// Datetime-derived version of the plugin
	plugin_info.dateTimeVersion='20250613103500';

	// ID/name of the plugin
	plugin_info.pluginId='shortcuts';

	window.plugin.shortcuts.showDialog=function() {
		const data=`
        <i>Shortcuts:</i><br>
        <div class="dropdown-container">
					<details>
						<summary>Quick Draw Links</summary>
      			<div class="content">
        			<ul>
								<li>Copy = [y]</li> 
								<li>Link = [k]</li> 
								<li>Move = [.]</li>
								<li>Star = [s]</li>
							</ul>
						</div>
					</details>

					<details>
						<summary>Bookmarks</summary>
						<div class="content">
							<ul>
								<li>Add Bookmark = [b]</li>
								<li>Open bookmarks = [v]</li>
								<li>Auto draw existing bkmrks = [q]</li>
							</ul>
						</div>
					</details>

					<details>
						<summary>Draw Tools</summary>
						<div class="content">
							<ul>
								<li>line = [l]</li> 
								<li>polygon = [p]</li> 
								<li>circle = [o]</li> 
								<li>marker = [m]</li> 
								<li>cancel = [a]</li>
								<li>edit = [e]</li> 
								<li>delete = [d]</li> 
								<li>save = [s]</li> 
								<li>cancel = [a]</li>
							</ul>
						</div>
					</details>
				</div>
        `;

		window.dialog( {
			title: "Shortcuts List",
			html: data
		} ).parent();
	}

	// The entry point for this plugin.
	function setup() {

		IITC.toolbox.addButton( {
			label: 'Shortcuts Ref',
			accesskey: ';',
			action: window.plugin.shortcuts.showDialog
		} );
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