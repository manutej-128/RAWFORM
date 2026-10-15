# RAWFORM

**Write like yourself.**
Analyze your writing. Refine it. Make it yours.

A product by **Arclume**.

---

## What it does

Three screens, four actions, no accounts to manage.

| Action | What happens |
| --- | --- |
| **Analyze** | Scores your draft with the SlopMonster rules and lists every matched phrase. |
| **Humanize** | Rewrites the draft with local rules and reports exactly what it changed. |
| **Check Again** | Re-scores the rewritten text, so you can see the difference. |
| **Copy** | Copies the rewritten text, character for character. |

The score counts pattern matches. It is not a claim about who wrote the text.

---

## Run it

You need **Node.js 18 or newer**. Nothing else — no Python at runtime, no API
key, no paid service.

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

For a production build:

```bash
npm run build
npm run start
```

### Windows

The same three commands work in PowerShell, Command Prompt and the VS Code
terminal. Open the folder in VS Code, press <kbd>Ctrl</kbd> + <kbd>`</kbd> for
the terminal, then:

```powershell
npm install
npm run dev
```

---

## The one environment variable

`.env` holds a single line:

```
DATABASE_URL="YOUR_NEW_NEON_CONNECTION_STRING"
```

Paste your Neon connection string between the quotes and restart. Then create
the one table:

```bash
npx drizzle-kit push
```

Leaving the placeholder in place is also fine. Every feature still runs; the
sign-in just does not persist, and `/api/health` reports
`"database":"not-configured"` rather than failing.

---

## Deploy to Netlify

Netlify builds this with zero configuration. There is no Python at runtime, no
API key and no build step beyond `next build`.

1. Push the repository to GitHub, GitLab or Bitbucket.
2. In Netlify: **Add new site → Import an existing project**, pick the repo.
   The build command (`npm run build`) and Node version (22) are already set in
   `netlify.toml`, so leave the defaults alone.
3. Open **Site configuration → Environment variables** and add:

   | Key | Value |
   | --- | --- |
   | `DATABASE_URL` | your Neon connection string |

   `.env` is git-ignored, so this is the only place the real string lives.
4. Deploy.

### Creating the table

Run this once from your machine, with the same connection string in your local
`.env`:

```bash
npx drizzle-kit push
```

### Use the pooled Neon host

Serverless functions start and stop constantly. Copy the connection string
labelled **Pooled connection** in the Neon dashboard — its host contains
`-pooler` — so connections are shared rather than exhausted.

### Deploying without a database

You can skip steps 3 and 4 entirely. Leave `DATABASE_URL` unset and the site
still deploys and works; the sign-in simply does not persist and
`/api/health` reports `"database":"not-configured"`.

---

## Privacy

The database has exactly one table, `users`, holding a name, an email and a
timestamp. There is no table for drafts, rewrites, scores, history or activity,
because none of those are ever saved.

Your text is scored in memory and discarded with the response. It is never
written to disk, never logged, never placed in browser storage, and never sent
to any third party. The rewriter runs in this process; no model or external
service sees a word of it.

---

## The detector

The rules come from [SlopMonster](https://github.com/ItsssssJack/SlopMonster).
The original tool is kept here unchanged:

```
tools/deslop.py          the original scorer, verbatim
tools/test_deslop.py     the original regression suite, verbatim
tools/analyze.py         thin JSON adapter around deslop.py
```

You can still run it from a terminal, exactly as upstream documents:

```bash
python3 tools/deslop.py --text "It's not just a tool, it's a game-changing journey."
python3 tools/deslop.py README.md
cd tools && python3 test_deslop.py
```

The app itself runs the same rules in TypeScript (`src/lib/deslop.ts`), a
line-for-line transcription of `deslop.py`. That removes the Python child
process, which is what used to fail with *"Analysis process encountered an
error"* on machines where `python3` was not on the PATH, and on hosts where
Python does not exist at all.

Parity between the two is checked, not assumed:

```bash
node scripts/parity.mjs
```

It scores the same inputs with both engines and compares the score, the word
count and every finding. Python 3 is needed for that script only.

---

## Layout

```
src/
  app/
    page.tsx              the three screens
    frame.tsx             masthead, colophon, ambient backdrop
    ambient.tsx           the blurred background loop
    globals.css           type scale and surface
    api/
      analyze/route.ts    scores text in process
      humanize/route.ts   rewrites text in process
      auth/route.ts       stores name and email, nothing more
      health/route.ts     readiness, database state
  lib/
    deslop.ts             the detector
    humanize.ts           the local rewriter
  db/
    index.ts              optional Postgres client
    schema.ts             the users table
tools/                    the original SlopMonster tool
scripts/parity.mjs        detector parity harness
```

---

## Limits

The rewriter follows fixed rules. It unwinds stock constructions and replaces
generic wording. It will not restructure an argument, and when it finds nothing
safe to change it says so and returns your text untouched. It cannot make text
undetectable, and it does not claim to.

MIT, as is the SlopMonster catalogue it builds on.
