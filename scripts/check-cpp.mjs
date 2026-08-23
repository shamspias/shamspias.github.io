/**
 * Compiles every C and C++ code block in the posts.
 *
 *   node scripts/check-cpp.mjs [file ...]
 *
 * A tutorial that ships code which does not compile is worse than one that
 * ships none, because the reader trusts it and pastes it. So every ```cpp and
 * ```c block is handed to the compiler. Blocks are fragments as often as whole
 * programs, so each is tried three ways and passes if any way is accepted:
 *
 *   1. as written        (a complete program, with its own main and includes)
 *   2. at file scope     (a function definition, wrapped with common headers)
 *   3. inside a function (a loose run of statements)
 *
 * Blocks that are deliberately not meant to compile, an error being shown on
 * purpose, carry the info string `cpp no-compile` and are skipped.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const DIR = 'src/content/blog';
const CXX = process.env.CXX ?? 'clang++';
const CC = process.env.CC ?? 'clang';

// Apple clang has no <bits/stdc++.h>, so the umbrella is spelled out. These are
// the headers the examples in this series draw on.
const PREAMBLE = `
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <cmath>
#include <cstdint>
#include <vector>
#include <string>
#include <array>
#include <algorithm>
#include <numeric>
#include <unordered_map>
#include <unordered_set>
#include <map>
#include <set>
#include <queue>
#include <stack>
#include <deque>
#include <tuple>
#include <utility>
#include <functional>
#include <limits>
#include <iostream>
using namespace std;
`;

const files =
  process.argv.length > 2
    ? process.argv.slice(2)
    : readdirSync(DIR)
        .filter((f) => f.endsWith('.md'))
        .map((f) => path.join(DIR, f))
        .sort();

const tmp = mkdtempSync(path.join(tmpdir(), 'cppcheck-'));

let blocks = 0;
let failures = 0;

function tryCompile(source, isC) {
  const ext = isC ? '.c' : '.cpp';
  const file = path.join(tmp, `s${blocks}_${Math.abs(hash(source))}${ext}`);
  writeFileSync(file, source);
  try {
    execFileSync(isC ? CC : CXX, [
      '-std=' + (isC ? 'c11' : 'c++17'),
      '-fsyntax-only',
      '-w',
      file,
    ], { stdio: 'pipe' });
    return null;
  } catch (e) {
    return (e.stderr?.toString() || e.message).split('\n').filter(Boolean).slice(0, 4).join('\n');
  }
}

// A stable id for the temp file name, no Date/random needed.
function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

for (const file of files) {
  const raw = readFileSync(file, 'utf8');
  const fences = [...raw.matchAll(/^```([^\n]*)\n([\s\S]*?)^```/gm)];

  // A reader builds the file up block by block, so a struct defined in one
  // block is in scope for the next. The checker does the same: file-scope
  // definitions accumulate into a context that later blocks are compiled
  // against. Kept per language so a C block does not see C++ definitions.
  const context = { cpp: '', c: '' };
  for (const [, infoRaw, code] of fences) {
    const info = infoRaw.trim();
    const lang = info.split(/\s+/)[0];
    if (lang !== 'cpp' && lang !== 'c') continue;
    if (info.includes('no-compile')) continue;
    blocks++;
    const isC = lang === 'c';

    // A block often mixes `#include`/`using` directives with the code they
    // enable. Those must sit at file scope even when the rest is wrapped in a
    // function, so they are hoisted out before wrapping.
    const lines = code.split('\n');
    const directives = lines.filter((l) => /^\s*(#\s*include|#\s*define|using\s)/.test(l));
    const body = lines.filter((l) => !/^\s*(#\s*include|#\s*define|using\s)/.test(l)).join('\n');
    const hoist = directives.join('\n');

    const ctx = context[lang];
    const isMain = /\bint\s+main\b/.test(code);

    // Ordered from "definition seen against earlier blocks" to "standalone
    // loose statements". The first that compiles wins.
    const attempts = [
      { src: PREAMBLE + '\n' + ctx + '\n' + code, learn: !isMain }, // defs, in context
      { src: PREAMBLE + '\n' + code, learn: false }, // defs, standalone
      { src: PREAMBLE + '\n' + ctx + '\n' + hoist + '\nvoid __demo__() {\n' + body + '\n}\n', learn: false },
      { src: PREAMBLE + '\n' + hoist + '\nvoid __demo__() {\n' + body + '\n}\n', learn: false },
      { src: code, learn: false }, // a complete program as written
    ];
    let ok = false;
    let lastErr = '';
    for (const { src, learn } of attempts) {
      const err = tryCompile(src, isC);
      if (err === null) {
        ok = true;
        // Only a definition that compiled *against the context* is added, so a
        // block that only compiled standalone (a redefinition, say) does not
        // poison what follows.
        if (learn) context[lang] = ctx + '\n' + code;
        break;
      }
      lastErr = err;
    }
    if (!ok) {
      failures++;
      console.log(`  ${path.basename(file)}\n    a ${lang} block does not compile:`);
      console.log(
        lastErr.split('\n').map((l) => '      ' + l).join('\n'),
      );
      console.log('      ---\n' + code.split('\n').slice(0, 3).map((l) => '      | ' + l).join('\n'));
    }
  }
}

rmSync(tmp, { recursive: true, force: true });

console.log(
  failures === 0
    ? `\n${blocks} C/C++ blocks, all compile.`
    : `\n${blocks} C/C++ blocks, ${failures} do not compile.`,
);
process.exit(failures > 0 ? 1 : 0);
