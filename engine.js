/* State and mutations for the tmux simulator. No DOM here. */
(() => {
  'use strict';

  const STORE_KEY = 'tmux-practice:v1';

  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (err) { saved = {}; }

  const prefs = Object.assign(
    { prefix: 'ctrl-b', theme: 'dark', done: [], hints: true },
    saved.prefs || {}
  );
  if (!Array.isArray(prefs.done)) prefs.done = [];

  function savePrefs() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ prefs })); } catch (err) { /* private mode */ }
  }

  let uid = 1;

  const KINDS = {
    shell: {
      title: 'shell', prompt: true, ps1: 'you@devbox ~/code',
      lines: [],
    },
    vim: {
      title: 'vim', prompt: false,
      lines: [
        '  1 " notes.md',
        '  2',
        '  3 ## tmux',
        '  4 - prefix Ctrl+b, then:',
        '  5 - c  new window',
        '  6 - %  split side by side',
        '  7 - "  split stacked',
        '~',
        '"notes.md" 7L, 118B',
      ],
    },
    logs: {
      title: 'logs', prompt: false,
      lines: [
        '12:01:04 worker[204] bridge connected to edge-1',
        '12:02:11 worker[204] health check ok',
        '12:03:02 proxy certificate renewed',
        '12:04:19 worker[204] heartbeat',
        '12:04:49 worker[204] heartbeat',
      ],
    },
    tests: {
      title: 'pytest', prompt: false,
      lines: ['$ pytest -q', '....................', '20 passed in 0.42s'],
    },
    top: {
      title: 'htop', prompt: false,
      lines: [
        '  CPU[||||||          32%]',
        '  Mem[|||||||      6.1G/31G]',
        '  Swp[              0K/36G]',
        '  PID  USER   CPU%  MEM%  COMMAND',
        '  1842 you   7.2   1.1  node',
        '  2033 you   2.8   0.4  claude',
      ],
    },
  };

  const SPLIT_KINDS = ['logs', 'tests', 'vim', 'top', 'shell'];
  let splitCursor = 0;

  function nextSplitKind() {
    const kind = SPLIT_KINDS[splitCursor % SPLIT_KINDS.length];
    splitCursor += 1;
    return kind;
  }

  function makeLeaf(kind) {
    const k = KINDS[kind] ? kind : 'shell';
    return { type: 'leaf', id: 'p' + (uid++), kind: k, title: KINDS[k].title };
  }

  function makeWindow(name) {
    const pane = makeLeaf('shell');
    return {
      id: 'w' + (uid++),
      name: name || 'shell',
      panes: pane,
      active: pane.id,
      zoom: false,
    };
  }

  function makeSession(name) {
    return {
      id: 's' + (uid++),
      name: name || String(uid),
      windows: [makeWindow('shell')],
      activeWindow: 0,
      lastWindow: 0,
    };
  }

  const S = {
    sessions: [makeSession('work')],
    si: 0,
    prefixArmed: false,
    attached: true,
    mode: 'normal',
    msg: '',
    msgUntil: 0,
  };

  const cur = () => S.sessions[S.si];
  const win = () => cur().windows[cur().activeWindow];

  function msg(text, ms) {
    S.msg = text;
    S.msgUntil = Date.now() + (ms || 2600);
  }

  function leaves(node, out) {
    const acc = out || [];
    if (!node) return acc;
    if (node.type === 'leaf') { acc.push(node); return acc; }
    leaves(node.a, acc);
    leaves(node.b, acc);
    return acc;
  }

  function findLeaf(node, id) {
    if (!node) return null;
    if (node.type === 'leaf') return node.id === id ? node : null;
    return findLeaf(node.a, id) || findLeaf(node.b, id);
  }

  function activeLeaf() {
    const w = win();
    return findLeaf(w.panes, w.active) || leaves(w.panes)[0];
  }

  function splitTree(node, targetId, dir) {
    if (node.type === 'leaf') {
      if (node.id !== targetId) return node;
      const kept = { type: 'leaf', id: node.id, kind: node.kind, title: node.title };
      const fresh = makeLeaf(nextSplitKind());
      return { type: 'split', dir: dir, ratio: 0.5, a: kept, b: fresh };
    }
    return {
      type: 'split',
      dir: node.dir,
      ratio: node.ratio,
      a: splitTree(node.a, targetId, dir),
      b: splitTree(node.b, targetId, dir),
    };
  }

  function removeLeaf(node, id) {
    if (node.type === 'leaf') return node.id === id ? null : node;
    const a = removeLeaf(node.a, id);
    const b = removeLeaf(node.b, id);
    if (!a) return b;
    if (!b) return a;
    return { type: 'split', dir: node.dir, ratio: node.ratio, a: a, b: b };
  }

  /* ---------- window / pane operations ---------- */

  function newWindow(name) {
    const c = cur();
    c.lastWindow = c.activeWindow;
    c.windows.push(makeWindow(name || 'shell'));
    c.activeWindow = c.windows.length - 1;
    return true;
  }

  function splitPane(dir) {
    const w = win();
    if (leaves(w.panes).length >= 6) {
      msg('six panes is plenty for practice');
      return false;
    }
    w.panes = splitTree(w.panes, w.active, dir);
    const all = leaves(w.panes);
    w.active = all[all.length - 1].id;
    w.zoom = false;
    return true;
  }

  function killPane() {
    const w = win();
    const all = leaves(w.panes);
    if (all.length < 2) {
      if (cur().windows.length > 1) {
        killWindow();
        return true;
      }
      msg('last pane in the last window — use :kill-session');
      return false;
    }
    const idx = all.findIndex((p) => p.id === w.active);
    w.panes = removeLeaf(w.panes, w.active);
    const rest = leaves(w.panes);
    w.active = rest[Math.max(0, idx - 1)].id;
    w.zoom = false;
    return true;
  }

  function killWindow() {
    const c = cur();
    if (c.windows.length < 2) {
      msg('last window — kill the session with :kill-session');
      return false;
    }
    c.windows.splice(c.activeWindow, 1);
    c.activeWindow = Math.min(c.activeWindow, c.windows.length - 1);
    return true;
  }

  function zoomPane() {
    const w = win();
    w.zoom = !w.zoom;
    return true;
  }

  function nextPane() {
    const w = win();
    const all = leaves(w.panes);
    const idx = all.findIndex((p) => p.id === w.active);
    w.active = all[(idx + 1) % all.length].id;
    return true;
  }

  function selectPane(dir) {
    const w = win();
    const all = leaves(w.panes);
    const idx = all.findIndex((p) => p.id === w.active);
    const step = (dir === 'ArrowLeft' || dir === 'ArrowUp') ? -1 : 1;
    w.active = all[(idx + step + all.length) % all.length].id;
    return true;
  }

  function resizePane(dir) {
    const w = win();
    const axis = (dir === 'ArrowLeft' || dir === 'ArrowRight') ? 'h' : 'v';
    const positive = (dir === 'ArrowRight' || dir === 'ArrowDown');

    const path = [];
    (function walk(node) {
      if (node.type === 'leaf') return false;
      const inA = findLeaf(node.a, w.active) !== null;
      path.push({ node: node, inA: inA });
      return walk(inA ? node.a : node.b);
    })(w.panes);

    for (let i = path.length - 1; i >= 0; i -= 1) {
      const entry = path[i];
      if (entry.node.dir !== axis) continue;
      const growA = entry.inA ? positive : !positive;
      entry.node.ratio = Math.min(0.8, Math.max(0.2, entry.node.ratio + (growA ? 0.06 : -0.06)));
      return true;
    }
    msg('no split on that axis — split first');
    return false;
  }

  function selectWindow(index) {
    const c = cur();
    if (index < 0 || index >= c.windows.length) {
      msg('no window ' + index);
      return false;
    }
    c.lastWindow = c.activeWindow;
    c.activeWindow = index;
    return true;
  }

  function nextWindow(delta) {
    const c = cur();
    const n = c.windows.length;
    c.lastWindow = c.activeWindow;
    c.activeWindow = (c.activeWindow + delta + n) % n;
    return true;
  }

  function lastWindow() {
    const c = cur();
    const tmp = c.activeWindow;
    c.activeWindow = c.lastWindow;
    c.lastWindow = tmp;
    return true;
  }

  function renameWindow(name) {
    if (!name) return false;
    win().name = name;
    return true;
  }

  /* ---------- session operations ---------- */

  function newSession(name) {
    S.sessions.push(makeSession(name));
    S.si = S.sessions.length - 1;
    return true;
  }

  function switchSession(index) {
    if (index < 0 || index >= S.sessions.length) return false;
    S.si = index;
    return true;
  }

  function renameSession(name) {
    if (!name) return false;
    cur().name = name;
    return true;
  }

  function killSession(indexOrName) {
    let idx = S.si;
    if (typeof indexOrName === 'number') idx = indexOrName;
    if (typeof indexOrName === 'string') {
      idx = S.sessions.findIndex((s) => s.name === indexOrName);
    }
    if (idx < 0 || S.sessions.length < 2) return false;
    S.sessions.splice(idx, 1);
    S.si = Math.max(0, idx - 1);
    return true;
  }

  function detach() {
    S.attached = false;
    return true;
  }

  function attach() {
    S.attached = true;
    return true;
  }

  /* ---------- command prompt ---------- */

  function flagValue(args, flag) {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  }

  function command(input) {
    const raw = String(input || '').trim();
    if (!raw) return { ok: true, msg: '' };
    const parts = raw.split(/\s+/);
    const cmd = parts[0];
    const args = parts.slice(1);

    switch (cmd) {
      case 'new-window':
      case 'neww': {
        const name = flagValue(args, '-n') || 'shell';
        newWindow(name);
        return { ok: true, msg: 'new window: ' + name };
      }
      case 'split-window':
      case 'splitw': {
        const dir = args.indexOf('-h') >= 0 ? 'h' : 'v';
        if (!splitPane(dir)) return { ok: false, msg: S.msg };
        return { ok: true, msg: 'split ' + (dir === 'h' ? 'side by side' : 'stacked') };
      }
      case 'kill-pane':
        if (!killPane()) return { ok: false, msg: S.msg };
        return { ok: true, msg: 'pane killed' };
      case 'kill-window':
        if (!killWindow()) return { ok: false, msg: S.msg };
        return { ok: true, msg: 'window killed' };
      case 'new-session':
      case 'new': {
        const name = flagValue(args, '-s') || 'session' + S.sessions.length;
        newSession(name);
        return { ok: true, msg: 'new session: ' + name };
      }
      case 'kill-session': {
        const target = flagValue(args, '-t');
        const ok = target === undefined ? killSession(S.si) : killSession(target);
        if (!ok) return { ok: false, msg: 'cannot kill that session (keep at least one)' };
        return { ok: true, msg: 'session killed' };
      }
      case 'attach-session':
      case 'attach': {
        const target = flagValue(args, '-t');
        if (target === undefined) { attach(); return { ok: true, msg: 'attached' }; }
        const idx = S.sessions.findIndex((s) => s.name === target);
        if (idx < 0) return { ok: false, msg: 'no session named ' + target };
        switchSession(idx);
        attach();
        return { ok: true, msg: 'attached to ' + target };
      }
      case 'rename-window':
      case 'renamew': {
        const name = args.filter((a) => !a.startsWith('-')).join(' ');
        if (!name) return { ok: false, msg: 'usage: rename-window NAME' };
        renameWindow(name);
        return { ok: true, msg: 'window renamed to ' + name };
      }
      case 'rename-session': {
        const name = args.filter((a) => !a.startsWith('-')).join(' ');
        if (!name) return { ok: false, msg: 'usage: rename-session NAME' };
        renameSession(name);
        return { ok: true, msg: 'session renamed to ' + name };
      }
      case 'select-window': {
        const target = flagValue(args, '-t');
        const index = target ? parseInt(String(target).replace(/[^0-9]/g, ''), 10) : NaN;
        if (!Number.isNaN(index)) selectWindow(index);
        return { ok: true, msg: 'window selected' };
      }
      case 'detach':
      case 'detach-client':
        detach();
        return { ok: true, msg: 'detached' };
      case 'list-keys':
        return { ok: true, msg: 'opening key list', help: true };
      case 'set-option':
      case 'set':
      case 'setw':
      case 'set-window-option':
      case 'bind':
      case 'bind-key':
      case 'unbind':
      case 'source-file':
      case 'source':
        return { ok: true, msg: cmd + ' applied (simulated)' };
      default:
        return { ok: false, msg: 'unknown command: ' + cmd };
    }
  }

  window.TMUX = {
    S: S,
    prefs: prefs,
    savePrefs: savePrefs,
    KINDS: KINDS,
    msg: msg,
    cur: cur,
    win: win,
    leaves: leaves,
    findLeaf: findLeaf,
    activeLeaf: activeLeaf,
    newWindow: newWindow,
    splitPane: splitPane,
    killPane: killPane,
    killWindow: killWindow,
    zoomPane: zoomPane,
    nextPane: nextPane,
    selectPane: selectPane,
    resizePane: resizePane,
    selectWindow: selectWindow,
    nextWindow: nextWindow,
    lastWindow: lastWindow,
    renameWindow: renameWindow,
    newSession: newSession,
    switchSession: switchSession,
    renameSession: renameSession,
    killSession: killSession,
    detach: detach,
    attach: attach,
    command: command,
  };
})();
