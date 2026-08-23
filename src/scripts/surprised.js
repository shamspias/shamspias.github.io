/*
 * The Surprised arcade: two dozen tiny games, each one a small idea from logic,
 * physics, or maths made pokeable. No framework, no assets, no network. Every
 * game mounts into a stage element on demand (when its card first scrolls into
 * view) and pauses its animation when it scrolls away, so a page of two dozen
 * of them stays light.
 *
 * A game is a factory: `(stage) => handle`, where the handle may carry
 * `pause()` and `resume()` for anything that runs an animation loop. Everything
 * else is plain DOM, driven by the shared helpers at the top.
 */

/* --- tiny helpers ---------------------------------------------------------- */

/** Hyperscript. `el('button', {class:'g-btn', onClick:f}, 'Go')`. */
function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'style') n.style.cssText = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k === 'dataset') Object.assign(n.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2).toLowerCase(), v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    n.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return n;
}

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/** The site's own colours, so a game looks native in either theme. */
function theme() {
  const cs = getComputedStyle(document.documentElement);
  const g = (n, f) => cs.getPropertyValue(n).trim() || f;
  return {
    bg: g('--bg', '#fafafa'),
    sunken: g('--bg-sunken', '#f4f4f5'),
    fg: g('--fg', '#1a1a1c'),
    faint: g('--fg-faint', '#67676f'),
    muted: g('--fg-muted', '#52525b'),
    accent: g('--accent', '#a8290f'),
    rule: g('--rule', '#e4e4e7'),
  };
}

/** A cheerful, colour-blind-friendly-ish palette that reads in both themes. */
const CANDY = ['#ff5d8f', '#ff9f45', '#ffd23f', '#3ddc97', '#4da3ff', '#a78bfa', '#f97316', '#22d3ee'];

/* --- shared building blocks ----------------------------------------------- */

function button(label, onClick, extra = '') {
  return el('button', { type: 'button', class: 'g-btn ' + extra, onClick }, label);
}

function bar(...kids) {
  return el('div', { class: 'g-bar' }, ...kids);
}

function note(text = '') {
  return el('p', { class: 'g-note', 'aria-live': 'polite' }, text);
}

/**
 * A DPI-correct canvas that fills the stage width at a fixed aspect ratio and
 * re-fits on resize. Draw in CSS pixels; the transform handles the rest.
 */
function makeCanvas(stage, ratio = 1.5) {
  const wrap = el('div', { class: 'g-canvas' });
  const cv = document.createElement('canvas');
  wrap.append(cv);
  stage.append(wrap);
  const ctx = cv.getContext('2d');
  const state = { W: 0, H: 0 };
  function fit() {
    const w = Math.max(1, Math.round(wrap.clientWidth));
    const h = Math.round(w / ratio);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    state.W = w;
    state.H = h;
    wrap.style.height = h + 'px';
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    cv.style.width = w + 'px';
    cv.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  const ro = new ResizeObserver(fit);
  ro.observe(wrap);
  fit();
  return { wrap, cv, ctx, state, fit, destroy: () => ro.disconnect() };
}

/** An animation loop that only runs while `start`ed. dt is clamped seconds. */
function makeLoop(fn) {
  let id = null,
    last = 0,
    on = false;
  const step = (t) => {
    if (!on) return;
    const dt = Math.min(0.04, (t - last) / 1000 || 0);
    last = t;
    fn(dt, t / 1000);
    id = requestAnimationFrame(step);
  };
  return {
    start() {
      if (on) return;
      on = true;
      last = performance.now();
      id = requestAnimationFrame(step);
    },
    stop() {
      on = false;
      if (id) cancelAnimationFrame(id);
      id = null;
    },
  };
}

/** Local pointer coordinates, in CSS pixels, from a pointer event on `node`. */
function local(node, ev) {
  const r = node.getBoundingClientRect();
  return { x: ev.clientX - r.left, y: ev.clientY - r.top };
}

/** Pointer drag helper. Handlers get {x,y} in the node's local pixels. */
function drag(node, { down, move, up } = {}) {
  const onDown = (e) => {
    e.preventDefault();
    node.setPointerCapture?.(e.pointerId);
    down && down(local(node, e), e);
  };
  const onMove = (e) => move && move(local(node, e), e);
  const onUp = (e) => up && up(local(node, e), e);
  node.addEventListener('pointerdown', onDown);
  node.addEventListener('pointermove', onMove);
  node.addEventListener('pointerup', onUp);
  node.addEventListener('pointercancel', onUp);
}

/** A short blip. Guarded: audio is a nicety, never a requirement. */
let AC = null;
function blip(freq = 440, dur = 0.14, type = 'sine') {
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === 'suspended') AC.resume();
    const o = AC.createOscillator();
    const g = AC.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = 0.0001;
    o.connect(g).connect(AC.destination);
    const t = AC.currentTime;
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t);
    o.stop(t + dur + 0.02);
  } catch {
    /* no audio, no problem */
  }
}

const GAMES = {};
const reg = (id, factory) => (GAMES[id] = factory);

/* ========================================================================== *
 *  LOGIC
 * ========================================================================== */

/* Lights Out ---------------------------------------------------------------- */
reg('lights-out', (stage) => {
  const N = 5;
  let grid = [];
  const status = note();
  const board = el('div', { class: 'g-board', style: `--n:${N}` });

  const idx = (r, c) => r * N + c;
  const draw = () => {
    board.replaceChildren();
    let onCount = 0;
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++) {
        const lit = grid[idx(r, c)];
        if (lit) onCount++;
        board.append(
          el('button', {
            type: 'button',
            class: 'g-lite' + (lit ? ' on' : ''),
            'aria-label': `row ${r + 1}, column ${c + 1}, ${lit ? 'on' : 'off'}`,
            onClick: () => tap(r, c),
          }),
        );
      }
    status.textContent = onCount === 0 ? 'Solved. Every light is out.' : `${onCount} still lit. Turn them all off.`;
    status.classList.toggle('win', onCount === 0);
  };
  const flip = (r, c) => {
    if (r < 0 || c < 0 || r >= N || c >= N) return;
    grid[idx(r, c)] = !grid[idx(r, c)];
  };
  const tap = (r, c) => {
    flip(r, c);
    flip(r - 1, c);
    flip(r + 1, c);
    flip(r, c - 1);
    flip(r, c + 1);
    draw();
  };
  const scramble = () => {
    grid = new Array(N * N).fill(false);
    // Apply random real taps, so the board is always solvable.
    for (let k = 0; k < 8; k++) tap(randInt(0, N - 1), randInt(0, N - 1));
    // tap() drew already; ensure a clean redraw
    draw();
  };

  stage.append(board, bar(button('New board', scramble)), status);
  scramble();
  return {};
});

