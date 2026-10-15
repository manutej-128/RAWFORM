/**
 * SlopMonster detector — TypeScript port of tools/deslop.py.
 *
 * The catalogue, the regexes, the windows, the floors and the scoring are a
 * line-for-line transcription of the original Python tool, which remains in
 * this repo at tools/deslop.py as the reference implementation and CLI.
 * Running the rules in-process removes the Python child process, so the app
 * cannot fail with a spawn, PATH or timeout error on any machine or host.
 *
 * Parity is checked by scripts/parity.mjs, which scores the same inputs with
 * both engines and compares the results.
 */

export type Finding = { phrase: string; count: number; example?: string };
export type Category = { key: string; title: string; items: Finding[] };
export type Report = {
  score: number;
  wordCount: number;
  categories: Category[];
  clean: boolean;
};

/* ── the catalogue ──────────────────────────────────────────────────── */

const VOCAB = [
  "delve", "leverage", "seamless", "elevate", "robust", "unlock", "unleash",
  "empower", "streamline", "cutting-edge", "state-of-the-art", "game-changer",
  "game-changing", "revolutionize", "revolutionise", "transformative",
  "transformation", "innovate", "holistic", "synergy", "synergies", "paradigm",
  "bespoke", "meticulous", "tapestry", "testament", "beacon", "unparalleled",
  "supercharge", "turbocharge", "effortless", "next-level",
  "pivotal", "foster", "showcase", "compelling", "intuitive", "world-class",
  "best-in-class",
];

const VOCAB_EXACT = [
  "crafted", "curated", "harnessing", "harness the power", "journey", "realm",
  "landscape", "navigate the", "in the world of", "in today's", "ever-evolving",
  "fast-paced", "look no further", "dive in", "let's dive", "deep dive",
  "embark", "unlock the power", "buckle up", "the secret sauce", "level up",
];

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** A regex source matching `word` and its inflections. */
function rootPattern(word: string): string {
  const root = word.replace(/(ed|ing|ly|e)$/, "");
  if (root.length < 4) {
    return `(?<!\\w)${escapeRegex(word)}(?!\\w)`;
  }
  return `(?<!\\w)${escapeRegex(root)}(?:e|es|ed|ing|ion|ions|ional|ive|al|ally|s|ly|ness)?(?!\\w)`;
}

const NEG_JUST = "(?:\\bnot|n['\u2019]t)\\s+(?:just|only|merely|simply)\\b";
const XY_TAIL = "[^!?]{0,80}?[,.]\\s*(?:it|this|that|they|we|you|he|she|i)\\b";

const PHRASES: [string, string][] = [
  [NEG_JUST + "[^.!?]{0,80}\\bbut\\b", "the 'not just X, but Y' construction"],
  [NEG_JUST + XY_TAIL, "the 'not just X, it's Y' construction"],
  ["\\bwhether you(?:'?re| are)\\b[^.!?]{0,40}\\bor\\b", "the 'whether you're X or Y' opener"],
  ["\\bmore than just\\b", "'more than just'"],
  ["\\b(that|this)(?:'?s| is) where\\b[^.!?]{0,30}\\bcomes? in\\b", "'that's where X comes in'"],
  ["\\bsay goodbye to\\b", "'say goodbye to'"],
  ["\\bimagine (a|an|the)\\b", "the 'imagine a…' opener"],
  ["\\bin conclusion\\b|\\bto sum up\\b", "essay-summary phrasing"],
  ["\\bwhen it comes to\\b", "'when it comes to' filler"],
  ["\\bat the end of the day\\b", "'at the end of the day'"],
  ["\\bthe key is\\b|\\bthe truth is\\b", "throat-clearing opener"],
  ["\\bhelps? you to\\b|\\bcan help you\\b", "hedged benefit ('helps you to…')"],
  ["\\bmay potentially\\b|\\bcould potentially\\b|\\bmight possibly\\b", "stacked hedging"],
  ["\\bvery unique\\b|\\bquite literally\\b", "intensifier padding"],
  ["\\bhere'?s the thing\\b|\\blet'?s break (it|this) down\\b|\\bthe best part\\b", "throat-clearing opener"],
  ["\\bready to get started\\b|\\blet'?s get started\\b", "boilerplate CTA"],
  ["\\bthe (result|answer|catch|kicker|upshot)\\?\\s", "self-answering question"],
];

const COMPOUND = /\b[a-z]{2,}-[a-z]{2,}(?:-[a-z]{2,})*\b/gi;
const COMPOUND_FLOOR = 4;

const PROOF = new RegExp(
  "([\\d][\\d,]*(?:\\.\\d+)?)\\s*\\+?\\s*" +
    "((?:happy|early|active|satisfied|verified|trusted|delighted)\\s+)?" +
    "(?:\\w+\\s+){0,1}" +
    "(users?|customers?|learners?|students?|teams?|members?|companies|businesses" +
    "|homeowners?|subscribers?|clients?|patients?|readers?|sites?|projects?)" +
    "(?!\\w)",
  "gi"
);

const RHYTHM: string[] = [
  "\\b(\\w{4,}),\\s+(\\w{4,}),\\s+and\\s+(\\w{4,})\\b",
  "\\b(\\w{4,}),\\s+(\\w{4,})\\s+and\\s+((?:\\w+\\s+){1,2}\\w+)\\s*[.!?,;:]",
];

/* ── helpers ────────────────────────────────────────────────────────── */

