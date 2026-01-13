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





// Main function to find and layer triangles along the spine (median)
self.findLayeredTrianglePlan = function() {
    let corners = self.selectedPortals.map(portal => portal.guid);

    // Ensure exactly 3 portals are selected
    if (corners.length !== 3) {
        $("#triangle-plan-text").val("Please select exactly three portals.");
        return;
    }

    // Get the portals inside the triangle
    let portalsInsideTriangle = self.getPortalsInTriangle(corners, null);

    // Find the best base of the triangle to use for layering
    const { base, triangles } = self.findBestBase(corners, portalsInsideTriangle);

    // Generate the plan based on the best base
    const layeredTriangles = self.generateLayeredTriangles(base, triangles, portalsInsideTriangle);

    // Display the result and draw the plan
    if (layeredTriangles && layeredTriangles.length > 0) {
        self.plan = layeredTriangles;
        $("#triangle-plan-text").val(self.planToText(self.plan));
        self.drawPlan(self.plan); // Visualize the fields
        $("#export-dt-btn").show(); // Show the export button for Draw Tools
    } else {
        $("#triangle-plan-text").val("No fields found. Try different portals.");
    }
};

// Function to generate layered triangles along the spine
self.generateLayeredTriangles = function(base, triangles, portalsInside) {
    let layeredTriangles = [];
    
    // Calculate the median (spine) for the portals inside the triangle
    const spinePortals = self.calculateMedianLine(base, portalsInside);

    // Layer triangles using the base and spine, ensuring no intersection
    spinePortals.forEach((portal) => {
        const triangle = self.createSubTriangle(base[0], base[1], portal, layeredTriangles);
        if (triangle) {
            layeredTriangles.push(triangle);
        }
    });

    return layeredTriangles;
};

// Calculate the median line (spine) based on the base and the portals inside the triangle
self.calculateMedianLine = function(base, portalsInside) {
    let spinePortals = [];

    // Sort the portals by their distance from the base's midpoint
    const midBase = {
        lat: (base[0].lat + base[1].lat) / 2,
        lng: (base[0].lng + base[1].lng) / 2
    };

    portalsInside.sort((p1, p2) => {
        const dist1 = getDistance(p1, midBase);
        const dist2 = getDistance(p2, midBase);
        return dist1 - dist2;
    });

    // Select portals that are closest to the median line as the spine
    spinePortals = portalsInside.slice(0, Math.min(5, portalsInside.length)); // Limit to closest 5 portals

    return spinePortals;
};

// Create a sub-triangle with no intersection, given the base and a portal on the spine
self.createSubTriangle = function(basePoint1, basePoint2, topPoint, existingTriangles) {
    const newTriangle = [basePoint1, basePoint2, topPoint];

    // Check for intersections with existing triangles
    for (let existingTriangle of existingTriangles) {
        if (self.checkIntersection(basePoint1, topPoint, basePoint2, existingTriangle)) {
            return null; // Ignore if it would intersect
        }
    }

    return newTriangle;
};

// Function to check if a triangle intersects any other existing triangles (simplified)
self.checkIntersection = function(basePoint1, portal, topPoint, triangles) {
    // Implement a line-segment intersection algorithm (placeholder logic)
    return false; // Placeholder, assuming no intersection for now
};

// Export plan to DrawTools
self.exportPlanToDrawTools = function() {
    if (self.plan) {
        self.exportToDrawtools(self.plan);
    }
};

// Hover animations
self.animateHover = function() {
    if (window.map.hasLayer(self.highlightLayergroup)) {
        self.highlightLayergroup.clearLayers();
    }

    self.selectedPortals.forEach(({ guid }) => {
        self.animateCircle(guid); // Animate circle around the portal on hover
    });
};

// Attach event handlers for UI interactions
self.attachEventHandler = function() {
    $("#colorPicker").change(function() {
        self.linkStyle.color = this.value;
        self.fieldStyle.fillColor = this.value;
        self.updateLayer();
    });

    $("#export-dt-btn").click(function() {
        self.exportPlanToDrawTools();  // Export plan to draw tools
    });

    // Mouse hover animation
    $("#portal-details").mouseover(function() {
        self.animateHover();
    });

    $("#portal-details").mouseout(function() {
        if (window.map.hasLayer(self.highlightLayergroup)) {
            self.highlightLayergroup.clearLayers();
        }
    });
};