/* Tower of Hanoi ------------------------------------------------------------ */
reg('hanoi', (stage) => {
  let n = 4;
  let pegs = [[], [], []];
  let sel = null;
  let moves = 0;
  const status = note();
  const wrap = el('div', { class: 'g-hanoi' });

  const reset = (count = n) => {
    n = count;
    pegs = [[], [], []];
    for (let d = n; d >= 1; d--) pegs[0].push(d);
    sel = null;
    moves = 0;
    draw();
  };
  const draw = () => {
    wrap.replaceChildren();
    pegs.forEach((peg, i) => {
      const col = el('button', {
        type: 'button',
        class: 'g-peg' + (sel === i ? ' sel' : ''),
        'aria-label': `peg ${i + 1}`,
        onClick: () => tap(i),
      });
      col.append(el('span', { class: 'g-rod' }));
      peg.forEach((d) => {
        col.append(
          el('span', {
            class: 'g-disc',
            style: `width:${20 + d * (78 / n)}%;background:${CANDY[(d - 1) % CANDY.length]}`,
          }),
        );
      });
      wrap.append(col);
    });
    const best = Math.pow(2, n) - 1;
    if (pegs[2].length === n) {
      status.textContent = `Solved in ${moves} moves. The best possible is ${best}.`;
      status.classList.add('win');
    } else {
      status.classList.remove('win');
      status.textContent = `Moves ${moves}. Fewest possible for ${n} discs: ${best}.`;
    }
  };
  const tap = (i) => {
    if (sel === null) {
      if (pegs[i].length) sel = i;
    } else if (sel === i) {
      sel = null;
    } else {
      const from = pegs[sel];
      const to = pegs[i];
      const d = from[from.length - 1];
      if (!to.length || to[to.length - 1] > d) {
        to.push(from.pop());
        moves++;
      }
      sel = null;
    }
    draw();
  };

  const sizes = bar(
    el('span', { class: 'g-note' }, 'Discs:'),
    ...[3, 4, 5, 6].map((k) => button(k, () => reset(k), k === n ? 'on' : '')),
    button('Restart', () => reset()),
  );
  stage.append(wrap, sizes, status);
  reset(4);
  return {};
});

/* 15 Puzzle ----------------------------------------------------------------- */
reg('fifteen', (stage) => {
  const N = 4;
  let tiles = [];
  let moves = 0;
  const status = note();
  const board = el('div', { class: 'g-board', style: `--n:${N}` });
  const solved = () => tiles.every((v, i) => v === (i + 1) % (N * N));
  const draw = () => {
    board.replaceChildren();
    tiles.forEach((v, i) => {
      if (v === 0) {
        board.append(el('span', { class: 'g-tile blank' }));
      } else {
        board.append(
          el('button', {
            type: 'button',
            class: 'g-tile' + (v === i + 1 ? ' home' : ''),
            onClick: () => move(i),
          }, v),
        );
      }
    });
    if (solved() && moves > 0) {
      status.textContent = `Ordered in ${moves} moves.`;
      status.classList.add('win');
    } else {
      status.classList.remove('win');
      status.textContent = `Slide the tiles into order, 1 to 15. Moves ${moves}.`;
    }
  };
  const blankAt = () => tiles.indexOf(0);
  const move = (i) => {
    const b = blankAt();
    const [ri, ci] = [Math.floor(i / N), i % N];
    const [rb, cb] = [Math.floor(b / N), b % N];
    if (Math.abs(ri - rb) + Math.abs(ci - cb) === 1) {
      [tiles[b], tiles[i]] = [tiles[i], tiles[b]];
      moves++;
      draw();
    }
  };
  const scramble = () => {
    tiles = [...Array(N * N).keys()].map((v) => (v + 1) % (N * N));
    for (let k = 0; k < 300; k++) {
      const b = blankAt();
      const [rb, cb] = [Math.floor(b / N), b % N];
      const opts = [];
      if (rb > 0) opts.push(b - N);
      if (rb < N - 1) opts.push(b + N);
      if (cb > 0) opts.push(b - 1);
      if (cb < N - 1) opts.push(b + 1);
      const j = pick(opts);
      [tiles[b], tiles[j]] = [tiles[j], tiles[b]];
    }
    moves = 0;
    draw();
  };
  stage.append(board, bar(button('Shuffle', scramble)), status);
  scramble();
  return {};
});

/* Nim ----------------------------------------------------------------------- */
reg('nim', (stage) => {
  let piles = [];
  let turn = 'you';
  let over = false;
  let showHint = false;
  const status = note();
  const wrap = el('div', { class: 'g-nim' });

  const reset = () => {
    piles = [randInt(2, 4), randInt(3, 5), randInt(4, 6)];
    turn = 'you';
    over = false;
    draw();
  };
  const nimSum = () => piles.reduce((a, b) => a ^ b, 0);
  const total = () => piles.reduce((a, b) => a + b, 0);
  const draw = () => {
    wrap.replaceChildren();
    piles.forEach((count, p) => {
      const row = el('div', { class: 'g-nim-row' });
      for (let k = count - 1; k >= 0; k--) {
        row.append(
          el('button', {
            type: 'button',
            class: 'g-bead',
            style: `background:${CANDY[p % CANDY.length]}`,
            'aria-label': `pile ${p + 1}, take ${count - k}`,
            disabled: turn !== 'you' || over,
            onClick: () => take(p, count - k),
          }),
        );
      }
      wrap.append(row);
    });
    const s = nimSum();
    if (over) {
      status.textContent = turn === 'you' ? 'You took the last stone. You win!' : 'The computer took the last stone. It wins.';
      status.classList.toggle('win', turn === 'you');
    } else {
      status.classList.remove('win');
      status.textContent =
        (turn === 'you' ? 'Your turn. Click a stone to take it and every stone above it.' : 'Computer thinking...') +
        (showHint ? `  (nim-sum ${s}: ${s === 0 ? 'you are losing with perfect play' : 'a winning move exists'})` : '');
    }
  };
  const take = (p, cnt) => {
    if (turn !== 'you' || over) return;
    piles[p] -= cnt;
    if (total() === 0) {
      over = true;
      draw();
      return;
    }
    turn = 'ai';
    draw();
    setTimeout(aiMove, 550);
  };
  const aiMove = () => {
    const s = nimSum();
    if (s !== 0) {
      // Optimal: make nim-sum zero.
      for (let p = 0; p < piles.length; p++) {
        const target = piles[p] ^ s;
        if (target < piles[p]) {
          piles[p] = target;
          break;
        }
      }
    } else {
      // Losing position: take one from the largest pile and hope.
      let big = 0;
      for (let p = 1; p < piles.length; p++) if (piles[p] > piles[big]) big = p;
      piles[big] -= 1;
    }
    if (total() === 0) {
      over = true;
      turn = 'ai';
      draw();
      return;
    }
    turn = 'you';
    draw();
  };
  stage.append(
    wrap,
    bar(
      button('New game', reset),
      button('Strategy hint', () => {
        showHint = !showHint;
        draw();
      }),
    ),
    status,
  );
  reset();
  return {};
});

