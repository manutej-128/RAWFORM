/**
 * Local rule-based improver — TypeScript port of tools/humanize.py.
 *
 * Deterministic, offline, in-process. No model, no network, no API key.
 * It unwinds the stock constructions and replaces the generic vocabulary
 * named in SlopMonster's references/signs-of-ai-writing.md. It invents
 * nothing, and when it finds nothing safe to change it says so and returns
 * the text exactly as written.
 */

export type Rewrite = {
  rewritten: string;
  changed: boolean;
  changes: string[];
};

/** Keep the leading capital of whatever we replaced. */
function matchCase(original: string, replacement: string): string {
  if (!original || !replacement) return replacement;
  if (original[0] === original[0].toUpperCase() && original[0] !== original[0].toLowerCase()) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

const VOCAB_MAP: [RegExp, string][] = [
  [/\bdelve into\b/gi, "examine"],
  [/\bdelve\b/gi, "explore"],
  [/\bleverages\b/gi, "uses"],
  [/\bleveraging\b/gi, "using"],
  [/\bleveraged\b/gi, "used"],
  [/\bleverage\b/gi, "use"],
  [/\bseamlessly\b/gi, "smoothly"],
  [/\bseamless\b/gi, "smooth"],
  [/\belevates\b/gi, "improves"],
  [/\belevating\b/gi, "improving"],
  [/\belevated\b/gi, "improved"],
  [/\belevate\b/gi, "improve"],
  [/\brobust\b/gi, "reliable"],
  [/\bunlock the power of\b/gi, "use"],
  [/\bunlocks\b/gi, "opens"],
  [/\bunlocking\b/gi, "opening"],
  [/\bunlock\b/gi, "open"],
  [/\bunleash the power of\b/gi, "use"],
  [/\bunleashes\b/gi, "releases"],
  [/\bunleash\b/gi, "release"],
  [/\bempowers\b/gi, "enables"],
  [/\bempowering\b/gi, "enabling"],
  [/\bempower\b/gi, "enable"],
  [/\bstreamlines\b/gi, "simplifies"],
  [/\bstreamlining\b/gi, "simplifying"],
  [/\bstreamline\b/gi, "simplify"],
  [/\bcutting-edge\b/gi, "modern"],
  [/\bstate-of-the-art\b/gi, "modern"],
  [/\bgame-changer\b/gi, "major shift"],
  [/\bgame-changing\b/gi, "significant"],
  [/\brevolutionizes\b/gi, "changes"],
  [/\brevolutionises\b/gi, "changes"],
  [/\brevolutionize\b/gi, "change"],
  [/\brevolutionise\b/gi, "change"],
  [/\btransformative\b/gi, "meaningful"],
  [/\btransformation\b/gi, "change"],
  [/\bholistic\b/gi, "complete"],
  [/\bsynergies\b/gi, "coordination"],
  [/\bsynergy\b/gi, "coordination"],
  [/\bparadigm shift\b/gi, "major change"],
  [/\bparadigm\b/gi, "model"],
  [/\bbespoke\b/gi, "custom"],
  [/\bmeticulously\b/gi, "carefully"],
  [/\bmeticulous\b/gi, "careful"],
  [/\btapestry\b/gi, "mix"],
  [/\btestament\b/gi, "evidence"],
  [/\bbeacon\b/gi, "guide"],
  [/\bunparalleled\b/gi, "exceptional"],
  [/\bsupercharges\b/gi, "accelerates"],
  [/\bsupercharge\b/gi, "accelerate"],
  [/\bturbocharge\b/gi, "speed up"],
  [/\beffortlessly\b/gi, "easily"],
  [/\beffortless\b/gi, "simple"],
  [/\bnext-level\b/gi, "advanced"],
  [/\bpivotal\b/gi, "key"],
  [/\bfosters\b/gi, "supports"],
  [/\bfoster\b/gi, "support"],
  [/\bshowcases\b/gi, "shows"],
  [/\bshowcase\b/gi, "show"],
  [/\bcompelling\b/gi, "persuasive"],
  [/\bintuitive\b/gi, "straightforward"],
  [/\bworld-class\b/gi, "high quality"],
  [/\bbest-in-class\b/gi, "top tier"],
  [/\bharness the power of\b/gi, "use"],
  [/\bharnessing\b/gi, "using"],
  [/\bnavigate the landscape\b/gi, "navigate the field"],
  [/\bin the realm of\b/gi, "in"],
  [/\brealm\b/gi, "area"],
  [/\blandscape\b/gi, "environment"],
  [/\bin today's fast-paced world\b/gi, "today"],
  [/\bin today's world\b/gi, "today"],
  [/\bin the world of\b/gi, "in"],
  [/\bever-evolving\b/gi, "evolving"],
  [/\bfast-paced\b/gi, "active"],
  [/\blook no further\b/gi, "here is what you need"],
  [/\bdive deep\b/gi, "explore in detail"],
  [/\bdeep dive\b/gi, "detailed look"],
  [/\blet's dive in\b/gi, "let us begin"],
  [/\bdive in\b/gi, "begin"],
  [/\bembark on\b/gi, "begin"],
  [/\bembark\b/gi, "start"],
  [/\bbuckle up\b/gi, "get ready"],
  [/\bthe secret sauce\b/gi, "the main factor"],
  [/\blevel up\b/gi, "advance"],
  [/\bjourney\b/gi, "process"],
  [/\bplethora\b/gi, "wealth"],
  [/\bmyriad\b/gi, "many"],
  [/\bit'?s important to note\b/gi, "note"],
  [/\bit is important to note\b/gi, "note"],
  [/\bit'?s worth noting\b/gi, "note"],
  [/\bit is worth noting\b/gi, "note"],
  [/\bthat being said\b/gi, "however"],
];

/**
 * Openers that get deleted outright. Each captures the character that follows
 * so the sentence it exposes keeps its capital letter.
 */
const OPENER_CUTS: [RegExp, string][] = [
  [
    /\bwhether you(?:'?re| are)\b[^.!?]{0,50}\bor\b[^.!?]{0,50},\s*(\S)/gi,
    "Removed a 'whether you're X or Y' opener",
  ],
  [/\b(?:the key is|the truth is)\s+(?:that\s+)?(\S)/gi, "Removed a throat-clearing opener"],
  [/\bhere'?s the thing[.:,\s]+(\S)/gi, "Removed \u201chere's the thing\u201d"],
  [
    /\blet'?s break (?:it|this) down[.:,\s]+(\S)/gi,
    "Removed \u201clet's break this down\u201d",
  ],
];

const PHRASE_FIXES: [RegExp, string, string][] = [
  [/\bsay goodbye to\b/gi, "replace", "Replaced 'say goodbye to'"],
  [/\bmore than just\b/gi, "more than", "Tightened 'more than just'"],
  [/\bat the end of the day\b/gi, "ultimately", "Cut 'at the end of the day'"],
  [/\bwhen it comes to\b/gi, "for", "Cut 'when it comes to' filler"],
  [/\bready to get started\?\s*/gi, "Get started. ", "Turned a boilerplate CTA into a statement"],
  [/\blet'?s get started\b/gi, "start here", "Turned a boilerplate CTA into a statement"],
  [/\b(?:in conclusion|to sum up)\b/gi, "in summary", "Replaced essay-summary phrasing"],
  [/\bmay potentially\b/gi, "may", "Unstacked a double hedge"],
  [/\bcould potentially\b/gi, "could", "Unstacked a double hedge"],
  [/\bmight possibly\b/gi, "might", "Unstacked a double hedge"],
  [/\bvery unique\b/gi, "unique", "Dropped a redundant intensifier"],
  [/\bquite literally\b/gi, "literally", "Dropped a redundant intensifier"],
  [/\bhelps? you to\b/gi, "helps you", "Used the direct verb"],
  [/\bcan help you\b/gi, "helps you", "Used the direct verb"],
];

const NEG_JUST_CLAUSE =
  /(?:\b(?:it|this|that)\s*(?:'s|\u2019s|\s+is|\s+was)?\s*(?:not|n['\u2019]t)|(?:\bnot|n['\u2019]t))\s+(?:just|only|merely|simply)\b[^.!?]{0,80}?(?:[,.]\s*(?:it|this|that|they|we|you|he|she|i)\b|[,.]?\s*\bbut\b)[^.!?]*/gi;

export function improve(input: string): Rewrite {
  if (!input) return { rewritten: input, changed: false, changes: [] };

  const original = input;
  let t = input.replace(/\u2011/g, "-").replace(/\u00a0/g, " ");
  const changes: string[] = [];

  const note = (label: string) => {
    if (!changes.includes(label)) changes.push(label);
  };

  // 1. "It's not just X, it's Y" / "not just X, but Y" — keep the real claim.
  {
    const before = t;
    t = t.replace(NEG_JUST_CLAUSE, (full) => {
      const split = /[,.]\s+(it|this|that|they|we|you|he|she|i)\b/i.exec(full);
      if (split && split.index !== undefined) {
        return matchCase(full, full.slice(split.index).replace(/^[,.\s]+/, ""));
      }
      const butM = /[,.]?\s*\bbut\b\s*/i.exec(full);
      if (butM && butM.index !== undefined) {
        return matchCase(full, full.slice(butM.index + butM[0].length));
      }
      return full;
    });
    if (t !== before) note("Cut the 'not just X, it's Y' construction");
  }

  // 2. Deleted openers — the exposed sentence keeps its capital.
  for (const [re, label] of OPENER_CUTS) {
    const before = t;
    t = t.replace(re, (_full, next: string) => next.toUpperCase());
    if (t !== before) note(label);
  }

  // 3. "that's where X comes in" — say what X does.
  {
    const before = t;
    t = t.replace(
      /\b(?:that|this)(?:'?s| is) where\b\s+([^.!?]{1,30}?)\s+comes?\s+in\b/gi,
      (full, subject: string) => {
        const s = subject.trim();
        return matchCase(full, `${s} ${s.endsWith("s") ? "helps" : "provides this"}`);
      }
    );
    if (t !== before) note("Rewrote 'that's where X comes in'");
  }

  // 4. Stock phrases.
  for (const [re, rep, label] of PHRASE_FIXES) {
    const before = t;
    t = t.replace(re, (m) => matchCase(m, rep));
    if (t !== before) note(label);
  }

  // 5. Generic vocabulary.
  {
    const before = t;
    for (const [re, rep] of VOCAB_MAP) {
      t = t.replace(re, (m) => matchCase(m, rep));
    }
    if (t !== before) note("Swapped generic wording for plain terms");
  }

  // Tidy the seams left by removed clauses.
  t = t
    .replace(/[ \t]+/g, " ")
    .replace(/\s+([,.:;?!])/g, "$1")
    .replace(/([.!?])\s*[.!?]+/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const changed = t !== original.trim();
  return { rewritten: t, changed, changes: changed ? changes : [] };
}
