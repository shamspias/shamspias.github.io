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
    for (let k = 0; k < 5; k++) tap(randInt(0, N - 1), randInt(0, N - 1));
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
  reset(3);
  return {};
});

/* 15 Puzzle ----------------------------------------------------------------- */
reg('fifteen', (stage) => {
  const N = 3;
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
      status.textContent = `Done in ${moves} moves!`;
      status.classList.add('win');
    } else {
      status.classList.remove('win');
      status.textContent = `Put the numbers in order. Moves ${moves}.`;
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
  status.textContent = 'Two swings, different lengths. Longer swings are slower.';
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
  status.textContent = 'Steeper ramp, faster roll!';
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
      status.textContent = 'Balanced! Far weights push as hard as heavy ones.';
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
  const FACES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
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

/* ========================================================================== *
 *  SHARED HELPERS for the learning games (hoisted function declarations, so
 *  they can sit anywhere in the file).
 * ========================================================================== */

const BLUE = '#4da3ff';
const PINK = '#ff5d8f';
const MINT = '#3ddc97';

const sigmoid = (z) => 1 / (1 + Math.exp(-z));

/** Linear interpolation between two hex colours. t in [0,1]. */
function lerpHex(a, b, t) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * clamp(t, 0, 1)));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
/** A field value in [0,1] to a blue-to-pink colour. */
const heat = (v) => lerpHex(BLUE, PINK, v);

/** Map the data square [-1,1] x [-1,1] onto the canvas, with inverses. */
function dataFrame(W, H, pad = 16) {
  const s = Math.min(W, H) - pad * 2;
  const ox = (W - s) / 2;
  const oy = (H - s) / 2;
  return {
    s,
    x: (dx) => ox + ((dx + 1) / 2) * s,
    y: (dy) => oy + ((1 - dy) / 2) * s,
    ix: (px) => ((px - ox) / s) * 2 - 1,
    iy: (py) => 1 - ((py - oy) / s) * 2,
  };
}

/** Softmax of an array, with an optional temperature. */
function softmaxArr(logits, temp = 1) {
  const m = Math.max(...logits);
  const ex = logits.map((z) => Math.exp((z - m) / temp));
  const sum = ex.reduce((a, b) => a + b, 0);
  return ex.map((e) => e / sum);
}

/** Solve A x = b in place by Gaussian elimination with partial pivoting. */
function solveLinear(A, b) {
  const n = b.length;
  for (let i = 0; i < n; i++) {
    let p = i;
    for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
    [A[i], A[p]] = [A[p], A[i]];
    [b[i], b[p]] = [b[p], b[i]];
    const piv = A[i][i] || 1e-9;
    for (let r = 0; r < n; r++) {
      if (r === i) continue;
      const f = A[r][i] / piv;
      for (let c = i; c < n; c++) A[r][c] -= f * A[i][c];
      b[r] -= f * b[i];
    }
  }
  return b.map((v, i) => v / (A[i][i] || 1e-9));
}

/** Least-squares polynomial coefficients (low to high) with tiny ridge term. */
function polyfit(xs, ys, deg) {
  const n = deg + 1;
  const A = Array.from({ length: n }, () => new Array(n).fill(0));
  const bb = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) for (let k = 0; k < xs.length; k++) A[i][j] += xs[k] ** (i + j);
    A[i][i] += 1e-6;
    for (let k = 0; k < xs.length; k++) bb[i] += ys[k] * xs[k] ** i;
  }
  return solveLinear(A, bb);
}
const polyval = (c, x) => c.reduce((s, ci, i) => s + ci * x ** i, 0);

/* ========================================================================== *
 *  MACHINE LEARNING
 * ========================================================================== */

/* Gradient descent -------------------------------------------------------- */
reg('gradient-descent', (stage) => {
  const c = makeCanvas(stage, 1.6);
  const loop = makeLoop(tick);
  const L = (x) => (x - 0.25) * (x - 0.25) + 0.15; // a smooth valley
  const dL = (x) => 2 * (x - 0.25);
  let x = -1.15;
  let lr = 0.12;
  let auto = false;
  const status = note();
  const px = (dx) => 24 + ((dx + 1.4) / 2.8) * (c.state.W - 48);
  const py = (v) => c.state.H - 20 - (v / 1.9) * (c.state.H - 40);
  const step = () => {
    const g = dL(x);
    x = x - lr * g * 2.2;
    if (!isFinite(x) || Math.abs(x) > 3) {
      x = clamp(x, -1.4, 1.4);
      auto = false;
      status.textContent = 'Oops, too big a step! It flew out. Make the learning rate smaller.';
      status.classList.remove('win');
    } else if (Math.abs(g) < 0.03) {
      status.textContent = 'Reached the bottom! That is how a computer learns: roll to the lowest spot.';
      status.classList.add('win');
      auto = false;
    } else {
      status.classList.remove('win');
      status.textContent = 'Rolling down the hill...';
    }
    draw();
  };
  function tick() {
    if (auto) step();
  }
  function draw() {
    const { ctx } = c;
    const { W, H } = c.state;
    const t = theme();
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = t.faint;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let dx = -1.4; dx <= 1.4; dx += 0.03) {
      const X = px(dx),
        Y = py(L(dx));
      dx === -1.4 ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y);
    }
    ctx.stroke();
    // ball
    const bx = px(x),
      by = py(L(x));
    ctx.fillStyle = PINK;
    ctx.beginPath();
    ctx.arc(bx, by, 9, 0, 7);
    ctx.fill();
  }
  const s = slider('Learning rate', 2, 120, lr * 100, (v) => (lr = v / 100), '%');
  status.textContent = 'This ball is like a computer learning. Each step rolls it lower. Try Auto-roll!';
  stage.append(
    s.node,
    bar(
      button('Step', () => { auto = false; step(); }),
      button('Auto-roll', () => { auto = !auto; status.classList.remove('win'); }),
      button('Reset', () => { x = -1.15; auto = false; status.classList.remove('win'); draw(); }),
    ),
    status,
  );
  draw();
  return { pause: loop.stop, resume: loop.start };
});

/* Classifier: draw the boundary -------------------------------------------- */
reg('classify', (stage) => {
  const c = makeCanvas(stage, 1.3);
  let angle = 0.6,
    bias = 0;
  let pts = [];
  const status = note();
  const gen = () => {
    pts = [];
    const blob = (mx, my, label) => {
      for (let i = 0; i < 9; i++) pts.push({ x: mx + rand(-0.3, 0.3), y: my + rand(-0.3, 0.3), label });
    };
    blob(-0.5, 0.45, 1);
    blob(0.5, -0.45, -1);
    draw();
  };
  const wof = () => [Math.cos(angle), Math.sin(angle)];
  const pred = (p) => {
    const [w1, w2] = wof();
    return w1 * p.x + w2 * p.y - bias >= 0 ? 1 : -1;
  };
  const acc = () => pts.filter((p) => pred(p) === p.label).length / pts.length;
  const draw = () => {
    const { ctx } = c;
    const { W, H } = c.state;
    const t = theme();
    const f = dataFrame(W, H);
    ctx.clearRect(0, 0, W, H);
    // shaded half-planes
    const [w1, w2] = wof();
    const img = 22;
    for (let i = 0; i < img; i++)
      for (let j = 0; j < img; j++) {
        const dx = (i / (img - 1)) * 2 - 1;
        const dy = (j / (img - 1)) * 2 - 1;
        const side = w1 * dx + w2 * dy - bias >= 0;
        ctx.fillStyle = side ? 'rgba(77,163,255,0.14)' : 'rgba(255,93,143,0.14)';
        ctx.fillRect(f.x(dx) - f.s / img / 2, f.y(dy) - f.s / img / 2, f.s / img + 1, f.s / img + 1);
      }
    // boundary line: w.p = bias
    ctx.strokeStyle = t.fg;
    ctx.lineWidth = 2;
    const dir = [-w2, w1];
    const c0 = [w1 * bias, w2 * bias];
    ctx.beginPath();
    ctx.moveTo(f.x(c0[0] - dir[0] * 2), f.y(c0[1] - dir[1] * 2));
    ctx.lineTo(f.x(c0[0] + dir[0] * 2), f.y(c0[1] + dir[1] * 2));
    ctx.stroke();
    // points
    for (const p of pts) {
      ctx.fillStyle = p.label === 1 ? BLUE : PINK;
      ctx.strokeStyle = pred(p) === p.label ? 'rgba(0,0,0,0)' : t.fg;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(f.x(p.x), f.y(p.y), 6, 0, 7);
      ctx.fill();
      if (pred(p) !== p.label) ctx.stroke();
    }
    const a = acc();
    status.classList.toggle('win', a === 1);
    status.textContent = a === 1 ? 'Perfect split! Every dot is on its own side.' : `${Math.round(a * 100)}% sorted. Move the line, or tap Let it learn.`;
  };
  const learn = () => {
    // a few perceptron passes, then read the weights back into the sliders
    let w = wof();
    let b = bias;
    for (let e = 0; e < 60; e++)
      for (const p of pts) {
        const y = w[0] * p.x + w[1] * p.y - b >= 0 ? 1 : -1;
        if (y !== p.label) {
          w[0] += 0.1 * p.label * p.x;
          w[1] += 0.1 * p.label * p.y;
          b -= 0.1 * p.label;
        }
      }
    angle = Math.atan2(w[1], w[0]);
    const mag = Math.hypot(w[0], w[1]) || 1;
    bias = clamp(b / mag, -1, 1);
    sA.set(((angle + Math.PI) / (2 * Math.PI)) * 100);
    sB.set(((bias + 1) / 2) * 100);
    draw();
  };
  const sA = slider('Turn', 0, 100, ((angle + Math.PI) / (2 * Math.PI)) * 100, (v) => { angle = (v / 100) * 2 * Math.PI - Math.PI; draw(); });
  const sB = slider('Shift', 0, 100, ((bias + 1) / 2) * 100, (v) => { bias = (v / 100) * 2 - 1; draw(); });
  status.textContent = 'Blue apples, pink oranges. Move the line so each kind is on one side.';
  stage.append(sA.node, sB.node, bar(button('Let it learn', learn), button('New dots', gen)), status);
  gen();
  return {};
});