/* Mastermind ---------------------------------------------------------------- */
reg('mastermind', (stage) => {
  const COLORS = CANDY.slice(0, 6);
  const LEN = 4;
  const ROWS = 8;
  let secret = [];
  let cur = [];
  let row = 0;
  let over = false;
  let penIndex = 0;
  let hist = [];
  const status = note();
  const grid = el('div', { class: 'g-mm' });

  const reset = () => {
    secret = Array.from({ length: LEN }, () => randInt(0, COLORS.length - 1));
    cur = new Array(LEN).fill(-1);
    row = 0;
    over = false;
    penIndex = 0;
    draw();
  };
  const score = (guess) => {
    let black = 0,
      white = 0;
    const s = secret.slice(),
      g = guess.slice();
    for (let i = 0; i < LEN; i++)
      if (g[i] === s[i]) {
        black++;
        s[i] = g[i] = -2;
      }
    for (let i = 0; i < LEN; i++) {
      if (g[i] < 0) continue;
      const j = s.indexOf(g[i]);
      if (j >= 0) {
        white++;
        s[j] = -3;
      }
    }
    return { black, white };
  };
  const draw = () => {
    grid.replaceChildren();
    for (let r = 0; r < ROWS; r++) {
      const guessRow = el('div', { class: 'g-mm-row' + (r === row && !over ? ' active' : '') });
      const pegs = r === row && !over ? cur : r < row ? hist[r]?.guess : null;
      for (let i = 0; i < LEN; i++) {
        const v = pegs ? pegs[i] : -1;
        guessRow.append(
          el('button', {
            type: 'button',
            class: 'g-mm-peg',
            style: v >= 0 ? `background:${COLORS[v]}` : '',
            'aria-label': 'peg',
            disabled: !(r === row && !over),
            onClick: () => {
              penIndex = i;
              cur[i] = -1;
              draw();
            },
          }),
        );
      }
      const fb = el('div', { class: 'g-mm-fb' });
      if (r < row) {
        const res = hist[r].res;
        for (let k = 0; k < res.black; k++) fb.append(el('span', { class: 'g-key black' }));
        for (let k = 0; k < res.white; k++) fb.append(el('span', { class: 'g-key white' }));
      }
      guessRow.append(fb);
      grid.append(guessRow);
    }
  };
  const palette = el('div', { class: 'g-mm-pal' });
  const submit = button('Check', () => {
    if (over || cur.includes(-1)) {
      status.textContent = 'Fill all four pegs first.';
      return;
    }
    const res = score(cur);
    hist[row] = { guess: cur.slice(), res };
    if (res.black === LEN) {
      over = true;
      status.textContent = `Cracked it in ${row + 1} ${row === 0 ? 'try' : 'tries'}.`;
      status.classList.add('win');
    } else {
      row++;
      cur = new Array(LEN).fill(-1);
      penIndex = 0;
      if (row >= ROWS) {
        over = true;
        status.textContent = `Out of rows. The code was ${secret.map((i) => '#' + i).join(' ')} — shown below.`;
        revealSecret();
      } else {
        status.textContent = `${res.black} in place, ${res.white} right colour, wrong place.`;
        status.classList.remove('win');
      }
    }
    draw();
  });
  const secretRow = el('div', { class: 'g-mm-secret', hidden: true });
  const revealSecret = () => {
    secretRow.hidden = false;
    secretRow.replaceChildren(el('span', { class: 'g-note' }, 'Code:'));
    secret.forEach((v) => secretRow.append(el('span', { class: 'g-mm-peg', style: `background:${COLORS[v]}` })));
  };

  const buildPalette = () => {
    palette.replaceChildren(el('span', { class: 'g-note' }, 'Pick:'));
    COLORS.forEach((c, i) =>
      palette.append(
        el('button', {
          type: 'button',
          class: 'g-swatch',
          style: `background:${c}`,
          'aria-label': `colour ${i + 1}`,
          onClick: () => {
            if (over) return;
            cur[penIndex] = i;
            penIndex = (penIndex + 1) % LEN;
            secretRow.hidden = true;
            draw();
          },
        }),
      ),
    );
  };

  reset();
  buildPalette();
  stage.append(grid, palette, bar(submit, button('New code', () => {
    hist = [];
    reset();
    secretRow.hidden = true;
  })), secretRow, status);
  return {};
});

/* Logic Gates --------------------------------------------------------------- */
reg('logic-gates', (stage) => {
  const GATES = {
    AND: (a, b) => a && b,
    OR: (a, b) => a || b,
    XOR: (a, b) => a !== b,
    NAND: (a, b) => !(a && b),
    NOR: (a, b) => !(a || b),
  };
  const names = Object.keys(GATES);
  let gate = 'AND';
  let a = false,
    b = false;
  let target = true;
  const status = note();
  const view = el('div', { class: 'g-gate' });

  const out = () => GATES[gate](a, b);
  const draw = () => {
    const o = out();
    view.replaceChildren(
      el('div', { class: 'g-gate-io' },
        el('button', { type: 'button', class: 'g-switch' + (a ? ' on' : ''), onClick: () => { a = !a; draw(); } }, 'A = ' + (a ? 1 : 0)),
        el('button', { type: 'button', class: 'g-switch' + (b ? ' on' : ''), onClick: () => { b = !b; draw(); } }, 'B = ' + (b ? 1 : 0)),
      ),
      el('div', { class: 'g-gate-box' }, gate),
      el('div', { class: 'g-bulb' + (o ? ' lit' : '') }, o ? '1' : '0'),
    );
    if (o === target) {
      status.textContent = `Output is ${o ? 1 : 0}. That matches the goal. Nice.`;
      status.classList.add('win');
    } else {
      status.classList.remove('win');
      status.textContent = `Goal: make the bulb show ${target ? 1 : 0}. Flip A, B, or change the gate.`;
    }
  };
  const newGoal = () => {
    gate = pick(names);
    a = Math.random() < 0.5;
    b = Math.random() < 0.5;
    // choose a target that is reachable but not already satisfied
    target = Math.random() < 0.5;
    draw();
  };
  const gateBar = bar(
    el('span', { class: 'g-note' }, 'Gate:'),
    ...names.map((g) => button(g, () => { gate = g; draw(); })),
  );
  stage.append(view, gateBar, bar(button('New goal', newGoal)), status);
  newGoal();
  return {};
});

/* ========================================================================== *
 *  PHYSICS
 * ========================================================================== */

