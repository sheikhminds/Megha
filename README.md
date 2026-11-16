<p align="center">
  <img src="./logo.png" alt="Megha logo" width="220" />
</p>

<h1 align="center">Megha</h1>

<p align="center">A live browser stream on the left. An AI browser agent named Megha on the right.</p>

## Interface

- **Live Viewport** — real-time JPEG frames from the browser, rendered to a canvas.
  After a period with no agent activity it automatically rests on a calm, breathing
  butterfly screen and wakes as soon as there is work to do.
- **Hide browser** — collapses the stream so the agent chat can use the full width.
  While hidden, a **Browser preview** mini card and a collapsible **Agent steps**
  disclosure sit above the composer — tap the preview to restore the full viewport.
- **Agent Chat** — talk to **Megha**, an AI agent that drives the browser with
  `agent-browser` commands. It runs an observe → act → verify loop (up to 8 steps)
  until the task is finished, and each step is shown as an expandable tool call.

The agent's system prompt is an **MDX** file (`prompts/megha.mdx`), compiled at
runtime into a composed system message. It uses Reflection AI's Beam model, with a
local multi-step planner as a fallback.

Built with Astyx components and the neutral theme. Layouts adapt from desktop split
panes to a stacked mobile view using container queries.

## Architecture

```
agent-browser (Chrome daemon) ──WebSocket──▶ /api/stream (SSE) ──▶ Live viewport
                                                  ▲
Agent Chat ──▶ /api/chat ──MDX prompt──▶ Reflection Beam ──▶ /api/command
```

## Setup

```bash
# Browser tooling (one time)
npm install -g agent-browser
agent-browser install --with-deps

# App dependencies
npm install

# AI model credentials — kept out of git via .gitignore
cat > .env.local <<'EOF'
REFLECTION_API_KEY=your_key_here
REFLECTION_MODEL=Beam-1.0-501B-A23B
EOF
```

## Run

```bash
npm run dev          # http://localhost:3000
npm run build && npm start
npx astryx doctor --built .   # project convention check
```

Example prompts: “open example.com and tell me the page title”, “show me the
interactive elements”, “click the Learn more link”, “check the console for errors”.