/* Perceptron: one neuron --------------------------------------------------- */
reg('perceptron', (stage) => {
  const GATES = { AND: (a, b) => a & b, OR: (a, b) => a | b, NAND: (a, b) => (a & b) ? 0 : 1 };
  let gate = 'AND';
  let w1 = 0.2,
    w2 = -0.4,
    b = 0.1;
  const status = note();
  const table = el('div', { class: 'g-ptable' });
  const out = (x1, x2) => (w1 * x1 + w2 * x2 + b >= 0 ? 1 : 0);
  const draw = () => {
    table.replaceChildren();
    let right = 0;
    for (const [x1, x2] of [[0, 0], [0, 1], [1, 0], [1, 1]]) {
      const want = GATES[gate](x1, x2);
      const got = out(x1, x2);
      if (got === want) right++;
      table.append(
        el('div', { class: 'g-prow' + (got === want ? ' ok' : ' bad') },
          el('span', { class: 'g-pmono' }, `${x1} , ${x2}`),
          el('span', { class: 'g-pmono' }, `neuron ${got}`),
          el('span', { class: 'g-pmono' }, `want ${want}`),
        ),
      );
    }
    status.classList.toggle('win', right === 4);
    status.textContent = right === 4 ? `Yes! The brain cell learned ${gate}.` : `${right} of 4 right. Slide the weights, or tap Train.`;
  };
  const train = () => {
    for (let e = 0; e < 30; e++)
      for (const [x1, x2] of [[0, 0], [0, 1], [1, 0], [1, 1]]) {
        const want = GATES[gate](x1, x2);
        const got = out(x1, x2);
        const err = want - got;
        w1 += 0.1 * err * x1;
        w2 += 0.1 * err * x2;
        b += 0.1 * err;
      }
    sW1.set(w1 * 25 + 50);
    sW2.set(w2 * 25 + 50);
    sB.set(b * 25 + 50);
    draw();
  };
  const sW1 = slider('Weight 1', 0, 100, w1 * 25 + 50, (v) => { w1 = (v - 50) / 25; draw(); });
  const sW2 = slider('Weight 2', 0, 100, w2 * 25 + 50, (v) => { w2 = (v - 50) / 25; draw(); });
  const sB = slider('Bias', 0, 100, b * 25 + 50, (v) => { b = (v - 50) / 25; draw(); });
  const gateBar = bar(el('span', { class: 'g-note' }, 'Target:'), ...Object.keys(GATES).map((g) => button(g, () => { gate = g; draw(); })));
  status.textContent = 'This one brain cell adds things up and lights up. Make it match the goal.';
  stage.append(table, sW1.node, sW2.node, sB.node, gateBar, bar(button('Train it', train)), status);
  draw();
  return {};
});

/* Neural net learns XOR ---------------------------------------------------- */
reg('neural-net', (stage) => {
  const c = makeCanvas(stage, 1.15);
  const loop = makeLoop(tick);
  const data = [
    [0, 0, 0], [0, 1, 1], [1, 0, 1], [1, 1, 0],
  ];
  let W1, b1, W2, b2, epoch, training;
  const status = note();
  const init = () => {
    const r = () => rand(-1, 1);
    W1 = [[r(), r()], [r(), r()]];
    b1 = [r(), r()];
    W2 = [r(), r()];
    b2 = r();
    epoch = 0;
  };
  const fwd = (x1, x2) => {
    const h = [sigmoid(W1[0][0] * x1 + W1[0][1] * x2 + b1[0]), sigmoid(W1[1][0] * x1 + W1[1][1] * x2 + b1[1])];
    const o = sigmoid(W2[0] * h[0] + W2[1] * h[1] + b2);
    return { h, o };
  };
  const trainStep = () => {
    const lr = 0.5;
    for (const [x1, x2, y] of data) {
      const { h, o } = fwd(x1, x2);
      const dO = (o - y) * o * (1 - o);
      const dH = [dO * W2[0] * h[0] * (1 - h[0]), dO * W2[1] * h[1] * (1 - h[1])];
      W2[0] -= lr * dO * h[0];
      W2[1] -= lr * dO * h[1];
      b2 -= lr * dO;
      W1[0][0] -= lr * dH[0] * x1;
      W1[0][1] -= lr * dH[0] * x2;
      W1[1][0] -= lr * dH[1] * x1;
      W1[1][1] -= lr * dH[1] * x2;
      b1[0] -= lr * dH[0];
      b1[1] -= lr * dH[1];
    }
    epoch++;
  };
  const loss = () => data.reduce((s, [x1, x2, y]) => s + (fwd(x1, x2).o - y) ** 2, 0) / 4;
  function tick() {
    if (training) {
      for (let k = 0; k < 60; k++) trainStep();
      if (epoch > 900 && loss() > 0.2) init(); // shake out of a local minimum
    }
    draw();
  }
  function draw() {
    const { ctx } = c;
    const { W, H } = c.state;
    const f = dataFrame(W, H);
    ctx.clearRect(0, 0, W, H);
    const R = 20;
    for (let i = 0; i < R; i++)
      for (let j = 0; j < R; j++) {
        const dx = i / (R - 1),
          dy = j / (R - 1);
        const o = fwd(dx, dy).o;
        ctx.fillStyle = heat(o);
        ctx.globalAlpha = 0.5;
        ctx.fillRect(f.x(dx * 2 - 1) - f.s / R / 2, f.y(dy * 2 - 1) - f.s / R / 2, f.s / R + 1, f.s / R + 1);
      }
    ctx.globalAlpha = 1;
    for (const [x1, x2, y] of data) {
      ctx.fillStyle = y ? PINK : BLUE;
      ctx.strokeStyle = theme().fg;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(f.x(x1 * 2 - 1), f.y(x2 * 2 - 1), 11, 0, 7);
      ctx.fill();
      ctx.stroke();
    }
    const l = loss();
    status.classList.toggle('win', l < 0.02);
    status.textContent = l < 0.02 ? `Done! The brain learned it after ${epoch} rounds. See how the colours bent.` : `Learning... round ${epoch}. Watch the colours find the corners.`;
  }
  status.textContent = 'One line cannot split these. A brain with a hidden layer can. Press Train!';
  stage.append(
    bar(
      button('Train', () => { training = !training; }),
      button('Reset weights', () => { init(); training = false; draw(); }),
    ),
    status,
  );
  init();
  draw();
  return { pause: loop.stop, resume: loop.start };
});

/* Activation functions ----------------------------------------------------- */
reg('activation', (stage) => {
  const c = makeCanvas(stage, 1.5);
  const FN = {
    Step: (x) => (x >= 0 ? 1 : 0),
    Sigmoid: (x) => sigmoid(x),
    Tanh: (x) => Math.tanh(x),
    ReLU: (x) => Math.max(0, x),
    'Leaky ReLU': (x) => (x >= 0 ? x : 0.1 * x),
  };
  let name = 'Sigmoid',
    xv = 0.8;
  const status = note();
  const draw = () => {
    const { ctx } = c;
    const { W, H } = c.state;
    const t = theme();
    ctx.clearRect(0, 0, W, H);
    const px = (x) => 20 + ((x + 4) / 8) * (W - 40);
    const py = (y) => H - 20 - ((y + 1.2) / 3.4) * (H - 40);
    ctx.strokeStyle = t.rule;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px(-4), py(0));
    ctx.lineTo(px(4), py(0));
    ctx.moveTo(px(0), py(-1.2));
    ctx.lineTo(px(0), py(2.2));
    ctx.stroke();
    const fn = FN[name];
    ctx.strokeStyle = PINK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = -4; x <= 4; x += 0.05) (x === -4 ? ctx.moveTo : ctx.lineTo).call(ctx, px(x), py(fn(x)));
    ctx.stroke();
    ctx.fillStyle = BLUE;
    ctx.beginPath();
    ctx.arc(px(xv), py(fn(xv)), 7, 0, 7);
    ctx.fill();
    status.textContent = `${name}(${xv.toFixed(1)}) = ${fn(xv).toFixed(2)}. This curve decides how much the brain cell fires.`;
  };
  const s = slider('Input x', -40, 40, xv * 10, (v) => { xv = v / 10; draw(); });
  const fbar = bar(...Object.keys(FN).map((n) => button(n, () => { name = n; draw(); })));
  stage.append(s.node, fbar, status);
  draw();
  return {};
});

