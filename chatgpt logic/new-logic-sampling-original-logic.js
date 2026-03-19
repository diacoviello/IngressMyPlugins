// ==UserScript==
// @author          DiabloEnMusica
// @id              DiabloEnMusica
// @name            Spine Layering
// @version         1.1
// @description     Plugin for planning fields in IITC
// @category        AAAAA
// @namespace       conversion
// @updateURL
// @downloadURL
// @preview
// @issueTracker
// @include         https://intel.ingress.com/*
// @include         http://intel.ingress.com/*
// @include         https://*.ingress.com/intel*
// @include         http://*.ingress.com/intel*
// @include         https://*.ingress.com/mission/*
// @include         http://*.ingress.com/mission/*
// @match           https://intel.ingress.com/*
// @match           http://intel.ingress.com/*
// @match           https://*.ingress.com/intel*
// @match           http://*.ingress.com/intel*
// @match           https://*.ingress.com/mission/*
// @match           http://*.ingress.com/mission/*
// @grant           none
// ==/UserScript==

pluginName="Spine Layering";
version="1.1";
changeLog=[
	{
		version: '1.1',
		changes: [
			'release',
		],
	},
];


// Function to calculate the distance between two points (lat/lng)
function getDistance( p1, p2 ) {
	const R=6371; // Radius of the Earth in km
	const dLat=deg2rad( p2.lat-p1.lat );
	const dLng=deg2rad( p2.lng-p1.lng );
	const a=Math.sin( dLat/2 )*Math.sin( dLat/2 )+
		Math.cos( deg2rad( p1.lat ) )*Math.cos( deg2rad( p2.lat ) )*
		Math.sin( dLng/2 )*Math.sin( dLng/2 );
	const c=2*Math.atan2( Math.sqrt( a ), Math.sqrt( 1-a ) );
	return R*c; // Distance in km
}

// Utility function to convert degrees to radians
function deg2rad( deg ) {
	return deg*( Math.PI/180 );
}

// Function to check if a new triangle intersects any existing triangles
function checkIntersection( basePoint1, portal, topPoint, existingTriangles ) {
	// Placeholder for intersection logic (implement a line-segment intersection algorithm)
	return false; // Assume no intersection for now
}

// Function to determine if a point is inside a triangle
self.pointInTriangle=function( pt, triangle ) {
	const [ p1, p2, p3 ]=triangle.map( pt => ( {
		lat: pt.lat*Math.PI/180,
		lng: pt.lng*Math.PI/180
	} ) );

	const v0=self.vectorSubtract( p3, p1 );
	const v1=self.vectorSubtract( p2, p1 );
	const v2=self.vectorSubtract( pt, p1 );

	const dot00=self.dotProduct( v0, v0 );
	const dot01=self.dotProduct( v0, v1 );
	const dot02=self.dotProduct( v0, v2 );
	const dot11=self.dotProduct( v1, v1 );
	const dot12=self.dotProduct( v1, v2 );

	const invDenom=1/( dot00*dot11-dot01*dot01 );
	const u=( dot11*dot02-dot01*dot12 )*invDenom;
	const v=( dot00*dot12-dot01*dot02 )*invDenom;

	return u>=0&&v>=0&&u+v<1;
};

// Function to subtract vectors
self.vectorSubtract=function( a, b ) {
	return { lat: a.lat-b.lat, lng: a.lng-b.lng };
};

// Function to compute the dot product
self.dotProduct=function( a, b ) {
	return a.lat*b.lat+a.lng*b.lng;
};

// --- Core Logic for Layered Triangles ---

// Main function to find and layer triangles based on the median
self.findLayeredTrianglePlan=function() {
	let corners=self.selectedPortals.map( portal => portal.guid );

	// Ensure exactly 3 portals are selected
	if ( corners.length!==3 ) {
		$( "#triangle-plan-text" ).val( "Please select exactly three portals." );
		return;
	}

	// Get the portals inside the triangle
	let portalsInsideTriangle=self.getPortalsInTriangle( corners, null );

	// Find the best base of the triangle to use for layering
	const { base, triangles }=self.findBestBase( corners, portalsInsideTriangle );

	// Generate the plan based on the best base
	const layeredTriangles=self.generateLayeredTriangles( base, triangles, portalsInsideTriangle );

	// Display the result and draw the plan
	if ( layeredTriangles&&layeredTriangles.length>0 ) {
		self.plan=layeredTriangles;
		$( "#triangle-plan-text" ).val( self.planToText( self.plan ) );
		self.drawPlan( self.plan ); // Visualize the fields
		$( "#export-dt-btn" ).show(); // Show the export button for Draw Tools
	} else {
		$( "#triangle-plan-text" ).val( "No fields found. Try different portals." );
	}
};

