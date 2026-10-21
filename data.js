/* Static content: key list, drills, cheatsheet. Loaded before engine.js. */
(() => {
  'use strict';

  const KEYMAP = [
    ['Sessions', 'd', 'detach — leave everything running'],
    ['Sessions', 's', 'session list (choose-tree)'],
    ['Sessions', '$', 'rename session'],
    ['Sessions', ':new-session -s name', 'create a session'],
    ['Windows', 'c', 'new window'],
    ['Windows', 'n / p', 'next / previous window'],
    ['Windows', '0–9', 'jump to window number'],
    ['Windows', 'w', 'window list'],
    ['Windows', ',', 'rename window'],
    ['Windows', '&', 'kill window'],
    ['Windows', 'l', 'last window'],
    ['Panes', '%', 'split side by side'],
    ['Panes', '"', 'split stacked'],
    ['Panes', 'o', 'next pane'],
    ['Panes', '← ↑ → ↓', 'select pane in a direction'],
    ['Panes', 'z', 'zoom / unzoom pane'],
    ['Panes', 'x', 'kill pane'],
    ['Panes', 'Ctrl+← ↑ → ↓', 'resize pane'],
    ['Copy mode', '[', 'enter copy mode'],
    ['Copy mode', 'Space', 'start selection'],
    ['Copy mode', 'Enter', 'copy selection'],
    ['Copy mode', 'q', 'leave copy mode'],
    ['Other', '?', 'list every key'],
    ['Other', ':', 'command prompt'],
    ['Other', 't', 'clock'],
  ];

  const DRILLS = [
    {
      id: 'prefix',
      task: 'Arm the prefix: press Ctrl+b and release. The chip at the top should light up.',
      keys: 'Ctrl+b  (release, do not hold)',
      extra: 'Every tmux binding is prefix + one key. The prefix is a mode switch, not a modifier you hold.',
      test: (a) => a === 'prefix',
    },
    {
      id: 'help',
      task: 'Open the key list without leaving the terminal.',
      keys: 'Ctrl+b  then  ?',
      extra: 'Prefix then ? is list-keys. Escape or q closes it.',
      test: (a) => a === 'help',
    },
    {
      id: 'new-window',
      task: 'Create a second window and switch to it.',
      keys: 'Ctrl+b  then  c',
      extra: 'The status line is the window list: 0:shell 1:shell*. The * is where you are.',
      test: (a) => a === 'new-window',
    },
    {
      id: 'next-window',
      task: 'Move to the next window.',
      keys: 'Ctrl+b  then  n',
      extra: 'p goes backwards. l jumps to the last window you visited — handy when hopping between two.',
      test: (a) => a === 'next-window',
    },
    {
      id: 'split-h',
      task: 'Split the active pane side by side (left / right).',
      keys: 'Ctrl+b  then  %',
      extra: 'In tmux terms this is split-window -h: -h describes the horizontal arrangement, not the divider.',
      test: (a) => a === 'split-h',
    },
    {
      id: 'split-v',
      task: 'Split the active pane into stacked panes (top / bottom).',
      keys: 'Ctrl+b  then  "',
      extra: 'That is a literal double quote: Shift+\' on most layouts.',
      test: (a) => a === 'split-v',
    },
    {
      id: 'next-pane',
      task: 'Cycle focus to the next pane.',
      keys: 'Ctrl+b  then  o',
      extra: 'Arrow keys after the prefix select a pane by direction. o cycles through them in order.',
      test: (a) => a === 'next-pane',
    },
    {
      id: 'zoom',
      task: 'Zoom the active pane to fill the window, then unzoom it.',
      keys: 'Ctrl+b  then  z  (again to undo)',
      extra: 'Zoom is the answer to a pane that is too small to read — the second z restores the layout.',
      test: (a) => a === 'zoom',
    },
    {
      id: 'resize',
      task: 'Make the active pane wider or taller.',
      keys: 'Ctrl+b  then  Ctrl+→  (or Ctrl+← ↑ ↓)',
      extra: 'The second key is Ctrl+arrow, not arrow alone: arrow selects, Ctrl+arrow resizes.',
      test: (a) => a === 'resize',
    },
    {
      id: 'rename-window',
      task: 'Rename the current window to anything you like.',
      keys: 'Ctrl+b  then  ,  type a name  Enter',
      extra: 'Automatic renames are noisy. Naming windows after their purpose makes the status line useful.',
      test: (a) => a === 'rename-window',
    },
    {
      id: 'detach',
      task: 'Detach from the session, then reattach.',
      keys: 'Ctrl+b  then  d  — then  Enter  to reattach',
      extra: 'This is the whole point: detaching leaves every process running. Closing the terminal is not the same thing.',
      test: (a) => a === 'reattach',
    },
    {
      id: 'sessions',
      task: 'Open the session list.',
      keys: 'Ctrl+b  then  s',
      extra: 'Sessions contain windows; windows contain panes. One session per project keeps them apart.',
      test: (a) => a === 'sessions',
    },
    {
      id: 'command',
      task: 'Use the command prompt to open a window named “logs”.',
      keys: 'Ctrl+b  then  :  new-window -n logs  Enter',
      extra: 'Every key binding is a command. The prompt is where you learn the real names.',
      test: (a, p) => a === 'command-run' && /^new-window/.test(p || ''),
    },
    {
      id: 'copy',
      task: 'Enter copy mode, then leave it.',
      keys: 'Ctrl+b  then  [  — then  q',
      extra: 'Copy mode is how you scroll back. Space starts a selection, Enter copies, q leaves.',
      test: (a) => a === 'copy-exit',
    },
    {
      id: 'kill-pane',
      task: 'Kill the active pane (and confirm).',
      keys: 'Ctrl+b  then  x  then  y',
      extra: 'tmux asks before destructive actions. Read the prompt — y is easy to hit by reflex.',
      test: (a) => a === 'kill-pane',
    },
  ];

  const CHEATSHEET = [
    // shell
    { cat: 'Shell', key: 'tmux', desc: 'start a new session' },
    { cat: 'Shell', key: 'tmux new -A -s NAME', desc: 'attach to NAME, or create it — safe to re-run' },
    { cat: 'Shell', key: 'tmux new -A -s NAME -c DIR', desc: 'same, starting in DIR' },
    { cat: 'Shell', key: 'tmux ls', desc: 'list sessions' },
    { cat: 'Shell', key: 'tmux attach -t NAME', desc: 'reattach after a disconnect' },
    { cat: 'Shell', key: 'tmux new -d -s NAME CMD', desc: 'start detached and run CMD' },
    { cat: 'Shell', key: 'tmux kill-session -t NAME', desc: 'end a session (kills its processes)' },
    { cat: 'Shell', key: 'tmux kill-server', desc: 'end every session — careful' },
    { cat: 'Shell', key: 'tmux capture-pane -pt NAME', desc: 'print the visible pane without attaching' },
    { cat: 'Shell', key: 'tmux send-keys -t NAME CMD Enter', desc: 'type into a session from a script' },

    // sessions
    { cat: 'Sessions', key: 'prefix d', desc: 'detach; everything keeps running' },
    { cat: 'Sessions', key: 'prefix s', desc: 'session / window tree' },
    { cat: 'Sessions', key: 'prefix $', desc: 'rename session' },
    { cat: 'Sessions', key: 'prefix :new-session -s NAME', desc: 'create a session' },
    { cat: 'Sessions', key: 'prefix ( / )', desc: 'previous / next client' },

    // windows
    { cat: 'Windows', key: 'prefix c', desc: 'new window' },
    { cat: 'Windows', key: 'prefix n / p', desc: 'next / previous window' },
    { cat: 'Windows', key: 'prefix 0–9', desc: 'jump to window' },
    { cat: 'Windows', key: 'prefix w', desc: 'window list' },
    { cat: 'Windows', key: 'prefix ,', desc: 'rename window' },
    { cat: 'Windows', key: 'prefix &', desc: 'kill window (asks)' },
    { cat: 'Windows', key: 'prefix l', desc: 'last window' },
    { cat: 'Windows', key: 'prefix .', desc: 'move window to another index' },
    { cat: 'Windows', key: 'prefix f', desc: 'find a window by name' },

    // panes
    { cat: 'Panes', key: 'prefix %', desc: 'split side by side (-h)' },
    { cat: 'Panes', key: 'prefix "', desc: 'split stacked (-v)' },
    { cat: 'Panes', key: 'prefix o', desc: 'next pane' },
    { cat: 'Panes', key: 'prefix ;', desc: 'last pane' },
    { cat: 'Panes', key: 'prefix ← ↑ → ↓', desc: 'select pane by direction' },
    { cat: 'Panes', key: 'prefix Ctrl+← ↑ → ↓', desc: 'resize pane' },
    { cat: 'Panes', key: 'prefix z', desc: 'zoom / unzoom' },
    { cat: 'Panes', key: 'prefix x', desc: 'kill pane (asks)' },
    { cat: 'Panes', key: 'prefix !', desc: 'break pane into its own window' },
    { cat: 'Panes', key: 'prefix { / }', desc: 'swap pane left / right' },
    { cat: 'Panes', key: 'prefix Space', desc: 'cycle layouts' },
    { cat: 'Panes', key: 'prefix q', desc: 'show pane numbers; press one to jump' },

    // copy mode
    { cat: 'Copy mode', key: 'prefix [', desc: 'enter copy mode (scrollback)' },
    { cat: 'Copy mode', key: 'Space', desc: 'start selection' },
    { cat: 'Copy mode', key: 'Enter', desc: 'copy selection and exit' },
    { cat: 'Copy mode', key: 'prefix ]', desc: 'paste the tmux buffer' },
    { cat: 'Copy mode', key: 'q / Escape', desc: 'leave copy mode' },
    { cat: 'Copy mode', key: 'prefix =', desc: 'list buffers' },

    // misc
    { cat: 'Other', key: 'prefix ?', desc: 'list all key bindings' },
    { cat: 'Other', key: 'prefix :', desc: 'command prompt (every binding has a name)' },
    { cat: 'Other', key: 'prefix t', desc: 'clock' },
    { cat: 'Other', key: 'prefix ~', desc: 'show messages' },
    { cat: 'Other', key: 'prefix :set -g mouse on', desc: 'enable mouse (put it in ~/.tmux.conf)' },
    { cat: 'Other', key: 'prefix r', desc: 'reload config — only if you bound it' },

    // config
    { cat: 'Config', key: 'set -g base-index 1', desc: 'number windows from 1' },
    { cat: 'Config', key: 'setw -g pane-base-index 1', desc: 'number panes from 1' },
    { cat: 'Config', key: 'set -g history-limit 50000', desc: 'deeper scrollback' },
    { cat: 'Config', key: 'set -sg escape-time 10', desc: 'snappier Escape in vim/neovim' },
    { cat: 'Config', key: 'set -g mouse on', desc: 'click to focus, drag to resize, wheel to scroll' },
    { cat: 'Config', key: 'bind | split-window -h -c "#{pane_current_path}"', desc: 'split keeping the current directory' },
    { cat: 'Config', key: 'bind r source-file ~/.tmux.conf', desc: 'reload shortcut' },
  ];

  window.TMUX_DATA = { KEYMAP, DRILLS, CHEATSHEET };
})();