/* Projectile ---------------------------------------------------------------- */
reg('projectile', (stage) => {
  const c = makeCanvas(stage, 1.7);
  const loop = makeLoop(tick);
  let angle = 45,
    power = 60;
  let ball = null;
  let target = { x: 0, r: 16 };
  let hits = 0,
    shots = 0;
  const status = note();
  const G = 9.8;

  const reset = () => {
    const { W } = c.state;
    target.x = rand(W * 0.55, W * 0.9);
    ball = null;
    draw();
  };
  const fire = () => {
    const { W, H } = c.state;
    const rad = (angle * Math.PI) / 180;
    const v = power * 0.14 * Math.sqrt(W); // scale nicely to canvas
    ball = { x: 26, y: H - 24, vx: Math.cos(rad) * v, vy: -Math.sin(rad) * v, t: 0, trail: [] };
    shots++;
  };
  function tick(dt) {
    draw();
    if (!ball) return;
    ball.vy += G * 30 * dt;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    ball.trail.push({ x: ball.x, y: ball.y });
    if (ball.trail.length > 60) ball.trail.shift();
    const { W, H } = c.state;
    if (Math.hypot(ball.x - target.x, ball.y - (H - 22)) < target.r + 6) {
      hits++;
      status.textContent = `Hit! ${hits} of ${shots} on target.`;
      status.classList.add('win');
      ball = null;
      setTimeout(reset, 700);
      return;
    }
    if (ball.y > H - 20 || ball.x > W + 20) {
      status.classList.remove('win');
      status.textContent = `Missed. ${hits} of ${shots} on target. Adjust angle and power.`;
      ball = null;
    }
  }
  function draw() {
    const { ctx } = c;
    const { W, H } = c.state;
    const t = theme();
    ctx.clearRect(0, 0, W, H);
    // ground
    ctx.fillStyle = t.rule;
    ctx.fillRect(0, H - 20, W, 20);
    // target flag
    ctx.fillStyle = t.accent;
    ctx.beginPath();
    ctx.arc(target.x, H - 22, target.r, 0, 7);
    ctx.fill();
    ctx.fillStyle = t.bg;
    ctx.beginPath();
    ctx.arc(target.x, H - 22, target.r * 0.55, 0, 7);
    ctx.fill();
    // cannon
    const rad = (angle * Math.PI) / 180;
    ctx.strokeStyle = t.fg;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(26, H - 24);
    ctx.lineTo(26 + Math.cos(rad) * 34, H - 24 - Math.sin(rad) * 34);
    ctx.stroke();
    // aim dots (predicted arc)
    if (!ball) {
      const v = power * 0.14 * Math.sqrt(W);
      ctx.fillStyle = t.faint;
      for (let i = 1; i <= 16; i++) {
        const tt = i * 0.06;
        const px = 26 + Math.cos(rad) * v * tt;
        const py = H - 24 - Math.sin(rad) * v * tt + 0.5 * G * 30 * tt * tt;
        if (py > H - 20) break;
        ctx.globalAlpha = 1 - i / 18;
        ctx.beginPath();
        ctx.arc(px, py, 2.2, 0, 7);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    if (ball) {
      ctx.strokeStyle = CANDY[3];
      ctx.lineWidth = 2;
      ctx.beginPath();
      ball.trail.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.stroke();
      ctx.fillStyle = CANDY[0];
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, 7, 0, 7);
      ctx.fill();
    }
  }
  const sA = slider('Angle', 10, 85, angle, (v) => { angle = v; if (!ball) draw(); }, '°');
  const sP = slider('Power', 30, 100, power, (v) => { power = v; if (!ball) draw(); }, '');
  stage.append(sA.node, sP.node, bar(button('Fire', fire), button('Move target', reset)), status);
  reset();
  return { pause: loop.stop, resume: loop.start };
});

/* Orbit --------------------------------------------------------------------- */
reg('orbit', (stage) => {
  const c = makeCanvas(stage, 1.4);
  const loop = makeLoop(tick);
  let planet = null;
  let aim = null; // {from,to} while dragging
  let trail = [];
  const status = note();
  const GM = 26000;

  const centre = () => ({ x: c.state.W / 2, y: c.state.H / 2 });
  drag(c.wrap, {
    down: (p) => { aim = { from: p, to: p }; },
    move: (p) => { if (aim) { aim.to = p; } },
    up: (p) => {
      if (!aim) return;
      const vx = (aim.from.x - p.x) * 0.9;
      const vy = (aim.from.y - p.y) * 0.9;
      planet = { x: aim.from.x, y: aim.from.y, vx, vy };
      trail = [];
      aim = null;
      status.classList.remove('win');
      status.textContent = 'In flight. Too slow and it falls in; too fast and it escapes.';
    },
  });
  function tick(dt) {
    const { ctx } = c;
    const { W, H } = c.state;
    const t = theme();
    ctx.clearRect(0, 0, W, H);
    const s = centre();
    // star
    ctx.fillStyle = CANDY[2];
    ctx.beginPath();
    ctx.arc(s.x, s.y, 12, 0, 7);
    ctx.fill();
    ctx.fillStyle = t.accent;
    ctx.globalAlpha = 0.18;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 22, 0, 7);
    ctx.fill();
    ctx.globalAlpha = 1;
    if (aim) {
      ctx.strokeStyle = t.faint;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(aim.from.x, aim.from.y);
      ctx.lineTo(aim.to.x, aim.to.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = CANDY[4];
      ctx.beginPath();
      ctx.arc(aim.from.x, aim.from.y, 6, 0, 7);
      ctx.fill();
    }
    if (planet) {
      // gravity toward star (a few substeps for stability)
      for (let k = 0; k < 4; k++) {
        const dx = s.x - planet.x,
          dy = s.y - planet.y;
        const r2 = Math.max(120, dx * dx + dy * dy);
        const inv = 1 / Math.sqrt(r2);
        const a = GM / r2;
        planet.vx += a * dx * inv * (dt / 4);
        planet.vy += a * dy * inv * (dt / 4);
        planet.x += planet.vx * (dt / 4);
        planet.y += planet.vy * (dt / 4);
      }
      trail.push({ x: planet.x, y: planet.y });
      if (trail.length > 240) trail.shift();
      ctx.strokeStyle = CANDY[4];
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      trail.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = CANDY[0];
      ctx.beginPath();
      ctx.arc(planet.x, planet.y, 6, 0, 7);
      ctx.fill();
      if (planet.x < -40 || planet.x > W + 40 || planet.y < -40 || planet.y > H + 40) {
        status.textContent = 'It escaped into the dark. Fling a little slower for an orbit.';
        planet = null;
      }
    } else if (!aim) {
      ctx.fillStyle = t.faint;
      ctx.font = '14px ' + theme().fg;
    }
  }
  status.textContent = 'Drag anywhere and release to fling a planet. Aim for a loop, not a crash.';
  stage.append(bar(button('Clear', () => { planet = null; trail = []; status.textContent = 'Drag to fling a planet past the star.'; })), status);
  return { pause: loop.stop, resume: loop.start };
});

/* Pendulum ------------------------------------------------------------------ */
reg('pendulum', (stage) => {
  const c = makeCanvas(stage, 1.6);
  const loop = makeLoop(tick);
  let L1 = 0.6,
    L2 = 0.35;
  let a1 = 0.5,
    a2 = 0.5,
    v1 = 0,
    v2 = 0;
  const G = 9.8;
  const status = note();

  const period = (Lfrac) => 2 * Math.PI * Math.sqrt((Lfrac * 2.2) / G);
  function tick(dt) {
    const { ctx } = c;
    const { W, H } = c.state;
    const t = theme();
    ctx.clearRect(0, 0, W, H);
    const pxL = W * 0.32,
      pxR = W * 0.68,
      py = 24;
    const step = (a, v, Lf) => {
      const len = Lf * (H - 60);
      v += (-G / (len / 60)) * Math.sin(a) * dt;
      v *= 0.999;
      a += v * dt;
      return [a, v, len];
    };
    let lenL, lenR;
    [a1, v1, lenL] = step(a1, v1, L1);
    [a2, v2, lenR] = step(a2, v2, L2);
    const bob = (px, a, len, col, label) => {
      const bx = px + Math.sin(a) * len;
      const by = py + Math.cos(a) * len;
      ctx.strokeStyle = t.faint;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(bx, by);
      ctx.stroke();
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(bx, by, 13, 0, 7);
      ctx.fill();
      ctx.fillStyle = t.faint;
      ctx.textAlign = 'center';
      ctx.font = '12px sans-serif';
      ctx.fillText(label, px, py - 8);
    };
    bob(pxL, a1, lenL, CANDY[4], 'T ≈ ' + period(L1).toFixed(2) + 's');
    bob(pxR, a2, lenR, CANDY[0], 'T ≈ ' + period(L2).toFixed(2) + 's');
  }
  const push = () => {
    a1 = 0.9;
    a2 = 0.9;
    v1 = 0;
    v2 = 0;
  };
  status.textContent = 'Two pendulums, different lengths. Longer means slower. Mass never enters the period.';
  const s1 = slider('Left length', 20, 90, L1 * 100, (v) => (L1 = v / 100), '%');
  const s2 = slider('Right length', 20, 90, L2 * 100, (v) => (L2 = v / 100), '%');
  stage.append(s1.node, s2.node, bar(button('Pull back and release', push)), status);
  return { pause: loop.stop, resume: loop.start };
});

/* Incline ------------------------------------------------------------------- */
reg('incline', (stage) => {
  const c = makeCanvas(stage, 1.8);
  const loop = makeLoop(tick);
  let deg = 25;
  let ball = null;
  const status = note();
  const G = 9.8;
  const reset = () => { ball = { s: 0, v: 0 }; };
  function tick(dt) {
    const { ctx } = c;
    const { W, H } = c.state;
    const t = theme();
    ctx.clearRect(0, 0, W, H);
    const rad = (deg * Math.PI) / 180;
    const x0 = 30,
      y0 = 40;
    const len = Math.min((W - 60) / Math.cos(rad), (H - 70) / Math.sin(rad));
    const x1 = x0 + Math.cos(rad) * len;
    const y1 = y0 + Math.sin(rad) * len;
    ctx.strokeStyle = t.fg;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x0, y1);
    ctx.closePath();
    ctx.stroke();
    const a = G * Math.sin(rad);
    if (ball) {
      ball.v += a * 26 * dt;
      ball.s += ball.v * dt;
      if (ball.s > len - 14) { ball.s = len - 14; ball.v = 0; }
      const bx = x0 + Math.cos(rad) * ball.s;
      const by = y0 + Math.sin(rad) * ball.s;
      ctx.fillStyle = CANDY[0];
      ctx.beginPath();
      ctx.arc(bx - Math.sin(rad) * 10, by + Math.cos(rad) * 10, 12, 0, 7);
      ctx.fill();
    }
    ctx.fillStyle = t.faint;
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`angle ${deg}°   a = g·sin θ = ${a.toFixed(2)} m/s²`, 12, H - 12);
  }
  status.textContent = 'Steeper ramp, larger acceleration. It is g times the sine of the angle.';
  const s = slider('Ramp angle', 5, 80, deg, (v) => { deg = v; }, '°');
  stage.append(s.node, bar(button('Drop the ball', reset)), status);
  reset();
  return { pause: loop.stop, resume: loop.start };
});