/** Fold typographic variants back to the plain ones the rules match. */
export function normalise(text: string): string {
  const folded = text
    .replace(/\u2011/g, "-")
    .replace(/\u00a0/g, " ")
    .replace(/\u2019/g, "'");
  return folded.replace(/\s+/g, " ").trim();
}

function countMatches(source: string, pattern: string, flags: string): number {
  const re = new RegExp(pattern, flags.includes("g") ? flags : flags + "g");
  let n = 0;
  while (re.exec(source) !== null) {
    n += 1;
    if (re.lastIndex === 0) break;
  }
  return n;
}

function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/);
}

function occurrences(haystack: string, needle: string): number {
  let n = 0;
  let i = haystack.indexOf(needle);
  while (i !== -1) {
    n += 1;
    i = haystack.indexOf(needle, i + needle.length);
  }
  return n;
}

/* ── audit ──────────────────────────────────────────────────────────── */

type Hits = {
  vocab: [string, number][];
  phrases: [string, number][];
  punctuation: [string, string][];
  rhythm: [string, string][];
  proof: string[];
};

export function audit(text: string): Hits {
  const hits: Hits = { vocab: [], phrases: [], punctuation: [], rhythm: [], proof: [] };
  const low = text.toLowerCase();

  for (const w of VOCAB) {
    const n = countMatches(low, rootPattern(w), "g");
    if (n) hits.vocab.push([w, n]);
  }

  for (const w of VOCAB_EXACT) {
    const n = countMatches(low, `(?<!\\w)${escapeRegex(w)}(?!\\w)`, "g");
    if (n) hits.vocab.push([w, n]);
  }

  for (const [pat, label] of PHRASES) {
    const n = countMatches(low, pat, "g");
    if (n) hits.phrases.push([label, n]);
  }

  // Em-dash density, bounded to 220-character windows.
  for (const s of splitSentences(text)) {
    for (let i = 0; i < Math.max(1, s.length); i += 220) {
      const win = s.slice(i, i + 220);
      if (occurrences(win, "\u2014") >= 2) {
        hits.punctuation.push([
          "two or more em-dashes in one sentence",
          win.slice(0, 70).trim(),
        ]);
        break;
      }
    }
  }

  // Stacked hyphenated compounds.
  for (const s of splitSentences(text)) {
    for (let i = 0; i < Math.max(1, s.length); i += 220) {
      const win = s.slice(i, i + 220);
      const found = win.match(COMPOUND) ?? [];
      if (found.length >= COMPOUND_FLOOR) {
        hits.punctuation.push([
          `${found.length} hyphenated compounds stacked in one sentence`,
          found.slice(0, 4).join(", "),
        ]);
        break;
      }
    }
  }

  // Semicolon density, with a floor that scales with length.
  const semis = occurrences(text, ";");
  if (semis > Math.max(3, Math.floor(text.length / 1200))) {
    hits.punctuation.push(["semicolon-heavy for web copy", `${semis} found`]);
  }

  // Rule-of-three rhythm.
  for (const pat of RHYTHM) {
    const re = new RegExp(pat, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      hits.rhythm.push(["rule-of-three list", m[0].slice(0, 60)]);
      if (m.index === re.lastIndex) re.lastIndex += 1;
    }
  }

  // Possible invented proof.
  const proofRe = new RegExp(PROOF.source, "gi");
  let pm: RegExpExecArray | null;
  while ((pm = proofRe.exec(text)) !== null) {
    hits.proof.push(pm[0].trim());
    if (pm.index === proofRe.lastIndex) proofRe.lastIndex += 1;
  }

  return hits;
}

/* ── report ─────────────────────────────────────────────────────────── */

const TITLES: Record<keyof Hits, string> = {
  vocab: "AI vocabulary",
  phrases: "AI constructions",
  punctuation: "punctuation cadence",
  rhythm: "rule-of-three rhythm",
  proof: "possible invented proof",
};

const ORDER: (keyof Hits)[] = ["proof", "phrases", "vocab", "punctuation", "rhythm"];

/** Score text out of 5 and group every finding, exactly as deslop.py reports. */
export function analyse(raw: string): Report | null {
  const text = normalise(raw);
  if (!text.split(/\s+/).filter(Boolean).length) return null;

  const hits = audit(text);

  const failed = ORDER.filter((k) => hits[k].length > 0);
  const score = Math.max(0, 5 - failed.length);

  const categories: Category[] = [];
  for (const key of ORDER) {
    const items = hits[key];
    if (!items.length) continue;

    const counts = new Map<string, number>();
    const examples = new Map<string, string>();

    for (const item of items) {
      if (Array.isArray(item)) {
        const label = String(item[0]);
        const second = item[1];
        if ((key === "vocab" || key === "phrases") && typeof second === "number") {
          counts.set(label, (counts.get(label) ?? 0) + second);
        } else {
          counts.set(label, (counts.get(label) ?? 0) + 1);
          if (!examples.has(label) && typeof second === "string") {
            examples.set(label, second);
          }
        }
      } else {
        const label = String(item);
        counts.set(label, (counts.get(label) ?? 0) + 1);
      }
    }

    categories.push({
      key,
      title: TITLES[key],
      items: [...counts.entries()].map(([phrase, count]) => {
        const example = examples.get(phrase);
        return example ? { phrase, count, example } : { phrase, count };
      }),
    });
  }

  return {
    score,
    wordCount: text.split(/\s+/).filter(Boolean).length,
    categories,
    clean: score === 5,
  };
}