/* K-means clustering ------------------------------------------------------- */
reg('kmeans', (stage) => {
  const c = makeCanvas(stage, 1.3);
  let pts = [],
    cents = [],
    K = 3;
  const status = note();
  const COLS = [BLUE, PINK, MINT, '#ffd23f'];
  const gen = () => {
    pts = [];
    const blob = (mx, my) => { for (let i = 0; i < 12; i++) pts.push({ x: mx + rand(-0.28, 0.28), y: my + rand(-0.28, 0.28), c: -1 }); };
    blob(-0.5, 0.5); blob(0.55, 0.4); blob(0, -0.55);
    seed();
  };
  const seed = () => {
    cents = shuffle(pts).slice(0, K).map((p) => ({ x: p.x, y: p.y }));
    pts.forEach((p) => (p.c = -1));
    draw();
    status.classList.remove('win');
    status.textContent = `${K} centres dropped. Tap Step to sort the dots into groups.`;
  };
  const step = () => {
    pts.forEach((p) => {
      let best = 0,
        bd = 1e9;
      cents.forEach((ct, i) => { const d = (p.x - ct.x) ** 2 + (p.y - ct.y) ** 2; if (d < bd) { bd = d; best = i; } });
      p.c = best;
    });
    let moved = 0;
    cents.forEach((ct, i) => {
      const own = pts.filter((p) => p.c === i);
      if (own.length) {
        const nx = own.reduce((s, p) => s + p.x, 0) / own.length;
        const ny = own.reduce((s, p) => s + p.y, 0) / own.length;
        moved += Math.abs(nx - ct.x) + Math.abs(ny - ct.y);
        ct.x = nx; ct.y = ny;
      }
    });
    draw();
    if (moved < 0.01) { status.textContent = 'Done! The computer found the groups all by itself.'; status.classList.add('win'); }
    else status.textContent = 'Dots sorted, centres moved. Keep tapping Step.';
  };
  const draw = () => {
    const { ctx } = c;
    const { W, H } = c.state;
    const f = dataFrame(W, H);
    ctx.clearRect(0, 0, W, H);
    for (const p of pts) {
      ctx.fillStyle = p.c < 0 ? theme().faint : COLS[p.c];
      ctx.beginPath();
      ctx.arc(f.x(p.x), f.y(p.y), 5, 0, 7);
      ctx.fill();
    }
    cents.forEach((ct, i) => {
      ctx.fillStyle = COLS[i];
      ctx.strokeStyle = theme().fg;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(f.x(ct.x), f.y(ct.y), 11, 0, 7);
      ctx.fill();
      ctx.stroke();
    });
  };
  const kbar = bar(el('span', { class: 'g-note' }, 'Groups:'), ...[2, 3, 4].map((k) => button(k, () => { K = k; seed(); })));
  stage.append(kbar, bar(button('Step', step), button('New dots', gen)), status);
  gen();
  return {};
});

/* K nearest neighbours ----------------------------------------------------- */
reg('knn', (stage) => {
  const c = makeCanvas(stage, 1.3);
  let train = [],
    q = { x: 0, y: 0 },
    K = 3;
  const status = note();
  const gen = () => {
    train = [];
    const blob = (mx, my, label) => { for (let i = 0; i < 9; i++) train.push({ x: mx + rand(-0.32, 0.32), y: my + rand(-0.32, 0.32), label }); };
    blob(-0.45, 0.4, 0); blob(0.5, -0.35, 1);
    draw();
  };
  const classify = (p) => {
    const near = train.map((t) => ({ d: (t.x - p.x) ** 2 + (t.y - p.y) ** 2, label: t.label })).sort((a, b) => a.d - b.d).slice(0, K);
    const votes = near.filter((n) => n.label === 1).length;
    return { pred: votes > K / 2 ? 1 : 0, near };
  };
  const draw = () => {
    const { ctx } = c;
    const { W, H } = c.state;
    const f = dataFrame(W, H);
    ctx.clearRect(0, 0, W, H);
    for (const t of train) {
      ctx.fillStyle = t.label ? PINK : BLUE;
      ctx.beginPath();
      ctx.arc(f.x(t.x), f.y(t.y), 5, 0, 7);
      ctx.fill();
    }
    const { pred, near } = classify(q);
    const maxd = Math.sqrt(near[near.length - 1]?.d ?? 0);
    ctx.strokeStyle = theme().faint;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(f.x(q.x), f.y(q.y), maxd * (f.s / 2), 0, 7);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = pred ? PINK : BLUE;
    ctx.strokeStyle = theme().fg;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(f.x(q.x), f.y(q.y), 10, 0, 7);
    ctx.fill();
    ctx.stroke();
    status.textContent = `Its ${K} closest neighbours say: ${pred ? 'pink' : 'blue'}. Drag it!`;
  };
  drag(c.wrap, {
    down: (p) => moveQ(p),
    move: (p) => moveQ(p),
  });
  const moveQ = (p) => {
    const f = dataFrame(c.state.W, c.state.H);
    q = { x: clamp(f.ix(p.x), -1, 1), y: clamp(f.iy(p.y), -1, 1) };
    draw();
  };
  const s = slider('K neighbours', 1, 9, K, (v) => { K = v % 2 ? v : v + 1; draw(); });
  status.textContent = 'The grey dot is new. It copies its closest neighbours. Drag it around!';
  stage.append(s.node, bar(button('New dots', gen)), status);
  gen();
  return {};
});

/* Overfitting -------------------------------------------------------------- */
reg('overfit', (stage) => {
  const c = makeCanvas(stage, 1.4);
  let deg = 3,
    train = [],
    test = [];
  const status = note();
  const truth = (x) => 0.55 * Math.sin(3.1 * x);
  const gen = () => {
    train = Array.from({ length: 11 }, () => { const x = rand(-1, 1); return { x, y: truth(x) + rand(-0.18, 0.18) }; });
    test = Array.from({ length: 60 }, (_, i) => { const x = -1 + (2 * i) / 59; return { x, y: truth(x) }; });
    draw();
  };
  const draw = () => {
    const { ctx } = c;
    const { W, H } = c.state;
    const t = theme();
    const px = (x) => 20 + ((x + 1) / 2) * (W - 40);
    const py = (y) => H / 2 - y * (H * 0.36);
    ctx.clearRect(0, 0, W, H);
    // true curve
    ctx.strokeStyle = t.rule;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = -1; x <= 1; x += 0.02) (x === -1 ? ctx.moveTo : ctx.lineTo).call(ctx, px(x), py(truth(x)));
    ctx.stroke();
    const coef = polyfit(train.map((p) => p.x), train.map((p) => p.y), deg);
    ctx.strokeStyle = PINK;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let x = -1; x <= 1; x += 0.01) (x === -1 ? ctx.moveTo : ctx.lineTo).call(ctx, px(x), py(clamp(polyval(coef, x), -2, 2)));
    ctx.stroke();
    for (const p of train) {
      ctx.fillStyle = BLUE;
      ctx.beginPath();
      ctx.arc(px(p.x), py(p.y), 5, 0, 7);
      ctx.fill();
    }
    const trainErr = train.reduce((s, p) => s + (polyval(coef, p.x) - p.y) ** 2, 0) / train.length;
    const testErr = test.reduce((s, p) => s + (clamp(polyval(coef, p.x), -3, 3) - p.y) ** 2, 0) / test.length;
    const over = testErr > 0.05 && deg > 6;
    status.classList.toggle('win', testErr < 0.02);
    status.textContent = `Level ${deg}. ` + (over ? 'Too wiggly! It memorised the wobbles.' : deg < 2 ? 'Too stiff! It misses the shape.' : 'Just right!');
  };
  const s = slider('Model complexity', 1, 11, deg, (v) => { deg = v; draw(); });
  status.textContent = 'The grey line is the real shape. Find a fit that follows it, not the wobbles.';
  stage.append(s.node, bar(button('New sample', gen)), status);
  gen();
  return {};
});

/* ========================================================================== *
 *  AI ARCHITECTURES
 * ========================================================================== */

/* Softmax and temperature -------------------------------------------------- */
reg('softmax', (stage) => {
  const names = ['A', 'B', 'C', 'D'];
  let logits = [2, 1, 0.2, -0.5];
  let temp = 1;
  const status = note();
  const bars = el('div', { class: 'g-bars' });
  const draw = () => {
    const probs = softmaxArr(logits, temp);
    bars.replaceChildren();
    probs.forEach((p, i) => {
      bars.append(
        el('div', { class: 'g-bar-row' },
          el('span', { class: 'g-bar-tag' }, names[i]),
          el('div', { class: 'g-bar-track' }, el('div', { class: 'g-bar-fill', style: `width:${(p * 100).toFixed(1)}%;background:${CANDY[i]}` })),
          el('span', { class: 'g-bar-num tnum' }, (p * 100).toFixed(0) + '%'),
        ),
      );
    });
    const top = probs.indexOf(Math.max(...probs));
    status.textContent = `Scores become chances that add to 100%. Low heat picks a favourite (${names[top]}); high heat shares it out.`;
  };
  const sliders = logits.map((v, i) => slider(`Score ${names[i]}`, -30, 30, v * 10, (nv) => { logits[i] = nv / 10; draw(); }));
  const st = slider('Temperature', 20, 300, temp * 100, (v) => { temp = v / 100; draw(); }, '%');
  status.textContent = 'This turns scores into chances that add up to a whole. Slide and watch!';
  stage.append(bars, ...sliders.map((s) => s.node), st.node, status);
  draw();
  return {};
});

