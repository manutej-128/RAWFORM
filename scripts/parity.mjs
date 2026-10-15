/**
 * Parity check: score the same inputs with the original Python detector
 * (tools/deslop.py via tools/analyze.py) and the in-process TypeScript port
 * (src/lib/deslop.ts), then compare score, word count and every finding.
 *
 *   node scripts/parity.mjs
 *
 * Requires Python 3 for the reference side only. The app itself does not.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SAMPLES = [
  "It's not just a tool, it's a game-changing journey.",
  "We leverage seamless synergy to elevate your workflow.",
  "The quick brown fox jumps over the lazy dog.",
  "Whether you are a beginner or a pro, start here.",
  "This is where Acme comes in. Say goodbye to guesswork.",
  "Trusted, reliable and built to last.",
  "It is faster, smarter, and better.",
  "Inspection, repair and replacement for homes and commercial buildings.",
  "Join 10,000 happy customers who delve into our robust platform.",
  "Our industry-leading, context-aware, best-in-class, AI-powered platform ships today.",
  "We craft furniture by hand in Leeds. Harness the horse before you load the cart.",
  "In today's fast-paced world, let's dive in and unlock the power of synergy.",
  "The result? Teams ship faster. Here's the thing. Ready to get started?",
  "A quiet morning; a cold room; a long walk; a short letter; nothing more.",
  "He paused \u2014 thought about it \u2014 then left without another word.",
  "Acme elevates, empowers and revolutionizes the ever-evolving landscape of work.",
  "Plain prose about a train timetable, written without any marketing at all.",
  "May potentially help you to navigate the realm of bespoke solutions.",
  "",
  "   ",
];

function pythonReport(text) {
  const res = spawnSync("python3", ["tools/analyze.py"], {
    input: text,
    encoding: "utf-8",
  });
  if (res.error || res.status !== 0) return { unavailable: true };
  try {
    return JSON.parse(res.stdout);
  } catch {
    return { unavailable: true };
  }
}

async function loadTsEngine() {
  // Compile the port on the fly with the project's TypeScript, so this script
  // runs with plain node and no extra dependency.
  const src = readFileSync("src/lib/deslop.ts", "utf-8");
  const ts = (await import("typescript")).default;
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const dir = mkdtempSync(join(tmpdir(), "rawform-"));
  const file = join(dir, "deslop.mjs");
  writeFileSync(file, js, "utf-8");
  return import(file);
}

const { analyse } = await loadTsEngine();

let checked = 0;
let skipped = 0;
const failures = [];

for (const sample of SAMPLES) {
  const py = pythonReport(sample);
  const ts = analyse(sample);

  if (py.unavailable) {
    skipped += 1;
    continue;
  }

  // Empty input: Python reports an error object, the port returns null.
  if (py.error) {
    if (ts !== null) failures.push({ sample, why: "port scored text Python refused" });
    checked += 1;
    continue;
  }

  if (ts === null) {
    failures.push({ sample, why: "port returned null, Python scored it" });
    checked += 1;
    continue;
  }

  const norm = (r) => ({
    score: r.score,
    wordCount: r.wordCount,
    categories: r.categories
      .map((c) => ({
        key: c.key,
        items: c.items
          .map((i) => `${i.phrase}|${i.count}|${i.example ?? ""}`)
          .sort(),
      }))
      .sort((a, b) => a.key.localeCompare(b.key)),
  });

  const a = JSON.stringify(norm(py));
  const b = JSON.stringify(norm(ts));
  if (a !== b) failures.push({ sample, python: a, port: b });
  checked += 1;
}

console.log(`samples compared : ${checked}`);
console.log(`samples skipped  : ${skipped} (python3 unavailable)`);
console.log(`mismatches       : ${failures.length}`);

for (const f of failures) {
  console.log("\n--- MISMATCH ---");
  console.log("input :", JSON.stringify(f.sample));
  if (f.why) console.log("why   :", f.why);
  if (f.python) console.log("python:", f.python);
  if (f.port) console.log("port  :", f.port);
}

process.exit(failures.length === 0 ? 0 : 1);
