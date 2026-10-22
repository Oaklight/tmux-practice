# tmux practice

**Live:** https://oaklight.github.io/tmux-practice/

An offline, single-page simulator for building tmux muscle memory. No build
step, no dependencies, no network calls.

```bash
xdg-open index.html      # or: python3 -m http.server -d . 8000
```

## What it does

- **Simulated terminal** with real split trees, windows, a status line, and
  a working prefix key (`Ctrl+b` by default).
- **15 drills** that check the action you performed, not the exact keystrokes.
  Move with prev/next or jump straight to a step via the numbered strip.
  Progress is stored in `localStorage`; a single step can be marked undone.
- **Cheatsheet** covering keys, shell commands, and config lines, with filter.
- **Touch keypad** so the same drills work on a phone.
- **Copy mode**, detach/reattach, command prompt with a small real parser,
  session/window choosers, zoom, resize, kill confirmations.

## Keys that work

Prefix + `c n p l % " o z x , & d s w [ : ? t 0–9` and arrows; prefix +
`Ctrl+arrow` to resize. `:` accepts a useful subset:

```
new-window -n logs        split-window -h        kill-pane
new-session -s work       rename-window NAME     rename-session NAME
select-window -t 1        detach                 list-keys
set -g mouse on           source-file ~/.tmux.conf
```

## Notes

- **Firefox** reserves `Ctrl+b` for the bookmarks sidebar. Switch the prefix to
  `Ctrl+a` under Settings, or tap the prefix chip.
- The simulator is deliberately forgiving: unbound keys produce a message and
  nothing breaks. Real tmux is equally forgiving — the prefix is a mode, not a
  held modifier.
- "Resurrection" is not simulated: a browser reload starts a fresh state.

## Files

| File | Purpose |
|---|---|
| `index.html` | markup, tabs, real-tmux reference |
| `styles.css` | theme, layout, terminal |
| `data.js` | key list, drills, cheatsheet |
| `engine.js` | state, split tree, mutations, command parser |
| `ui.js` | rendering, keyboard/pointer input, drills, persistence |

Asset URLs in `index.html` carry a `?v=` query. Bump it whenever `styles.css`
or one of the `.js` files changes, so a Pages deployment cannot serve new HTML
with cached old assets.