/* Attention: who looks at whom -------------------------------------------- */
reg('attention', (stage) => {
  // Each token carries a tiny "meaning" vector [animal, predator/energy, refers].
  const toks = [
    ['The', [0, 0, 0]], ['tiger', [1, 1, 0]], ['chased', [0, 0.3, 0]], ['the', [0, 0, 0]],
    ['deer', [1, -0.6, 0]], ['because', [0, 0, 0]], ['it', [0.9, 0.9, 0.2]], ['was', [0, 0, 0]], ['hungry', [0.2, 0.9, 0]],
  ];
  let query = 6;
  const status = note();
  const row = el('div', { class: 'g-tokens' });
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const draw = () => {
    const q = toks[query][1];
    const scores = toks.map((t, i) => (i === query ? -9 : dot(q, t[1])));
    const w = softmaxArr(scores.map((s) => s * 2.2));
    row.replaceChildren();
    toks.forEach(([word], i) => {
      const strength = i === query ? 0 : w[i];
      row.append(
        el('button', {
          type: 'button',
          class: 'g-token' + (i === query ? ' q' : ''),
          style: i === query ? '' : `background:rgba(168,41,15,${(strength * 0.9).toFixed(2)})`,
          onClick: () => { query = i; draw(); },
        }, word),
      );
    });
    const ranked = toks.map(([w2], i) => ({ w2, s: i === query ? -1 : w[i] })).filter((r) => r.s > 0).sort((a, b) => b.s - a.s);
    status.textContent = `"${toks[query][0]}" looks most at "${ranked[0]?.w2}"${ranked[1] ? ` and "${ranked[1].w2}"` : ''}. That is attention!`;
  };
  status.textContent = 'Tap any word. The others light up by how much it looks at them.';
  stage.append(row, status);
  draw();
  return {};
});

/* Next-token: a tiny language model --------------------------------------- */
reg('next-token', (stage) => {
  const CORPUS = [
    'the cat sat on the mat', 'the cat ran to the hat', 'the dog ran after the cat',
    'twinkle twinkle little star', 'how i wonder what you are', 'up above the world so high',
    'like a diamond in the sky', 'the sun is a big yellow star', 'the star is up in the sky',
    'the little cat is on the mat',
  ];
  const model = new Map();
  for (const line of CORPUS) {
    const w = ['<start>', ...line.split(' ')];
    for (let i = 0; i < w.length - 1; i++) {
      if (!model.has(w[i])) model.set(w[i], new Map());
      const m = model.get(w[i]);
      m.set(w[i + 1], (m.get(w[i + 1]) || 0) + 1);
    }
  }
  let words = [];
  const status = note();
  const sentence = el('p', { class: 'g-sentence' });
  const choices = el('div', { class: 'g-bars' });
  const draw = () => {
    sentence.textContent = words.length ? words.join(' ') + ' ...' : '(press a word to begin)';
    const last = words.length ? words[words.length - 1] : '<start>';
    const m = model.get(last);
    choices.replaceChildren();
    if (!m) {
      status.textContent = 'The robot ran out of words. Tap Start over.';
      return;
    }
    const total = [...m.values()].reduce((a, b) => a + b, 0);
    const ranked = [...m.entries()].map(([w, n]) => ({ w, p: n / total })).sort((a, b) => b.p - a.p).slice(0, 5);
    ranked.forEach(({ w, p }, i) => {
      choices.append(
        el('button', { type: 'button', class: 'g-bar-row g-bar-btn', onClick: () => { words.push(w); draw(); } },
          el('span', { class: 'g-bar-tag' }, w),
          el('div', { class: 'g-bar-track' }, el('div', { class: 'g-bar-fill', style: `width:${(p * 100).toFixed(0)}%;background:${CANDY[i % CANDY.length]}` })),
          el('span', { class: 'g-bar-num tnum' }, (p * 100).toFixed(0) + '%'),
        ),
      );
    });
    status.textContent = 'A chatbot just guesses the next word, again and again. Tap one!';
  };
  stage.append(sentence, choices, bar(button('Start over', () => { words = []; draw(); })), status);
  draw();
  return {};
});