/* Bounce -------------------------------------------------------------------- */
reg('bounce', (stage) => {
  const c = makeCanvas(stage, 1.6);
  const loop = makeLoop(tick);
  let balls = [];
  let aim = null;
  const G = 520;
  const add = (x, y, vx = 0, vy = 0) =>
    balls.push({ x, y, vx, vy, r: rand(9, 16), col: pick(CANDY) });
  drag(c.wrap, {
    down: (p) => (aim = { from: p, to: p }),
    move: (p) => aim && (aim.to = p),
    up: (p) => {
      if (aim) add(aim.from.x, aim.from.y, (p.x - aim.from.x) * 3, (p.y - aim.from.y) * 3);
      aim = null;
    },
  });
  function tick(dt) {
    const { ctx } = c;
    const { W, H } = c.state;
    const t = theme();
    ctx.clearRect(0, 0, W, H);
    for (const b of balls) {
      b.vy += G * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x < b.r) { b.x = b.r; b.vx *= -0.9; }
      if (b.x > W - b.r) { b.x = W - b.r; b.vx *= -0.9; }
      if (b.y > H - b.r) { b.y = H - b.r; b.vy *= -0.86; b.vx *= 0.99; }
      if (b.y < b.r) { b.y = b.r; b.vy *= -0.9; }
    }
    // pairwise elastic (equal mass): swap velocity components along normal
    for (let i = 0; i < balls.length; i++)
      for (let j = i + 1; j < balls.length; j++) {
        const a = balls[i],
          b = balls[j];
        const dx = b.x - a.x,
          dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        const min = a.r + b.r;
        if (d > 0 && d < min) {
          const nx = dx / d,
            ny = dy / d;
          const overlap = min - d;
          a.x -= (nx * overlap) / 2;
          a.y -= (ny * overlap) / 2;
          b.x += (nx * overlap) / 2;
          b.y += (ny * overlap) / 2;
          const av = a.vx * nx + a.vy * ny;
          const bv = b.vx * nx + b.vy * ny;
          const diff = bv - av;
          a.vx += diff * nx;
          a.vy += diff * ny;
          b.vx -= diff * nx;
          b.vy -= diff * ny;
        }
      }
    for (const b of balls) {
      ctx.fillStyle = b.col;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, 7);
      ctx.fill();
    }
    if (aim) {
      ctx.strokeStyle = t.faint;
      ctx.beginPath();
      ctx.moveTo(aim.from.x, aim.from.y);
      ctx.lineTo(aim.to.x, aim.to.y);
      ctx.stroke();
    }
  }
  const status = note('Drag to fling a ball. They bounce and knock each other about, equal-mass and elastic.');
  for (let i = 0; i < 4; i++) add(rand(40, c.state.W - 40), rand(30, 80), rand(-120, 120), 0);
  stage.append(bar(button('Add ball', () => add(rand(30, c.state.W - 30), 30, rand(-140, 140), 0)), button('Clear', () => (balls = []))), status);
  return { pause: loop.stop, resume: loop.start };
});

/* Balance (torque) ---------------------------------------------------------- */
reg('balance', (stage) => {
  const c = makeCanvas(stage, 1.9);
  const loop = makeLoop(tick);
  const NOTCH = 5; // positions each side
  let left = {},
    right = {};
  let angle = 0,
    target = 0;
  const status = note();

  const torque = () => {
    let tl = 0,
      tr = 0;
    for (const k in left) tl += left[k] * (Number(k) + 1);
    for (const k in right) tr += right[k] * (Number(k) + 1);
    return { tl, tr, net: tr - tl };
  };
  const wrapClick = (ev) => {
    const { W, H } = c.state;
    const p = local(c.wrap, ev);
    const cx = W / 2,
      cy = H * 0.42;
    const span = W * 0.4;
    const rel = (p.x - cx) / (span / NOTCH);
    const slot = Math.round(Math.abs(rel)) - 1;
    if (slot < 0 || slot >= NOTCH) return;
    if (Math.abs(p.y - cy) > 60) return;
    const side = rel < 0 ? left : right;
    side[slot] = (side[slot] || 0) + 1;
  };
  c.wrap.addEventListener('click', wrapClick);
  function tick(dt) {
    const { ctx } = c;
    const { W, H } = c.state;
    const t = theme();
    ctx.clearRect(0, 0, W, H);
    const cx = W / 2,
      cy = H * 0.42;
    const { net } = torque();
    target = clamp(net * 0.03, -0.35, 0.35);
    angle += (target - angle) * Math.min(1, dt * 6);
    // pivot
    ctx.fillStyle = t.faint;
    ctx.beginPath();
    ctx.moveTo(cx - 14, H - 20);
    ctx.lineTo(cx + 14, H - 20);
    ctx.lineTo(cx, cy + 6);
    ctx.fill();
    // beam
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.fillStyle = t.fg;
    ctx.fillRect(-W * 0.42, -5, W * 0.84, 10);
    const span = W * 0.4;
    const drawStack = (side, sign) => {
      for (let s = 0; s < NOTCH; s++) {
        const n = side[s] || 0;
        const x = sign * (span / NOTCH) * (s + 1);
        for (let k = 0; k < n; k++) {
          ctx.fillStyle = CANDY[(s + k) % CANDY.length];
          ctx.fillRect(x - 9, -5 - (k + 1) * 15, 18, 13);
        }
      }
    };
    drawStack(left, -1);
    drawStack(right, 1);
    ctx.restore();
    if (Math.abs(net) < 0.5 && (Object.keys(left).length || Object.keys(right).length)) {
      status.textContent = 'Balanced. Torque left equals torque right: weight times distance.';
      status.classList.add('win');
    } else {
      status.classList.remove('win');
      status.textContent = 'Click left or right of the pivot to drop a weight. Balance the beam.';
    }
  }
  stage.append(bar(button('Clear', () => { left = {}; right = {}; })), status);
  return { pause: loop.stop, resume: loop.start };
});

/* ========================================================================== *
 *  MATHS
 * ========================================================================== */

/* Prime sieve --------------------------------------------------------------- */
reg('primes', (stage) => {
  const MAX = 100;
  let crossed = new Set();
  const status = note();
  const board = el('div', { class: 'g-sieve' });
  const isPrime = (n) => {
    if (n < 2) return false;
    for (let i = 2; i * i <= n; i++) if (n % i === 0) return false;
    return true;
  };
  const draw = () => {
    board.replaceChildren();
    for (let n = 2; n <= MAX; n++) {
      const out = crossed.has(n);
      board.append(
        el('button', {
          type: 'button',
          class: 'g-num' + (out ? ' out' : ''),
          onClick: () => strike(n),
        }, n),
      );
    }
  };
  const strike = (n) => {
    if (crossed.has(n)) return;
    // striking a number crosses out all its higher multiples (the sieve step)
    for (let m = n * 2; m <= MAX; m += n) crossed.add(m);
    draw();
    const survivors = [];
    for (let k = 2; k <= MAX; k++) if (!crossed.has(k)) survivors.push(k);
    const done = survivors.every(isPrime) && survivors.length === 25;
    status.classList.toggle('win', done);
    status.textContent = done
      ? `Done. The ${survivors.length} numbers left standing are exactly the primes to 100.`
      : `${survivors.length} numbers left. Cross out each multiple; primes are what survive.`;
  };
  status.textContent = 'Click a number to cross out its multiples. Keep going. Primes are the survivors.';
  stage.append(board, bar(button('Reset', () => { crossed = new Set(); draw(); status.textContent = 'Click 2, then 3, then 5... cross out multiples.'; status.classList.remove('win'); })), status);
  draw();
  return {};
});

