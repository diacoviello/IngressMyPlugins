// ==UserScript==
// @author         DiabloEnMusica
// @name           Portal Street View
// @category       Diablo
// @description    Adds a Google Streetview popup for portals, accessible via a button in the portal details or by long-pressing the map (mobile) / right-clicking the map (desktop). The target portal and any other portals within 100 m are pinned onto the Street View sphere at their true ground positions (and stay anchored as you move). An interactive overhead minimap shows a live Google pegman you can drag to reposition the view, plus zoom. Works on both desktop IITC and IITC-Mobile. When the nearest camera is out of Ingress deploy range, it shows the distance and a suggested parking spot.
// @version        2.1.1
// @namespace      https://github.com/diacoviello/IngressMyPlugins
// @updateURL      https://raw.githubusercontent.com/diacoviello/IngressMyPlugins/main/myVersion/Diablo_iitc_streetview.user.js
// @downloadURL    https://raw.githubusercontent.com/diacoviello/IngressMyPlugins/main/myVersion/Diablo_iitc_streetview.user.js
// @match          https://intel.ingress.com/*
// @match          http://intel.ingress.com/*
// @match          https://*.ingress.com/intel*
// @match          http://*.ingress.com/intel*
// @grant          none
// ==/UserScript==

/* global $, L, map, google */