/* State space / Mamba: a memory that carries forward ----------------------- */
reg('state-space', (stage) => {
  const c = makeCanvas(stage, 1.7);
  const loop = makeLoop(tick);
  const seq = [0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0];
  let decay = 0.75;
  let phase = 0;
  let state = 0;
  let trace = [];
  let idx = 0;
  const status = note();
  const reset = () => { phase = 0; state = 0; trace = []; idx = 0; };
  function tick(dt) {
    phase += dt * 2.2;
    while (phase >= 1 && idx < seq.length) {
      state = decay * state + seq[idx];
      trace.push({ i: idx, s: state, spike: seq[idx] });
      idx++;
      phase -= 1;
    }
    draw();
    if (idx >= seq.length) {
      const remembers = state > 0.05;
      status.classList.toggle('win', true);
      status.textContent = `Done! The memory ${remembers ? 'still remembers' : 'forgot'} the early flashes. More memory remembers longer.`;
    }
  }
  function draw() {
    const { ctx } = c;
    const { W, H } = c.state;
    const t = theme();
    ctx.clearRect(0, 0, W, H);
    const n = seq.length;
    const step = (W - 40) / n;
    const base = H - 26;
    // input spikes
    seq.forEach((v, i) => {
      const x = 20 + step * (i + 0.5);
      ctx.fillStyle = v ? PINK : t.rule;
      ctx.fillRect(x - 4, base - v * 26, 8, v ? 26 : 3);
    });
    // state trace as a filled line
    ctx.strokeStyle = BLUE;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    trace.forEach((p, k) => {
      const x = 20 + step * (p.i + 0.5);
      const y = base - clamp(p.s, 0, 4) * 40;
      k === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
    if (trace.length) {
      const last = trace[trace.length - 1];
      ctx.fillStyle = BLUE;
      ctx.beginPath();
      ctx.arc(20 + step * (last.i + 0.5), base - clamp(last.s, 0, 4) * 40, 6, 0, 7);
      ctx.fill();
    }
    ctx.fillStyle = t.faint;
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('pink = words coming in    blue = the memory', 16, 16);
  }
  const s = slider('Memory (decay)', 30, 96, decay * 100, (v) => (decay = v / 100), '%');
  status.textContent = 'This AI keeps one little memory and updates it. Press Play!';
  stage.append(s.node, bar(button('Play', () => { reset(); status.classList.remove('win'); }), button('Reset', reset)), status);
  reset();
  draw();
  return { pause: loop.stop, resume: loop.start };
});

/* Model builder: stack layers, watch the parameters explode ---------------- */
reg('model-builder', (stage) => {
  const KINDS = { Embedding: 'emb', Attention: 'attn', FeedForward: 'ff', Conv: 'conv', Recurrent: 'rnn' };
  const WIDTHS = { Small: 64, Medium: 256, Large: 1024, Huge: 4096 };
  const params1 = (kind, w) => ({ emb: 10000 * w, attn: 4 * w * w, ff: 8 * w * w, conv: 9 * w * w, rnn: 4 * w * w }[kind]);
  let layers = [{ kind: 'emb', w: 256 }, { kind: 'attn', w: 256 }, { kind: 'ff', w: 256 }];
  const status = note();
  const list = el('div', { class: 'g-layers' });
  const readout = el('div', { class: 'g-readout' });
  const fmt = (n) => (n >= 1e9 ? (n / 1e9).toFixed(1) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : String(n));
  const verdict = (p) => {
    if (p < 1e5) return ['Tiny', 'Tell a cat from a dog, on a good day.'];
    if (p < 5e6) return ['Small', 'Finish your sentences and sort your email.'];
    if (p < 3e8) return ['Medium', 'Write a passable poem and answer trivia.'];
    if (p < 2e10) return ['Large', 'Hold a real conversation and write code.'];
    return ['Huge', 'Argue with you about the code it just wrote.'];
  };
  const total = () => layers.reduce((s, l) => s + params1(l.kind, l.w), 0);
  const draw = () => {
    list.replaceChildren();
    layers.forEach((l, i) => {
      const name = Object.keys(KINDS).find((k) => KINDS[k] === l.kind);
      const widthName = Object.keys(WIDTHS).find((k) => WIDTHS[k] === l.w) || 'Medium';
      list.append(
        el('div', { class: 'g-layer' },
          el('span', { class: 'g-layer-name' }, name),
          el('span', { class: 'g-layer-w' }, `${l.w} wide`),
          el('span', { class: 'g-layer-p tnum' }, fmt(params1(l.kind, l.w))),
          button('wider', () => { const ws = Object.values(WIDTHS); l.w = ws[Math.min(ws.length - 1, ws.indexOf(l.w) + 1)] || 4096; draw(); }, 'g-mini'),
          button('narrower', () => { const ws = Object.values(WIDTHS); l.w = ws[Math.max(0, ws.indexOf(l.w) - 1)] || 64; draw(); }, 'g-mini'),
          button('remove', () => { layers.splice(i, 1); draw(); }, 'g-mini'),
        ),
      );
    });
    const p = total();
    const [cls, can] = verdict(p);
    readout.replaceChildren(
      el('div', { class: 'g-readout-big tnum' }, fmt(p) + ' parameters'),
      el('div', { class: 'g-readout-cls' }, `Size class: ${cls}`),
      el('div', { class: 'g-readout-can' }, 'It could maybe: ' + can),
    );
    status.textContent = `${layers.length} blocks, ${fmt(p)} parts. Wider blocks add a LOT more. Big brains cost more!`;
  };
  const add = bar(el('span', { class: 'g-note' }, 'Add:'), ...Object.keys(KINDS).map((k) => button(k, () => { layers.push({ kind: KINDS[k], w: 256 }); draw(); }, 'g-mini')));
  status.textContent = 'Stack blocks to build a robot brain. Watch it grow, and see what it could do!';
  stage.append(readout, list, add, bar(button('Clear', () => { layers = []; draw(); })), status);
  draw();
  return {};
});

/* Embeddings: a map of meaning --------------------------------------------- */
reg('embeddings', (stage) => {
  const c = makeCanvas(stage, 1.25);
  const WORDS = {
    cat: [-0.6, 0.5], dog: [-0.78, 0.44], kitten: [-0.55, 0.66], puppy: [-0.72, 0.6], horse: [-0.88, 0.28],
    apple: [0.6, 0.6], banana: [0.78, 0.52], bread: [0.55, 0.44], cake: [0.72, 0.7],
    man: [0.15, -0.35], woman: [0.5, -0.35], king: [0.15, -0.68], queen: [0.5, -0.68],
  };
  const keys = Object.keys(WORDS);
  let sel = 'cat';
  let analogy = null;
  const status = note();
  const draw = () => {
    const { ctx } = c;
    const { W, H } = c.state;
    const t = theme();
    const f = dataFrame(W, H, 30);
    ctx.clearRect(0, 0, W, H);
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    // nearest neighbours of sel
    const near = keys.filter((k) => k !== sel)
      .map((k) => ({ k, d: (WORDS[k][0] - WORDS[sel][0]) ** 2 + (WORDS[k][1] - WORDS[sel][1]) ** 2 }))
      .sort((a, b) => a.d - b.d).slice(0, 3).map((n) => n.k);
    for (const nk of near) {
      ctx.strokeStyle = t.rule;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(f.x(WORDS[sel][0]), f.y(WORDS[sel][1]));
      ctx.lineTo(f.x(WORDS[nk][0]), f.y(WORDS[nk][1]));
      ctx.stroke();
    }
    for (const k of keys) {
      const isSel = k === sel;
      const isNear = near.includes(k);
      ctx.fillStyle = isSel ? PINK : isNear ? BLUE : t.faint;
      ctx.beginPath();
      ctx.arc(f.x(WORDS[k][0]), f.y(WORDS[k][1]), isSel ? 6 : 4, 0, 7);
      ctx.fill();
      ctx.fillStyle = isSel ? PINK : t.fg;
      ctx.fillText(k, f.x(WORDS[k][0]), f.y(WORDS[k][1]) - 9);
    }
    if (analogy) {
      ctx.fillStyle = MINT;
      ctx.strokeStyle = MINT;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(f.x(analogy[0]), f.y(analogy[1]), 7, 0, 7);
      ctx.stroke();
      ctx.fillText('king - man + woman', f.x(analogy[0]), f.y(analogy[1]) + 20);
    }
    status.textContent = `"${sel}" is closest to ${near.join(', ')}. Similar words sit near each other!`;
  };
  drag(c.wrap, {
    down: (p) => {
      const f = dataFrame(c.state.W, c.state.H, 30);
      let best = null,
        bd = 1e9;
      for (const k of keys) {
        const d = (f.x(WORDS[k][0]) - p.x) ** 2 + (f.y(WORDS[k][1]) - p.y) ** 2;
        if (d < bd) { bd = d; best = k; }
      }
      if (bd < 900) { sel = best; analogy = null; draw(); }
    },
  });
  status.textContent = 'A map of words. Close together means similar meaning. Tap one!';
  stage.append(bar(button('king - man + woman = ?', () => {
    analogy = [WORDS.king[0] - WORDS.man[0] + WORDS.woman[0], WORDS.king[1] - WORDS.man[1] + WORDS.woman[1]];
    sel = 'queen';
    draw();
    status.textContent = 'Magic! king minus man plus woman lands on queen.';
  })), status);
  draw();
  return {};
});

/* ========================================================================== *
 *  LOGIC PUZZLES
 * ========================================================================== */

/* River crossing: wolf, goat, cabbage -------------------------------------- */
reg('river-crossing', (stage) => {
  const ITEMS = { farmer: 'You', wolf: 'Wolf', goat: 'Goat', cabbage: 'Cabbage' };
  let pos = { farmer: 'L', wolf: 'L', goat: 'L', cabbage: 'L' };
  let over = false;
  const status = note();
  const banks = el('div', { class: 'g-banks' });
  const danger = () => {
    // something is eaten if the farmer is away and a bad pair shares a bank
    const away = (a, b) => pos[a] === pos[b] && pos.farmer !== pos[a];
    if (away('wolf', 'goat')) return 'The wolf ate the goat!';
    if (away('goat', 'cabbage')) return 'The goat ate the cabbage!';
    return null;
  };
  const draw = () => {
    banks.replaceChildren();
    ['L', 'R'].forEach((side) => {
      const bank = el('div', { class: 'g-bank' + (pos.farmer === side ? ' here' : '') });
      bank.append(el('div', { class: 'g-bank-label' }, side === 'L' ? 'Start' : 'Goal'));
      Object.keys(ITEMS).forEach((k) => {
        if (pos[k] !== side) return;
        const canMove = !over && k !== 'farmer' && pos[k] === pos.farmer;
        bank.append(
          el('button', {
            type: 'button',
            class: 'g-riv' + (k === 'farmer' ? ' farmer' : '') + (canMove ? ' can' : ''),
            disabled: !canMove && k !== 'farmer',
            title: k,
            onClick: () => canMove && cross(k),
          }, ITEMS[k]),
        );
      });
      banks.append(bank);
    });
    if (!over) status.textContent = pos.wolf === 'R' && pos.goat === 'R' && pos.cabbage === 'R' ? '' : 'Row things across. Never leave wolf with goat, or goat with cabbage, without you.';
    if (pos.farmer === 'R' && pos.wolf === 'R' && pos.goat === 'R' && pos.cabbage === 'R') {
      status.textContent = 'Everyone across, nothing eaten. Solved!';
      status.classList.add('win');
      over = true;
    }
  };
  const cross = (item) => {
    const to = pos.farmer === 'L' ? 'R' : 'L';
    pos.farmer = to;
    if (item) pos[item] = to;
    const d = danger();
    if (d) { status.textContent = d + ' Press reset.'; status.classList.remove('win'); over = true; draw(); return; }
    draw();
  };
  const reset = () => { pos = { farmer: 'L', wolf: 'L', goat: 'L', cabbage: 'L' }; over = false; status.classList.remove('win'); draw(); };
  status.textContent = 'Row things across. Never leave wolf with goat, or goat with cabbage, without you.';
  stage.append(banks, bar(button('Row across empty', () => !over && cross(null)), button('Reset', reset)), status);
  draw();
  return {};
});

/* Missionaries and cannibals ----------------------------------------------- */
reg('missionaries', (stage) => {
  let L = { m: 3, c: 3 },
    R = { m: 0, c: 0 },
    boatSide = 'L',
    load = { m: 0, c: 0 },
    over = false;
  const status = note();
  const view = el('div', { class: 'g-mc' });
  const safe = (b) => b.m === 0 || b.m >= b.c;
  const here = () => (boatSide === 'L' ? L : R);
  const draw = () => {
    view.replaceChildren();
    const mkBank = (b, side) => {
      const bank = el('div', { class: 'g-bank' + (boatSide === side ? ' here' : '') });
      bank.append(el('div', { class: 'g-bank-label' }, side === 'L' ? 'Start' : 'Goal'));
      bank.append(el('div', { class: 'g-mc-count' }, ('M '.repeat(b.m)).trim() || '-'));
      bank.append(el('div', { class: 'g-mc-count' }, ('C '.repeat(b.c)).trim() || '-'));
      return bank;
    };
    view.append(mkBank(L, 'L'), el('div', { class: 'g-mc-boat' }, 'Boat ' + (('M '.repeat(load.m) + 'C '.repeat(load.c)).trim() || 'empty')), mkBank(R, 'R'));
    if (!over) status.textContent = `Boat at ${boatSide === 'L' ? 'start' : 'goal'}. Load 1 or 2, never let cannibals outnumber missionaries.`;
  };
  const controls = el('div', { class: 'g-bar' });
  const adj = (t, d) => {
    const b = here();
    if (d > 0 && load.m + load.c >= 2) return;
    if (d > 0 && b[t] - load[t] <= 0) return;
    if (d < 0 && load[t] <= 0) return;
    load[t] += d;
    draw();
  };
  const cross = () => {
    if (load.m + load.c === 0) { status.textContent = 'The boat needs at least one person to row.'; return; }
    const from = here();
    const to = boatSide === 'L' ? R : L;
    from.m -= load.m; from.c -= load.c;
    to.m += load.m; to.c += load.c;
    boatSide = boatSide === 'L' ? 'R' : 'L';
    load = { m: 0, c: 0 };
    if (!safe(L) || !safe(R)) { status.textContent = 'The cannibals outnumbered the missionaries. Press reset.'; status.classList.remove('win'); over = true; draw(); return; }
    if (R.m === 3 && R.c === 3) { status.textContent = 'All six safely across. Solved!'; status.classList.add('win'); over = true; }
    draw();
  };
  const reset = () => { L = { m: 3, c: 3 }; R = { m: 0, c: 0 }; boatSide = 'L'; load = { m: 0, c: 0 }; over = false; status.classList.remove('win'); draw(); };
  controls.append(
    button('+ missionary', () => adj('m', 1)), button('- missionary', () => adj('m', -1)),
    button('+ cannibal', () => adj('c', 1)), button('- cannibal', () => adj('c', -1)),
  );
  stage.append(view, controls, bar(button('Row across', cross), button('Reset', reset)), status);
  draw();
  return {};
});

/* Water jugs --------------------------------------------------------------- */
reg('water-jugs', (stage) => {
  const CAP = [5, 3];
  const TARGET = 4;
  let jug = [0, 0];
  const status = note();
  const view = el('div', { class: 'g-jugs' });
  const draw = () => {
    view.replaceChildren();
    jug.forEach((v, i) => {
      const j = el('div', { class: 'g-jug' });
      j.append(el('div', { class: 'g-jug-fill', style: `height:${(v / CAP[i]) * 100}%` }));
      const wrap = el('div', { class: 'g-jug-wrap' }, j, el('div', { class: 'g-jug-cap' }, `${v} / ${CAP[i]} L`));
      view.append(wrap);
    });
    if (jug.includes(TARGET)) { status.textContent = `You measured exactly ${TARGET} litres. Solved!`; status.classList.add('win'); }
    else { status.classList.remove('win'); status.textContent = `Get exactly ${TARGET} litres in either jug using fill, empty, and pour.`; }
  };
  const pour = (a, b) => {
    const amt = Math.min(jug[a], CAP[b] - jug[b]);
    jug[a] -= amt; jug[b] += amt;
  };
  stage.append(
    view,
    bar(
      button('Fill 5L', () => { jug[0] = CAP[0]; draw(); }),
      button('Fill 3L', () => { jug[1] = CAP[1]; draw(); }),
      button('Empty 5L', () => { jug[0] = 0; draw(); }),
      button('Empty 3L', () => { jug[1] = 0; draw(); }),
    ),
    bar(
      button('Pour 5L into 3L', () => { pour(0, 1); draw(); }),
      button('Pour 3L into 5L', () => { pour(1, 0); draw(); }),
      button('Reset', () => { jug = [0, 0]; draw(); }),
    ),
    status,
  );
  draw();
  return {};
});

/* Sokoban ------------------------------------------------------------------ */
reg('sokoban', (stage) => {
  const LEVELS = [
    ['#####', '#@$.#', '#####'],
    ['######', '#@ $.#', '#  $ #', '#  . #', '######'],
    ['#######', '#.$@$.#', '#######'],
  ];
  let level = 0,
    grid = [],
    px = 0,
    py = 0,
    pushes = 0;
  const status = note();
  const board = el('div', { class: 'g-sok' });
  const targets = new Set();
  const load = (n) => {
    level = ((n % LEVELS.length) + LEVELS.length) % LEVELS.length;
    grid = LEVELS[level].map((r) => r.split(''));
    targets.clear();
    pushes = 0;
    for (let y = 0; y < grid.length; y++)
      for (let x = 0; x < grid[y].length; x++) {
        const ch = grid[y][x];
        if (ch === '.' || ch === '*' || ch === '+') targets.add(y + ',' + x);
        if (ch === '@' || ch === '+') { px = x; py = y; grid[y][x] = ch === '+' ? '.' : ' '; }
        if (ch === '*') grid[y][x] = '$';
      }
    draw();
  };
  const at = (x, y) => (grid[y] && grid[y][x]) || '#';
  const isBox = (x, y) => at(x, y) === '$';
  const isFree = (x, y) => at(x, y) === ' ' || at(x, y) === '.';
  const move = (dx, dy) => {
    const nx = px + dx,
      ny = py + dy;
    if (isBox(nx, ny)) {
      const bx = nx + dx,
        by = ny + dy;
      if (!isFree(bx, by)) return;
      grid[by][bx] = '$';
      grid[ny][nx] = targets.has(ny + ',' + nx) ? '.' : ' ';
      pushes++;
    } else if (!isFree(nx, ny)) return;
    px = nx; py = ny;
    draw();
  };
  const won = () => targets.size > 0 && [...targets].every((t) => { const [y, x] = t.split(',').map(Number); return grid[y][x] === '$'; });
  const draw = () => {
    board.style.setProperty('--w', String(grid[0].length));
    board.replaceChildren();
    for (let y = 0; y < grid.length; y++)
      for (let x = 0; x < grid[y].length; x++) {
        const isP = x === px && y === py;
        const ch = grid[y][x];
        const tgt = targets.has(y + ',' + x);
        let cls = 'g-sok-cell',
          txt = '';
        if (ch === '#') cls += ' wall';
        else if (isP) { cls += ' player'; txt = ''; }
        else if (ch === '$') { cls += tgt ? ' box on' : ' box'; txt = ''; }
        else if (tgt) { cls += ' target'; txt = '·'; }
        board.append(el('div', { class: cls }, txt));
      }
    if (won()) { status.textContent = `Level solved in ${pushes} pushes!`; status.classList.add('win'); }
    else { status.classList.remove('win'); status.textContent = 'Push every box onto a dot. You can only push, never pull.'; }
  };
  const pad = el('div', { class: 'g-dpad' },
    el('span', {}),
    button('↑', () => move(0, -1)),
    el('span', {}),
    button('←', () => move(-1, 0)),
    button('↺', () => load(level), 'g-mini'),
    button('→', () => move(1, 0)),
    el('span', {}),
    button('↓', () => move(0, 1)),
    el('span', {}),
  );
  stage.append(board, pad, bar(button('Next level', () => load(level + 1))), status);
  load(0);
  return {};
});

/* Sudoku 4x4 --------------------------------------------------------------- */
reg('sudoku4', (stage) => {
  let sol = [],
    grid = [],
    fixed = [];
  const status = note();
  const board = el('div', { class: 'g-sudoku' });
  const gen = () => {
    const base = [[1, 2, 3, 4], [3, 4, 1, 2], [2, 1, 4, 3], [4, 3, 2, 1]];
    const perm = shuffle([1, 2, 3, 4]);
    sol = base.map((r) => r.map((v) => perm[v - 1]));
    // shuffle rows within bands and cols within stacks (keeps validity)
    if (Math.random() < 0.5) [sol[0], sol[1]] = [sol[1], sol[0]];
    if (Math.random() < 0.5) [sol[2], sol[3]] = [sol[3], sol[2]];
    grid = sol.map((r) => r.slice());
    fixed = sol.map((r) => r.map(() => true));
    let holes = 8;
    while (holes > 0) {
      const y = randInt(0, 3),
        x = randInt(0, 3);
      if (fixed[y][x]) { fixed[y][x] = false; grid[y][x] = 0; holes--; }
    }
    draw();
  };
  const valid = () => {
    const ok = (arr) => new Set(arr).size === 4 && !arr.includes(0);
    for (let i = 0; i < 4; i++) {
      if (!ok(grid[i])) return false;
      if (!ok(grid.map((r) => r[i]))) return false;
    }
    for (const [by, bx] of [[0, 0], [0, 2], [2, 0], [2, 2]]) {
      const box = [grid[by][bx], grid[by][bx + 1], grid[by + 1][bx], grid[by + 1][bx + 1]];
      if (!ok(box)) return false;
    }
    return true;
  };
  const conflict = (y, x) => {
    const v = grid[y][x];
    if (!v) return false;
    for (let i = 0; i < 4; i++) {
      if (i !== x && grid[y][i] === v) return true;
      if (i !== y && grid[i][x] === v) return true;
    }
    const by = y - (y % 2),
      bx = x - (x % 2);
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) if ((by + dy !== y || bx + dx !== x) && grid[by + dy][bx + dx] === v) return true;
    return false;
  };
  const draw = () => {
    board.replaceChildren();
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 4; x++) {
        const v = grid[y][x];
        const cls = 'g-scell' + (fixed[y][x] ? ' fixed' : '') + (conflict(y, x) ? ' bad' : '') + ((x === 1 || x === 3) ? ' vr' : '') + ((y === 1 || y === 3) ? ' hr' : '');
        board.append(
          el('button', {
            type: 'button',
            class: cls,
            disabled: fixed[y][x],
            onClick: () => { if (!fixed[y][x]) { grid[y][x] = (grid[y][x] % 4) + 1; draw(); } },
          }, v || ''),
        );
      }
    if (valid()) { status.textContent = 'Every row, column, and box has 1 to 4. Solved!'; status.classList.add('win'); }
    else { status.classList.remove('win'); status.textContent = 'Each row, column, and box needs 1, 2, 3, 4. Tap a cell.'; }
  };
  stage.append(board, bar(button('New puzzle', gen)), status);
  gen();
  return {};
});

