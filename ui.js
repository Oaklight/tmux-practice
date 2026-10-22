/* Rendering, input, drills, tabs. */
(() => {
  'use strict';

  const E = window.TMUX;
  const D = window.TMUX_DATA;
  const S = E.S;
  const prefs = E.prefs;

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
  ));

  let drillIdx = 0;
  let hintOpen = false;
  let msgTimer = 0;
  let cmdMode = 'command';
  let cmdBuf = '';
  let chooser = { kind: 'sessions', idx: 0 };
  let confirmKind = null;
  const copyState = { line: 0, selecting: false };

  /* ---------- labels ---------- */

  function prefixLabel() {
    if (prefs.prefix === 'ctrl-a') return 'Ctrl+a';
    if (prefs.prefix === 'ctrl-space') return 'Ctrl+Space';
    return 'Ctrl+b';
  }

  function subPrefix(text) {
    return String(text || '').replace(/Ctrl\+b/g, prefixLabel());
  }

  function clock() {
    return new Date().toTimeString().slice(0, 8);
  }

  /* ---------- panes ---------- */

  function paneEl(leaf) {
    const w = E.win();
    const order = E.leaves(w.panes);
    const idx = order.indexOf(leaf);

    const el = document.createElement('div');
    el.className = 'pane' + (leaf.id === w.active ? ' active' : '');
    el.dataset.pane = leaf.id;

    const bar = document.createElement('div');
    bar.className = 'pane-bar';
    const title = document.createElement('span');
    title.textContent = idx + ':' + leaf.title;
    const badge = document.createElement('span');
    badge.className = 'pane-badge';
    badge.textContent = leaf.id === w.active ? '*' : '';
    bar.append(title, badge);

    const body = document.createElement('div');
    body.className = 'pane-body';
    const kind = E.KINDS[leaf.kind] || E.KINDS.shell;
    kind.lines.forEach((line) => {
      const row = document.createElement('div');
      row.className = 'line';
      row.textContent = line;
      body.appendChild(row);
    });
    if (kind.prompt) {
      const row = document.createElement('div');
      row.className = 'line promptline';
      const ps1 = document.createElement('span');
      ps1.className = 'ps1';
      ps1.textContent = kind.ps1 || 'shell';
      const cursor = document.createElement('span');
      cursor.className = 'cursor';
      row.append(ps1, document.createTextNode(' '), cursor);
      body.appendChild(row);
    }

    el.append(bar, body);
    el.addEventListener('click', () => {
      if (S.mode !== 'normal') return;
      w.active = leaf.id;
      E.msg('pane ' + idx + ' focused', 1200);
      render();
    });
    return el;
  }

  function nodeEl(node) {
    if (node.type === 'leaf') return paneEl(node);
    const box = document.createElement('div');
    box.className = 'split';
    box.dataset.dir = node.dir;
    const a = nodeEl(node.a);
    const b = nodeEl(node.b);
    a.style.flexGrow = String(node.ratio);
    b.style.flexGrow = String(1 - node.ratio);
    box.append(a, b);
    return box;
  }

  function copyBar() {
    const box = document.createElement('div');
    box.className = 'copybar' + (copyState.selecting ? ' selecting' : '');
    const head = document.createElement('div');
    head.className = 'copyhead';
    head.textContent = 'copy mode — Space select · Enter copy · q quit';
    box.appendChild(head);
    const lines = [
      '14:02:10 worker[204] heartbeat',
      '14:01:40 worker[204] heartbeat',
      '14:00:02 proxy certificate renewed',
      '13:59:11 health check ok',
      '13:58:04 bridge connected',
      '13:57:32 worker[204] heartbeat',
    ];
    lines.forEach((line, i) => {
      const row = document.createElement('div');
      row.className = 'copyline' + (i === copyState.line ? ' cur' : '');
      row.textContent = (i === copyState.line ? '› ' : '  ') + line;
      box.appendChild(row);
    });
    return box;
  }

  function renderPanes() {
    const host = $('#panes');
    const w = E.win();
    host.innerHTML = '';
    const tree = w.zoom ? (E.findLeaf(w.panes, w.active) || w.panes) : w.panes;
    host.appendChild(nodeEl(tree));
    if (S.mode === 'copy') {
      const active = host.querySelector('.pane.active');
      if (active) active.appendChild(copyBar());
    }
  }

  /* ---------- status / message / command line ---------- */

  function renderStatus() {
    const c = E.cur();
    const w = E.win();
    const left = document.createElement('span');
    left.className = 'st-left';

    const session = document.createElement('span');
    session.className = 'session';
    session.textContent = '[' + c.name + ']';
    left.appendChild(session);

    c.windows.forEach((item, i) => {
      const btn = document.createElement('button');
      btn.className = 'win' + (i === c.activeWindow ? ' on' : '');
      btn.textContent = i + ':' + item.name + (i === c.activeWindow ? '*' : '');
      btn.addEventListener('click', () => {
        E.selectWindow(i);
        render();
      });
      left.appendChild(btn);
    });

    const right = document.createElement('span');
    right.className = 'st-right';
    if (w.zoom) right.appendChild(document.createTextNode('Z '));
    if (!S.attached) right.appendChild(document.createTextNode('detached '));
    const host = document.createElement('span');
    host.className = 'st-host';
    host.textContent = '"devbox" ';
    right.appendChild(host);
    const time = document.createElement('span');
    time.id = 'st-time';
    time.textContent = clock();
    right.appendChild(time);
    if (S.prefixArmed) {
      const tag = document.createElement('span');
      tag.textContent = '  [PREFIX]';
      right.appendChild(tag);
    }

    const line = $('#statusline');
    line.innerHTML = '';
    line.append(left, right);
  }

  function renderMsg() {
    const el = $('#msgline');
    const on = S.msg && Date.now() < S.msgUntil;
    el.textContent = on ? S.msg : '';
    el.classList.toggle('on', !!on);
    clearTimeout(msgTimer);
    if (on) msgTimer = setTimeout(render, Math.max(60, S.msgUntil - Date.now() + 30));
  }

  function renderCmdline() {
    const el = $('#cmdline');
    if (S.mode !== 'command') {
      el.hidden = true;
      el.textContent = '';
      return;
    }
    el.hidden = false;
    const prompt = cmdMode === 'rename-window'
      ? 'rename-window: '
      : cmdMode === 'rename-session' ? 'rename-session: ' : ':';
    el.textContent = prompt + cmdBuf;
  }

  function renderHint() {
    const el = $('#hint');
    if (!prefs.hints) return;
    let text = 'Press ' + prefixLabel() + ', release, then a key — or tap a key below';
    if (S.mode === 'copy') text = 'copy mode: Space start · Enter copy · q quit';
    else if (S.mode === 'command') text = 'type a command, Enter to run, Escape to cancel';
    else if (S.mode === 'sessions' || S.mode === 'windows') text = '↑ ↓ move · Enter select · q close';
    else if (S.mode === 'detach') text = 'Enter reattaches — detaching never stops the processes';
    else if (S.mode === 'confirm') text = 'y confirms, n cancels';
    else if (S.mode === 'help') text = 'Escape, q or ? closes the key list';
    else if (S.prefixArmed) text = 'prefix armed — press a key: c n p % " o z x , d s [ : ? &';
    el.textContent = text;
  }

  /* ---------- overlays ---------- */

  function kbd(text) {
    const el = document.createElement('kbd');
    el.textContent = text;
    return el;
  }

  function helpCard() {
    const card = document.createElement('div');
    card.className = 'overlay-card';
    const head = document.createElement('h3');
    head.textContent = 'prefix keys — ' + prefixLabel() + ' then…';
    card.appendChild(head);

    const table = document.createElement('table');
    table.className = 'keytable';
    D.KEYMAP.forEach((row) => {
      const tr = document.createElement('tr');
      const cat = document.createElement('td');
      const label = document.createElement('span');
      label.className = 'cat';
      label.textContent = row[0];
      cat.appendChild(label);
      const key = document.createElement('td');
      key.appendChild(kbd(row[1]));
      const desc = document.createElement('td');
      desc.className = 'muted';
      desc.textContent = row[2];
      tr.append(cat, key, desc);
      table.appendChild(tr);
    });
    card.appendChild(table);

    const note = document.createElement('p');
    note.className = 'ov-note';
    note.textContent = 'Escape, q or ? closes this list.';
    card.appendChild(note);
    return card;
  }

  function clockCard() {
    const card = document.createElement('div');
    card.className = 'overlay-card';
    const head = document.createElement('h3');
    head.textContent = 'clock';
    const body = document.createElement('div');
    body.className = 'clock';
    body.textContent = clock();
    const note = document.createElement('p');
    note.className = 'ov-note';
    note.textContent = 'Yes, this is a real binding. Any of q, Escape or ? closes it.';
    card.append(head, body, note);
    return card;
  }

  function sessionRow(item, i) {
    const btn = document.createElement('button');
    btn.className = 'ov-item' + (i === chooser.idx ? ' sel' : '');
    const name = document.createElement('span');
    name.textContent = item.name;
    const meta = document.createElement('span');
    meta.className = 'meta';
    meta.textContent = item.windows.length + ' windows' + (i === E.S.si ? ' · current' : '');
    btn.append(name, meta);
    btn.addEventListener('click', () => {
      chooser.idx = i;
      choose();
    });
    return btn;
  }

  function chooserCard() {
    const isSessions = S.mode === 'sessions';
    const card = document.createElement('div');
    card.className = 'overlay-card';
    const head = document.createElement('h3');
    head.textContent = isSessions ? 'sessions' : 'windows';
    card.appendChild(head);

    const list = document.createElement('div');
    list.className = 'ov-list';
    if (isSessions) {
      E.S.sessions.forEach((item, i) => list.appendChild(sessionRow(item, i)));
    } else {
      E.cur().windows.forEach((item, i) => {
        const btn = document.createElement('button');
        btn.className = 'ov-item' + (i === chooser.idx ? ' sel' : '');
        const name = document.createElement('span');
        name.textContent = i + ': ' + item.name;
        const meta = document.createElement('span');
        meta.className = 'meta';
        meta.textContent = i === E.cur().activeWindow ? 'current' : '';
        btn.append(name, meta);
        btn.addEventListener('click', () => {
          chooser.idx = i;
          choose();
        });
        list.appendChild(btn);
      });
    }
    card.appendChild(list);

    const note = document.createElement('p');
    note.className = 'ov-note';
    note.textContent = '↑ ↓ move · Enter select · q close';
    card.appendChild(note);
    return card;
  }

  function detachCard() {
    const card = document.createElement('div');
    card.className = 'overlay-card';
    const head = document.createElement('h3');
    head.textContent = 'detached';
    const note = document.createElement('p');
    note.className = 'ov-note';
    note.innerHTML = 'Session <b>' + esc(E.cur().name) + '</b> is still running with '
      + E.cur().windows.length + ' window(s). Detaching never stops processes — that is the point.';
    card.append(head, note);

    const list = document.createElement('div');
    list.className = 'ov-list';
    E.S.sessions.forEach((item, i) => list.appendChild(sessionRow(item, i)));
    card.appendChild(list);

    const hint = document.createElement('p');
    hint.className = 'ov-note';
    hint.innerHTML = 'Press <b>Enter</b> to reattach. In a real shell: <code>tmux attach -t '
      + esc(E.cur().name) + '</code>.';
    card.appendChild(hint);
    return card;
  }

  function confirmCard() {
    const card = document.createElement('div');
    card.className = 'overlay-card';
    const head = document.createElement('h3');
    head.textContent = 'confirm';
    const note = document.createElement('p');
    note.className = 'ov-note';
    note.textContent = confirmKind === 'kill-window'
      ? 'Kill this window and every pane in it?'
      : 'Kill the active pane?';
    const actions = document.createElement('div');
    actions.className = 'confirm-actions';
    const yes = document.createElement('button');
    yes.className = 'danger ghost';
    yes.textContent = 'y — kill';
    yes.addEventListener('click', confirmYes);
    const no = document.createElement('button');
    no.className = 'ghost';
    no.textContent = 'n — cancel';
    no.addEventListener('click', confirmNo);
    actions.append(yes, no);
    card.append(head, note, actions);
    return card;
  }

  function renderOverlay() {
    const el = $('#overlay');
    const modal = ['help', 'clock', 'detach', 'sessions', 'windows', 'confirm'].indexOf(S.mode) >= 0;
    if (!modal) {
      el.hidden = true;
      el.innerHTML = '';
      return;
    }
    el.hidden = false;
    el.innerHTML = '';
    if (S.mode === 'help') el.appendChild(helpCard());
    else if (S.mode === 'clock') el.appendChild(clockCard());
    else if (S.mode === 'detach') el.appendChild(detachCard());
    else if (S.mode === 'sessions' || S.mode === 'windows') el.appendChild(chooserCard());
    else if (S.mode === 'confirm') el.appendChild(confirmCard());
  }

  /* ---------- drills ---------- */

  function nextUndone(from) {
    const start = from < 0 ? 0 : from;
    for (let n = 0; n < D.DRILLS.length; n += 1) {
      const i = (start + n) % D.DRILLS.length;
      if (prefs.done.indexOf(D.DRILLS[i].id) < 0) return i;
    }
    return 0;
  }

  function drillPasses(drill, action, payload) {
    try { return !!drill.test(action, payload); } catch (err) { return false; }
  }

  function checkDrill(action, payload) {
    const current = D.DRILLS[drillIdx % D.DRILLS.length];
    if (current && drillPasses(current, action, payload)) {
      if (prefs.done.indexOf(current.id) >= 0) {
        E.msg('✓ correct — already completed, practice anyway', 1800);
        return;
      }
      prefs.done.push(current.id);
      E.savePrefs();
      E.msg('✓ ' + subPrefix(current.task), 3200);
      hintOpen = false;
      return;
    }

    let hit = null;
    D.DRILLS.forEach((candidate) => {
      if (hit || prefs.done.indexOf(candidate.id) >= 0) return;
      if (drillPasses(candidate, action, payload)) hit = candidate;
    });
    if (!hit) return;
    prefs.done.push(hit.id);
    E.savePrefs();
    E.msg('✓ ' + subPrefix(hit.task), 3200);
    hintOpen = false;
  }

  function acted(action, payload) {
    checkDrill(action, payload);
    render();
  }

  function renderDrill() {
    const list = D.DRILLS;
    const total = list.length;
    const done = prefs.done.length;
    const current = drillIdx % total;
    const drill = list[current];

    $('#drill-count').textContent = done + ' / ' + total;
    $('#drill-fill').style.width = (100 * done / total) + '%';
    $('#drill-title').textContent = 'step ' + (current + 1) + ' of ' + total
      + (done === total ? ' · all done' : '');
    $('#drill-task').textContent = subPrefix(drill.task);
    $('#drill-keys').textContent = hintOpen ? subPrefix(drill.keys) : 'hidden — tap “show hint”';
    $('#drill-extra').hidden = !hintOpen || !drill.extra;
    $('#drill-extra').textContent = subPrefix(drill.extra) || '';
    $('#drill-hint-btn').textContent = hintOpen ? 'hide hint' : 'show hint';
    $('#drill-reset').hidden = prefs.done.indexOf(drill.id) < 0;
    renderStrip();
  }

  function renderStrip() {
    const host = $('#drill-strip');
    const current = drillIdx % D.DRILLS.length;
    host.innerHTML = '';
    D.DRILLS.forEach((drill, i) => {
      const done = prefs.done.indexOf(drill.id) >= 0;
      const btn = document.createElement('button');
      btn.className = 'step' + (done ? ' done' : '') + (i === current ? ' current' : '');
      btn.textContent = String(i + 1);
      btn.title = subPrefix(drill.task);
      btn.setAttribute('aria-label', 'Drill ' + (i + 1) + ': ' + subPrefix(drill.task)
        + (done ? ' (done)' : ''));
      btn.setAttribute('aria-current', i === current ? 'step' : 'false');
      btn.addEventListener('click', () => goToDrill(i));
      host.appendChild(btn);
    });
  }

  function goToDrill(index) {
    const total = D.DRILLS.length;
    drillIdx = ((index % total) + total) % total;
    hintOpen = false;
    render();
  }

  function stepDrill(delta) {
    goToDrill((drillIdx % D.DRILLS.length) + delta);
  }

  /* ---------- render ---------- */

  function render() {
    document.documentElement.dataset.theme = prefs.theme;
    $('#prefix-label').textContent = prefixLabel();
    $('#prefix-chip').classList.toggle('armed', S.prefixArmed);
    $('#hint').hidden = !prefs.hints;
    $('#keypad').hidden = !prefs.hints;
    renderPanes();
    renderStatus();
    renderMsg();
    renderCmdline();
    renderOverlay();
    renderHint();
    renderDrill();
  }

  /* ---------- input ---------- */

  function isPrefixKey(e) {
    if (prefs.prefix === 'ctrl-a') {
      return e.ctrlKey && !e.metaKey && !e.altKey && String(e.key).toLowerCase() === 'a';
    }
    if (prefs.prefix === 'ctrl-space') {
      return e.ctrlKey && (e.code === 'Space' || e.key === ' ');
    }
    return e.ctrlKey && !e.metaKey && !e.altKey && String(e.key).toLowerCase() === 'b';
  }

  function armPrefix(real) {
    S.prefixArmed = true;
    if (real) checkDrill('prefix');
    render();
  }

  function handleTmuxKey(e) {
    const key = String(e.key || '');
    if (key.indexOf('Arrow') === 0) {
      if (e.ctrlKey) {
        if (E.resizePane(key)) acted('resize', key);
        else render();
      } else {
        E.selectPane(key);
        acted('select-pane', key);
      }
      return;
    }
    if (/^[0-9]$/.test(key)) {
      E.selectWindow(Number(key));
      acted('select-window', key);
      return;
    }
    switch (key.toLowerCase()) {
      case '?':
        S.mode = 'help';
        acted('help');
        break;
      case 'c':
        E.newWindow('shell');
        acted('new-window');
        break;
      case 'n':
        E.nextWindow(1);
        acted('next-window');
        break;
      case 'p':
        E.nextWindow(-1);
        acted('prev-window');
        break;
      case 'l':
        E.lastWindow();
        acted('last-window');
        break;
      case '%':
        if (E.splitPane('h')) acted('split-h');
        else render();
        break;
      case '"':
        if (E.splitPane('v')) acted('split-v');
        else render();
        break;
      case 'o':
        E.nextPane();
        acted('next-pane');
        break;
      case 'z':
        E.zoomPane();
        acted('zoom');
        break;
      case 'x':
        confirmKind = 'kill-pane';
        S.mode = 'confirm';
        render();
        break;
      case '&':
        confirmKind = 'kill-window';
        S.mode = 'confirm';
        render();
        break;
      case ',':
        cmdMode = 'rename-window';
        cmdBuf = '';
        S.mode = 'command';
        render();
        break;
      case 'd':
        E.detach();
        S.mode = 'detach';
        acted('detach');
        break;
      case 's':
        chooser = { kind: 'sessions', idx: E.S.si };
        S.mode = 'sessions';
        acted('sessions');
        break;
      case 'w':
        chooser = { kind: 'windows', idx: E.cur().activeWindow };
        S.mode = 'windows';
        acted('windows');
        break;
      case '[':
        copyState.line = 0;
        copyState.selecting = false;
        S.mode = 'copy';
        acted('copy');
        break;
      case ':':
        cmdMode = 'command';
        cmdBuf = '';
        S.mode = 'command';
        render();
        break;
      case 't':
        S.mode = 'clock';
        render();
        break;
      case 'q':
        E.msg('pane numbers are not simulated — try z to zoom', 2200);
        render();
        break;
      default:
        E.msg('unbound key in the simulator: ' + key, 1800);
        render();
    }
  }

  function onKey(e) {
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    if (S.mode === 'command') { handleCommandKey(e); return; }
    if (S.mode === 'sessions' || S.mode === 'windows') { handleChooserKey(e); return; }
    if (S.mode === 'copy') { handleCopyKey(e); return; }
    if (S.mode === 'confirm') { handleConfirmKey(e); return; }
    if (S.mode === 'help' || S.mode === 'clock') { handleOverlayKey(e); return; }
    if (S.mode === 'detach') {
      if (e.key === 'Enter') {
        e.preventDefault();
        E.attach();
        S.mode = 'normal';
        acted('reattach');
      } else if (e.key === 'Escape') {
        e.preventDefault();
      }
      return;
    }

    if (isPrefixKey(e)) {
      e.preventDefault();
      e.stopPropagation();
      if (S.prefixArmed) {
        S.prefixArmed = false;
        render();
      } else {
        armPrefix(true);
      }
      return;
    }

    if (S.prefixArmed) {
      e.preventDefault();
      e.stopPropagation();
      S.prefixArmed = false;
      handleTmuxKey(e);
      return;
    }

    if (e.key === 'Escape' && S.prefixArmed) {
      S.prefixArmed = false;
      render();
    }
  }

  function handleCommandKey(e) {
    const key = e.key;
    if (key === 'Escape') {
      e.preventDefault();
      S.mode = 'normal';
      cmdBuf = '';
      render();
      return;
    }
    if (key === 'Enter') {
      e.preventDefault();
      const value = cmdBuf;
      cmdBuf = '';
      S.mode = 'normal';
      if (cmdMode === 'rename-window') {
        if (value.trim()) {
          E.renameWindow(value.trim());
          acted('rename-window', value.trim());
        } else {
          E.msg('rename cancelled', 1500);
          render();
        }
        return;
      }
      if (cmdMode === 'rename-session') {
        if (value.trim()) {
          E.renameSession(value.trim());
          E.msg('session renamed to ' + value.trim(), 1800);
        }
        render();
        return;
      }
      const result = E.command(value);
      if (result.help) {
        S.mode = 'help';
        E.msg(result.msg, 1800);
        render();
        return;
      }
      E.msg(result.msg || 'ok', 2200);
      acted('command-run', value.trim());
      return;
    }
    if (key === 'Backspace') {
      e.preventDefault();
      cmdBuf = cmdBuf.slice(0, -1);
      render();
      return;
    }
    if (key.length === 1 && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      if (cmdBuf.length < 100) cmdBuf += key;
      render();
    }
  }

  function handleChooserKey(e) {
    const items = S.mode === 'sessions' ? E.S.sessions : E.cur().windows;
    if (e.key === 'Escape' || e.key === 'q') {
      e.preventDefault();
      S.mode = 'normal';
      render();
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'j') {
      e.preventDefault();
      chooser.idx = (chooser.idx + 1) % items.length;
      render();
      return;
    }
    if (e.key === 'ArrowUp' || e.key === 'k') {
      e.preventDefault();
      chooser.idx = (chooser.idx - 1 + items.length) % items.length;
      render();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      choose();
    }
  }

  function choose() {
    if (S.mode === 'sessions') {
      E.switchSession(chooser.idx);
      S.mode = 'normal';
      E.msg('switched to ' + E.cur().name, 1600);
      acted('select-session');
    } else {
      E.selectWindow(chooser.idx);
      S.mode = 'normal';
      acted('select-window');
    }
  }

  function handleCopyKey(e) {
    if (e.key === 'q' || e.key === 'Escape') {
      e.preventDefault();
      S.mode = 'normal';
      copyState.selecting = false;
      acted('copy-exit');
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      copyState.line = Math.min(5, copyState.line + 1);
      render();
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      copyState.line = Math.max(0, copyState.line - 1);
      render();
      return;
    }
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      copyState.selecting = !copyState.selecting;
      render();
      return;
    }
    if (e.key === 'Enter' || e.key === 'y') {
      e.preventDefault();
      if (copyState.selecting) {
        copyState.selecting = false;
        E.msg('copied 1 line to the tmux buffer', 2000);
        render();
      }
      return;
    }
    e.preventDefault();
  }

  function handleConfirmKey(e) {
    if (e.key === 'y' || e.key === 'Y') {
      e.preventDefault();
      confirmYes();
    } else if (e.key === 'n' || e.key === 'N' || e.key === 'Escape' || e.key === 'Enter') {
      e.preventDefault();
      confirmNo();
    }
  }

  function confirmYes() {
    const kind = confirmKind;
    confirmKind = null;
    S.mode = 'normal';
    if (kind === 'kill-pane') {
      if (E.killPane()) acted('kill-pane');
      else render();
    } else if (kind === 'kill-window') {
      if (E.killWindow()) acted('kill-window');
      else render();
    } else {
      render();
    }
  }

  function confirmNo() {
    confirmKind = null;
    S.mode = 'normal';
    E.msg('cancelled', 1200);
    render();
  }

  function handleOverlayKey(e) {
    if (e.key === 'Escape' || e.key === 'q' || e.key === '?') {
      e.preventDefault();
      S.mode = 'normal';
      render();
    }
  }

  /* ---------- touch keypad ---------- */

  function tapKey(k) {
    if (k === 'prefix') {
      if (S.prefixArmed) {
        S.prefixArmed = false;
        render();
      } else {
        armPrefix(false);
      }
      return;
    }
    if (S.mode !== 'normal') return;
    const fake = {
      key: k.indexOf('C-') === 0 ? k.slice(2) : k,
      ctrlKey: k.indexOf('C-') === 0,
      metaKey: false,
      altKey: false,
      preventDefault() {},
      stopPropagation() {},
    };
    handleTmuxKey(fake);
  }

  /* ---------- cheatsheet ---------- */

  function renderCheat(filter) {
    const q = String(filter || '').trim().toLowerCase();
    const host = $('#cheat-list');
    host.innerHTML = '';
    const groups = [];

    D.CHEATSHEET.forEach((item) => {
      const hay = (item.cat + ' ' + item.key + ' ' + item.desc).toLowerCase();
      if (q && hay.indexOf(q) < 0) return;
      let group = null;
      groups.forEach((g) => { if (g.cat === item.cat) group = g; });
      if (!group) {
        group = { cat: item.cat, items: [] };
        groups.push(group);
      }
      group.items.push(item);
    });

    if (!groups.length) {
      const empty = document.createElement('p');
      empty.className = 'muted tiny';
      empty.textContent = 'no matches';
      host.appendChild(empty);
      return;
    }

    groups.forEach((group) => {
      const box = document.createElement('div');
      box.className = 'cheat-group';
      const head = document.createElement('h4');
      head.textContent = group.cat;
      box.appendChild(head);
      group.items.forEach((item) => {
        const row = document.createElement('div');
        row.className = 'cheat-row';
        const key = document.createElement('div');
        key.className = 'cheat-key';
        key.innerHTML = esc(item.key).replace(/prefix/g, '<span class="p">prefix</span>');
        const desc = document.createElement('div');
        desc.className = 'cheat-desc';
        desc.textContent = item.desc;
        row.append(key, desc);
        box.appendChild(row);
      });
      host.appendChild(box);
    });
  }

  /* ---------- tabs / settings ---------- */

  function initTabs() {
    $$('.tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        $$('.tab').forEach((t) => t.classList.toggle('active', t === tab));
        ['drills', 'cheat', 'real', 'settings'].forEach((name) => {
          $('#tab-' + name).hidden = name !== tab.dataset.tab;
        });
        if (tab.dataset.tab === 'cheat') renderCheat($('#cheat-search').value);
        if (tab.dataset.tab === 'settings') syncSettings();
      });
    });
  }

  function syncSettings() {
    $$('input[name="prefix"]').forEach((radio) => {
      radio.checked = radio.value === prefs.prefix;
    });
    $('#opt-hints').checked = !!prefs.hints;
  }

  function resetAll() {
    prefs.done = [];
    E.savePrefs();
    drillIdx = 0;
    hintOpen = false;
    E.msg('progress reset', 1600);
    render();
  }

  function initSettings() {
    $$('input[name="prefix"]').forEach((radio) => {
      radio.addEventListener('change', () => {
        if (!radio.checked) return;
        prefs.prefix = radio.value;
        S.prefixArmed = false;
        E.savePrefs();
        E.msg('prefix is now ' + prefixLabel(), 1800);
        render();
      });
    });
    $('#opt-hints').addEventListener('change', (e) => {
      prefs.hints = e.target.checked;
      E.savePrefs();
      render();
    });
    $('#wipe').addEventListener('click', resetAll);
    $('#reset-top').addEventListener('click', resetAll);
  }

  /* ---------- wiring ---------- */

  function init() {
    initTabs();
    initSettings();
    syncSettings();

    $('#cheat-search').addEventListener('input', (e) => renderCheat(e.target.value));
    $('#drill-hint-btn').addEventListener('click', () => {
      hintOpen = !hintOpen;
      render();
    });
    $('#drill-prev').addEventListener('click', () => stepDrill(-1));
    $('#drill-next').addEventListener('click', () => stepDrill(1));
    $('#drill-reset').addEventListener('click', () => {
      const drill = D.DRILLS[drillIdx % D.DRILLS.length];
      prefs.done = prefs.done.filter((id) => id !== drill.id);
      E.savePrefs();
      E.msg('drill marked undone', 1500);
      render();
    });
    $('#theme-btn').addEventListener('click', () => {
      prefs.theme = prefs.theme === 'dark' ? 'light' : 'dark';
      E.savePrefs();
      render();
    });
    $('#prefix-chip').addEventListener('click', () => {
      if (S.prefixArmed) {
        S.prefixArmed = false;
        render();
      } else {
        armPrefix(false);
      }
    });

    $$('#keypad .key').forEach((btn) => {
      btn.addEventListener('click', () => tapKey(btn.dataset.k));
    });

    document.addEventListener('keydown', onKey, true);

    renderCheat('');
    drillIdx = nextUndone(-1);
    render();

    setInterval(() => {
      if (S.mode === 'clock') renderOverlay();
      else {
        const time = $('#st-time');
        if (time) time.textContent = clock();
      }
    }, 1000);
  }

  init();
})();