;(function () {
  'use strict';

  // ── Config ─────────────────────────────────────────────────────────────────
  const PLUGIN_NAME  = 'Portal Street View';
  const SV_FOV       = 90;
  const SV_PITCH     = 5;
  const PANO_RADIUS  = 100; // metres to search for coverage
  const DEPLOY_RANGE = 40;  // Ingress interaction/deploy range in metres
  const PORTAL_HEIGHT_M = 1.83; // real-world height (~6 ft) the beacon should appear in Street View

  // Map pin icon (SVG, transparent background)
  const _PORTAL_SVG= `<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg"><path d="M512 85.333333c-164.949333 0-298.666667 133.738667-298.666667 298.666667 0 164.949333 298.666667 554.666667 298.666667 554.666667s298.666667-389.717333 298.666667-554.666667c0-164.928-133.717333-298.666667-298.666667-298.666667z m0 448a149.333333 149.333333 0 1 1 0-298.666666 149.333333 149.333333 0 0 1 0 298.666666z" fill="#FF3D00" /></svg>`;
  const PORTAL_ICON_URL= 'data:image/svg+xml,' + encodeURIComponent(_PORTAL_SVG);
  // ───────────────────────────────────────────────────────────────────────────

  // ── Device detection ────────────────────────────────────────────────────────
  const isMobile = () =>
    /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent) ||
    (window.innerWidth <= 768);

  // ── Inject CSS once ─────────────────────────────────────────────────────────
  function injectCSS() {
    if ($('#sv-style').length) return;
    $('head').append(`
      <style id="sv-style">
        /* Shared */
        #sv-overlay {
          display: none;
          position: fixed;
          z-index: 9998;
          top: 0; left: 0;
          width: 100%; height: 100%;
          background: rgba(0,0,0,0.6);
        }
        #sv-modal {
          display: none;
          position: fixed;
          z-index: 9999;
          background: #1a1a1a;
          border: 2px solid #00bfff;
          border-radius: 6px;
          box-shadow: 0 0 30px rgba(0,191,255,0.35);
          font-family: sans-serif;
          color: #eee;
          overflow: hidden;
        }
        #sv-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          background: #111;
          cursor: move;
          user-select: none;
          -webkit-user-select: none;
        }
        #sv-title {
          font-size: 13px;
          font-weight: bold;
          color: #00bfff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 85%;
        }
        #sv-close {
          background: none;
          border: none;
          color: #aaa;
          font-size: 22px;
          line-height: 1;
          cursor: pointer;
          padding: 0 4px;
          -webkit-tap-highlight-color: transparent;
        }
        #sv-pano-container { position: relative; }
        #sv-pano { width: 100%; }
        #sv-minimap {
          position: absolute;
          bottom: 8px; right: 8px;
          width: 180px; height: 180px;
          border: 2px solid #00bfff;
          border-radius: 4px;
          box-shadow: 0 0 8px rgba(0,0,0,0.6);
          z-index: 10;
          overflow: hidden;
        }
        #sv-status {
          padding: 5px 12px;
          font-size: 11px;
          color: #888;
          background: #111;
        }
        /* ── Desktop layout ── */
        @media (min-width: 769px) {
          #sv-modal {
            width: 600px;
            top: 50%; left: 50%;
            transform: translate(-50%, -50%);
          }
          #sv-pano { height: 450px; }
        }
        /* ── Mobile layout — full-screen ── */
        @media (max-width: 768px) {
          #sv-minimap { width: 170px; height: 170px; bottom: 8px; right: 8px; }
          /* Shrink the minimap's zoom control so it doesn't cover the map */
          #sv-minimap .gm-bundled-control,
          #sv-minimap .gm-bundled-control-on-bottom {
            transform: scale(0.6);
            transform-origin: 100% 100%;
          }
          #sv-modal {
            width: 100% !important;
            height: 100% !important;
            height: 100dvh !important;
            left: 0 !important;
            top: 0 !important;
            bottom: auto !important;
            transform: none !important;
            border-radius: 0;
            border: none;
            display: flex;
            flex-direction: column;
          }
          #sv-header { cursor: default; }
          #sv-pano-container { flex: 1 1 auto; min-height: 0; }
          #sv-pano { height: 100%; min-height: 0; max-height: none; }
          #sv-close { font-size: 26px; }
          #sv-status { font-size: 12px; padding: 6px 14px 10px; }
        }

        /* Street View button — portal pane */
        .sv-btn {
          display: inline-block;
          margin: 4px 2px;
          padding: 5px 11px;
          background: #003344;
          border: 1px solid #00bfff;
          border-radius: 4px;
          color: #00bfff;
          cursor: pointer;
          font-size: 12px;
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
        }
        .sv-btn:active { background: #005566; }
      </style>
    `);
  }

  // ── Build modal DOM (once) ───────────────────────────────────────────────────
  function buildModal() {
    if ($('#sv-modal').length) return;
    injectCSS();

    $('body').append(`
      <div id="sv-overlay"></div>
      <div id="sv-modal">
        <div id="sv-header">
          <span id="sv-title">Street View</span>
          <button id="sv-close" aria-label="Close">&times;</button>
        </div>
        <div id="sv-pano-container">
          <div id="sv-pano"></div>
          <div id="sv-minimap"></div>
        </div>
        <div id="sv-status">Loading…</div>
      </div>
    `);

    $('#sv-close').on('click', closeModal);

    // Mobile: tap overlay to close
    $('#sv-overlay').on('click touchend', closeModal);

    // Mobile: swipe down on header to close
    setupSwipeToClose($('#sv-header')[0]);

    // Desktop: draggable
    if (!isMobile()) {
      makeDraggable($('#sv-modal')[0], $('#sv-header')[0]);
    }
  }

  // ── Swipe-down-to-close (mobile) ────────────────────────────────────────────
  function setupSwipeToClose(handle) {
    let startY = null;
    handle.addEventListener('touchstart', e => {
      startY = e.touches[0].clientY;
    }, { passive: true });
    handle.addEventListener('touchend', e => {
      if (startY === null) return;
      const dy = e.changedTouches[0].clientY - startY;
      if (dy > 60) closeModal(); // swipe down ≥60px = close
      startY = null;
    }, { passive: true });
  }

  // ── Open Street View ────────────────────────────────────────────────────────
  let svPanorama      = null;
  let svMiniMap       = null;
  let svPathLine      = null;
  let svPosListener   = null;
  let svPanoMarkers   = []; // google.maps.Marker[] drawn on the panorama sphere
  let svMiniMarkers   = []; // google.maps.Marker[] drawn on the overhead minimap
  let svCurrentPortal = null; // { lat, lng, imageUrl }

  function openStreetView(lat, lng, portalName, portalImageUrl) {
    buildModal();
    $('#sv-title').text(`📍 ${portalName || 'Portal'}`);
    $('#sv-status').text('Loading…');
    $('#sv-modal, #sv-overlay').show();

    if (typeof google === 'undefined' || !google.maps || !google.maps.StreetViewPanorama) {
      setStatus('⚠ Google Maps API not available.');
      return;
    }

    const pos = { lat, lng };
    svCurrentPortal = { lat, lng, imageUrl: portalImageUrl };

    if (!svPanorama) {
      svPanorama = new google.maps.StreetViewPanorama(
        document.getElementById('sv-pano'),
        {
          position: pos,
          pov: { heading: 0, pitch: SV_PITCH },
          fov: SV_FOV,
          addressControl: false,
          fullscreenControl: false,
          motionTracking: false,
          motionTrackingControl: false,
          // Disable keyboard shortcuts on mobile to prevent map interference
          clickToGo: !isMobile(),
          scrollwheel: !isMobile(),
        }
      );
      // Re-draw nearby portals & recenter the minimap whenever the camera
      // is moved (clicking an arrow, dragging the pegman, etc.). The target
      // portal marker is anchored by Google and tracks automatically — this
      // listener only refreshes the *nearby* set relative to the new spot.
      svPosListener = svPanorama.addListener('position_changed', onPanoMoved);
      // Re-scale beacons on pan/zoom so they hold a constant real-world height.
      svPanorama.addListener('pov_changed', resizePanoMarkers);
    } else {
      svPanorama.setPosition(pos);
      svPanorama.setPov({ heading: 0, pitch: SV_PITCH });
    }

    const svc = new google.maps.StreetViewService();
    svc.getPanorama({ location: pos, radius: PANO_RADIUS }, (data, status) => {
      if (status === google.maps.StreetViewStatus.OK) {
        const panoLatLng = data.location.latLng;
        const heading = google.maps.geometry.spherical.computeHeading(
          panoLatLng,
          new google.maps.LatLng(lat, lng)
        );
        // Load the imagery synchronously so it always appears, even where a
        // deferred callback might not run (IITC-Mobile's WebView doesn't
        // reliably service requestAnimationFrame).
        svPanorama.setPano(data.location.pano);
        svPanorama.setPov({ heading, pitch: SV_PITCH });
        // The modal was just shown (display:none → block); the panorama's
        // canvas can initialize at the wrong size before layout flushed,
        // leaving it blank until an interaction forces a resize. Once layout
        // settles, force the resize ourselves and re-apply the POV so the
        // imagery renders without needing a pegman drag.
        setTimeout(() => {
          google.maps.event.trigger(svPanorama, 'resize');
          svPanorama.setPov({ heading, pitch: SV_PITCH });
        }, 0);
        const dist = Math.round(
          google.maps.geometry.spherical.computeDistanceBetween(
            panoLatLng, new google.maps.LatLng(lat, lng)
          )
        );
        const parkLat = panoLatLng.lat().toFixed(6);
        const parkLng = panoLatLng.lng().toFixed(6);
        const outOfRange = dist > DEPLOY_RANGE;
        const parkingNote = outOfRange
          ? ` · Park at (${parkLat}, ${parkLng}) and walk ${dist}m to portal`
          : '';
        setStatus(
          isMobile()
            ? `📷 ~${dist}m away · Swipe down or tap ✕ to close${parkingNote}`
            : `📷 Coverage ~${dist}m from portal · Drag the pegman to move${parkingNote}`
        );
        updateMiniMap(lat, lng, panoLatLng, dist, portalImageUrl);
        drawPortalMarkers(panoLatLng);
      } else {
        setStatus('⚠ No Street View coverage within 100 m of this portal.');
      }
    });
  }

  function setStatus(msg) { $('#sv-status').text(msg); }

  // Fired when the user navigates the panorama (arrows / pegman drag).
  function onPanoMoved() {
    if (!svPanorama) return;
    const p = svPanorama.getPosition();
    if (!p) return;
    drawPortalMarkers(p);
    if (svMiniMap) svMiniMap.panTo(p);
  }

  // ── Street View sphere markers (target portal + everything within range) ─────
  // Markers added with `setMap(panorama)` are projected onto the sphere by
  // Google at their real-world ground position and stay locked there as the
  // camera pans and as you walk between adjacent panoramas — no manual trig.
  function drawPortalMarkers(centerLatLng) {
    if (!svPanorama || !svCurrentPortal) return;

    // Clear previous sphere markers
    svPanoMarkers.forEach(m => m.setMap(null));
    svPanoMarkers = [];

    const targetLatLng = new google.maps.LatLng(svCurrentPortal.lat, svCurrentPortal.lng);
    svPanoMarkers.push(makePanoMarker(targetLatLng, 'Target portal'));

    // Other portals within PANO_RADIUS of where we're standing
    getNearbyPortals(centerLatLng, PANO_RADIUS, targetLatLng).forEach(p => {
      svPanoMarkers.push(makePanoMarker(p.latLng, p.title));
    });

    resizePanoMarkers(); // size them for the current distance/zoom
  }

  // Beacon marker on the panorama. Size is set later by resizePanoMarkers().
  function makePanoMarker(latLng, title) {
    return new google.maps.Marker({
      position: latLng,
      map: svPanorama,
      title,
      optimized: false, // required for crisp SVG data-URL rendering
      icon: { url: PORTAL_ICON_URL, scaledSize: new google.maps.Size(56, 56), anchor: new google.maps.Point(28, 52) },
    });
  }

  // Street View markers are fixed pixel size (Google does not perspective-scale
  // them), so we resize each one ourselves to hold a constant real-world height
  // of PORTAL_HEIGHT_M as the camera distance and zoom change.
  function resizePanoMarkers() {
    if (!svPanorama || !svPanoMarkers.length) return;
    const camPos = svPanorama.getPosition();
    if (!camPos) return;
    const panoEl = document.getElementById('sv-pano');
    if (!panoEl) return;
    const W = panoEl.offsetWidth, H = panoEl.offsetHeight;
    if (!W || !H) return;

    // Vertical field of view in radians: hFov = 180 / 2^zoom degrees.
    const zoom    = svPanorama.getPov().zoom || 1;
    const hFovRad = (180 / Math.pow(2, zoom)) * Math.PI / 180;
    const vFovRad = hFovRad * H / W;
    const spherical = google.maps.geometry.spherical;

    svPanoMarkers.forEach(m => {
      const pos = m.getPosition();
      if (!pos) return;
      const d = Math.max(1, spherical.computeDistanceBetween(camPos, pos));
      // Angular height subtended by a PORTAL_HEIGHT_M object at distance d → px.
      const angular = 2 * Math.atan((PORTAL_HEIGHT_M / 2) / d);
      let hPx = (angular / vFovRad) * H;
      hPx = Math.max(12, Math.min(hPx, H * 4)); // clamp to sane bounds
      // Skip redundant setIcon (pure heading pans don't change size) to avoid
      // reloading the SVG and flickering.
      if (Math.abs((m.__svH || 0) - hPx) < 0.5) return;
      m.__svH = hPx;
      const wPx = hPx;                           // preserve SVG aspect ratio (1:1)
      m.setIcon({
        url: PORTAL_ICON_URL,
        scaledSize: new google.maps.Size(wPx, hPx),
        anchor: new google.maps.Point(wPx / 2, hPx * 0.92), // pin tip sits on ground
      });
    });
  }

  // Build a portal-beacon Marker. Anchor sits near the base of the beacon so
  // the icon "stands" on the ground at the coordinate.
  function makeBeaconMarker(latLng, title, size, targetMap) {
    const h = size; // preserve SVG aspect ratio (1:1)
    return new google.maps.Marker({
      position: latLng,
      map: targetMap,
      title,
      optimized: false, // required for crisp SVG data-URL rendering
      icon: {
        url: PORTAL_ICON_URL,
        scaledSize: new google.maps.Size(size, h),
        anchor: new google.maps.Point(size / 2, Math.round(h * 0.92)),
      },
    });
  }

  // Collect IITC portals (window.portals) within `radius` m of `centerLatLng`,
  // skipping the target portal itself.
  function getNearbyPortals(centerLatLng, radius, targetLatLng) {
    const out = [];
    if (!window.portals) return out;
    const spherical = google.maps.geometry.spherical;
    for (const guid in window.portals) {
      const layer = window.portals[guid];
      if (!layer || typeof layer.getLatLng !== 'function') continue;
      const ll = layer.getLatLng();
      const latLng = new google.maps.LatLng(ll.lat, ll.lng);
      // Skip the target (same spot, within ~3 m)
      if (spherical.computeDistanceBetween(latLng, targetLatLng) < 3) continue;
      if (spherical.computeDistanceBetween(latLng, centerLatLng) > radius) continue;
      const data = (layer.options && layer.options.data) || {};
      out.push({ latLng, title: data.title || 'Portal' });
    }
    return out;
  }

  // ── Mini overhead map ────────────────────────────────────────────────────────
  // The minimap is *linked* to the panorama (setStreetView). That makes Google
  // render its own pegman on the map showing the camera's position + heading,
  // and dragging that pegman drives the Street View. Zoom & pan are enabled so
  // the user can scroll in/out and reposition the pegman manually.
  function updateMiniMap(portalLat, portalLng, panoLatLng, dist, portalImageUrl) {
    const portalLatLng = new google.maps.LatLng(portalLat, portalLng);
    const mapEl = document.getElementById('sv-minimap');

    if (!svMiniMap) {
      svMiniMap = new google.maps.Map(mapEl, {
        mapTypeId: 'satellite',
        tilt: 0,
        gestureHandling: 'greedy', // scroll/drag/pinch zoom without modifier keys
        zoomControl: true,
        streetViewControl: true,    // shows the draggable pegman
        mapTypeControl: false,
        fullscreenControl: false,
        rotateControl: false,
        clickableIcons: false,
        keyboardShortcuts: false,
      });
      svMiniMap.setStreetView(svPanorama); // link → live pegman + drag-to-move
    }

    // Fit both points in view (only on (re)open, not on every pano move)
    const bounds = new google.maps.LatLngBounds();
    bounds.extend(portalLatLng);
    bounds.extend(panoLatLng);
    svMiniMap.fitBounds(bounds, 24);
    google.maps.event.addListenerOnce(svMiniMap, 'bounds_changed', () => {
      if ((svMiniMap.getZoom() || 0) > 19) svMiniMap.setZoom(19);
    });

    // Overhead portal markers (target + nearby) — mirror the sphere markers.
    svMiniMarkers.forEach(m => m.setMap(null));
    svMiniMarkers = [];
    svMiniMarkers.push(makeBeaconMarker(portalLatLng, 'Target portal', 30, svMiniMap));
    getNearbyPortals(panoLatLng, PANO_RADIUS, portalLatLng).forEach(p => {
      svMiniMarkers.push(makeBeaconMarker(p.latLng, p.title, 20, svMiniMap));
    });

    if (dist > DEPLOY_RANGE) {
      // Dashed line from camera/parking spot to portal
      const dash = { path: 'M 0,-1 0,1', strokeOpacity: 1, strokeColor: '#ffcc00', scale: 3 };
      if (!svPathLine) {
        svPathLine = new google.maps.Polyline({
          path: [panoLatLng, portalLatLng],
          strokeOpacity: 0,
          icons: [{ icon: dash, offset: '0', repeat: '10px' }],
          map: svMiniMap,
        });
      } else {
        svPathLine.setPath([panoLatLng, portalLatLng]);
        svPathLine.setMap(svMiniMap);
      }
    } else {
      if (svPathLine) svPathLine.setMap(null);
    }
  }

  // ── Close modal ─────────────────────────────────────────────────────────────
  function closeModal() {
    svPanoMarkers.forEach(m => m.setMap(null));
    svPanoMarkers = [];
    svMiniMarkers.forEach(m => m.setMap(null));
    svMiniMarkers = [];
    if (svPathLine) svPathLine.setMap(null);
    $('#sv-modal, #sv-overlay').hide();
  }

  // ── Desktop drag ────────────────────────────────────────────────────────────
  function makeDraggable(el, handle) {
    let ox, oy, mx, my;
    handle.addEventListener('mousedown', e => {
      e.preventDefault();
      mx = e.clientX; my = e.clientY;
      document.onmouseup   = () => { document.onmouseup = document.onmousemove = null; };
      document.onmousemove = e => {
        ox = mx - e.clientX; oy = my - e.clientY;
        mx = e.clientX;      my = e.clientY;
        el.style.transform = 'none';
        el.style.top  = (el.offsetTop  - oy) + 'px';
        el.style.left = (el.offsetLeft - ox) + 'px';
      };
    });
  }

  // ── Inject button into portal detail pane ───────────────────────────────────
  function addPortalButton(data) {
    if (!data || !data.portal) return;

    const ll    = data.portal.getLatLng();
    const lat   = ll.lat;
    const lng   = ll.lng;
    const name  = data.portal.options.data.title || 'Portal';
    const image = data.portal.options.data.image || null;

    const btn = $('<a>', {
      text:  '🔭 Street View',
      title: 'Open Google Street View near this portal',
      class: 'sv-btn',
    }).on('click touchend', e => {
      e.preventDefault();
      e.stopPropagation();
      openStreetView(lat, lng, name, image);
    });

    $('#portaldetails').find('.imgpreview').after(
      $('<div>').css({ padding: '4px 8px' }).append(btn)
    );
  }

  // ── Map long-press (mobile) / right-click (desktop) ─────────────────────────
  function addMapTrigger() {
    if (isMobile()) {
      // Leaflet doesn't fire contextmenu reliably on mobile;
      // use a long-press via touchstart/touchend on the map container
      let pressTimer = null;
      const mapEl = document.getElementById('map');
      if (!mapEl) return;

      mapEl.addEventListener('touchstart', e => {
        if (e.touches.length !== 1) return;
        const touch = e.touches[0];
        pressTimer = setTimeout(() => {
          const latlng = map.containerPointToLatLng(
            L.point(touch.clientX, touch.clientY)
          );
          openStreetView(latlng.lat, latlng.lng,
            `Map point (${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)})`);
        }, 600); // 600ms long-press
      }, { passive: true });

      mapEl.addEventListener('touchend',  () => clearTimeout(pressTimer), { passive: true });
      mapEl.addEventListener('touchmove', () => clearTimeout(pressTimer), { passive: true });

    } else {
      map.on('contextmenu', e => {
        openStreetView(e.latlng.lat, e.latlng.lng,
          `Map point (${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)})`);
      });
    }
  }

  // ── IITC bootstrap ──────────────────────────────────────────────────────────
  const plugin_info = {};
  if (typeof GM_info !== 'undefined' && GM_info && GM_info.script) {
    plugin_info.script = {
      version:     GM_info.script.version,
      name:        GM_info.script.name,
      description: GM_info.script.description,
    };
  }

  function setup() {
    window.addHook( 'portalDetailsUpdated', addPortalButton );
    addMapTrigger();
    $( document ).on( 'keydown', e => { if ( e.key==='Escape' ) closeModal(); } );
    console.log( `[IITC] ${PLUGIN_NAME} v2 loaded (${isMobile()? 'mobile':'desktop'} mode).` );
  }

  // --- BOILERPLATE TO FIX THE ERROR ---
  setup.info=GM_info.script; // Allows IITC to display plugin info
  if ( !window.plugin ) window.plugin={};
  window.plugin.portalStreetView=setup;

  if ( window.iitcLoaded&&typeof setup==='function' ) {
    setup();
  } else {
    if ( window.bootPlugins ) {
      window.bootPlugins.push( setup );
    } else {
      window.bootPlugins=[ setup ];
    }
  }
} )(); // End of IIFE