/* ========================================================================== *
 *  MATHS FOR MACHINES
 * ========================================================================== */

/* Derivative: the slope at a point ----------------------------------------- */
reg('derivative', (stage) => {
  const c = makeCanvas(stage, 1.5);
  const f = (x) => 0.6 * Math.sin(2 * x);
  const df = (x) => 1.2 * Math.cos(2 * x);
  let x0 = 0.3;
  const status = note();
  const px = (x) => 20 + ((x + 1.5) / 3) * (c.state.W - 40);
  const py = (y) => c.state.H / 2 - y * (c.state.H * 0.34);
  const draw = () => {
    const { ctx } = c;
    const { W, H } = c.state;
    const t = theme();
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = t.rule;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px(-1.5), py(0));
    ctx.lineTo(px(1.5), py(0));
    ctx.stroke();
    ctx.strokeStyle = t.fg;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let x = -1.5; x <= 1.5; x += 0.02) (x === -1.5 ? ctx.moveTo : ctx.lineTo).call(ctx, px(x), py(f(x)));
    ctx.stroke();
    const m = df(x0);
    ctx.strokeStyle = PINK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px(x0 - 0.6), py(f(x0) - m * 0.6));
    ctx.lineTo(px(x0 + 0.6), py(f(x0) + m * 0.6));
    ctx.stroke();
    ctx.fillStyle = BLUE;
    ctx.beginPath();
    ctx.arc(px(x0), py(f(x0)), 7, 0, 7);
    ctx.fill();
    const flat = Math.abs(m) < 0.08;
    status.classList.toggle('win', flat);
    status.textContent = `Steepness = ${m.toFixed(2)}. ` + (flat ? 'Flat! This is the top or bottom.' : m > 0 ? 'Going uphill.' : 'Going downhill.');
  };
  const s = slider('Point x', -150, 150, x0 * 100, (v) => { x0 = v / 100; draw(); });
  status.textContent = 'The pink line shows how steep the hill is at the dot. Slide it!';
  stage.append(s.node, status);
  draw();
  return {};
});