// Function to generate layered triangles based on the base and median (spine)
self.generateLayeredTriangles=function( base, triangles, portalsInside ) {
	let layeredTriangles=[];

	// Calculate the median (spine) for the portals inside the triangle
	const spinePortals=self.calculateMedianLine( base, portalsInside );

	// Layer triangles using the base and spine, ensuring no intersection
	spinePortals.forEach( ( portal ) => {
		const triangle=self.createSubTriangle( base[ 0 ], base[ 1 ], portal, layeredTriangles );
		if ( triangle ) {
			layeredTriangles.push( triangle );
		}
	} );

	return layeredTriangles;
};

// Calculate the median line (spine) based on the base and the portals inside the triangle
self.calculateMedianLine=function( base, portalsInside ) {
	let spinePortals=[];

	// Sort the portals by their distance from the base's midpoint
	const midBase={
		lat: ( base[ 0 ].lat+base[ 1 ].lat )/2,
		lng: ( base[ 0 ].lng+base[ 1 ].lng )/2
	};

	portalsInside.sort( ( p1, p2 ) => {
		const dist1=getDistance( p1, midBase );
		const dist2=getDistance( p2, midBase );
		return dist1-dist2;
	} );

	// Select portals that are closest to the median line as the spine
	spinePortals=portalsInside.slice( 0, Math.min( 5, portalsInside.length ) ); // Limit to closest 5 portals

	return spinePortals;
};

// Create a sub-triangle with no intersection, given the base and a portal on the spine
self.createSubTriangle=function( basePoint1, basePoint2, topPoint, existingTriangles ) {
	const newTriangle=[ basePoint1, basePoint2, topPoint ];

	// Check for intersections with existing triangles
	for ( let existingTriangle of existingTriangles ) {
		if ( self.checkIntersection( basePoint1, topPoint, basePoint2, existingTriangle ) ) {
			return null; // Ignore if it would intersect
		}
	}

	return newTriangle;
};

// --- UI Functions ---

// Hover animations on mouse hover
self.animateHover=function() {
	if ( window.map.hasLayer( self.highlightLayergroup ) ) {
		self.highlightLayergroup.clearLayers();
	}

	self.selectedPortals.forEach( ( { guid } ) => {
		self.animateCircle( guid ); // Animate circle around the portal on hover
	} );
};

// Attach event handlers for color picker and mouse hover
self.attachEventHandler=function() {
	$( "#colorPicker" ).change( function() {
		self.linkStyle.color=this.value;
		self.fieldStyle.fillColor=this.value;
		self.updateLayer();
	} );

	// Mouse hover animation
	$( "#portal-details" ).mouseover( function() {
		self.animateHover();
	} );

	$( "#portal-details" ).mouseout( function() {
		if ( window.map.hasLayer( self.highlightLayergroup ) ) {
			self.highlightLayergroup.clearLayers();
		}
	} );

	$( "#export-dt-btn" ).click( function() {
		self.exportPlanToDrawTools();  // Export plan to Draw Tools
	} );
};

// --- Export Functionality ---

// Export plan to DrawTools
self.exportPlanToDrawTools=function() {
	if ( self.plan ) {
		self.exportToDrawtools( self.plan );
	}
};

// --- Event Handlers and Initialization ---

$( document ).ready( function() {
	self.attachEventHandler(); // Attach all the event handlers when the document is ready
} );

// // Create a script element to hold our content script
// var script=document.createElement( 'script' );
// var info={};
// // GM_info is defined by the assorted monkey-themed browser extensions
// // and holds information parsed from the script header.
// if ( typeof GM_info!=='undefined'&&GM_info&&GM_info.script ) {
// 	info.script={
// 		version: GM_info.script.version,
// 		name: GM_info.script.name,
// 		description: GM_info.script.description
// 	};
// }
// // Create a text node and our IIFE inside of it
// var textContent=document.createTextNode( '('+wrapper+')('+JSON.stringify( info )+')' );
// // Add some content to the script element
// script.appendChild( textContent );
// // Finally, inject it... wherever.
// ( document.body||document.head||document.documentElement ).appendChild( script );