/* Times-table lightning ----------------------------------------------------- */
reg('times-table', (stage) => {
  let score = 0,
    time = 30,
    running = false,
    a = 2,
    b = 2;
  let timer = null;
  const q = el('div', { class: 'g-quiz-q' }, '');
  const opts = el('div', { class: 'g-quiz-opts' });
  const status = note('Beat the clock. Thirty seconds, as many as you can.');
  const next = () => {
    a = randInt(2, 12);
    b = randInt(2, 12);
    q.textContent = `${a} × ${b}`;
    const right = a * b;
    const set = new Set([right]);
    while (set.size < 4) set.add(right + randInt(-9, 9) || right + 1);
    opts.replaceChildren();
    shuffle([...set]).forEach((v) =>
      opts.append(button(v, () => answer(v, right), 'g-quiz-opt')),
    );
  };
  const answer = (v, right) => {
    if (!running) return;
    if (v === right) { score++; blip(660, 0.08); } else { blip(180, 0.12, 'square'); time = Math.max(0, time - 2); }
    status.textContent = `Score ${score}. Time ${time}s.`;
    next();
  };
  const start = () => {
    score = 0;
    time = 30;
    running = true;
    startBtn.textContent = 'Restart';
    next();
    clearInterval(timer);
    timer = setInterval(() => {
      time--;
      status.textContent = `Score ${score}. Time ${time}s.`;
      if (time <= 0) {
        clearInterval(timer);
        running = false;
        status.textContent = `Time! Final score ${score}.`;
        status.classList.add('win');
        q.textContent = '× ×';
        opts.replaceChildren();
      }
    }, 1000);
  };
  const startBtn = button('Start', () => { status.classList.remove('win'); start(); });
  stage.append(q, opts, bar(startBtn), status);
  return { pause: () => clearInterval(timer) };
});

/* Fraction match ------------------------------------------------------------ */
reg('fractions', (stage) => {
  const c = makeCanvas(stage, 1.5);
  let p = 1,
    qd = 2,
    score = 0,
    streak = 0;
  const status = note();
  const opts = el('div', { class: 'g-quiz-opts' });
  const gcd = (x, y) => (y ? gcd(y, x % y) : x);
  const drawPie = () => {
    const { ctx } = c;
    const { W, H } = c.state;
    const t = theme();
    ctx.clearRect(0, 0, W, H);
    const cx = W / 2,
      cy = H / 2,
      r = Math.min(W, H) * 0.36;
    for (let i = 0; i < qd; i++) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      const a0 = -Math.PI / 2 + (i / qd) * Math.PI * 2;
      const a1 = -Math.PI / 2 + ((i + 1) / qd) * Math.PI * 2;
      ctx.arc(cx, cy, r, a0, a1);
      ctx.closePath();
      ctx.fillStyle = i < p ? CANDY[3] : t.sunken;
      ctx.fill();
      ctx.strokeStyle = t.bg;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  };
  const newQ = () => {
    qd = randInt(2, 8);
    p = randInt(1, qd - 1);
    drawPie();
    const g = gcd(p, qd);
    const correct = `${p / g}/${qd / g}`;
    const set = new Set([correct]);
    while (set.size < 4) {
      const dq = randInt(2, 9);
      const dp = randInt(1, dq - 1);
      const dg = gcd(dp, dq);
      set.add(`${dp / dg}/${dq / dg}`);
    }
    opts.replaceChildren();
    shuffle([...set]).forEach((f) => opts.append(button(f, () => answer(f, correct), 'g-quiz-opt')));
  };
  const answer = (f, correct) => {
    if (f === correct) { score++; streak++; blip(700, 0.08); status.textContent = `Right. ${p}/${qd} reduces to ${correct}. Score ${score}, streak ${streak}.`; status.classList.add('win'); }
    else { streak = 0; blip(200, 0.12, 'square'); status.textContent = `Not quite. The shaded slice is ${correct}.`; status.classList.remove('win'); }
    setTimeout(newQ, 850);
  };
  status.textContent = 'Which fraction is shaded? Reduced to lowest terms.';
  stage.append(opts, status);
  newQ();
  return {};
});

/* Guess the line ------------------------------------------------------------ */
reg('guess-line', (stage) => {
  const c = makeCanvas(stage, 1.4);
  let pts = [];
  let m = 1,
    b = 0;
  let trueM = 1,
    trueB = 0;
  const status = note();
  const toX = (gx) => 20 + ((gx + 5) / 10) * (c.state.W - 40);
  const toY = (gy) => c.state.H - 20 - ((gy + 5) / 10) * (c.state.H - 40);
  const gen = () => {
    trueM = rand(-1.6, 1.6);
    trueB = rand(-2.5, 2.5);
    pts = [];
    for (let i = 0; i < 12; i++) {
      const x = rand(-4.5, 4.5);
      pts.push({ x, y: trueM * x + trueB + rand(-0.8, 0.8) });
    }
    draw();
  };
  const err = () => pts.reduce((s, p) => s + (m * p.x + b - p.y) ** 2, 0) / pts.length;
  const draw = () => {
    const { ctx } = c;
    const { W, H } = c.state;
    const t = theme();
    ctx.clearRect(0, 0, W, H);
    // axes
    ctx.strokeStyle = t.rule;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(toX(-5), toY(0));
    ctx.lineTo(toX(5), toY(0));
    ctx.moveTo(toX(0), toY(-5));
    ctx.lineTo(toX(0), toY(5));
    ctx.stroke();
    // line
    ctx.strokeStyle = t.accent;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(toX(-5), toY(m * -5 + b));
    ctx.lineTo(toX(5), toY(m * 5 + b));
    ctx.stroke();
    // points
    ctx.fillStyle = CANDY[4];
    pts.forEach((p) => {
      ctx.beginPath();
      ctx.arc(toX(p.x), toY(p.y), 4, 0, 7);
      ctx.fill();
    });
    const e = err();
    status.classList.toggle('win', e < 0.5);
    status.textContent = e < 0.5 ? `Great fit! Error ${e.toFixed(2)}. That is close to the best line.` : `Error ${e.toFixed(2)}. Lower is better. Tune slope and intercept.`;
  };
  const sM = slider('Slope', -30, 30, m * 10, (v) => { m = v / 10; draw(); }, '');
  const sB = slider('Intercept', -30, 30, b * 10, (v) => { b = v / 10; draw(); }, '');
  stage.append(sM.node, sB.node, bar(button('New points', gen)), status);
  gen();
  return {};
});

