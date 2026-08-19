================================================================================
IITC ACCESSKEY AUDIT  —  USED / UNUSED
Generated: 2026-08-19
Sources scanned (cloned at scan time, HEAD of default branch):
  A) IITC-CE/ingress-intel-total-conversion   (core + bundled plugins)
  B) IITC-CE/Community-plugins                (dist/*.user.js, 277 files)
  C) diacoviello/IngressMyPlugins             (myVersion/, IITC-Community/,
                                               from_release_plugins/, OLD/)
Method: grep -rin "accesskey" + "accessKey" + "access_key" across *.js/*.html,
        plus a sweep for raw keydown/keypress handlers that squat bare keys.
================================================================================


================================================================================
SECTION 1 — USED
================================================================================

--------------------------------------------------------------------------------
1.1  IITC CORE — always live, you cannot reclaim these
--------------------------------------------------------------------------------
 0   Toggle chat/comm window          core/total-conversion-build.js:233
 c   Focus chat input box             core/total-conversion-build.js:239
 i   Toggle sidebar                   core/total-conversion-build.js:241
 f   Focus location search box        core/total-conversion-build.js:257
 w   Close portal detail panel        core/code/portal_display.js:246
 o   "Ornaments Opt" toolbox button   core/code/ornaments.js:104
 1   Comm tab "All"                   core/code/chat.js:21 + core/code/comm.js:17
 2   Comm tab "Faction"               core/code/chat.js:21 + core/code/comm.js:27
 3   Comm tab "Alerts"                core/code/chat.js:21 + core/code/comm.js:37

 NOTE: comm tabs are templated as accesskey="{index}" and index = position in
 chat.channels. Any plugin that registers an extra channel gets the NEXT digit
 automatically. Digits 4+ are therefore volatile, not free.

--------------------------------------------------------------------------------
1.2  IITC CORE-BUNDLED PLUGINS — live only when that plugin is enabled
--------------------------------------------------------------------------------
 t   "Portals list" toolbox           plugins/portals-list.js:505
 v   Toggle bookmarks box             plugins/bookmarks.js:1287
 b   Star/bookmark current portal     plugins/bookmarks.js:1318
 q   "Auto draw" toolbox              plugins/bookmarks.js:1425
 9   Permalink / privacy toggle       plugins/privacy-view.js:71 and :74
 x   "DrawTools Opt" toolbox          plugins/draw-tools.js:796

 draw-tools DRAWING TOOLBAR — plugins/draw-tools.js:164
 These are assigned by DOM order and CLEARED when the button is hidden, so they
 are released back to the pool when the relevant toolbar state is inactive:
   l  line
   p  polygon
   o  circle          <-- collides with core Ornaments 'o' (1.1) whenever the
                          draw toolbar is visible; last-registered element wins
   m  marker
   a  cancel (_abort)
   e  edit
   d  delete
   s  save
   a  cancel (second container — duplicated on purpose)

--------------------------------------------------------------------------------
1.3  COMMUNITY PLUGINS
--------------------------------------------------------------------------------
 In YOUR repo:
 4   Comm "public" button    IITC-Community/loadmorecommshistory.user.js:271
 5   Comm "load more"        IITC-Community/loadmorecommshistory.user.js:329

 In IITC-CE/Community-plugins (not currently in your repo — listed because your
 old tracker referenced them and they will bite you if you install them):
 p   PokeNav copy            dist/MaxEtMoritz/PNavCopy.user.js:1663, :1695
 s   PokeNav settings        dist/MaxEtMoritz/PNavCopy.user.js:1750
 t   Add task                dist/Zaso/todo-list.user.js:505
 p   Mark PokéStop           dist/NvlblNm/s2check.user.js:5555
 g   Mark Gym                dist/NvlblNm/s2check.user.js:5556
 w   Mark Power Spot         dist/NvlblNm/s2check.user.js:5557

--------------------------------------------------------------------------------
1.4  YOUR OWN PLUGINS (diacoviello/IngressMyPlugins — myVersion/)
--------------------------------------------------------------------------------
 ;   "Shortcuts Ref" toolbox          Diablo_shortcuts-list.user.js:105
 k   Route-planner menu button        Diablo_multiple-maps-route-planner.user.js:1544
 ]   Toggle waypoint                  Diablo_multiple-maps-route-planner.user.js:1497
 g   Mass copy/paste button           Diablo_crosslinkFix.user.js:692, :802
 .   Copy button                      Diablo_crosslinkFix.user.js:772
 x   Star button                      Diablo_crosslinkFix.user.js:784
 /   Move button                      Diablo_crosslinkFix.user.js:813
 z   Link button                      Diablo_crosslinkFix.user.js:825
 r   "< Main menu" link in dialog     Diablo_crosslinkFix.user.js:1631
 ,   Quick Draw Links toolbox entry   Diablo_crosslinkFix.user.js:3706

--------------------------------------------------------------------------------
1.5  RAW KEY HANDLERS (NOT accesskey — no modifier needed, so they collide
     with plain typing, not with Alt-chords)
--------------------------------------------------------------------------------
 x   Close top dialog                 Diablo_closeDialogMenus.user.js:192
 >   Cycle dialog                     Diablo_closeDialogMenus.user.js:197
 <   Cycle dialog                     Diablo_closeDialogMenus.user.js:202
 Esc Unspiderfy overlapping markers   core/code/boot.js:158 (keypress, keyCode 27)


================================================================================
SECTION 2 — UNUSED / AVAILABLE
================================================================================

--------------------------------------------------------------------------------
2.1  GENUINELY FREE — nothing in core, core plugins, the community repo, or your
     repo claims these. Safest picks for new plugins.
--------------------------------------------------------------------------------
 LETTERS:  h   j   n   u
 DIGITS:   6   7   8

 Recommended assignment order: h, j, n, u, then 6, 7, 8.
 Caveat on digits: see the comm-tab note in 1.1 — 6/7/8 are only free while you
 run <=5 comm channels. Prefer the letters.

--------------------------------------------------------------------------------
2.2  EFFECTIVELY FREE (claimed only by dead code — see Section 3.1)
--------------------------------------------------------------------------------
 y   claimed by Diablo_crosslinkFix.user.js:2919, :2977 via window.dialog(),
     which does not support an accesskey option. Never reaches the DOM.
     Reclaim it, or fix the call site — pick one, do not leave it ambiguous.

--------------------------------------------------------------------------------
2.3  CONDITIONALLY FREE — free only when a given plugin is off/hidden
--------------------------------------------------------------------------------
 l p o m a e d s   free whenever the draw-tools drawing toolbar is hidden;
                   draw-tools explicitly clears accessKey on hidden buttons
                   (draw-tools.js:184-185). Do NOT build on this — the window
                   in which they are free is not under your control.
 t v b q 9 x       free if you never enable portals-list / bookmarks /
                   privacy-view / draw-tools.

--------------------------------------------------------------------------------
2.4  PUNCTUATION / SYMBOL SPACE — legal but browser-inconsistent
--------------------------------------------------------------------------------
 Already taken by you:   ;   ,   .   /   ]   
 Untaken and plausible:  [   '   \   -   =   `
 Untaken but avoid:      anything requiring Shift on a US layout (! @ # etc.) —
                         inconsistent across Firefox/Chrome/Chromium mobile.


================================================================================
SECTION 3 — DEFECTS AND COLLISIONS FOUND DURING THE SCAN
================================================================================

3.1  DEAD accesskey OPTIONS — window.dialog() ignores them
     core/code/dialog.js accepts text/html/title/modal/id/*Callback/width/
     height/dialogClass/classes. There is NO accesskey option; it is silently
     dropped. These three call sites do nothing:
       Diablo_crosslinkFix.user.js:2345            accesskey: '0'
       Diablo_crosslinkFix.user.js:2919            accesskey: 'y'
       Diablo_crosslinkFix.user.js:2977            accesskey: 'y'
       Diablo_multiple-maps-route-planner.user.js:679   accesskey: 'k'
     Fix: set it on the returned element, or use IITC.toolbox.addButton(),
     which DOES honour accesskey / access_key / accessKey (core/code/toolbox.js:128-130).

3.2  HARD COLLISION — 'x'
     draw-tools "DrawTools Opt" (plugins/draw-tools.js:796) vs your crosslinkFix
     star button (Diablo_crosslinkFix.user.js:784). Both are persistent toolbox/
     status-bar elements. Whichever is later in the DOM wins; the other becomes
     unreachable. Additionally Diablo_closeDialogMenus binds bare 'x' on keydown.
     Three claimants on one key. Move the crosslinkFix star to a free letter.

3.3  HARD COLLISION — '0'
     Core chat-window toggle (total-conversion-build.js:233) vs the dead
     crosslinkFix dialog option. Currently harmless ONLY because 3.1 makes the
     crosslinkFix one a no-op. If you "fix" 3.1 without changing the key, you
     break the core chat toggle.

3.4  MISLABELLED KEY — route planner
     Diablo_multiple-maps-route-planner.user.js:1497-1499
       setAttribute('accesskey', ']')
       title  += ' (accesskey: A)'          <-- says A
       aria-label 'Toggle waypoint (accesskey ['']'   <-- malformed quoting
     The actual key is ']'. Title and aria-label both lie. Users and screen
     readers get the wrong key.

3.5  IF YOU INSTALL s2check / PoGo
     It binds 'w' (Power Spot) which is the CORE portal-detail close key.
     It also binds 'p' and 'g' — 'g' is already yours in crosslinkFix.

3.6  YOUR EXISTING accesskeyTracker.txt IS STALE
     It is missing, from core alone: w, q, o, t, x, and the 1/2/3 comm tabs.
     It lists 'i', 'f', 'c', '0', 'v', 'b', '9' correctly. It contains none of
     your own myVersion/ keys except by implication. Replace it with this file.


================================================================================
SECTION 4 — HOW accesskey IS ACTUALLY TRIGGERED (relevant to any choice above)
================================================================================
  Firefox (desktop):      Alt+Shift+key
  Chrome/Edge (Win/Linux):Alt+key
  Chrome/Edge (macOS):    Control+Option+key
  Safari (macOS):         Control+Option+key
  Mobile:                 effectively unavailable without a hardware keyboard
Because Chrome uses bare Alt+key, single letters can collide with the browser's
own menu mnemonics. h, j, n, u are clean in that respect on Chrome/Firefox.
================================================================================
