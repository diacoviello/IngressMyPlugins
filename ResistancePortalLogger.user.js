plugin_script = """
// ==UserScript==
// @id             iitc-plugin-resistance-action-logger
// @name           Resistance Portal Interaction Logger
// @category       Info
// @version        1.0.0
// @description    Log Resistance agent actions within a radius and export driving distance/times via OSRM
// @updateURL      https://github.com/diacoviello/IngressMyPlugins/blob/main/ResistancePortalLogger.user.js
// @downloadURL    https://github.com/diacoviello/IngressMyPlugins/blob/main/ResistancePortalLogger.user.js
// @include        https://intel.ingress.com/*
// @grant          none
// ==/UserScript==

function wrapper(plugin_info) {
  if (window.plugin.resistanceActionLogger) return;

  window.plugin.resistanceActionLogger = function () { };
  const self = window.plugin.resistanceActionLogger;

  const RADIUS_METERS = 1000;
  let log = [];
  let lastActions = {};

  function haversineDistance(lat1, lon1, lat2, lon2) {
    function toRad(x) { return x * Math.PI / 180; }
    const R = 6371000;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function isWithinRadius(lat, lng) {
    const center = window.map.getCenter();
    return haversineDistance(center.lat, center.lng, lat, lng) <= RADIUS_METERS;
  }

  function getPortalLink(lat, lng) {
    return `https://intel.ingress.com/intel?ll=${lat},${lng}&z=17`;
  }

  function fetchDrivingData(lat1, lng1, lat2, lng2, callback) {
    const url = `https://router.project-osrm.org/route/v1/driving/${lng1},${lat1};${lng2},${lat2}?overview=false`;
    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (data.routes && data.routes.length > 0) {
          callback(data.routes[0].distance / 1000, data.routes[0].duration);
        } else {
          callback(null, null);
        }
      }).catch(() => callback(null, null));
  }

  function logAction(agent, type, portal) {
    if (!portal || !portal.options || !portal.options.data) return;
    const data = portal.options.data;
    const lat = portal.getLatLng().lat;
    const lng = portal.getLatLng().lng;
    const name = data.title;
    const time = new Date();

    if (!isWithinRadius(lat, lng)) return;
    if (data.team !== 'R') return;

    const portalLink = getPortalLink(lat, lng);
    const last = lastActions[agent];
    if (last) {
      fetchDrivingData(last.lat, last.lng, lat, lng, (distance, duration) => {
        const entry = {
          time: time.toISOString(),
          agent, type,
          portalName: name,
          portalLink,
          lat: lat.toFixed(6),
          lng: lng.toFixed(6),
          distance: distance ? distance.toFixed(2) : "N/A",
          duration: duration ? Math.round(duration) : "N/A"
        };
        log.push(entry);
        lastActions[agent] = { lat, lng, time };
        console.log("[RES LOG]", entry);
      });
    } else {
      lastActions[agent] = { lat, lng, time };
    }
  }

  function exportCSV() {
    let csv = "Time,Agent,Action,Portal Name,Portal Link,Latitude,Longitude,Distance (km),Time Between (s)\\n";
    csv += log.map(e => `${e.time},"${e.agent}","${e.type}","${e.portalName}","${e.portalLink}",${e.lat},${e.lng},${e.distance},${e.duration}`).join("\\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "res_portal_log.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function setupHooks() {
    window.addHook('portalCaptured', data => logAction(data.capturedBy, "Captured", data.portal));
    window.addHook('portalDetailsUpdated', data => {
      const portal = window.portals[data.guid];
      if (portal && portal.options && portal.options.data && portal.options.data.owner) {
        const agent = portal.options.data.owner;
        logAction(agent, "Viewed", portal);
      }
    });
    window.addHook('linkCreated', data => {
      const portal = window.portals[data.link.options.data.oGuid];
      const agent = data.link.options.data.team === "R" ? data.link.options.data.agent : null;
      if (portal && agent) logAction(agent, "Linked", portal);
    });
    window.addHook('fieldCreated', data => {
      const portal = window.portals[data.field.options.data.oGuid];
      const agent = data.field.options.data.team === "R" ? data.field.options.data.agent : null;
      if (portal && agent) logAction(agent, "Fielded", portal);
    });
  }

  function setupControls() {
    const link = document.createElement("a");
    link.textContent = "Download CSV";
    link.addEventListener("click", exportCSV);
    link.style.margin = "5px";
    $('#toolbox').append(link);
  }

  const setup = function () {
    setupHooks();
    setupControls();
    console.log("[ResistanceActionLogger] Plugin loaded.");
  };

  setup.info = plugin_info;
  if (!window.bootPlugins) window.bootPlugins = [];
  window.bootPlugins.push(setup);
  if (window.iitcLoaded) setup();
}

var script = document.createElement('script');
script.appendChild(document.createTextNode('('+ wrapper +')({});'));
(document.body || document.head || document.documentElement).appendChild(script);
"""

# Save to file
with open("/mnt/data/ResistancePortalLogger.user.js", "w") as file:
    file.write(plugin_script)

"/mnt/data/ResistancePortalLogger.user.js"