/* Estimate the dots --------------------------------------------------------- */
reg('estimate', (stage) => {
  const c = makeCanvas(stage, 1.5);
  let count = 0,
    shown = false,
    guess = 20;
  const status = note('Dots flash for a moment. Guess how many, then check.');
  const opts = el('div', { class: 'g-quiz-opts' });
  const flash = () => {
    count = randInt(12, 80);
    const { ctx } = c;
    const { W, H } = c.state;
    const t = theme();
    ctx.clearRect(0, 0, W, H);
    for (let i = 0; i < count; i++) {
      ctx.fillStyle = pick(CANDY);
      ctx.beginPath();
      ctx.arc(rand(12, W - 12), rand(12, H - 12), 6, 0, 7);
      ctx.fill();
    }
    shown = true;
    status.textContent = 'Quick, count the feel of it...';
    setTimeout(() => {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = t.faint;
      ctx.textAlign = 'center';
      ctx.font = '20px sans-serif';
      ctx.fillText('How many?', W / 2, H / 2);
      buildGuesses();
    }, 1100);
  };
  const buildGuesses = () => {
    const base = Math.max(10, count + randInt(-18, 18));
    const set = new Set([count]);
    while (set.size < 4) set.add(Math.max(5, count + randInt(-25, 25)));
    opts.replaceChildren();
    shuffle([...set]).forEach((v) => opts.append(button(v, () => check(v), 'g-quiz-opt')));
  };
  const check = (v) => {
    const { ctx } = c;
    const { W, H } = c.state;
    ctx.clearRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.font = '22px sans-serif';
    ctx.fillStyle = theme().fg;
    ctx.fillText(`It was ${count}.`, W / 2, H / 2);
    const off = Math.abs(v - count);
    status.classList.toggle('win', off <= 3);
    status.textContent = off === 0 ? 'Exactly right!' : off <= 3 ? `You said ${v}, off by ${off}. Superb estimate.` : `You said ${v}, it was ${count}. Off by ${off}.`;
    opts.replaceChildren();
  };
  stage.append(opts, bar(button('Flash dots', flash)), status);
  return {};
});

/* Pattern: next number ------------------------------------------------------ */
reg('pattern', (stage) => {
  let seq = [],
    answer = 0,
    rule = '';
  const q = el('div', { class: 'g-quiz-q' });
  const opts = el('div', { class: 'g-quiz-opts' });
  const status = note();
  const gen = () => {
    const kind = randInt(0, 3);
    if (kind === 0) {
      const a = randInt(1, 6),
        d = randInt(2, 6);
      seq = [a, a + d, a + 2 * d, a + 3 * d];
      answer = a + 4 * d;
      rule = `add ${d} each time`;
    } else if (kind === 1) {
      const a = randInt(1, 3),
        r = randInt(2, 3);
      seq = [a, a * r, a * r * r, a * r * r * r];
      answer = a * r ** 4;
      rule = `multiply by ${r}`;
    } else if (kind === 2) {
      seq = [1, 1, 2, 3, 5];
      answer = 8;
      rule = 'each is the sum of the two before (Fibonacci)';
    } else {
      const a = randInt(1, 5);
      seq = [a * a, (a + 1) ** 2, (a + 2) ** 2, (a + 3) ** 2];
      answer = (a + 4) ** 2;
      rule = 'perfect squares';
    }
    q.textContent = seq.join(',  ') + ',  ?';
    const set = new Set([answer]);
    while (set.size < 4) set.add(answer + randInt(-9, 9) || answer + 2);
    opts.replaceChildren();
    shuffle([...set]).forEach((v) => opts.append(button(v, () => check(v), 'g-quiz-opt')));
    status.classList.remove('win');
    status.textContent = 'What comes next?';
  };
  const check = (v) => {
    if (v === answer) { status.textContent = `Yes! The rule was: ${rule}.`; status.classList.add('win'); blip(700, 0.08); setTimeout(gen, 1100); }
    else { status.textContent = 'Look again at the gaps between the numbers.'; blip(200, 0.12, 'square'); }
  };
  stage.append(q, opts, status);
  gen();
  return {};
});

/* Angle aim ----------------------------------------------------------------- */
reg('angle', (stage) => {
  const c = makeCanvas(stage, 1.5);
  let targetA = 40,
    myA = 45,
    score = 0;
  const status = note();
  const draw = () => {
    const { ctx } = c;
    const { W, H } = c.state;
    const t = theme();
    ctx.clearRect(0, 0, W, H);
    const ox = 30,
      oy = H - 26,
      R = Math.min(W - 60, H - 50);
    // protractor arc
    ctx.strokeStyle = t.rule;
    ctx.lineWidth = 1;
    for (let d = 0; d <= 90; d += 10) {
      const rr = (d * Math.PI) / 180;
      ctx.beginPath();
      ctx.moveTo(ox + Math.cos(rr) * (R - 8), oy - Math.sin(rr) * (R - 8));
      ctx.lineTo(ox + Math.cos(rr) * R, oy - Math.sin(rr) * R);
      ctx.stroke();
    }
    // target
    const tr = (targetA * Math.PI) / 180;
    ctx.fillStyle = t.accent;
    ctx.beginPath();
    ctx.arc(ox + Math.cos(tr) * R, oy - Math.sin(tr) * R, 9, 0, 7);
    ctx.fill();
    // arrow
    const mr = (myA * Math.PI) / 180;
    ctx.strokeStyle = CANDY[4];
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(ox + Math.cos(mr) * (R - 6), oy - Math.sin(mr) * (R - 6));
    ctx.stroke();
    ctx.fillStyle = t.fg;
    ctx.font = '15px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${myA}°`, ox + 8, oy - 10);
  };
  const fire = () => {
    const off = Math.abs(myA - targetA);
    if (off <= 3) { score++; status.textContent = `Bullseye at ${myA}°! Score ${score}.`; status.classList.add('win'); setTimeout(() => { targetA = randInt(10, 80); status.classList.remove('win'); draw(); }, 900); }
    else { status.textContent = `Off by ${off}°. The dot sits higher or lower than your arrow.`; status.classList.remove('win'); }
  };
  status.textContent = 'Point the arrow at the red dot. Read the angle off the protractor.';
  const s = slider('Angle', 5, 88, myA, (v) => { myA = v; draw(); }, '°');
  stage.append(s.node, bar(button('Fire', fire), button('New target', () => { targetA = randInt(10, 80); draw(); })), status);
  targetA = randInt(10, 80);
  draw();
  return {};
});

/* ========================================================================== *
 *  MEMORY & PERCEPTION
 * ========================================================================== */

/* Simon --------------------------------------------------------------------- */
reg('simon', (stage) => {
  const COLS = [CANDY[3], CANDY[0], CANDY[4], CANDY[2]];
  const FREQ = [330, 415, 247, 550];
  let seq = [],
    step = 0,
    accepting = false,
    best = 0;
  const status = note('Watch the pattern, then repeat it. It grows by one each round.');
  const pads = COLS.map((col, i) =>
    el('button', {
      type: 'button',
      class: 'g-simon',
      style: `background:${col}`,
      'aria-label': `pad ${i + 1}`,
      onClick: () => press(i),
    }),
  );
  const grid = el('div', { class: 'g-simon-grid' }, ...pads);
  const flash = (i) =>
    new Promise((res) => {
      pads[i].classList.add('flash');
      blip(FREQ[i], 0.3);
      setTimeout(() => { pads[i].classList.remove('flash'); setTimeout(res, 130); }, 320);
    });
  const playback = async () => {
    accepting = false;
    for (const i of seq) await flash(i);
    accepting = true;
    step = 0;
    status.textContent = `Your turn: ${seq.length} in the pattern.`;
  };
  const nextRound = () => {
    seq.push(randInt(0, 3));
    best = Math.max(best, seq.length - 1);
    playback();
  };
  const press = (i) => {
    if (!accepting) return;
    flash(i);
    if (seq[step] === i) {
      step++;
      if (step === seq.length) { accepting = false; status.textContent = 'Right! Next round...'; status.classList.add('win'); setTimeout(() => { status.classList.remove('win'); nextRound(); }, 700); }
    } else {
      accepting = false;
      status.textContent = `Broken at length ${seq.length}. Best streak: ${Math.max(best, seq.length - 1)}. Press Start.`;
    }
  };
  const start = () => { seq = []; step = 0; status.classList.remove('win'); nextRound(); };
  stage.append(grid, bar(button('Start', start)), status);
  return { pause: () => (accepting = false) };
});

