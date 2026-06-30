// ==UserScript==
// @id           nj-trails-overlay
// @author       DiabloEnMusica
// @name         Trails Overlay 
// @category     Diablo
// @version      2.2.0
// @namespace    https://github.com/diacoviello
// @updateURL      https://raw.githubusercontent.com/diacoviello/IngressMyPlugins/main/myVersion/Diablo_nj-trails.user.js
// @downloadURL    https://raw.githubusercontent.com/diacoviello/IngressMyPlugins/main/myVersion/Diablo_nj-trails.user.js
// @description  Hiking/biking trail overlay that sits on top of ANY base layer. Live OSM (Overpass) by default, NJDEP static optional. Settings panel: use-type filter, color/opacity/weight, adjustable glow, start/end trailhead markers.
// @match        https://intel.ingress.com/*
// @grant        none
// ==/UserScript==

function wrapper(plugin_info) {
  if (typeof window.plugin !== 'function') window.plugin = function () {};
  window.plugin.trails = function () {};
  var self = window.plugin.trails;

  // ======================== CONFIG ========================================
  // 'osm'    -> live Overpass query of the current viewport (recommended).
  // 'static' -> one fixed GeoJSON file (e.g. your filtered/simplified NJDEP export).
  self.SOURCE      = 'osm';
  self.STATIC_URL  = 'https://raw.githubusercontent.com/diacoviello/iitc-data/main/nj_trails.geojson';
  self.OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
  self.MIN_ZOOM    = 14;     // DEFAULT min zoom; live value is adjustable in the panel
  self.DEBOUNCE_MS = 600;    // wait after panning before querying
  // For 'static' NJDEP data, set the field names so the use-classifier works:
  self.NJDEP_FIELDS = { name: 'TRAILNAME', hike: 'HIKE', bike: 'BIKE', horse: 'EQUESTRIAN' };
  // ========================================================================

  self.LS_KEY = 'plugin-trails-settings';

  self.defaults = {
    uses:        { hiking: true, biking: false, horse: false, other: false },
    lineColor:   '#ffffff',
    lineOpacity: 0.9,
    lineWeight:  3,
    glow:        true,
    glowColor:   '#fbff00',
    glowOpacity: 0.4,
    glowSize:    4,    // px of glow spread (also drives blur radius)
    heads:       true, // start/end trailhead markers
    proxMeters:  40,   // portals-near-trail search radius (meters)
    minZoom:     self.MIN_ZOOM // hide trails below this zoom
  };

  // -- settings load/save --------------------------------------------------
  self.loadSettings = function () {
    var s = {};
    try { s = JSON.parse(localStorage.getItem(self.LS_KEY)) || {}; } catch (e) {}
    self.s = Object.assign({}, self.defaults, s);
    self.s.uses = Object.assign({}, self.defaults.uses, s.uses || {});
  };
  self.saveSettings = function () {
    try { localStorage.setItem(self.LS_KEY, JSON.stringify(self.s)); } catch (e) {}
  };

  // -- use-type classification --------------------------------------------
  self.classifyOSM = function (tags) {
    tags = tags || {};
    var hw = tags.highway || '';
    var foot = tags.foot, bike = tags.bicycle, horse = tags.horse;
    var hikeHW = ['path', 'footway', 'track', 'steps', 'bridleway'];
    var uses = [];
    if ((hikeHW.indexOf(hw) >= 0 && foot !== 'no') || foot === 'yes' || foot === 'designated') uses.push('hiking');
    if (hw === 'cycleway' || bike === 'yes' || bike === 'designated') uses.push('biking');
    if (hw === 'bridleway' || horse === 'yes' || horse === 'designated') uses.push('horse');
    if (!uses.length) uses.push('other');
    return uses;
  };
  self.classifyNJDEP = function (p) {
    p = p || {};
    var f = self.NJDEP_FIELDS, yes = function (v) { return v === 'Y' || v === 'Yes' || v === 1 || v === '1' || v === true; };
    var uses = [];
    if (yes(p[f.hike])) uses.push('hiking');
    if (yes(p[f.bike])) uses.push('biking');
    if (yes(p[f.horse])) uses.push('horse');
    if (!uses.length) uses.push('other');
    return uses;
  };

  // -- normalize any source into a tagged FeatureCollection ----------------
  self.osmToFc = function (osm) {
    var feats = [];
    (osm.elements || []).forEach(function (el) {
      if (el.type !== 'way' || !el.geometry || el.geometry.length < 2) return;
      var coords = el.geometry.map(function (g) { return [g.lon, g.lat]; });
      feats.push({
        type: 'Feature',
        properties: {
          _uses: self.classifyOSM(el.tags),
          _name: (el.tags && el.tags.name) || 'Unnamed path'
        },
        geometry: { type: 'LineString', coordinates: coords }
      });
    });
    return { type: 'FeatureCollection', features: feats };
  };
  self.staticToFc = function (gj) {
    (gj.features || []).forEach(function (f) {
      var p = f.properties || (f.properties = {});
      p._uses = self.classifyNJDEP(p);
      p._name = p[self.NJDEP_FIELDS.name] || p.NAME || 'Unnamed trail';
    });
    return gj;
  };

  self.passesFilter = function (f) {
    var u = (f.properties && f.properties._uses) || [];
    return u.some(function (x) { return self.s.uses[x]; });
  };

  // -- styles (read live settings each render) -----------------------------
  self.lineStyle = function () {
    return { color: self.s.lineColor, opacity: self.s.lineOpacity, weight: self.s.lineWeight, lineCap: 'round', lineJoin: 'round' };
  };
  self.glowStyle = function () {
    return { color: self.s.glowColor, opacity: self.s.glowOpacity, weight: self.s.lineWeight + self.s.glowSize * 2, lineCap: 'round', lineJoin: 'round' };
  };

  // -- start/end markers ---------------------------------------------------
  self.endpoints = function (feature) {
    var g = feature.geometry; if (!g) return null;
    var lines = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : null;
    if (!lines || !lines.length) return null;
    var first = lines[0], last = lines[lines.length - 1];
    if (!first.length || !last.length) return null;
    var s = first[0], e = last[last.length - 1];
    return { start: L.latLng(s[1], s[0]), end: L.latLng(e[1], e[0]) };
  };
  self.addHead = function (latlng, fill, label, name) {
    self.headLayer.addLayer(
      L.circleMarker(latlng, { pane: 'njHeads', radius: 5, color: '#111', weight: 1, fillColor: fill, fillOpacity: 0.95 })
        .bindPopup('<b>' + name + '</b><br>' + label)
    );
  };

  // -- (re)render from the cached FeatureCollection ------------------------
  self.render = function () {
    self.glowLayer.clearLayers();
    self.lineLayer.clearLayers();
    self.headLayer.clearLayers();
    if (map.getZoom() < self.s.minZoom) {
      self.setStatus('Zoom in to show trails (min zoom ' + self.s.minZoom + ')');
      return;
    }
    if (!self.fc) return;

    var feats = self.fc.features.filter(self.passesFilter);
    var fc = { type: 'FeatureCollection', features: feats };

    if (self.s.glow) self.glowLayer.addData(fc);
    self.lineLayer.addData(fc);

    if (self.s.heads) {
      var seen = {};
      feats.forEach(function (f) {
        var ep = self.endpoints(f); if (!ep) return;
        var name = (f.properties && f.properties._name) || 'Trail';
        [[ep.start, '#1f9d55', 'Trailhead'], [ep.end, '#e3342f', 'Trailhead']].forEach(function (m) {
          var key = m[0].lat.toFixed(5) + ',' + m[0].lng.toFixed(5);
          if (seen[key]) return; seen[key] = true;
          self.addHead(m[0], m[1], m[2], name);
        });
      });
    }
    self.applyGlowFilter();
    self.setStatus(feats.length + ' segment(s) shown');
  };

  // -- soft glow via SVG blur on the glow renderer (degrades gracefully) ---
  self.applyGlowFilter = function () {
    try { if (self._blur) self._blur.setAttribute('stdDeviation', String(Math.max(0.01, self.s.glowSize / 2))); } catch (e) {}
    try {
      var g = self.glowRenderer && self.glowRenderer._rootGroup;
      if (g) g.setAttribute('filter', self.s.glow ? 'url(#njtrail-glow)' : '');
    } catch (e) {}
  };

  // -- portals-near-trail finder -------------------------------------------
  // Distance from point P to segment A-B, all in projected pixel space.
  self.pointToSeg = function (p, a, b) {
    var dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
    if (l2 === 0) return Math.sqrt((p.x - a.x) * (p.x - a.x) + (p.y - a.y) * (p.y - a.y));
    var t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
    var cx = a.x + t * dx, cy = a.y + t * dy, ex = p.x - cx, ey = p.y - cy;
    return Math.sqrt(ex * ex + ey * ey);
  };

  self.findNearbyPortals = function () {
    self.nearLayer.clearLayers();
    self._results = [];
    if (!self.fc || !window.portals) { self.setStatus('No trail data / portals loaded'); self.renderResults(); return; }

    var zoom = map.getZoom();
    var feats = self.fc.features.filter(self.passesFilter);

    // Project every trail segment into pixel space once.
    var segs = [];
    feats.forEach(function (f) {
      var g = f.geometry;
      var lines = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [];
      lines.forEach(function (line) {
        var pts = line.map(function (c) { return map.project(L.latLng(c[1], c[0]), zoom); });
        for (var i = 0; i < pts.length - 1; i++) segs.push([pts[i], pts[i + 1], f.properties._name]);
      });
    });
    if (!segs.length) { self.setStatus('No trail segments match the current filter'); self.renderResults(); return; }

    var thr = self.s.proxMeters, count = 0, tested = 0;
    for (var guid in window.portals) {
      var pm = window.portals[guid], ll;
      try { ll = pm.getLatLng(); } catch (e) { continue; }
      if (!ll) continue;
      tested++;

      var pp = map.project(ll, zoom);
      var mpp = 40075016.686 * Math.cos(ll.lat * Math.PI / 180) / (256 * Math.pow(2, zoom)); // meters/pixel
      var thrPx = thr / mpp;
      var best = Infinity, bestName = null;

      for (var i = 0; i < segs.length; i++) {
        var a = segs[i][0], b = segs[i][1];
        if (pp.x < Math.min(a.x, b.x) - thrPx || pp.x > Math.max(a.x, b.x) + thrPx) continue; // bbox reject
        if (pp.y < Math.min(a.y, b.y) - thrPx || pp.y > Math.max(a.y, b.y) + thrPx) continue;
        var d = self.pointToSeg(pp, a, b);
        if (d < best) { best = d; bestName = segs[i][2]; }
      }

      if (best <= thrPx) {
        var distM = best * mpp;
        var title = (pm.options && pm.options.data && pm.options.data.title) || 'Portal';
        self._results.push({ guid: guid, ll: ll, distM: distM, title: title, trail: bestName });
        L.circleMarker(ll, { renderer: self.nearRenderer, radius: 9, color: '#ff00ff', weight: 2, fill: false })
          .bindPopup('<b>' + title + '</b><br>' + Math.round(distM) + ' m from ' + (bestName || 'trail'))
          .addTo(self.nearLayer);
        count++;
      }
    }

    self._results.sort(function (x, y) { return x.distM - y.distM; });
    if (tested < 5) {
      self.setStatus('Only ' + tested + ' portals loaded — zoom in so IITC loads portals, then retry');
    } else {
      self.setStatus(count + ' portal(s) within ' + thr + ' m of a trail (' + tested + ' tested)');
    }
    self.renderResults();
  };

  self.gotoPortal = function (guid, ll) {
    map.setView(ll, Math.max(map.getZoom(), 17));
    try { if (window.renderPortalDetails) window.renderPortalDetails(guid); } catch (e) {}
  };

  self.renderResults = function () {
    var box = document.getElementById('trails-results');
    if (!box) return;
    box.innerHTML = '';
    if (!self._results || !self._results.length) return;
    self._results.forEach(function (r) {
      var row = document.createElement('a');
      row.href = '#';
      row.style.cssText = 'display:block;padding:3px 0;border-bottom:1px solid #333;text-decoration:none;';
      row.textContent = Math.round(r.distM) + ' m \u2014 ' + r.title;
      row.title = r.trail || '';
      row.addEventListener('click', function (ev) { ev.preventDefault(); self.gotoPortal(r.guid, r.ll); });
      box.appendChild(row);
    });
  };

  // -- data loading --------------------------------------------------------
  self.scheduleUpdate = function () {
    if (self.SOURCE !== 'osm') return;
    clearTimeout(self._t);
    self._t = setTimeout(self.fetchOSM, self.DEBOUNCE_MS);
  };
  self.fetchOSM = function () {
    if (map.getZoom() < self.s.minZoom) {
      self.fc = { type: 'FeatureCollection', features: [] }; self.render();
      self.setStatus('Zoom in to load trails (zoom ' + self.s.minZoom + '+)');
      return;
    }
    var b = map.getBounds();
    var q = '[out:json][timeout:25];'
          + 'way["highway"~"^(path|footway|track|cycleway|bridleway|steps)$"]'
          + '(' + b.getSouth() + ',' + b.getWest() + ',' + b.getNorth() + ',' + b.getEast() + ');'
          + 'out geom;';
    if (self._ctrl) self._ctrl.abort();
    self._ctrl = new AbortController();
    self.setStatus('Loading from OSM…');
    fetch(self.OVERPASS_URL, { method: 'POST', body: 'data=' + encodeURIComponent(q), signal: self._ctrl.signal })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (osm) { self.fc = self.osmToFc(osm); self.render(); })
      .catch(function (e) { if (e.name !== 'AbortError') { console.error('[Trails]', e); self.setStatus('Overpass error (rate limit?)'); } });
  };
  self.fetchStatic = function () {
    self.setStatus('Loading static file…');
    fetch(self.STATIC_URL)
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (gj) { self.fc = self.staticToFc(gj); self.render(); })
      .catch(function (e) { console.error('[Trails]', e); self.setStatus('File load error'); });
  };

  // -- settings panel ------------------------------------------------------
  self.setStatus = function (msg) {
    self._status = msg;
    var el = document.getElementById('trails-status');
    if (el) el.textContent = msg;
  };

  self.row = function (labelText, control) {
    var d = document.createElement('div');
    d.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin:6px 0;gap:8px;';
    var l = document.createElement('label'); l.textContent = labelText; l.style.flex = '1';
    d.appendChild(l); d.appendChild(control); return d;
  };
  self.checkbox = function (checked, onchange) {
    var c = document.createElement('input'); c.type = 'checkbox'; c.checked = checked;
    c.addEventListener('change', function () { onchange(c.checked); }); return c;
  };
  self.colorInput = function (val, onchange) {
    var c = document.createElement('input'); c.type = 'color'; c.value = val;
    c.addEventListener('input', function () { onchange(c.value); }); return c;
  };
  self.range = function (val, min, max, step, onchange) {
    var c = document.createElement('input'); c.type = 'range';
    c.min = min; c.max = max; c.step = step; c.value = val; c.style.width = '130px';
    c.addEventListener('input', function () { onchange(parseFloat(c.value)); }); return c;
  };

  self.buildPanel = function () {
    var s = self.s;
    var root = document.createElement('div');
    root.style.cssText = 'min-width:240px;font-size:13px;';
    var commit = function () { self.saveSettings(); self.render(); };

    var h1 = document.createElement('div'); h1.textContent = 'Show trail types'; h1.style.cssText = 'font-weight:bold;margin-top:2px;';
    root.appendChild(h1);
    [['hiking', 'Hiking / footpaths'], ['biking', 'Biking / cycleways'], ['horse', 'Equestrian'], ['other', 'Other / unclassified']].forEach(function (u) {
      root.appendChild(self.row(u[1], self.checkbox(s.uses[u[0]], function (v) { s.uses[u[0]] = v; commit(); })));
    });

    var hz = document.createElement('div'); hz.textContent = 'Visibility'; hz.style.cssText = 'font-weight:bold;margin-top:10px;';
    root.appendChild(hz);
    var zoomVal = document.createElement('span');
    zoomVal.textContent = s.minZoom;
    zoomVal.style.cssText = 'min-width:20px;text-align:right;';
    var zoomSlider = self.range(s.minZoom, 8, 19, 1, function (v) {
      s.minZoom = v; zoomVal.textContent = v; self.saveSettings();
      self.SOURCE === 'osm' ? self.fetchOSM() : self.render();
    });
    zoomSlider.style.width = '105px';
    var zoomWrap = document.createElement('div');
    zoomWrap.style.cssText = 'display:flex;align-items:center;gap:6px;';
    zoomWrap.appendChild(zoomSlider); zoomWrap.appendChild(zoomVal);
    root.appendChild(self.row('Min zoom to show', zoomWrap));

    var h2 = document.createElement('div'); h2.textContent = 'Trail line'; h2.style.cssText = 'font-weight:bold;margin-top:10px;';
    root.appendChild(h2);
    root.appendChild(self.row('Color', self.colorInput(s.lineColor, function (v) { s.lineColor = v; commit(); })));
    root.appendChild(self.row('Opacity', self.range(s.lineOpacity, 0.1, 1, 0.05, function (v) { s.lineOpacity = v; commit(); })));
    root.appendChild(self.row('Weight', self.range(s.lineWeight, 1, 8, 0.5, function (v) { s.lineWeight = v; commit(); })));

    var h3 = document.createElement('div'); h3.textContent = 'Glow'; h3.style.cssText = 'font-weight:bold;margin-top:10px;';
    root.appendChild(h3);
    root.appendChild(self.row('Enabled', self.checkbox(s.glow, function (v) { s.glow = v; commit(); })));
    root.appendChild(self.row('Color', self.colorInput(s.glowColor, function (v) { s.glowColor = v; commit(); })));
    root.appendChild(self.row('Opacity', self.range(s.glowOpacity, 0.05, 1, 0.05, function (v) { s.glowOpacity = v; commit(); })));
    root.appendChild(self.row('Size', self.range(s.glowSize, 1, 20, 1, function (v) { s.glowSize = v; commit(); })));

    var h4 = document.createElement('div'); h4.textContent = 'Markers'; h4.style.cssText = 'font-weight:bold;margin-top:10px;';
    root.appendChild(h4);
    root.appendChild(self.row('Trailheads (start/end)', self.checkbox(s.heads, function (v) { s.heads = v; commit(); })));

    var h5 = document.createElement('div'); h5.textContent = 'Portal finder'; h5.style.cssText = 'font-weight:bold;margin-top:10px;';
    root.appendChild(h5);
    root.appendChild(self.row('Search radius (m)', self.range(s.proxMeters, 5, 150, 5, function (v) { s.proxMeters = v; self.saveSettings(); })));
    var findBtn = document.createElement('button'); findBtn.textContent = 'Find portals near trails';
    findBtn.style.cssText = 'width:100%;margin-top:4px;';
    findBtn.addEventListener('click', self.findNearbyPortals);
    root.appendChild(findBtn);
    var resultsBox = document.createElement('div');
    resultsBox.id = 'trails-results';
    resultsBox.style.cssText = 'margin-top:8px;max-height:170px;overflow:auto;';
    root.appendChild(resultsBox);

    var status = document.createElement('div');
    status.id = 'trails-status'; status.textContent = self._status || '';
    status.style.cssText = 'margin-top:10px;color:#aaa;font-style:italic;';
    root.appendChild(status);

    var btns = document.createElement('div'); btns.style.cssText = 'margin-top:10px;display:flex;gap:8px;';
    var reset = document.createElement('button'); reset.textContent = 'Reset';
    reset.addEventListener('click', function () {
      self.s = JSON.parse(JSON.stringify(self.defaults));
      self.saveSettings(); self.render();
      self.dialogApi && self.dialogApi.dialog && self.dialogApi.dialog('close');
      self.openPanel();
    });
    var refresh = document.createElement('button'); refresh.textContent = 'Refresh data';
    refresh.addEventListener('click', function () { self.SOURCE === 'osm' ? self.fetchOSM() : self.fetchStatic(); });
    btns.appendChild(refresh); btns.appendChild(reset);
    root.appendChild(btns);

    return root;
  };

  self.openPanel = function () {
    self.dialogApi = window.dialog({
      title: 'Trails Overlay',
      html: self.buildPanel(),
      id: 'plugin-trails-panel',
      width: 'auto'
    });
    self.renderResults();
  };

  // -- setup ---------------------------------------------------------------
  self.setup = function () {
    self.loadSettings();

    // dedicated panes so order is: glow < lines < heads (all above base layer)
    map.createPane('njGlow').style.zIndex  = 398;
    map.createPane('njLines').style.zIndex = 400;
    map.createPane('njHeads').style.zIndex = 402;
    map.createPane('njNear').style.zIndex  = 590;  // portal highlights above IITC portals

    self.glowRenderer = L.svg({ pane: 'njGlow' }); self.glowRenderer.addTo(map);
    self.lineRenderer = L.svg({ pane: 'njLines' }); self.lineRenderer.addTo(map);

    // inject the blur filter once into the glow renderer's <svg>
    try {
      var ns = 'http://www.w3.org/2000/svg';
      var svg = self.glowRenderer._container;
      var defs = document.createElementNS(ns, 'defs');
      var filt = document.createElementNS(ns, 'filter');
      filt.setAttribute('id', 'njtrail-glow');
      filt.setAttribute('x', '-50%'); filt.setAttribute('y', '-50%');
      filt.setAttribute('width', '200%'); filt.setAttribute('height', '200%');
      self._blur = document.createElementNS(ns, 'feGaussianBlur');
      self._blur.setAttribute('stdDeviation', String(self.s.glowSize / 2));
      filt.appendChild(self._blur); defs.appendChild(filt); svg.appendChild(defs);
    } catch (e) { console.warn('[Trails] glow filter unavailable, using flat glow', e); }

    self.glowLayer = new L.GeoJSON(null, { renderer: self.glowRenderer, style: self.glowStyle, interactive: false });
    self.lineLayer = new L.GeoJSON(null, { renderer: self.lineRenderer, style: self.lineStyle,
      onEachFeature: function (f, layer) { layer.bindPopup('<b>' + (f.properties._name || 'Trail') + '</b>'); } });
    self.headLayer = new L.LayerGroup();
    self.nearRenderer = L.svg({ pane: 'njNear' }); self.nearRenderer.addTo(map);
    self.nearLayer = new L.LayerGroup();

    // overlays — render above whatever base layer is selected
    window.addLayerGroup('Trails (lines + glow)', L.layerGroup([self.glowLayer, self.lineLayer]), true);
    window.addLayerGroup('Trailheads (start/end)', self.headLayer, true);
    window.addLayerGroup('Portals near trails', self.nearLayer, true);

    // toolbox entry to open the settings panel
    $('#toolbox').append($('<a>', { text: 'Trails', title: 'Trail overlay settings', click: self.openPanel }));

    if (self.SOURCE === 'osm') {
      map.on('moveend', self.scheduleUpdate);
      self.fetchOSM();
    } else {
      map.on('zoomend', self.render);
      self.fetchStatic();
    }
  };

  var setup = self.setup;
  setup.info = plugin_info;
  if (!window.bootPlugins) window.bootPlugins = [];
  window.bootPlugins.push(setup);
  if (window.iitcLoaded) setup();
}

var script = document.createElement('script');
var info = {};
if (typeof GM_info !== 'undefined' && GM_info && GM_info.script) info.script = GM_info.script;
script.appendChild(document.createTextNode('(' + wrapper + ')(' + JSON.stringify(info) + ');'));
(document.body || document.head || document.documentElement).appendChild(script);
