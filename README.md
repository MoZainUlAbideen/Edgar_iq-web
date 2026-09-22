# EdgarIQ — web

The two-page marketing/explainer site for EdgarIQ, plus a chat widget that
plays back real, verified answers from an actual evaluation run — no
backend required for this version.

## Structure

```
index.html          Home — problem, pipeline, proof
how-it-works.html   Architecture, tech stack, real bug case studies
styles.css           Shared design tokens + base styles
home.css             Home page only
how.css              How-it-works page only
chat-widget.css       Chat launcher + panel (shared, both pages)
conversations.js      Real Q&A data the chat widget plays back
script.js             Chat widget interactivity
```

Plain HTML/CSS/JS on purpose — no build step, no `node_modules`, nothing
to install. Just files a browser can open directly.

## Preview locally

Just open `index.html` in a browser. No server needed for this static
version.

## Deploy to Vercel (step by step)

1. Push this folder to its own GitHub repo (or a subfolder of an existing
   one — see the note below if you do that).
2. Go to [vercel.com](https://vercel.com) → **Add New** → **Project**.
3. Import the GitHub repo.
4. Framework preset: choose **Other** (this is a static site, not
   Next.js/React — Vercel will serve the files as-is).
5. Leave build command and output directory blank.
6. Click **Deploy**. You'll get a live `*.vercel.app` URL in about a
   minute.

**If this lives in a subfolder** of your main `edgariq` repo (e.g.
`edgariq/web/`), set Vercel's **Root Directory** setting to that subfolder
during import, so it only deploys this site, not the Python backend.

## Swapping in the real backend later

Right now `script.js`'s `askQuestion()` plays back a canned answer from
`conversations.js`. To make it live:

1. Deploy the Python agent pipeline as a small API (e.g. a FastAPI wrapper
   around `answer_question()`) to a host that supports long-running
   requests — Render, Railway, or Fly.io all have free tiers. Vercel's own
   serverless functions won't work for this: they time out well before a
   ~30-50 second multi-agent pipeline run finishes, and can't run Ollama.
2. Replace the `setTimeout(...)` block in `askQuestion()` with a real
   `fetch()` call to that API, passing the typed question and rendering
   the real response (answer + citations) instead of the canned one.
3. Un-disable the text input in both HTML files once that's wired up.

## Content honesty

Every number, quote, and eval result on this site is real — pulled from
actual runs of the EdgarIQ backend against live NVIDIA filings, not
placeholder copy. If you re-run the eval harness and get different
numbers, update `conversations.js` and the eval table in
`how-it-works.html` to match.
