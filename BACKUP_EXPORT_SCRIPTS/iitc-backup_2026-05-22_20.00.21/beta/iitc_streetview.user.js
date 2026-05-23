// ==UserScript==
// @author         DiabloEnMusica
// @name           Portal Street View
// @category       Diablo
// @description    Adds a Google Streetview popup for portals, accessible via a button in the portal details or by long-pressing the map (mobile) / right-clicking the map (desktop). Works on both desktop IITC and IITC-Mobile. In cases where Street View is available but the nearest camera is out of Ingress deploy range, it shows the distance and a suggested parking spot to get within range.
// @version        2.0.0
// @namespace      https://github.com/diacoviello/IngressMyPlugins
// @updateURL      https://raw.githubusercontent.com/diacoviello/IngressMyPlugins/main/myVersion/iitc_streetview.user.js
// @downloadURL    https://raw.githubusercontent.com/diacoviello/IngressMyPlugins/main/myVersion/iitc_streetview.user.js
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

  // Ingress portal beacon icon (SVG, transparent background)
  const _PORTAL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 130">
    <defs>
      <filter id="sv-glow" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="sv-flame" x="-120%" y="-10%" width="340%" height="130%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <linearGradient id="sv-fl" x1=".5" y1="0" x2=".5" y2="1">
        <stop offset="0%"   stop-color="#eef8ff"/>
        <stop offset="40%"  stop-color="#7ad8e8" stop-opacity=".9"/>
        <stop offset="80%"  stop-color="#3a8090" stop-opacity=".4"/>
        <stop offset="100%" stop-color="#2a5860" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <g stroke="#3a6870" stroke-width="1.5" opacity=".8">
      <line x1="60" y1="75" x2="60" y2="38"/>
      <line x1="60" y1="75" x2="86" y2="49"/>
      <line x1="60" y1="75" x2="97" y2="75"/>
      <line x1="60" y1="75" x2="86" y2="101"/>
      <line x1="60" y1="75" x2="60" y2="112"/>
      <line x1="60" y1="75" x2="34" y2="101"/>
      <line x1="60" y1="75" x2="23" y2="75"/>
      <line x1="60" y1="75" x2="34" y2="49"/>
    </g>
    <g fill="#263d45" stroke="#4aa8b8" stroke-width=".8" filter="url(#sv-glow)">
      <polygon points="60,33 65,38 60,43 55,38"/>
      <polygon points="86,44 91,49 86,54 81,49"/>
      <polygon points="97,70 102,75 97,80 92,75"/>
      <polygon points="86,96 91,101 86,106 81,101"/>
      <polygon points="60,107 65,112 60,117 55,112"/>
      <polygon points="34,96 39,101 34,106 29,101"/>
      <polygon points="23,70 28,75 23,80 18,75"/>
      <polygon points="34,44 39,49 34,54 29,49"/>
    </g>
    <polygon points="60,64 69,75 60,86 51,75" fill="#3a8090" stroke="#7ae0e8" stroke-width="1.5" filter="url(#sv-glow)"/>
    <path d="M52,73 Q46,42 60,3 Q74,42 68,73Z"  fill="url(#sv-fl)" filter="url(#sv-flame)" opacity=".75"/>
    <path d="M57,73 Q55,50 60,12 Q65,50 63,73Z" fill="#d0f4ff" opacity=".7"/>
  </svg>`;
  const PORTAL_ICON_URL = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(_PORTAL_SVG);
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
          width: 150px; height: 150px;
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
        /* ── Mobile layout — full-screen sheet ── */
        @media (max-width: 768px) {
          #sv-minimap { width: 110px; height: 110px; bottom: 6px; right: 6px; }
          #sv-modal {
            width: 100% !important;
            left: 0 !important;
            bottom: 0 !important;
            top: auto !important;
            transform: none !important;
            border-radius: 12px 12px 0 0;
            border-left: none;
            border-right: none;
            border-bottom: none;
          }
          #sv-header { cursor: default; }
          #sv-pano { height: 55vw; min-height: 220px; max-height: 360px; }
          #sv-close { font-size: 26px; }
          #sv-status { font-size: 12px; padding: 6px 14px 10px; }
        }

        /* Portal pin overlay on Street View sphere */
        #sv-portal-overlay {
          position: absolute;
          top: 0; left: 0;
          width: 100%; height: 100%;
          pointer-events: none;
          z-index: 5;
          overflow: hidden;
        }
        #sv-portal-pin {
          position: absolute;
          display: none;
          flex-direction: column;
          align-items: center;
          transform: translate(-50%, -100%);
          pointer-events: none;
          filter: drop-shadow(0 2px 8px rgba(0,0,0,0.95));
        }
        #sv-portal-pin .sv-pin-icon {
          width: 40px; height: 40px;
          border-radius: 50%;
          border: 2px solid #00bfff;
          box-shadow: 0 0 10px rgba(0,191,255,0.7);
          background: #001520;
          overflow: visible;
          position: relative;
        }
        /* SVG beacon: hub (60,75) in a 120x130 viewBox is centred by translate(-50%,-57%) */
        #sv-portal-pin .sv-pin-icon img {
          width: 90px; height: 98px;
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -57%);
          pointer-events: none;
        }
        #sv-portal-pin::after {
          content: '';
          width: 0; height: 0;
          border-left: 7px solid transparent;
          border-right: 7px solid transparent;
          border-top: 11px solid #00bfff;
          margin-top: -2px;
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
          <div id="sv-portal-overlay">
            <div id="sv-portal-pin">
              <div class="sv-pin-icon"><img id="sv-portal-pin-img" src="" alt=""></div>
            </div>
          </div>
          <div id="sv-minimap"></div>
        </div>
        <div id="sv-status">Loading…</div>
      </div>
    `);

    $('#sv-portal-pin-img').attr('src', PORTAL_ICON_URL);
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
  let svPanorama    = null;
  let svMiniMap     = null;
  let svPortalMarker = null;
  let svPanoMarker  = null;
  let svPathLine     = null;
  let svPovListener  = null;
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
    const pin = document.getElementById('sv-portal-pin');
    if (pin) pin.style.display = 'none';

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
        svPanorama.setPano(data.location.pano);
        svPanorama.setPov({ heading, pitch: SV_PITCH });
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
            : `📷 Coverage ~${dist}m from portal · Drag header to move${parkingNote}`
        );
        updateMiniMap(lat, lng, panoLatLng, dist, portalImageUrl);
        if (svPovListener) google.maps.event.removeListener(svPovListener);
        svPovListener = svPanorama.addListener('pov_changed', updatePortalOverlay);
        updatePortalOverlay();
      } else {
        setStatus('⚠ No Street View coverage within 100 m of this portal.');
      }
    });
  }

  function setStatus(msg) { $('#sv-status').text(msg); }

  // ── Mini overhead map ────────────────────────────────────────────────────────
  function updateMiniMap(portalLat, portalLng, panoLatLng, dist, portalImageUrl) {
    const portalLatLng = new google.maps.LatLng(portalLat, portalLng);
    const mapEl = document.getElementById('sv-minimap');

    if (!svMiniMap) {
      svMiniMap = new google.maps.Map(mapEl, {
        mapTypeId: 'satellite',
        disableDefaultUI: true,
        gestureHandling: 'none',
        clickableIcons: false,
        keyboardShortcuts: false,
      });
    }

    // Fit both points in view
    const bounds = new google.maps.LatLngBounds();
    bounds.extend(portalLatLng);
    bounds.extend(panoLatLng);
    svMiniMap.fitBounds(bounds, 20);
    google.maps.event.addListenerOnce(svMiniMap, 'bounds_changed', () => {
      if ((svMiniMap.getZoom() || 0) > 18) svMiniMap.setZoom(18);
    });

    // Portal marker — use portal image if available, else a cyan circle
    const portalIcon = portalImageUrl
      ? { url: portalImageUrl, scaledSize: new google.maps.Size(32, 32), anchor: new google.maps.Point(16, 16) }
      : { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: '#00bfff', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 };

    if (!svPortalMarker) {
      svPortalMarker = new google.maps.Marker({ position: portalLatLng, map: svMiniMap, icon: portalIcon, title: 'Portal', zIndex: 2 });
    } else {
      svPortalMarker.setPosition(portalLatLng);
      svPortalMarker.setIcon(portalIcon);
      svPortalMarker.setMap(svMiniMap);
    }

    const povHeading = svPanorama ? svPanorama.getPov().heading : 0;
    const arrowIcon = {
      path: 'M 0,-10 L 6,6 L 0,2 L -6,6 Z',
      scale: 1.2,
      fillColor: dist > DEPLOY_RANGE ? '#ff4444' : '#4285F4',
      fillOpacity: 1,
      strokeColor: '#fff',
      strokeWeight: 1.5,
      rotation: povHeading,
    };

    if (!svPanoMarker) {
      svPanoMarker = new google.maps.Marker({
        position: panoLatLng, map: svMiniMap, icon: arrowIcon,
        title: dist > DEPLOY_RANGE ? 'Park here' : 'Street View camera', zIndex: 1,
      });
    } else {
      svPanoMarker.setPosition(panoLatLng);
      svPanoMarker.setIcon(arrowIcon);
      svPanoMarker.setMap(svMiniMap);
    }

    if (dist > DEPLOY_RANGE) {
      // Dashed line from parking to portal
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

  // ── Portal sphere overlay (updates on every pov_changed) ────────────────────
  function updatePortalOverlay() {
    if (!svPanorama || !svCurrentPortal) return;

    // Sync minimap arrow rotation with current heading
    if (svPanoMarker) {
      const icon = svPanoMarker.getIcon();
      if (icon && typeof icon === 'object' && 'rotation' in icon) {
        icon.rotation = svPanorama.getPov().heading;
        svPanoMarker.setIcon(icon);
      }
    }

    const panoPos = svPanorama.getPosition();
    if (!panoPos) return;

    const pov    = svPanorama.getPov();
    const zoom   = pov.zoom || 1;
    const panoEl = document.getElementById('sv-pano');
    if (!panoEl) return;
    const W = panoEl.offsetWidth;
    const H = panoEl.offsetHeight;
    if (!W || !H) return;

    // Google Street View FOV: hFov = 180 / 2^zoom (degrees)
    const hFovDeg = 180 / Math.pow(2, zoom);
    const vFovDeg = hFovDeg * H / W;
    const hFovRad = hFovDeg * Math.PI / 180;
    const vFovRad = vFovDeg * Math.PI / 180;

    const portalLatLng  = new google.maps.LatLng(svCurrentPortal.lat, svCurrentPortal.lng);
    const portalHeading = google.maps.geometry.spherical.computeHeading(panoPos, portalLatLng);

    let dH = portalHeading - pov.heading;
    while (dH >  180) dH -= 360;
    while (dH < -180) dH += 360;
    const dP = 0 - pov.pitch; // portals assumed at horizon pitch

    // Perspective projection → screen coordinates
    const x = W / 2 + Math.tan(dH * Math.PI / 180) / Math.tan(hFovRad / 2) * (W / 2);
    const y = H / 2 - Math.tan(dP * Math.PI / 180) / Math.tan(vFovRad / 2) * (H / 2);

    const pin = document.getElementById('sv-portal-pin');
    if (!pin) return;

    const inView = Math.abs(dH) < hFovDeg / 2 && x > 0 && x < W && y > -60 && y < H + 20;
    if (inView) {
      pin.style.display = 'flex';
      pin.style.left    = x + 'px';
      pin.style.top     = y + 'px';
    } else {
      pin.style.display = 'none';
    }
  }

  // ── Close modal ─────────────────────────────────────────────────────────────
  function closeModal() {
    if (svPovListener) {
      google.maps.event.removeListener(svPovListener);
      svPovListener = null;
    }
    const pin = document.getElementById('sv-portal-pin');
    if (pin) pin.style.display = 'none';
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
  window.plugin.portalStreetView=function() { };

  // function setup() {
  //   window.addHook('portalDetailsUpdated', addPortalButton);
  //   addMapTrigger();
  //   $(document).on('keydown', e => { if (e.key === 'Escape') closeModal(); });
  //   console.log(`[IITC] ${PLUGIN_NAME} v2 loaded (${isMobile() ? 'mobile' : 'desktop'} mode).`);
  // }
  window.plugin.portalStreetView.setup=function() {
    // Add safety check to ensure IITC is loaded
    if ( !window.addHook ) return;

    window.addHook( 'portalDetailsUpdated', addPortalButton );
    addMapTrigger();
    $( document ).on( 'keydown', e => { if ( e.key==='Escape' ) closeModal(); } );

    console.log( `[IITC] ${PLUGIN_NAME} v2 loaded (${isMobile()? 'mobile':'desktop'} mode).` );
  };

  var setup=window.plugin.portalStreetView.setup;

  if ( window.iitcLoaded&&typeof setup==='function' ) {
    setup();
  } else if ( window.bootPlugins ) {
    window.bootPlugins.push( setup );
  } else {
    window.bootPlugins=[ setup ];
  }

  const plugin_info = {};
  if (typeof GM_info !== 'undefined' && GM_info && GM_info.script) {
    plugin_info.script = {
      version:     GM_info.script.version,
      name:        GM_info.script.name,
      description: GM_info.script.description,
    };
  }

  if (window.iitcLoaded) {
    setup();
  } else {
    if (!window.bootPlugins) window.bootPlugins = [];
    window.bootPlugins.push(setup);
  }
})();