/* Memory match -------------------------------------------------------------- */
reg('memory-match', (stage) => {
  const FACES = ['🍓', '🌟', '🐙', '🎈', '🍀', '🌈', '🦊', '🍄'];
  let deck = [],
    open = [],
    matched = new Set(),
    moves = 0,
    lock = false;
  const status = note();
  const board = el('div', { class: 'g-board', style: '--n:4' });
  const draw = () => {
    board.replaceChildren();
    deck.forEach((face, i) => {
      const up = open.includes(i) || matched.has(i);
      board.append(
        el('button', {
          type: 'button',
          class: 'g-card' + (up ? ' up' : '') + (matched.has(i) ? ' done' : ''),
          onClick: () => flip(i),
        }, up ? face : '?'),
      );
    });
    if (matched.size === deck.length) { status.textContent = `All pairs found in ${moves} moves.`; status.classList.add('win'); }
    else { status.classList.remove('win'); status.textContent = `Find the pairs. Moves ${moves}.`; }
  };
  const flip = (i) => {
    if (lock || open.includes(i) || matched.has(i)) return;
    open.push(i);
    draw();
    if (open.length === 2) {
      moves++;
      const [a, b] = open;
      if (deck[a] === deck[b]) { matched.add(a); matched.add(b); open = []; draw(); }
      else { lock = true; setTimeout(() => { open = []; lock = false; draw(); }, 750); }
    }
  };
  const reset = () => { deck = shuffle([...FACES, ...FACES]); open = []; matched = new Set(); moves = 0; draw(); };
  stage.append(board, bar(button('New game', reset)), status);
  reset();
  return {};
});

/* Reaction time ------------------------------------------------------------- */
reg('reaction', (stage) => {
  let state = 'idle',
    t0 = 0,
    best = null,
    timer = null;
  const pad = el('button', { type: 'button', class: 'g-react idle' }, 'Click to start');
  const status = note('Wait for green, then click as fast as you can. Clicking early resets you.');
  const setState = (s, text) => { state = s; pad.className = 'g-react ' + s; pad.textContent = text; };
  pad.addEventListener('click', () => {
    if (state === 'idle' || state === 'result' || state === 'early') {
      setState('wait', 'Wait for green...');
      clearTimeout(timer);
      timer = setTimeout(() => { setState('go', 'CLICK!'); t0 = performance.now(); }, rand(1200, 3500));
    } else if (state === 'wait') {
      clearTimeout(timer);
      setState('early', 'Too soon! Click to retry.');
    } else if (state === 'go') {
      const ms = Math.round(performance.now() - t0);
      best = best == null ? ms : Math.min(best, ms);
      setState('result', `${ms} ms — click to go again`);
      status.textContent = `${ms} ms. Best: ${best} ms. A good human reaction is around 200 ms.`;
      status.classList.toggle('win', ms < 250);
    }
  });
  stage.append(pad, status);
  return { pause: () => { clearTimeout(timer); if (state === 'wait') setState('idle', 'Click to start'); } };
});

/* Stroop -------------------------------------------------------------------- */
reg('stroop', (stage) => {
  const WORDS = [
    ['RED', '#ef4444'],
    ['GREEN', '#22c55e'],
    ['BLUE', '#3b82f6'],
    ['YELLOW', '#eab308'],
    ['PURPLE', '#a855f7'],
  ];
  let score = 0,
    time = 30,
    running = false,
    ink = null,
    timer = null;
  const word = el('div', { class: 'g-stroop-word' }, 'READY');
  const opts = el('div', { class: 'g-quiz-opts' });
  const status = note('Click the INK colour, not the word it spells. Thirty seconds.');
  const next = () => {
    const [text] = pick(WORDS);
    ink = pick(WORDS);
    word.textContent = text;
    word.style.color = ink[1];
    opts.replaceChildren();
    shuffle(WORDS).forEach(([name, col]) =>
      opts.append(el('button', { type: 'button', class: 'g-quiz-opt', style: `border-color:${col};color:${col}`, onClick: () => answer(name) }, name)),
    );
  };
  const answer = (name) => {
    if (!running) return;
    if (name === ink[0]) { score++; blip(660, 0.07); } else { time = Math.max(0, time - 2); blip(180, 0.12, 'square'); }
    status.textContent = `Score ${score}. Time ${time}s.`;
    next();
  };
  const start = () => {
    score = 0; time = 30; running = true; status.classList.remove('win');
    startBtn.textContent = 'Restart';
    next();
    clearInterval(timer);
    timer = setInterval(() => {
      time--;
      status.textContent = `Score ${score}. Time ${time}s.`;
      if (time <= 0) { clearInterval(timer); running = false; word.textContent = 'DONE'; word.style.color = ''; opts.replaceChildren(); status.textContent = `Time! Score ${score}.`; status.classList.add('win'); }
    }, 1000);
  };
  const startBtn = button('Start', start);
  stage.append(word, opts, bar(startBtn), status);
  return { pause: () => clearInterval(timer) };
});

/* Binary blocks ------------------------------------------------------------- */
reg('binary', (stage) => {
  const BITS = 8;
  let bits = new Array(BITS).fill(0),
    target = 0;
  const status = note();
  const row = el('div', { class: 'g-binary' });
  const value = () => bits.reduce((v, b, i) => v + b * (1 << (BITS - 1 - i)), 0);
  const draw = () => {
    row.replaceChildren();
    bits.forEach((b, i) => {
      row.append(
        el('div', { class: 'g-bit-col' },
          el('button', { type: 'button', class: 'g-bit' + (b ? ' on' : ''), onClick: () => { bits[i] ^= 1; draw(); } }, b),
          el('span', { class: 'g-bit-place' }, 1 << (BITS - 1 - i)),
        ),
      );
    });
    const v = value();
    if (v === target) { status.textContent = `${v} in binary is ${bits.join('')}. Matched!`; status.classList.add('win'); }
    else { status.classList.remove('win'); status.textContent = `Make ${target}. You have ${v} (${bits.join('')}). Each switch adds its place value.`; }
  };
  const newTarget = () => { target = randInt(1, 255); bits = new Array(BITS).fill(0); draw(); };
  stage.append(row, bar(button('New number', newTarget), button('Clear', () => { bits = new Array(BITS).fill(0); draw(); })), status);
  newTarget();
  return {};
});

/* --- a labelled slider control -------------------------------------------- */
function slider(label, min, max, val, onInput, unit = '') {
  const out = el('span', { class: 'g-slider-val tnum' }, Math.round(val) + unit);
  const input = el('input', {
    type: 'range',
    class: 'g-range',
    min,
    max,
    value: val,
    step: 1,
    'aria-label': label,
  });
  input.addEventListener('input', () => {
    const v = Number(input.value);
    out.textContent = Math.round(v) + unit;
    onInput(v);
  });
  const node = el('label', { class: 'g-slider' },
    el('span', { class: 'g-slider-label' }, label),
    input,
    out,
  );
  return { node, input };
}

/* --- bootstrap ------------------------------------------------------------- */
function boot() {
  const cards = document.querySelectorAll('.game[data-game]');
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const card = entry.target;
        const stage = card.querySelector('[data-stage]');
        if (!stage) continue;
        if (entry.isIntersecting) {
          if (!card.__inited) {
            card.__inited = true;
            const id = card.dataset.game;
            const factory = GAMES[id];
            if (!factory) continue;
            stage.classList.add('is-ready');
            stage.replaceChildren();
            try {
              card.__handle = factory(stage) || {};
            } catch (err) {
              console.error('[surprised]', id, err);
              stage.append(el('p', { class: 'g-note' }, 'This one hit a snag on your browser.'));
            }
          }
          card.__handle && card.__handle.resume && card.__handle.resume();
        } else {
          card.__handle && card.__handle.pause && card.__handle.pause();
        }
      }
    },
    { rootMargin: '260px 0px' },
  );
  cards.forEach((c) => io.observe(c));
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
