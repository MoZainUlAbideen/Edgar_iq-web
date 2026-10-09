# EdgarIQ — web
### Link : https://edgar-iq-web.vercel.app/
The two-page marketing/explainer site for EdgarIQ, plus a chat widget that
plays back real, verified answers from an evaluation run, or talks to the live API when configured.

## Structure

```
index.html          Home — ask box, provenance specimen, problems, pipeline, proof
how-it-works.html   Architecture, live deployment, tech stack, four bug case studies
styles.css           Fonts (self-hosted), design tokens, nav, buttons, footer
fonts/               Fraunces, Hanken Grotesk, IBM Plex Mono (woff2)
og.png               Social preview image (1200x630)
vercel.json          Long cache for fonts
home.css             Home page only
how.css              How-it-works page only
chat-widget.css       Chat launcher + panel (shared, both pages)
conversations.js      Real Q&A data the chat widget plays back
config.js             API URL (empty = curated-only)
script.js             Chat widget (curated + live modes)
```

Plain HTML/CSS/JS on purpose — no build step, no `node_modules`, nothing
to install. Just files a browser can open directly.

## Preview locally

Run `python -m http.server 8000` in this folder and open http://localhost:8000
(opening the file directly also works, but the live-backend call needs a server origin).

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

## Live backend

`config.js` holds `window.EDGARIQ_API_URL`. Leave it empty for curated-only mode (ask boxes disabled, suggestions
play recorded answers). Set it to the Render URL of the EdgarIQ API (see `DEPLOY.md` in the main repo) and
the widget will, on page load, call `/health`; if that succeeds the input is enabled and typed questions run
the real pipeline (`POST /ask`, then poll `GET /ask/{id}`). If the backend is asleep or down, the widget
says so and keeps the recorded answers working.

Answers are rendered through a small escape-first markdown renderer — model output is never inserted as raw
HTML, and only `https://www.sec.gov/` source links are made clickable.

## Content honesty

Every number, quote, and eval result on this site is real — pulled from
actual runs of the EdgarIQ backend against live NVIDIA filings, not
placeholder copy. If you re-run the eval harness and get different
numbers, update `conversations.js` and the eval table in
`how-it-works.html` to match.