/* Integral: area as a stack of rectangles ---------------------------------- */
reg('integral', (stage) => {
  const c = makeCanvas(stage, 1.5);
  const f = (x) => 0.55 + 0.4 * Math.sin(1.8 * x);
  let n = 6;
  const status = note();
  const A = 0,
    B = 2;
  const px = (x) => 24 + (x / B) * (c.state.W - 48);
  const py = (y) => c.state.H - 22 - y * (c.state.H - 44);
  const draw = () => {
    const { ctx } = c;
    const { W, H } = c.state;
    const t = theme();
    ctx.clearRect(0, 0, W, H);
    const dx = (B - A) / n;
    let approx = 0;
    for (let i = 0; i < n; i++) {
      const xm = A + (i + 0.5) * dx;
      const h = f(xm);
      approx += h * dx;
      ctx.fillStyle = 'rgba(77,163,255,0.28)';
      ctx.strokeStyle = BLUE;
      ctx.lineWidth = 1;
      ctx.fillRect(px(A + i * dx), py(h), px(A + dx) - px(A), py(0) - py(h));
      ctx.strokeRect(px(A + i * dx), py(h), px(A + dx) - px(A), py(0) - py(h));
    }
    ctx.strokeStyle = t.fg;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let x = A; x <= B; x += 0.01) (x === A ? ctx.moveTo : ctx.lineTo).call(ctx, px(x), py(f(x)));
    ctx.stroke();
    // true area by fine sampling
    let truth = 0;
    for (let x = A; x < B; x += 0.001) truth += f(x + 0.0005) * 0.001;
    const err = Math.abs(approx - truth);
    status.classList.toggle('win', err < 0.01);
    status.textContent = `${n} blocks guess ${approx.toFixed(3)}. The real space is ${truth.toFixed(3)}. Add more blocks!`;
  };
  const s = slider('Rectangles', 2, 40, n, (v) => { n = v; draw(); });
  status.textContent = 'Fill the space under the curve with blocks. More blocks, better guess!';
  stage.append(s.node, status);
  draw();
  return {};
});

/* Vectors and the dot product ---------------------------------------------- */
reg('vectors', (stage) => {
  const c = makeCanvas(stage, 1.2);
  let a = { x: 0.6, y: 0.4 },
    b = { x: 0.5, y: -0.4 },
    sel = null;
  const status = note();
  const draw = () => {
    const { ctx } = c;
    const { W, H } = c.state;
    const t = theme();
    const f = dataFrame(W, H, 24);
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = t.rule;
    ctx.beginPath();
    ctx.moveTo(f.x(-1), f.y(0));
    ctx.lineTo(f.x(1), f.y(0));
    ctx.moveTo(f.x(0), f.y(-1));
    ctx.lineTo(f.x(0), f.y(1));
    ctx.stroke();
    const arrow = (v, col) => {
      ctx.strokeStyle = col;
      ctx.fillStyle = col;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(f.x(0), f.y(0));
      ctx.lineTo(f.x(v.x), f.y(v.y));
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(f.x(v.x), f.y(v.y), 7, 0, 7);
      ctx.fill();
    };
    arrow(a, BLUE);
    arrow(b, PINK);
    const dot = a.x * b.x + a.y * b.y;
    const ma = Math.hypot(a.x, a.y),
      mb = Math.hypot(b.x, b.y);
    const ang = (Math.acos(clamp(dot / (ma * mb || 1), -1, 1)) * 180) / Math.PI;
    status.textContent = `Agreement ${dot.toFixed(2)}, angle ${ang.toFixed(0)}°. ` + (Math.abs(dot) < 0.04 ? 'At a right angle they ignore each other.' : dot > 0 ? 'Pointing the same way.' : 'Pointing apart.');
    status.classList.toggle('win', Math.abs(dot) < 0.04);
  };
  drag(c.wrap, {
    down: (p) => {
      const f = dataFrame(c.state.W, c.state.H, 24);
      const da = (f.x(a.x) - p.x) ** 2 + (f.y(a.y) - p.y) ** 2;
      const db = (f.x(b.x) - p.x) ** 2 + (f.y(b.y) - p.y) ** 2;
      sel = da < db ? a : b;
      pt(p);
    },
    move: (p) => sel && pt(p),
    up: () => (sel = null),
  });
  const pt = (p) => {
    const f = dataFrame(c.state.W, c.state.H, 24);
    sel.x = clamp(f.ix(p.x), -1, 1);
    sel.y = clamp(f.iy(p.y), -1, 1);
    draw();
  };
  status.textContent = 'Drag the two arrows. See how much they agree.';
  stage.append(status);
  draw();
  return {};
});

/* Matrix transform --------------------------------------------------------- */
reg('matrix', (stage) => {
  const c = makeCanvas(stage, 1.2);
  let m = [1, 0, 0, 1];
  const status = note();
  const draw = () => {
    const { ctx } = c;
    const { W, H } = c.state;
    const t = theme();
    const f = dataFrame(W, H, 24);
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = t.rule;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(f.x(-1), f.y(0));
    ctx.lineTo(f.x(1), f.y(0));
    ctx.moveTo(f.x(0), f.y(-1));
    ctx.lineTo(f.x(0), f.y(1));
    ctx.stroke();
    const unit = [[0, 0], [0.6, 0], [0.6, 0.6], [0, 0.6]];
    const tf = ([x, y]) => [m[0] * x + m[1] * y, m[2] * x + m[3] * y];
    // original
    ctx.strokeStyle = t.faint;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    unit.forEach(([x, y], i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, f.x(x), f.y(y)));
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);
    // transformed
    ctx.strokeStyle = PINK;
    ctx.fillStyle = 'rgba(255,93,143,0.18)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    unit.map(tf).forEach(([x, y], i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, f.x(x), f.y(y)));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // basis vectors
    const bx = tf([0.6, 0]),
      by = tf([0, 0.6]);
    const drawB = (v, col) => { ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(f.x(0), f.y(0)); ctx.lineTo(f.x(v[0]), f.y(v[1])); ctx.stroke(); };
    drawB(bx, BLUE);
    drawB(by, MINT);
    const det = m[0] * m[3] - m[1] * m[2];
    status.textContent = `The square's size changed by ${Math.abs(det).toFixed(2)} times${det < 0 ? ', and flipped over' : ''}.`;
  };
  const names = ['a', 'b', 'c', 'd'];
  const sl = m.map((v, i) => slider(names[i], -20, 20, v * 10, (nv) => { m[i] = nv / 10; draw(); }));
  const presets = bar(
    button('Rotate', () => setM([0, -1, 1, 0])),
    button('Scale', () => setM([1.6, 0, 0, 1.6])),
    button('Shear', () => setM([1, 0.8, 0, 1])),
    button('Reset', () => setM([1, 0, 0, 1])),
  );
  const setM = (nm) => { m = nm.slice(); sl.forEach((s, i) => s.set(m[i] * 10)); draw(); };
  status.textContent = 'Four numbers bend the whole square. Try the presets!';
  stage.append(...sl.map((s) => s.node), presets, status);
  draw();
  return {};
});

