// ==UserScript==
// @id           enlarge-bookmark-star@yourname
// @author       DiabloEnMusica
// @name         Enlarge IITC Bookmark Star (Mobile)
// @category     Diablo
// @version      0.1.0
// @downloadURL    https://raw.githubusercontent.com/diacoviello/IngressMyPlugins/main/myVersion/star-resize.user.js
// @uploadURL    https://raw.githubusercontent.com/diacoviello/IngressMyPlugins/main/myVersion/star-resize.user.js
// @match        https://intel.ingress.com/*
// @grant        none
// ==/UserScript==

function wrapper(plugin_info) {
  const cfgKey  = 'enlargeBookmarkStar_size';
  const panename= 'enlargeBookmarkStarPane';
  const title   = 'Star Size';

  window.plugin.enlargeBookmarkStar = {};
  // load or default
  window.plugin.enlargeBookmarkStar.size = parseFloat(localStorage[cfgKey]||2.5);

  function applyCSS() {
    const sz  = window.plugin.enlargeBookmarkStar.size;
    const pad = (sz*0.2).toFixed(2);
    const mgn = (sz*0.2).toFixed(2);
    const css = `
      .bkmrksStar {
        font-size: ${sz}em !important;
        padding: ${pad}em !important;
        margin: ${mgn}em !important;
      }
      #updatestatus {
        bottom: 12px !important;
        right: 12px !important;
      }
    `;
    let style = document.getElementById('enlargeBookmarkStar-style');
    if (style) style.remove();
    style = document.createElement('style');
    style.id = 'enlargeBookmarkStar-style';
    style.innerHTML = css;
    document.head.appendChild(style);
  }

  function showPane() {
    // this works on both mobile and desktop to open our custom pane
    window.show(panename);
  }
  window.plugin.enlargeBookmarkStar.showPane = showPane;

  function onPaneChanged(pane) {
    if (pane !== panename) return;
    const paneDiv = document.getElementById('pane-'+panename);
    if (!paneDiv || paneDiv.dataset.initialized) return;
    paneDiv.dataset.initialized = 'yes';
    paneDiv.innerHTML = `
      <div style="padding:0.5em">
        <h3 style="margin:0 0 0.5em">Bookmark Star Size</h3>
        <input id="ebs-slider" type="range" min="1" max="5" step="0.1"
               value="${window.plugin.enlargeBookmarkStar.size}">
        <span id="ebs-val">${window.plugin.enlargeBookmarkStar.size.toFixed(1)}</span> em
      </div>`;
    const slider = paneDiv.querySelector('#ebs-slider');
    const val    = paneDiv.querySelector('#ebs-val');
    slider.oninput = () => {
      const v = parseFloat(slider.value);
      window.plugin.enlargeBookmarkStar.size = v;
      localStorage[cfgKey] = v;
      applyCSS();
      val.textContent = v.toFixed(1);
    };
  }

  function setup() {
    applyCSS();

    if (window.useAndroidPanes && window.useAndroidPanes()) {
      // mobile pane
      android.addPane(panename, title, '⭐');
      window.addHook('paneChanged', onPaneChanged);
    }
    // always add a toolbox/menu button
    const ico = `<a id="enlargeBookmarkStar-toggle" title="${title}"
                     onclick="window.plugin.enlargeBookmarkStar.showPane()">
                   ⭐
                 </a>`;
    $('#toolbox').append(ico);
  }

  setup.info = plugin_info;
  if (window.iitcLoaded) {
    setup();
  } else {
    document.addEventListener('iitcLoaded', setup, false);
  }
}

// inject
const script = document.createElement('script');
script.textContent = '('+wrapper+')( '+JSON.stringify({name:'enlargeBookmarkStar'})+' );';
(document.body||document.documentElement).appendChild(script);
