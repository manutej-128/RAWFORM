"use client";

import { useMemo, useState } from "react";
import { Frame } from "./frame";

type AnalysisItem = { phrase: string; count: number; example?: string };
type AnalysisCategory = { key: string; title: string; items: AnalysisItem[] };
type AnalysisResult = {
  score: number;
  wordCount: number;
  categories: AnalysisCategory[];
  clean: boolean;
};

type Target = "original" | "revised";

export default function Home() {
  const [view, setView] = useState<"landing" | "signin" | "workspace">("landing");

  // Identity — the only thing ever persisted
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  // Text state — original and revised stay separate, in memory only
  const [text, setText] = useState("");
  const [rewritten, setRewritten] = useState("");
  const [improverStatus, setImproverStatus] = useState<string | null>(null);
  const [improverChanges, setImproverChanges] = useState<string[]>([]);

  // Detector state
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analyzedTarget, setAnalyzedTarget] = useState<Target | null>(null);

  const [loadingAnalyze, setLoadingAnalyze] = useState(false);
  const [loadingHumanize, setLoadingHumanize] = useState(false);
  const [loadingCheckAgain, setLoadingCheckAgain] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const busy = loadingAnalyze || loadingHumanize || loadingCheckAgain;

  const wordCount = useMemo(
    () => (text.trim() ? text.trim().split(/\s+/).length : 0),
    [text]
  );
  const charCount = text.length;
  const revisedWordCount = useMemo(
    () => (rewritten.trim() ? rewritten.trim().split(/\s+/).length : 0),
    [rewritten]
  );

  const totalMatches = analysis
    ? analysis.categories.reduce(
        (acc, c) => acc + c.items.reduce((s, it) => s + it.count, 0),
        0
      )
    : 0;

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(null);
    const cleanName = name.trim();
    const cleanEmail = email.trim();

    if (!cleanName || !cleanEmail) {
      setAuthError("Enter your name and email to continue.");
      return;
    }
    if (!cleanEmail.includes("@") || !cleanEmail.includes(".")) {
      setAuthError("That email address does not look right.");
      return;
    }

    setSigningIn(true);
    try {
      await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: cleanName, email: cleanEmail }),
      });
    } catch {
      /* identity storage is best-effort; the session continues either way */
    } finally {
      setSigningIn(false);
      setView("workspace");
    }
  }

  async function runDetector(target: Target) {
    const payload = target === "original" ? text : rewritten;
    setError(null);

    if (!payload.trim()) {
      setError(
        target === "original"
          ? "Paste or type something before running the check."
          : "There is no revised text yet. Run Humanize first."
      );
      return;
    }

    if (target === "original") setLoadingAnalyze(true);
    else setLoadingCheckAgain(true);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: payload }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "The check could not be completed.");
        return;
      }
      setAnalysis(data as AnalysisResult);
      setAnalyzedTarget(target);
    } catch {
      setError("Could not reach the checker. Is the server still running?");
    } finally {
      setLoadingAnalyze(false);
      setLoadingCheckAgain(false);
    }
  }

  async function handleHumanize() {
    setError(null);
    setImproverStatus(null);
    setImproverChanges([]);

    if (!text.trim()) {
      setError("Paste or type something before running Humanize.");
      return;
    }

    setLoadingHumanize(true);
    try {
      const res = await fetch("/api/humanize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "The local improver could not run.");
        return;
      }

      setRewritten(data.rewritten || text);

      if (data.changed) {
        const changes: string[] = Array.isArray(data.changes) ? data.changes : [];
        setImproverChanges(changes);
        setImproverStatus(
          `${changes.length} rule-based edit${changes.length === 1 ? "" : "s"} applied locally.`
        );
        if (analyzedTarget === "revised") {
          setAnalysis(null);
          setAnalyzedTarget(null);
        }
      } else {
        setImproverStatus(
          "Nothing safe to change. The text was returned exactly as written."
        );
      }
    } catch {
      setError("Could not reach the local improver. Is the server still running?");
    } finally {
      setLoadingHumanize(false);
    }
  }

  async function handleCopy() {
    if (!rewritten) return;
    try {
      await navigator.clipboard.writeText(rewritten);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("The browser blocked clipboard access.");
    }
  }

  function clearSession() {
    setText("");
    setRewritten("");
    setAnalysis(null);
    setAnalyzedTarget(null);
    setImproverStatus(null);
    setImproverChanges([]);
    setError(null);
  }

  /* ───────────────────────── Screen 1 — Landing ───────────────────────── */

  if (view === "landing") {
    return (
      <Frame>
        <section className="flex-1 flex flex-col justify-center py-12">
          <h1 className="rise rise-1 display text-[clamp(4rem,15.5vw,11rem)] leading-[0.82] tracking-[-0.015em] font-medium">
            RAWFORM
          </h1>

          <div className="rise rise-2 border-t border-black mt-10 sm:mt-14" />

          <div className="rise rise-3 grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 pt-7">
            <p className="display italic text-[clamp(1.6rem,4vw,2.45rem)] leading-[1.05] tracking-[-0.01em]">
              Write like yourself.
            </p>

            <div className="flex flex-col gap-6 md:pt-1">
              <p className="text-[17px] leading-[1.45] text-neutral-900 max-w-[34ch]">
                Analyze your writing. Refine it.
                <br />
                Make it yours.
              </p>

              <div>
                <button
                  onClick={() => setView("signin")}
                  className="group inline-flex items-center gap-3 bg-black text-white label h-[52px] px-7 hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  START WRITING
                  <span className="inline-block transition-transform duration-200 group-hover:translate-x-1">
                    →
                  </span>
                </button>
              </div>
            </div>
          </div>
        </section>
      </Frame>
    );
  }

  /* ───────────────────────── Screen 2 — Sign in ───────────────────────── */

  if (view === "signin") {
    return (
      <Frame rightLabel="STEP 01 / NAME & EMAIL" onLogoClick={() => setView("landing")}>
        <section className="flex-1 flex flex-col justify-center py-14">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-start">
            <div className="rise rise-1">
              <h2 className="display text-[clamp(2.6rem,7vw,5rem)] leading-[0.9] tracking-[-0.015em] font-medium">
                Before
                <br />
                you begin
              </h2>
              <p className="display italic text-xl text-neutral-600 mt-5">
                Two fields. No password.
              </p>
            </div>

            <form onSubmit={handleSignIn} className="rise rise-2 w-full max-w-[420px]">
              <div className="border-t border-black pt-6 space-y-6">
                <div>
                  <label htmlFor="name-input" className="label text-neutral-500 block mb-2">
                    NAME
                  </label>
                  <input
                    id="name-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    autoComplete="name"
                    className="w-full h-11 bg-transparent border-b border-neutral-400 text-[17px] focus:outline-none focus:border-black transition-colors"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="email-input" className="label text-neutral-500 block mb-2">
                    EMAIL
                  </label>
                  <input
                    id="email-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    type="email"
                    autoComplete="email"
                    className="w-full h-11 bg-transparent border-b border-neutral-400 text-[17px] focus:outline-none focus:border-black transition-colors"
                    required
                  />
                </div>

                {authError && (
                  <p className="label text-black border-l-2 border-black pl-3 py-1 normal-case tracking-normal">
                    {authError}
                  </p>
                )}

                <div className="flex items-center gap-4 pt-1">
                  <button
                    type="submit"
                    disabled={signingIn}
                    className="group inline-flex items-center gap-3 bg-black text-white label h-[52px] px-7 hover:bg-neutral-800 transition-colors disabled:opacity-40 cursor-pointer"
                  >
                    {signingIn ? "ONE MOMENT" : "CONTINUE"}
                    <span className="inline-block transition-transform duration-200 group-hover:translate-x-1">
                      →
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setView("landing")}
                    className="label text-neutral-500 hover:text-black transition-colors cursor-pointer"
                  >
                    BACK
                  </button>
                </div>

                <p className="text-[12px] leading-relaxed text-neutral-500 pt-2">
                  Only your name and email are kept. Your writing, the revisions
                  and every score stay in memory for this session and are never
                  saved or sent anywhere.
                </p>
              </div>
            </form>
          </div>
        </section>
      </Frame>
    );
  }

  /* ──────────────────────── Screen 3 — Workspace ──────────────────────── */

  return (
    <Frame
      rightLabel={name ? name.toUpperCase() : "WORKSPACE"}
      onLogoClick={() => setView("landing")}
    >
      <section className="py-8 sm:py-10 space-y-8">
        {/* Section head */}
        <div className="rise rise-1 flex items-end justify-between gap-6 flex-wrap">
          <h2 className="display text-[clamp(2.1rem,5.5vw,3.4rem)] leading-[0.95] tracking-[-0.015em] font-medium">
            Your draft
          </h2>
          <div className="flex items-center gap-5">
            <span className="label mono text-neutral-500">
              {wordCount} {wordCount === 1 ? "WORD" : "WORDS"} · {charCount} CHARS
            </span>
            {(text || rewritten) && (
              <button
                onClick={clearSession}
                className="label text-neutral-500 hover:text-black transition-colors cursor-pointer"
              >
                CLEAR
              </button>
            )}
          </div>
        </div>

        {/* Draft input */}
        <div className="rise rise-2">
          <div className="border-t border-black" />
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (analyzedTarget === "original") {
                setAnalysis(null);
                setAnalyzedTarget(null);
              }
            }}
            placeholder="Paste your text here…"
            rows={12}
            spellCheck
            className="display w-full bg-transparent py-6 text-[19px] sm:text-[21px] leading-[1.6] tracking-[0.002em] resize-y focus:outline-none"
          />
          <div className="border-t border-neutral-300" />
        </div>

        {/* Actions */}
        <div className="rise rise-3 flex flex-wrap items-center gap-3">
          <button
            onClick={() => runDetector("original")}
            disabled={busy}
            className="label h-[46px] px-6 border border-black hover:bg-black hover:text-white transition-colors disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-black cursor-pointer"
          >
            {loadingAnalyze ? "ANALYZING…" : "ANALYZE"}
          </button>

          <button
            onClick={handleHumanize}
            disabled={busy}
            className="label h-[46px] px-6 bg-black text-white hover:bg-neutral-800 transition-colors disabled:opacity-35 cursor-pointer"
          >
            {loadingHumanize ? "REVISING…" : "HUMANIZE"}
          </button>

          <button
            onClick={() => runDetector("revised")}
            disabled={busy || !rewritten.trim()}
            className="label h-[46px] px-6 border border-black hover:bg-black hover:text-white transition-colors disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-black cursor-pointer"
            title={!rewritten.trim() ? "Run Humanize first" : "Re-run the checker on the revision"}
          >
            {loadingCheckAgain ? "CHECKING…" : "CHECK AGAIN"}
          </button>

          {busy && (
            <span className="label mono text-neutral-400 animate-pulse pl-1">
              WORKING LOCALLY…
            </span>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="border-l-2 border-black pl-4 py-2">
            <p className="label text-neutral-500 mb-1">SOMETHING STOPPED</p>
            <p className="text-[15px] leading-relaxed">{error}</p>
          </div>
        )}

        {/* Findings */}
        {analysis && (
          <section className="rise space-y-5">
            <div className="border-t border-black" />

            <div className="flex items-start justify-between gap-6 flex-wrap pt-1">
              <div>
                <p className="label text-neutral-500 mb-1">
                  SLOPMONSTER ·{" "}
                  {analyzedTarget === "revised" ? "REVISED TEXT" : "ORIGINAL TEXT"}
                </p>
                <h3 className="display text-[clamp(1.9rem,4.5vw,2.8rem)] leading-[1] tracking-[-0.01em] font-medium">
                  {analysis.clean ? "Reads clean" : "Findings"}
                </h3>
              </div>

              <div className="text-right">
                <p className="label text-neutral-500 mb-1">SCORE</p>
                <p className="display text-[clamp(2.6rem,7vw,4rem)] leading-[0.85] font-medium">
                  {analysis.score}
                  <span className="text-neutral-400">/5</span>
                </p>
              </div>
            </div>

            {/* Score meter — five plain marks, no chart */}
            <div className="flex items-center gap-1.5" aria-hidden>
              {[1, 2, 3, 4, 5].map((n) => (
                <span
                  key={n}
                  className={`h-[3px] flex-1 ${
                    n <= analysis.score ? "bg-black" : "bg-neutral-200"
                  }`}
                />
              ))}
            </div>

            <p className="text-[15px] leading-[1.6] max-w-[70ch] text-neutral-800">
              {analysis.clean
                ? `The checker scanned ${analysis.wordCount} words and matched none of its five pattern groups. The score reports pattern matches, not who wrote the text.`
                : `The checker scanned ${analysis.wordCount} words and matched ${totalMatches} phrase${
                    totalMatches === 1 ? "" : "s"
                  } across ${analysis.categories.length} group${
                    analysis.categories.length === 1 ? "" : "s"
                  }. The score reports pattern matches, not who wrote the text.`}
            </p>

            {analysis.categories.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-7 pt-1">
                {analysis.categories.map((cat) => (
                  <div key={cat.key}>
                    <div className="flex items-baseline justify-between border-b border-neutral-300 pb-1.5 mb-2">
                      <h4 className="label text-black">{cat.title}</h4>
                      <span className="label mono text-neutral-400">
                        {cat.items.reduce((s, it) => s + it.count, 0)}
                      </span>
                    </div>
                    <ul>
                      {cat.items.map((it, i) => (
                        <li
                          key={`${cat.key}-${i}`}
                          className="flex items-baseline justify-between gap-5 py-[7px] border-b border-neutral-100 last:border-0"
                        >
                          <span className="display text-[16px] leading-snug">
                            {it.phrase}
                            {it.example && (
                              <span className="block text-[12.5px] text-neutral-500 font-sans mt-0.5">
                                {it.example}
                              </span>
                            )}
                          </span>
                          <span className="mono text-[12px] text-neutral-500 shrink-0">
                            ×{it.count}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Revision */}
        <section className="space-y-4 pt-2">
          <div className="border-t border-black" />

          <div className="flex items-end justify-between gap-6 flex-wrap pt-1">
            <div>
              <p className="label text-neutral-500 mb-1">LOCAL REWRITE · OFFLINE</p>
              <h3 className="display text-[clamp(1.9rem,4.5vw,2.8rem)] leading-[1] tracking-[-0.01em] font-medium">
                The revision
              </h3>
            </div>

            <div className="flex items-center gap-4">
              <span className="label mono text-neutral-500">
                {revisedWordCount} {revisedWordCount === 1 ? "WORD" : "WORDS"}
              </span>
              <button
                onClick={handleCopy}
                disabled={!rewritten}
                className="label h-[42px] px-5 border border-black hover:bg-black hover:text-white transition-colors disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-black cursor-pointer"
              >
                {copied ? "COPIED" : "COPY"}
              </button>
            </div>
          </div>

          {improverStatus && (
            <div className="border-l-2 border-neutral-300 pl-4 py-1">
              <p className="text-[14px] leading-relaxed text-neutral-800">
                {improverStatus}
              </p>
              {improverChanges.length > 0 && (
                <ul className="mt-1.5 space-y-0.5">
                  {improverChanges.map((c, i) => (
                    <li key={i} className="text-[13px] text-neutral-500 leading-relaxed">
                      — {c}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div>
            <div className="border-t border-neutral-300" />
            <textarea
              value={rewritten}
              onChange={(e) => {
                setRewritten(e.target.value);
                if (analyzedTarget === "revised") {
                  setAnalysis(null);
                  setAnalyzedTarget(null);
                }
              }}
              placeholder="The revision appears here after Humanize. Your original stays untouched above."
              rows={10}
              spellCheck
              className="display w-full bg-transparent py-6 text-[19px] sm:text-[21px] leading-[1.6] tracking-[0.002em] resize-y focus:outline-none"
            />
            <div className="border-t border-neutral-300" />
          </div>

          <p className="text-[12px] leading-relaxed text-neutral-500 max-w-[66ch]">
            The rewrite runs on this machine with plain Python rules. It replaces
            generic wording and unwinds stock constructions. It does not invent
            facts, and it cannot promise a text reads as human.
          </p>
        </section>
      </section>
    </Frame>
  );
}
