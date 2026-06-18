// ==UserScript==
// @author          DiabloEnMusica
// @id              s2celldrawer@DiabloEnMusica
// @name            S2 Cell Drawer
// @category        Diablo
// @version         0.0.5.20260616.010307
// @namespace       https://github.com/jonatkins/ingress-intel-total-conversion
// @updateURL       https://raw.githubusercontent.com/diacoviello/IngressMyPlugins/main/myVersion/Diablo_s2-cells.user.js
// @downloadURL     https://raw.githubusercontent.com/diacoviello/IngressMyPlugins/main/myVersion/Diablo_s2-cells.user.js
// @description     [iitc-20260616.010307] Allows drawing of s2cells and creates a layerselected hook
// @include         https://*.ingress.com/intel*
// @include         http://*.ingress.com/intel*
// @include         https://*.ingress.com/mission/*
// @include         http://*.ingress.com/mission/*
// @match           https://*.ingress.com/intel*
// @match           http://*.ingress.com/intel*
// @match           https://*.ingress.com/mission/*
// @match           http://*.ingress.com/mission/*
// @match           https://intel.ingress.com/*
// @match           http://intel.ingress.com/*
// @grant           none
// ==/UserScript==
var L; // to prevent script errors on load
var $; // to prevent script errors on load
var map; // to prevent script errors on load
function wrapper(plugin_info) {
// ensure plugin framework is there, even if iitc is not yet loaded
if(typeof window.plugin !== 'function') window.plugin = function() {};
	//PLUGIN AUTHORS: writing a plugin outside of the IITC build environment? if so, delete these lines!!
	//(leaving them in place might break the 'About IITC' page or break update checks)
  // plugin_info.buildName = 'iitc';
  // plugin_info.dateTimeVersion = '20181209.010307';
  // plugin_info.pluginId = 'S2 Cell Drawer';
	// PLUGIN START ///////////////////////////////////////////////////////	
	// use own namespace for plugin
	window.plugin.s2celldrawer = function() {};            
	window.plugin.s2celldrawer.seenCells = {};
	window.plugin.s2celldrawer.bounds = null;

	window.plugin.s2celldrawer.defaultSettings = {
		color: '#FF6600',
		opacity: 1.0
	};
	window.plugin.s2celldrawer.settings = {};

	window.plugin.s2celldrawer.storeSettings = function() {
		localStorage['plugin.s2celldrawer.settings'] = JSON.stringify(window.plugin.s2celldrawer.settings);
	};

	window.plugin.s2celldrawer.loadSettings = function() {
		var stored = localStorage['plugin.s2celldrawer.settings'];
		if (stored) {
			try { window.plugin.s2celldrawer.settings = JSON.parse(stored); } catch(e) {}
		}
		var s = window.plugin.s2celldrawer.settings;
		var d = window.plugin.s2celldrawer.defaultSettings;
		if (!s.color) s.color = d.color;
		if (s.opacity === undefined) s.opacity = d.opacity;
	};

	window.plugin.s2celldrawer.redraw = function() {
		var s2Layer = window.plugin.s2celldrawer.layer;
		if (!s2Layer) return;
		s2Layer.clearLayers();
		var s = window.plugin.s2celldrawer.settings;
		window.plugin.s2celldrawer.drawCellList(s2Layer, 14, {
			color: s.color,
			opacity: s.opacity,
			weight: 1,
			fill: false
		});
	};

	window.plugin.s2celldrawer.showMenu = function() {
		var s = window.plugin.s2celldrawer.settings;

		var container = document.createElement('div');
		container.style.padding = '10px';

		// Color row
		var colorRow = container.appendChild(document.createElement('div'));
		colorRow.style.marginBottom = '12px';
		var colorLabel = colorRow.appendChild(document.createElement('label'));
		colorLabel.textContent = 'Cell Color:  ';
		colorLabel.style.fontWeight = 'bold';
		var colorInput = colorRow.appendChild(document.createElement('input'));
		colorInput.type = 'color';
		colorInput.value = s.color;
		colorInput.style.width = '60px';
		colorInput.style.height = '30px';
		colorInput.style.cursor = 'pointer';
		colorInput.style.border = 'none';
		colorInput.style.padding = '0';
		colorInput.style.marginLeft = '6px';

		// Reset color button
		var resetColorBtn = colorRow.appendChild(document.createElement('button'));
		resetColorBtn.textContent = 'Reset';
		resetColorBtn.style.marginLeft = '8px';
		resetColorBtn.addEventListener('click', function() {
			colorInput.value = window.plugin.s2celldrawer.defaultSettings.color;
		});

		// Opacity row
		var opacityRow = container.appendChild(document.createElement('div'));
		opacityRow.style.marginBottom = '12px';
		var opacityLabel = opacityRow.appendChild(document.createElement('label'));
		opacityLabel.textContent = 'Opacity:  ';
		opacityLabel.style.fontWeight = 'bold';
		var opacityInput = opacityRow.appendChild(document.createElement('input'));
		opacityInput.type = 'range';
		opacityInput.min = '0';
		opacityInput.max = '1';
		opacityInput.step = '0.05';
		opacityInput.value = s.opacity;
		opacityInput.style.width = '140px';
		opacityInput.style.marginLeft = '6px';
		opacityInput.style.verticalAlign = 'middle';
		var opacityValue = opacityRow.appendChild(document.createElement('span'));
		opacityValue.textContent = '  ' + Math.round(s.opacity * 100) + '%';
		opacityInput.addEventListener('input', function() {
			opacityValue.textContent = '  ' + Math.round(this.value * 100) + '%';
		});

		// Reset opacity button
		var resetOpacityBtn = opacityRow.appendChild(document.createElement('button'));
		resetOpacityBtn.textContent = 'Reset';
		resetOpacityBtn.style.marginLeft = '8px';
		resetOpacityBtn.addEventListener('click', function() {
			opacityInput.value = window.plugin.s2celldrawer.defaultSettings.opacity;
			opacityValue.textContent = '  ' + Math.round(window.plugin.s2celldrawer.defaultSettings.opacity * 100) + '%';
		});

		window.dialog({
			html: container,
			id: 's2celldrawer',
			title: 'S2 Cell Drawer - Settings',
			width: 'auto'
		}).dialog('option', 'buttons', {
			'Apply': function() {
				window.plugin.s2celldrawer.settings.color = colorInput.value;
				window.plugin.s2celldrawer.settings.opacity = parseFloat(opacityInput.value);
				window.plugin.s2celldrawer.storeSettings();
				window.plugin.s2celldrawer.redraw();
			},
			'Close': function() { $(this).dialog('close'); }
		});
	};
  
	window.plugin.s2celldrawer.drawCellList = function(layer, cellSize, cellOptions, showCallback, markerCss) {       
 		window.plugin.s2celldrawer.bounds = map.getBounds();
		window.plugin.s2celldrawer.seenCells = {};    
    // centre cell
    var zoom = map.getZoom();
    var maxzoom = 15;
    if (cellSize <= 14) maxzoom = 10;
    if (cellSize <= 8) maxzoom = 5;
    if (zoom >= maxzoom) {  // 5 // ;;;;
      // var cellSize = zoom>=7 ? 6 : 4;  // ;;;;vib      
      var cell = S2.S2Cell.FromLatLng ( map.getCenter(), cellSize );
      window.plugin.s2celldrawer.drawCellAndNeighbors(layer, cell, cellSize, cellOptions, showCallback, markerCss);
    }    
}   
  
  window.plugin.s2celldrawer.drawCellAndNeighbors = function(layer, cell, cellSize, cellOptions, showCallback, markerCss) {
  		var cellStr = cell.toString();
      if (!window.plugin.s2celldrawer.seenCells[cellStr]) {
        // cell not visited - flag it as visited now
        window.plugin.s2celldrawer.seenCells[cellStr] = true;
        // is it on the screen?
        var corners = cell.getCornerLatLngs();
        var cellBounds = L.latLngBounds([corners[0],corners[1]]).extend(corners[2]).extend(corners[3]);
        // Only draw filled cells when they are completely on screen because we must likely calculate something in it
        if ((cellOptions.fill && window.plugin.s2celldrawer.bounds.contains(cellBounds)) || (!cellOptions.fill && cellBounds.intersects(window.plugin.s2celldrawer.bounds))) {
          // on screen - draw it
          window.plugin.s2celldrawer.drawCell(layer, cell, cellSize, cellOptions, showCallback, markerCss);
          // and recurse to our neighbors
          var neighbors = cell.getNeighbors();
          for (var i=0; i<neighbors.length; i++) {
            window.plugin.s2celldrawer.drawCellAndNeighbors(layer, neighbors[i], cellSize, cellOptions, showCallback, markerCss);
          }
        }
    }
}
window.plugin.s2celldrawer.drawCell = function(layer, cell, cellSize, cellOptions, showCallback, markerCss) {  
    var name = '';  
    if (showCallback !== undefined && typeof showCallback === 'function') {
  		var callbackResult = showCallback(cell);
    	if (!callbackResult.Show) {
      	 return;       
    	} else {
      	 name = callbackResult.Value;
    	}
    }
    // corner points
    var corners = cell.getCornerLatLngs();
    
    var mapBounds = window.plugin.s2celldrawer.bounds;
    
    // center point
    var center = cell.getLatLng();
    
    if (cellOptions.fill) {
      var region = L.geodesicPolygon([corners[0],corners[1],corners[2],corners[3]], cellOptions);      
    } else {
    	var region = L.geodesicPolyline([corners[0],corners[1],corners[2]], cellOptions);
    }                
    
    // move the label if we're at a high enough zoom level and it's off screen
    if (map.getZoom() >= 9) {
      var namebounds = map.getBounds().pad(-0.1); // pad 10% inside the screen bounds
      if (!namebounds.contains(center)) {
        // name is off-screen. pull it in so it's inside the bounds
        var newlat = Math.max(Math.min(center.lat, namebounds.getNorth()), namebounds.getSouth());
        var newlng = Math.max(Math.min(center.lng, namebounds.getEast()), namebounds.getWest());
        var newpos = L.latLng(newlat,newlng);
        // ensure the new position is still within the same cell
        var newposcell = S2.S2Cell.FromLatLng ( newpos, 6 );
        if ( newposcell.toString() == cell.toString() ) {
          center=newpos;
        }
        // else we leave the name where it was - offscreen
      }
    }  
    
  	layer.addLayer(region);  	  
  	if (name != '') {  
      var marker = L.marker(center, {
        icon: L.divIcon({
          className: markerCss,
          iconAnchor: [100,5],
          iconSize: [200,10],
          html: name,
        })
      });    
      layer.addLayer(marker);      
    }
}   
 
var setup = function() {
  console.time('S2 Cell Drawer setup');

  window.pluginCreateHook('displayedLayerUpdated');
  window.updateDisplayedLayerGroup = window.updateDisplayedLayerGroupModified;

  // Load saved settings (color, opacity)
  window.plugin.s2celldrawer.loadSettings();

  // Create a Leaflet layer group for the S2 cells
  var s2Layer = new L.LayerGroup();
  window.plugin.s2celldrawer.layer = s2Layer;

  // Register with IITC's layer control so it appears in the dropdown
  window.addLayerGroup('S2 Cell Drawer', s2Layer, false);

  // Add toolbox button to open settings menu
  $('#toolbox').append('<a onclick="window.plugin.s2celldrawer.showMenu();return false;" title="S2 Cell Drawer Settings">S2 Cells</a>');

  map.on('moveend', window.plugin.s2celldrawer.redraw);
  window.plugin.s2celldrawer.redraw();
  console.timeEnd('S2 Cell Drawer setup');
};

// Overload for IITC default in order to catch the manual select/deselect event and handle it properly
// Update layerGroups display status to window.overlayStatus and localStorage 'ingress.intelmap.layergroupdisplayed'
window.updateDisplayedLayerGroupModified = function(name, display) {  
  overlayStatus[name] = display;  
  localStorage['ingress.intelmap.layergroupdisplayed'] = JSON.stringify(overlayStatus);
  runHooks('displayedLayerUpdated', {name: name, display: display});
}
  

window.S2 = {};
      var LatLngToXYZ = function(latLng) {
        var d2r = Math.PI/180.0;
        var phi = latLng.lat*d2r;
        var theta = latLng.lng*d2r;
        var cosphi = Math.cos(phi);
        return [Math.cos(theta)*cosphi, Math.sin(theta)*cosphi, Math.sin(phi)];
      };
      var XYZToLatLng = function(xyz) {
        var r2d = 180.0/Math.PI;
        var lat = Math.atan2(xyz[2], Math.sqrt(xyz[0]*xyz[0]+xyz[1]*xyz[1]));
        var lng = Math.atan2(xyz[1], xyz[0]);
        return L.latLng(lat*r2d, lng*r2d);
      };
      var largestAbsComponent = function(xyz) {
        var temp = [Math.abs(xyz[0]), Math.abs(xyz[1]), Math.abs(xyz[2])];
        if (temp[0] > temp[1]) {
          if (temp[0] > temp[2]) {
            return 0;
          } else {
            return 2;
          }
        } else {
          if (temp[1] > temp[2]) {
            return 1;
          } else {
            return 2;
          }
        }
      };
      var faceXYZToUV = function(face,xyz) {
        var u,v;
        switch (face) {
          case 0: u =  xyz[1]/xyz[0]; v =  xyz[2]/xyz[0]; break;
          case 1: u = -xyz[0]/xyz[1]; v =  xyz[2]/xyz[1]; break;
          case 2: u = -xyz[0]/xyz[2]; v = -xyz[1]/xyz[2]; break;
          case 3: u =  xyz[2]/xyz[0]; v =  xyz[1]/xyz[0]; break;
          case 4: u =  xyz[2]/xyz[1]; v = -xyz[0]/xyz[1]; break;
          case 5: u = -xyz[1]/xyz[2]; v = -xyz[0]/xyz[2]; break;
          default: throw {error: 'Invalid face'}; break;
        }
        return [u,v];
      }
      var XYZToFaceUV = function(xyz) {
        var face = largestAbsComponent(xyz);
        if (xyz[face] < 0) {
          face += 3;
        }
        uv = faceXYZToUV (face,xyz);
        return [face, uv];
      };
      var FaceUVToXYZ = function(face,uv) {
        var u = uv[0];
        var v = uv[1];
        switch (face) {
          case 0: return [ 1, u, v];
          case 1: return [-u, 1, v];
          case 2: return [-u,-v, 1];
          case 3: return [-1,-v,-u];
          case 4: return [ v,-1,-u];
          case 5: return [ v, u,-1];
          default: throw {error: 'Invalid face'};
        }
      };
      var STToUV = function(st) {
        var singleSTtoUV = function(st) {
          if (st >= 0.5) {
            return (1/3.0) * (4*st*st - 1);
          } else {
            return (1/3.0) * (1 - (4*(1-st)*(1-st)));
          }
        };
        return [singleSTtoUV(st[0]), singleSTtoUV(st[1])];
      };
      var UVToST = function(uv) {
        var singleUVtoST = function(uv) {
          if (uv >= 0) {
            return 0.5 * Math.sqrt (1 + 3*uv);
          } else {
            return 1 - 0.5 * Math.sqrt (1 - 3*uv);
          }
        };
        return [singleUVtoST(uv[0]), singleUVtoST(uv[1])];
      };
      var STToIJ = function(st,order) {
        var maxSize = (1<<order);
        var singleSTtoIJ = function(st) {
          var ij = Math.floor(st * maxSize);
          return Math.max(0, Math.min(maxSize-1, ij));
        };
        return [singleSTtoIJ(st[0]), singleSTtoIJ(st[1])];
      };
      var IJToST = function(ij,order,offsets) {
        var maxSize = (1<<order);
        return [
          (ij[0]+offsets[0])/maxSize,
          (ij[1]+offsets[1])/maxSize
        ];
      };
      // hilbert space-filling curve
      // based on http://blog.notdot.net/2009/11/Damn-Cool-Algorithms-Spatial-indexing-with-Quadtrees-and-Hilbert-Curves
      // note: rather then calculating the final integer hilbert position, we just return the list of quads
      // this ensures no precision issues whth large orders (S3 cell IDs use up to 30), and is more
      // convenient for pulling out the individual bits as needed later
      var pointToHilbertQuadList = function(x,y,order) {
        var hilbertMap = {
          'a': [ [0,'d'], [1,'a'], [3,'b'], [2,'a'] ],
          'b': [ [2,'b'], [1,'b'], [3,'a'], [0,'c'] ],
          'c': [ [2,'c'], [3,'d'], [1,'c'], [0,'b'] ],
          'd': [ [0,'a'], [3,'c'], [1,'d'], [2,'d'] ]
        };
        var currentSquare='a';
        var positions = [];
        for (var i=order-1; i>=0; i--) {
          var mask = 1<<i;
          var quad_x = x&mask ? 1 : 0;
          var quad_y = y&mask ? 1 : 0;
          var t = hilbertMap[currentSquare][quad_x*2+quad_y];
          positions.push(t[0]);
          currentSquare = t[1];
        }
        return positions;
      };
      // S2Cell class
      S2.S2Cell = function(){};
      //static method to construct
      S2.S2Cell.FromLatLng = function(latLng,level) {
        var xyz = LatLngToXYZ(latLng);
        var faceuv = XYZToFaceUV(xyz);
        var st = UVToST(faceuv[1]);
        var ij = STToIJ(st,level);
        return S2.S2Cell.FromFaceIJ (faceuv[0], ij, level);
      };
      S2.S2Cell.FromFaceIJ = function(face,ij,level) {
        var cell = new S2.S2Cell();
        cell.face = face;
        cell.ij = ij;
        cell.level = level;
        return cell;
      };
      S2.S2Cell.prototype.toString = function() {
        return 'F'+this.face+'ij['+this.ij[0]+','+this.ij[1]+']@'+this.level;
      };
      S2.S2Cell.prototype.getLatLng = function() {
        var st = IJToST(this.ij,this.level, [0.5,0.5]);
        var uv = STToUV(st);
        var xyz = FaceUVToXYZ(this.face, uv);
        return XYZToLatLng(xyz);
      };
      S2.S2Cell.prototype.getCornerLatLngs = function() {
        var result = [];
        var offsets = [
          [ 0.0, 0.0 ],
          [ 0.0, 1.0 ],
          [ 1.0, 1.0 ],
          [ 1.0, 0.0 ]
        ];
        for (var i=0; i<4; i++) {
          var st = IJToST(this.ij, this.level, offsets[i]);
          var uv = STToUV(st);
          var xyz = FaceUVToXYZ(this.face, uv);
          result.push ( XYZToLatLng(xyz) );
        }
        return result;
      };
      S2.S2Cell.prototype.getFaceAndQuads = function() {
        var quads = pointToHilbertQuadList(this.ij[0], this.ij[1], this.level);
        return [this.face,quads];
      };
      S2.S2Cell.prototype.getNeighbors = function() {
        var fromFaceIJWrap = function(face,ij,level) {
          var maxSize = (1<<level);
          if (ij[0]>=0 && ij[1]>=0 && ij[0]<maxSize && ij[1]<maxSize) {
            // no wrapping out of bounds
            return S2.S2Cell.FromFaceIJ(face,ij,level);
          } else {
            // the new i,j are out of range.
            // with the assumption that they're only a little past the borders we can just take the points as
            // just beyond the cube face, project to XYZ, then re-create FaceUV from the XYZ vector
            var st = IJToST(ij,level,[0.5,0.5]);
            var uv = STToUV(st);
            var xyz = FaceUVToXYZ(face,uv);
            var faceuv = XYZToFaceUV(xyz);
            face = faceuv[0];
            uv = faceuv[1];
            st = UVToST(uv);
            ij = STToIJ(st,level);
            return S2.S2Cell.FromFaceIJ (face, ij, level);
          }
        };
        var face = this.face;
        var i = this.ij[0];
        var j = this.ij[1];
        var level = this.level;
        return [
          fromFaceIJWrap(face, [i-1,j], level),
          fromFaceIJWrap(face, [i,j-1], level),
          fromFaceIJWrap(face, [i+1,j], level),
          fromFaceIJWrap(face, [i,j+1], level)
        ];
      };
  
 
// PLUGIN END //////////////////////////////////////////////////////////
setup.info = plugin_info; //add the script info data to the function as a property
if(!window.bootPlugins) window.bootPlugins = [];
window.bootPlugins.push(setup);
// if IITC has already booted, immediately run the 'setup' function
if(window.iitcLoaded && typeof setup === 'function') setup();
}
// wrapper end
// inject code into site context
var script = document.createElement('script');
var info = {};
if (typeof GM_info !== 'undefined' && GM_info && GM_info.script) info.script = { version: GM_info.script.version, name: GM_info.script.name, description: GM_info.script.description };
script.appendChild(document.createTextNode('('+ wrapper +')('+JSON.stringify(info)+');'));
(document.body || document.head || document.documentElement).appendChild(script);