/* ========================================================================== *
 *  MORE PHYSICS
 * ========================================================================== */

/* Spring: Hooke's law and simple harmonic motion --------------------------- */
reg('spring', (stage) => {
  const c = makeCanvas(stage, 1.7);
  const loop = makeLoop(tick);
  let k = 8,
    x = 0.6,
    v = 0,
    mass = 1,
    dragging = false;
  const status = note();
  function tick(dt) {
    if (!dragging) {
      const a = (-k / mass) * x;
      v += a * dt;
      v *= 0.999;
      x += v * dt;
    }
    draw();
  }
  function draw() {
    const { ctx } = c;
    const { W, H } = c.state;
    const t = theme();
    ctx.clearRect(0, 0, W, H);
    const midY = H / 2;
    const restX = W * 0.5;
    const massX = restX + x * (W * 0.3);
    // wall
    ctx.fillStyle = t.rule;
    ctx.fillRect(20, midY - 40, 8, 80);
    // coil
    ctx.strokeStyle = t.faint;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(28, midY);
    const coils = 14;
    for (let i = 0; i <= coils; i++) {
      const px = 28 + ((massX - 28) * i) / coils;
      ctx.lineTo(px, midY + (i % 2 ? -12 : 12) * (i > 0 && i < coils ? 1 : 0));
    }
    ctx.lineTo(massX, midY);
    ctx.stroke();
    // mass
    ctx.fillStyle = PINK;
    ctx.fillRect(massX - 18, midY - 18, 36, 36);
    const T = 2 * Math.PI * Math.sqrt(mass / k);
    ctx.fillStyle = t.faint;
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`stiffness k = ${k.toFixed(0)}   period T = ${T.toFixed(2)}s`, W / 2, H - 14);
  }
  drag(c.wrap, {
    down: (p) => { dragging = true; setX(p); },
    move: (p) => dragging && setX(p),
    up: () => { dragging = false; v = 0; },
  });
  const setX = (p) => {
    const { W } = c.state;
    x = clamp((p.x - W * 0.5) / (W * 0.3), -1, 1);
  };
  const s = slider('Stiffness', 2, 30, k, (v2) => (k = v2));
  status.textContent = 'Pull the block and let go. A stiffer spring bounces faster.';
  stage.append(s.node, status);
  draw();
  return { pause: loop.stop, resume: loop.start };
});

/* Elastic collision of two carts ------------------------------------------- */
reg('collide', (stage) => {
  const c = makeCanvas(stage, 2.0);
  const loop = makeLoop(tick);
  let m1 = 1,
    m2 = 3;
  let a, b;
  const status = note();
  const reset = () => {
    a = { x: 0.18, v: 0.9, m: m1 };
    b = { x: 0.7, v: -0.3, m: m2 };
    status.classList.remove('win');
  };
  const size = (m) => 18 + Math.cbrt(m) * 16;
  function tick(dt) {
    const { W } = c.state;
    a.x += a.v * dt * 0.4;
    b.x += b.v * dt * 0.4;
    const ra = size(a.m) / W,
      rb = size(b.m) / W;
    // walls
    if (a.x < ra) { a.x = ra; a.v = Math.abs(a.v); }
    if (b.x > 1 - rb) { b.x = 1 - rb; b.v = -Math.abs(b.v); }
    if (a.x < ra) a.v = Math.abs(a.v);
    // collision
    if (a.x + ra > b.x - rb && a.v > b.v) {
      const va = a.v,
        vb = b.v;
      a.v = ((a.m - b.m) * va + 2 * b.m * vb) / (a.m + b.m);
      b.v = ((b.m - a.m) * vb + 2 * a.m * va) / (a.m + b.m);
    }
    if (b.x < rb) { b.x = rb; b.v = Math.abs(b.v); }
    draw();
  }
  function draw() {
    const { ctx } = c;
    const { W, H } = c.state;
    const t = theme();
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = t.rule;
    ctx.beginPath();
    ctx.moveTo(0, H - 20);
    ctx.lineTo(W, H - 20);
    ctx.stroke();
    const box = (o, col) => {
      const s = size(o.m);
      ctx.fillStyle = col;
      ctx.fillRect(o.x * W - s / 2, H - 20 - s, s, s);
    };
    box(a, BLUE);
    box(b, PINK);
    const p = (a.m * a.v + b.m * b.v).toFixed(2);
    ctx.fillStyle = t.faint;
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`total momentum ${p} (conserved)`, W / 2, 18);
  }
  const s1 = slider('Blue mass', 1, 9, m1, (v) => { m1 = v; reset(); });
  const s2 = slider('Pink mass', 1, 9, m2, (v) => { m2 = v; reset(); });
  status.textContent = 'Smash the carts! A heavy one barely moves when a light one hits it.';
  stage.append(s1.node, s2.node, bar(button('Launch', reset)), status);
  reset();
  draw();
  return { pause: loop.stop, resume: loop.start };
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
  const set = (v) => {
    input.value = String(v);
    out.textContent = Math.round(Number(v)) + unit;
  };
  return { node, input, set };
}

/* --- bootstrap: the searchable, paginated gallery -------------------------- */
function boot() {
  const root = document.querySelector('.surprised');
  if (!root) return;
  const cards = [...root.querySelectorAll('.game[data-game]')];
  const search = root.querySelector('#arcade-search');
  const chips = [...root.querySelectorAll('.arcade-chip[data-cat]')];
  const pager = root.querySelector('#arcade-pager');
  const countEl = root.querySelector('#arcade-count');
  const heading = root.querySelector('#arcade-heading');
  const empty = root.querySelector('#arcade-empty');
  const grid = root.querySelector('#arcade-grid');
  const PAGE = 12;
  let cat = 'all';
  let q = '';
  let page = 0;

  const mount = (card) => {
    if (card.__inited) return;
    card.__inited = true;
    const stage = card.querySelector('[data-stage]');
    const factory = GAMES[card.dataset.game];
    if (!stage || !factory) return;
    stage.classList.add('is-ready');
    stage.replaceChildren();
    try {
      card.__handle = factory(stage) || {};
    } catch (err) {
      console.error('[surprised]', card.dataset.game, err);
      stage.append(el('p', { class: 'g-note' }, 'This one hit a snag on your browser.'));
    }
  };

  // Pause a running game once it scrolls out of view; resume when it returns.
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const card = e.target;
        if (card.classList.contains('is-hidden')) continue;
        const h = card.__handle;
        if (!h) continue;
        if (e.isIntersecting) h.resume && h.resume();
        else h.pause && h.pause();
      }
    },
    { rootMargin: '200px 0px' },
  );
  cards.forEach((c) => io.observe(c));

  const matches = (card) =>
    (cat === 'all' || card.dataset.cat === cat) && (!q || (card.dataset.search || '').includes(q));

  const pbtn = (label, fn, disabled, active) =>
    el('button', { type: 'button', class: 'arcade-page' + (active ? ' on' : ''), disabled, onClick: fn }, label);

  const toGrid = () => grid && grid.scrollIntoView({ behavior: 'smooth', block: 'start' });

  function render() {
    const shown = cards.filter(matches);
    const pages = Math.max(1, Math.ceil(shown.length / PAGE));
    page = clamp(page, 0, pages - 1);
    const start = page * PAGE;
    const onPage = new Set(shown.slice(start, start + PAGE));
    for (const card of cards) {
      const on = onPage.has(card);
      card.classList.toggle('is-hidden', !on);
      if (on) {
        mount(card);
        card.__handle && card.__handle.resume && card.__handle.resume();
      } else {
        card.__handle && card.__handle.pause && card.__handle.pause();
      }
    }
    const activeChip = chips.find((c) => c.dataset.cat === cat);
    if (heading) heading.textContent = activeChip ? activeChip.dataset.label : 'All games';
    if (countEl) countEl.textContent = shown.length
      ? `${shown.length} game${shown.length > 1 ? 's' : ''}` + (cat !== 'all' || q ? ' shown' : '')
      : 'nothing matches';
    if (empty) empty.hidden = shown.length > 0;
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.cat === cat)));
    if (pager) {
      pager.replaceChildren();
      if (pages > 1) {
        pager.append(pbtn('Prev', () => { page--; render(); toGrid(); }, page === 0));
        for (let i = 0; i < pages; i++) pager.append(pbtn(String(i + 1), () => { page = i; render(); toGrid(); }, false, i === page));
        pager.append(pbtn('Next', () => { page++; render(); toGrid(); }, page === pages - 1));
      }
    }
  }

  chips.forEach((ch) => ch.addEventListener('click', () => { cat = ch.dataset.cat; page = 0; render(); }));
  if (search) search.addEventListener('input', () => { q = search.value.trim().toLowerCase(); page = 0; render(); });

  const jump = () => {
    const m = location.hash.match(/^#game-(.+)$/);
    if (!m) return;
    const card = cards.find((c) => c.dataset.game === m[1]);
    if (!card) return;
    cat = 'all';
    q = '';
    if (search) search.value = '';
    const idx = cards.filter(matches).indexOf(card);
    page = Math.max(0, Math.floor(idx / PAGE));
    render();
    card.scrollIntoView({ block: 'center' });
  };

  render();
  if (location.hash) jump();
  window.addEventListener('hashchange', jump);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
