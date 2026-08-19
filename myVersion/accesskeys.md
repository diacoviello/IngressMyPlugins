# IITC Accesskey Audit — Used / Unused

**Generated:** 2026-08-19

**Sources scanned** (cloned at HEAD of default branch):

| # | Repo | Scope |
|---|------|-------|
| A | `IITC-CE/ingress-intel-total-conversion` | core + bundled plugins |
| B | `IITC-CE/Community-plugins` | `dist/*.user.js` — 277 files |
| C | `diacoviello/IngressMyPlugins` | `myVersion/`, `IITC-Community/`, `from_release_plugins/`, `OLD/` |

**Method:** `grep -rin` for `accesskey` / `accessKey` / `access_key` across `*.js` and `*.html`, plus a sweep for raw `keydown`/`keypress` handlers that squat bare keys.

---

## TL;DR

**As of the 2026-08-19 patches the free pool is exhausted.**

- **Free letters:** none. `h` `j` `n` `u` and `y` are now all assigned — see 1.4.
- **Free digits:** `7` `8` — volatile, see [comm-tab note](#11-iitc-core--always-live)
- **Free punctuation:** `[` `'` `\` `-` `=` `` ` ``
- **Next new plugin** must either take `7`/`8`, take punctuation, or reclaim a key from a plugin you don't actually run (see 2.3).

> ⚠ **Separately from accesskeys:** two of your plugins bind *bare* letters via `keydown` — `x` and `c`. The `x` binding is unguarded and in capture phase, which breaks `Ctrl`+`X` and blocks typing `x` in any text field. See [5.3](#53-defect--closedialogmenus-is-unguarded-and-in-capture-phase).

---

# 1. Used

## 1.1 IITC core — always live

You cannot reclaim these.

| Key | Function | Source |
|-----|----------|--------|
| `0` | Toggle chat/comm window | `core/total-conversion-build.js:233` |
| `c` | Focus chat input box | `core/total-conversion-build.js:239` |
| `i` | Toggle sidebar | `core/total-conversion-build.js:241` |
| `f` | Focus location search box | `core/total-conversion-build.js:257` |
| `w` | Close portal detail panel | `core/code/portal_display.js:246` |
| `o` | "Ornaments Opt" toolbox button | `core/code/ornaments.js:104` |
| `1` | Comm tab — All | `core/code/chat.js:21` + `core/code/comm.js:17` |
| `2` | Comm tab — Faction | `core/code/chat.js:21` + `core/code/comm.js:27` |
| `3` | Comm tab — Alerts | `core/code/chat.js:21` + `core/code/comm.js:37` |

> **Comm tabs are not hardcoded.** They are templated as `accesskey="{index}"` where `index` is the position in `chat.channels`. Any plugin registering an extra channel takes the *next* digit automatically. Digits 4+ are volatile, not free.

## 1.2 Core-bundled plugins

Live only when that plugin is enabled.

| Key | Function | Source |
|-----|----------|--------|
| `t` | "Portals list" toolbox | `plugins/portals-list.js:505` |
| `v` | Toggle bookmarks box | `plugins/bookmarks.js:1287` |
| `b` | Star/bookmark current portal | `plugins/bookmarks.js:1318` |
| `q` | "Auto draw" toolbox | `plugins/bookmarks.js:1425` |
| `9` | Permalink / privacy toggle | `plugins/privacy-view.js:71`, `:74` |
| `x` | "DrawTools Opt" toolbox | `plugins/draw-tools.js:796` |

### draw-tools drawing toolbar — `plugins/draw-tools.js:164`

Assigned by DOM order and **cleared when the button is hidden**, so they return to the pool whenever that toolbar state is inactive.

| Key | Tool |
|-----|------|
| `l` | line |
| `p` | polygon |
| `o` | circle — ⚠ collides with core Ornaments `o` |
| `m` | marker |
| `a` | cancel (`_abort`) |
| `e` | edit |
| `d` | delete |
| `s` | save |
| `a` | cancel (second container — duplicated intentionally) |

## 1.3 Community plugins

### Present in your repo

| Key | Function | Source |
|-----|----------|--------|
| `4` | Comm "public" button | `IITC-Community/loadmorecommshistory.user.js:271` |
| `5` | Comm "load more" | `IITC-Community/loadmorecommshistory.user.js:329` |

### Not installed — listed because your old tracker referenced them

| Key | Function | Source |
|-----|----------|--------|
| `p` | PokeNav copy | `dist/MaxEtMoritz/PNavCopy.user.js:1663`, `:1695` |
| `s` | PokeNav settings | `dist/MaxEtMoritz/PNavCopy.user.js:1750` |
| `t` | Add task | `dist/Zaso/todo-list.user.js:505` |
| `p` | Mark PokéStop | `dist/NvlblNm/s2check.user.js:5555` |
| `g` | Mark Gym | `dist/NvlblNm/s2check.user.js:5556` |
| `w` | Mark Power Spot | `dist/NvlblNm/s2check.user.js:5557` |

## 1.4 Your own plugins — `myVersion/`

| Key | Function | Source |
|-----|----------|--------|
| `;` | "Shortcuts Ref" toolbox | `Diablo_shortcuts-list.user.js:105` |
| `k` | Route-planner menu button | `Diablo_multiple-maps-route-planner.user.js:1544` |
| `]` | Toggle waypoint | `Diablo_multiple-maps-route-planner.user.js:1497` |
| `g` | Mass copy/paste button | `Diablo_crosslinkFix.user.js:692`, `:802` |
| `.` | Copy button | `Diablo_crosslinkFix.user.js:772` |
| `n` | Star button | `Diablo_crosslinkFix.user.js:784` — *was `x`, moved 2026-08-19* |
| `/` | Move button | `Diablo_crosslinkFix.user.js:813` |
| `z` | Link button | `Diablo_crosslinkFix.user.js:825` |
| `r` | "< Main menu" link in dialog | `Diablo_crosslinkFix.user.js:1631` |
| `,` | Quick Draw Links toolbox entry | `Diablo_crosslinkFix.user.js:3706` |
| `y` | Close active crosslinkFix dialog | `Diablo_crosslinkFix.user.js:2366`, `:2940`, `:2998` — *made live 2026-08-19* |
| `u` | Close route-planner About dialog | `Diablo_multiple-maps-route-planner.user.js:679` — *was dead `k`* |
| `h` | Destroy / Regenerate portal | `Diablo_destroyedLinks.user.js:734`, `:735` |
| `j` | Reset All | `Diablo_destroyedLinks.user.js:736` |
| `u` | Drawnize All | `Diablo_destroyedLinks.user.js:737` |
| `6` | Destroy Bookmarks | `Diablo_destroyedLinks.user.js:733` |

> `h` is shared by the Destroy and Regenerate buttons on purpose — they are mutually exclusive states of one slot (`hid_1`/`hid_2`, `.destroy_toggle a.hidden{display:none}`), and `display:none` elements do not activate accesskeys.
>
> `u` is shared by Drawnize All (portal detail pane) and the route-planner About dialog. These *can* be on screen at the same time. Low-severity, but it is a real overlap — move one if it bites.

## 1.5 Raw key handlers

**Not `accesskey`.** These are `keydown`/`keypress` listeners. They need no modifier, so they collide with plain typing rather than with Alt-chords. Full breakdown in [Section 5](#5-keydown--keypress-shortcuts).

| Key | Function | Source |
|-----|----------|--------|
| `x` | Close top dialog | `Diablo_closeDialogMenus.user.js:192` |
| `>` | Cycle dialog forward | `Diablo_closeDialogMenus.user.js:197` |
| `<` | Cycle dialog backward | `Diablo_closeDialogMenus.user.js:202` |
| `c` | Reset ALL bookmarks + maps | `Diablo_bookmarks-addon.user.js:1574` |
| `Ctrl`/`Cmd`+`Z` | Undo route edit | `from_release_plugins/portal-route.user.js:8234` |
| `Ctrl`/`Cmd`+`Shift`+`Z` | Redo route edit | `from_release_plugins/portal-route.user.js:8238` |
| `Esc` | Context-dependent cancel — see 5.2 | multiple |

---

# 2. Unused / Available

## 2.1 Genuinely free

Nothing in core, core plugins, the community repo, or your repo claims these. Safest picks for new plugins.

```
LETTERS:  h   j   n   u
DIGITS:   6   7   8
```

Prefer the letters — digits are subject to the comm-tab shift described in 1.1, and are only free while you run ≤5 channels.

## 2.2 Effectively free

| Key | Why |
|-----|-----|
| `y` | Claimed only by `Diablo_crosslinkFix.user.js:2919`, `:2977` via `window.dialog()`, which has no `accesskey` option. Never reaches the DOM. Reclaim it *or* fix the call site — don't leave it ambiguous. |

## 2.3 Conditionally free

Free only while a given plugin is off or hidden.

| Keys | Condition |
|------|-----------|
| `l` `p` `o` `m` `a` `e` `d` `s` | Free whenever the draw-tools drawing toolbar is hidden — draw-tools explicitly clears `accessKey` on hidden buttons (`draw-tools.js:184-185`). **Do not build on this**; the window in which they're free isn't under your control. |
| `t` `v` `b` `q` `9` `x` | Free only if you never enable portals-list / bookmarks / privacy-view / draw-tools. |

## 2.4 Punctuation and symbols

Legal, but browser-inconsistent.

| Status | Characters |
|--------|-----------|
| Already yours | `;` `,` `.` `/` `]` |
| Untaken, plausible | `[` `'` `\` `-` `=` `` ` `` |
| Untaken, avoid | Anything needing Shift on a US layout (`!` `@` `#` …) — inconsistent across Firefox, Chrome, and Chromium mobile |

---

# 3. Defects and Collisions

## 3.1 Dead `accesskey` options — `window.dialog()` ignores them

`core/code/dialog.js` accepts `text`, `html`, `title`, `modal`, `id`, the `*Callback` handlers, `width`, `height`, `dialogClass`, and `classes`. There is **no** `accesskey` option; it is silently dropped.

These four call sites do nothing:

```
Diablo_crosslinkFix.user.js:2345                  accesskey: '0'
Diablo_crosslinkFix.user.js:2919                  accesskey: 'y'
Diablo_crosslinkFix.user.js:2977                  accesskey: 'y'
Diablo_multiple-maps-route-planner.user.js:679    accesskey: 'k'
```

**Fix:** set it on the returned element, or use `IITC.toolbox.addButton()`, which honours `accesskey` / `access_key` / `accessKey` (`core/code/toolbox.js:128-130`).

## 3.2 Hard collision — `x`

Three claimants on one key:

1. draw-tools "DrawTools Opt" — `plugins/draw-tools.js:796`
2. Your crosslinkFix star button — `Diablo_crosslinkFix.user.js:784`
3. `Diablo_closeDialogMenus` bare `keydown` — `:192`

(1) and (2) are both persistent toolbox/status-bar elements. Whichever lands later in the DOM wins; the other becomes unreachable. **Move the crosslinkFix star to a free letter.**

## 3.3 Hard collision — `0`

Core's chat-window toggle (`total-conversion-build.js:233`) vs. the dead crosslinkFix dialog option. Currently harmless **only because** 3.1 makes the crosslinkFix one a no-op. Fix 3.1 without changing the key and you break the core chat toggle.

## 3.4 Mislabelled key — route planner

`Diablo_multiple-maps-route-planner.user.js:1497-1499`:

```javascript
setAttribute('accesskey', ']')
title += ' (accesskey: A)'                        // says A
aria-label 'Toggle waypoint (accesskey ['']'      // malformed quoting
```

The actual key is `]`. Title and aria-label both lie — users and screen readers get the wrong key.

## 3.5 If you install s2check / PoGo

It binds `w` (Power Spot), which is the **core portal-detail close key**. It also binds `p` and `g` — and `g` is already yours in crosslinkFix.

## 3.6 Your existing `accesskeyTracker.txt` is stale

Missing from core alone: `w`, `q`, `o`, `t`, `x`, and the `1`/`2`/`3` comm tabs. It correctly lists `i`, `f`, `c`, `0`, `v`, `b`, `9`. It contains none of your `myVersion/` keys except by implication. **Replace it with this file.**

---

# 4. How `accesskey` Is Actually Triggered

| Browser / platform | Chord |
|--------------------|-------|
| Firefox (desktop) | `Alt` + `Shift` + key |
| Chrome / Edge (Win, Linux) | `Alt` + key |
| Chrome / Edge (macOS) | `Control` + `Option` + key |
| Safari (macOS) | `Control` + `Option` + key |
| Mobile | Effectively unavailable without a hardware keyboard |

Because Chrome uses a bare `Alt` + key, single letters can collide with the browser's own menu mnemonics. `h`, `j`, `n`, and `u` are clean in that respect on both Chrome and Firefox.

---

# 5. keydown / keypress Shortcuts

Separate namespace from `accesskey`. An `accesskey` needs an Alt-chord; these fire on the bare key. They can therefore collide with **typing**, with **browser shortcuts**, and — in capture phase — with accesskeys themselves.

Swept with: `addEventListener('key*')`, `.on('key*')`, `.keydown()/.keyup()/.keypress()`, `onkey*`.

## 5.1 Bare-key bindings — the ones that matter

| Key | Action | Source | Guarded? |
|-----|--------|--------|----------|
| `x` / `X` | Close active dialog | `Diablo_closeDialogMenus.user.js` | ✅ **Fixed 2026-08-19** — see 5.3 |
| `>` | Cycle dialogs forward | `Diablo_closeDialogMenus.user.js` | ✅ **Fixed 2026-08-19** |
| `<` | Cycle dialogs backward | `Diablo_closeDialogMenus.user.js` | ✅ **Fixed 2026-08-19** |
| `c` / `C` | Reset ALL bookmarks + maps (destructive) | `Diablo_bookmarks-addon.user.js:1566-1581` | ✅ Yes — skips modifiers, skips form fields, wraps in `confirm()` |

## 5.2 Modifier-guarded or scoped — no action needed

| Binding | Source | Notes |
|---------|--------|-------|
| `Ctrl`/`Cmd`+`Z`, `+Shift+Z` | `portal-route.user.js:8211-8241` | **Reference implementation.** Bails on `closest('input, textarea, select, [contenteditable="true"]')` and on layer-disabled. Copy this pattern. |
| `Esc` (add-point / home-pick / bulk-select cancel) | `portal-route.user.js:8216-8231` | Contextual, state-gated |
| `Esc` (cancel mass copy-paste) | `Diablo_crosslinkFix.user.js:3713` | Namespaced `keydown.quickdrawlinks`, only fires when `self.masscopypaste` is set |
| `Esc` (close modal) | `Diablo_iitc_streetview.user.js:609` | Unnamespaced and never unbound — harmless, but leaks a listener per load |
| `Enter`, `Esc` (colour picker) | spectrum vendored into `Diablo_freestyler.user.js`, `Diablo_bookmarks-addon.user.js`, `Diablo_crosslinkFix.user.js`, `uniqueportalhistory.user.js` | Third-party library, scoped to the picker |
| `keypress` on own input | `IITC-Community/consolelog.user.js:66` | Element-scoped |
| `Esc` — unspiderfy markers | `core/code/boot.js:158` | Core, bound to map container only |

## 5.3 Defect — `closeDialogMenus` was unguarded and in capture phase — FIXED 2026-08-19

`Diablo_closeDialogMenus.user.js:191-209`:

```javascript
document.addEventListener( 'keydown', function( e ) {
    if ( e.key === 'x' || e.key === 'X' ) {
        e.stopImmediatePropagation();
        e.preventDefault();
        closeActiveDialog();
    } else if ( e.key === '>' ) { ... }
      else if ( e.key === '<' ) { ... }
}, true );   // <-- capture phase
```

Four problems, in descending severity:

1. **No form-field guard.** You cannot type `x`, `<`, or `>` in the IITC chat box, the location search box, or any dialog text input. Every one is swallowed before it reaches the field.
2. **No modifier check.** `e.key === 'x'` is still true while `Ctrl` is held, so **`Ctrl`+`X` (cut) is dead** across the whole Intel page. Same for `Cmd`+`X` on macOS.
3. **Capture phase + `preventDefault()` likely kills the draw-tools `x` accesskey.** `preventDefault()` on `keydown` suppresses accesskey activation in Chrome and Firefox, and capture phase means this handler runs first. Testable in 10 seconds: enable draw-tools, press `Alt`+`X`, see whether "DrawTools Opt" opens.
4. **`window.registerShortcut` does not exist.** Lines 212-215 gate on `typeof window.registerShortcut === 'function'`. It appears nowhere in IITC core or `IITC-CE/Community-plugins` — the only hits in the entire scan are the four lines in this file that *call* it. That branch is dead; the fallback listener at :191 always runs.

**Applied fix** — mirrors the `portal-route.js` guard, drops capture phase, and deletes the dead `registerShortcut` branch:

```javascript
function shouldIgnoreKeyEvent( e ) {
    if ( e.ctrlKey||e.altKey||e.metaKey||e.shiftKey&&e.key.length>1 ) return true;
    const el=e.target;
    if ( el&&typeof el.closest==='function'&&
        el.closest( 'input, textarea, select, [contenteditable="true"]' ) ) return true;
    if ( el&&el.isContentEditable ) return true;
    if ( !$( '.ui-dialog:visible' ).length ) return true;
    return false;
}

document.addEventListener( 'keydown', function( e ) {
    if ( shouldIgnoreKeyEvent( e ) ) return;
    ...
}, false );   // bubble, not capture
```

Also dropped: the per-keystroke `console.log` calls, which fired on every `x` you typed anywhere on the page.

## 5.4 Bare `c` overlaps core's chat accesskey

`c` is core's "focus chat input" accesskey (`total-conversion-build.js:239`) and, bare, your bookmarks-addon's **destructive reset**. Different chords (`Alt`+`C` vs `C`), so no technical collision — but a user reaching for chat who misses the Alt key gets a "Reset ALL bookmarks + maps?" prompt. The `confirm()` catches it. Consider moving the reset to a free letter anyway (`h`, `j`, `u`).

