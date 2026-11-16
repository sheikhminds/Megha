<p align="center">
  <img src="./logo.png" alt="Megha logo" width="220" />
</p>

<h1 align="center">Megha</h1>

<p align="center">
  A live browser stream on the left. An AI browser agent named Megha on the right.
</p>

<p align="center">
  <a href="https://github.com/sheikhminds/Megha"><img src="https://img.shields.io/github/license/sheikhminds/Megha" alt="License"></a>
  <a href="https://nextjs.org/"><img src="https://img.shields.io/badge/Next.js-16-black" alt="Next.js 16"></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-19-blue" alt="React 19"></a>
  <a href="https://astryxdesign.com/"><img src="https://img.shields.io/badge/AstyX-0.7.16-purple" alt="AstryX 0.7.16"></a>
</p>

---

## What is Megha?

Megha is an AI browser agent you talk to in plain English. She drives a real browser
(Chrome via [`agent-browser`](https://github.com/sheikhminds/agent-browser)) while you
watch every action live in a streaming viewport on the left side of the screen.

Split-pane layout: **live browser stream** on the left, **agent chat** on the right.
On mobile the panels stack. The viewport automatically rests on a breathing butterfly
screen when idle and wakes the moment there is work to do.

---

## Features

| Feature | Description |
|---------|-------------|
| 🖥️ **Live Viewport** | Real-time JPEG frames from the browser, rendered to a canvas. Shows connection status, frame count, and viewport size. |
| 🦋 **Idle rest** | After 25 seconds of inactivity the viewport rests on a breathing Megha logo and wakes on the next action. |
| 🙈 **Hide browser** | Collapse the stream so the chat uses full width. A mini browser preview card and collapsible Agent steps bar sit above the composer. |
| 🤖 **Agent Chat** | Talk to Megha in plain English. She runs an observe → act → verify loop (up to 8 steps) with `agent-browser` commands. |
| ⚡ **Streaming answers** | Replies stream in with a smooth reveal effect. Each agent step renders as an expandable tool call with input/output. |
| ❓ **Asks for help** | When Megha needs a login, verification code, or clarification, she pauses and asks you directly. |
| ⏹️ **Stop button** | Abort an in-progress agent run at any time. |
| 🔄 **Local + AI planner** | Uses Reflection AI's Beam model when credentials are configured; falls back to a local multi-step planner. |
| 📱 **Responsive** | Desktop split panes → stacked mobile view via container queries. Built with AstyX components. |


---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Browser (agent-browser, Chrome daemon)                                     │
│  ┌─────────────┐  WebSocket  ┌───────────────────────────────────────────┐  │
│  │  Screencast │◄────────────│  Next.js API Route: /api/stream (SSE)    │  │
│  └─────────────┘             │  frames, status, tabs, console, events   │  │
└──────────────────────────────┼───────────────────────────────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        ▼                      ▼                      ▼
   Live Viewport          /api/status           /api/command
   (canvas + SSE)         (session info)        (run one agent-browser
                                                       command, allow-listed)
                               ▲
                               │
                    ┌──────────┴──────────┐
                    ▼                     ▼
               /api/chat              MDX prompt
          (POST messages)         (prompts/megha.mdx)
                    │                     │
                    └──────────┬──────────┘
                               ▼
                      Reflection Beam (AI)
                      or Local Planner (fallback)
```

### API Routes

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/stream` | GET | SSE bridge from the browser WebSocket. Emits `frame`, `status`, `tabs`, `url`, `command`, `result`, `console`, `error`, `info` events. |
| `/api/status` | GET | Returns browser session info (port, connected, screencasting, viewport size) and agent mode (`ai` or `local`). Add `?start=1` to ensure a session exists. |
| `/api/chat` | POST | Send a chat message array to Megha. Returns her answer, executed steps, mode, and iterations. |
| `/api/command` | POST | Run a single allow-listed `agent-browser` command (open, snapshot, click, get, console, etc.). |


---

## Quick Start

### 1. Install the browser tooling (one time)

```bash
npm install -g agent-browser
agent-browser install --with-deps
```

### 2. Install app dependencies

```bash
npm install
```

### 3. Configure AI credentials (optional)

Create `.env.local` (gitignored) if you want to use Reflection AI's Beam model:

```bash
cat > .env.local <<'EOF'
REFLECTION_API_KEY=your_key_here
REFLECTION_MODEL=Beam-1.0-501B-A23B
EOF
```

Without these, Megha falls back to the local multi-step planner and still works fully.

### 4. Run the app

```bash
# Development
npm run dev          # http://localhost:3000

# Production
npm run build
npm start            # http://localhost:3000

# Project convention check
npx astryx doctor --built .
```


---

## Example Prompts

```
"open example.com and tell me the page title"
"show me the interactive elements"
"click the Learn more link"
"check the console for errors"
"take a screenshot"
"open github.com and search for astryx"
"what is the current url?"
"go back to the previous page"
"reload the page"
```


---

## Project Structure

```
megha/
├── app/
│   ├── page.tsx              # Main page: split-pane workspace
│   ├── layout.tsx            # Root layout with AstyX theme
│   ├── api/
│   │   ├── chat/route.ts     # Agent chat endpoint
│   │   ├── stream/route.ts   # Browser stream SSE bridge
│   │   ├── status/route.ts   # Session & agent mode status
│   │   └── command/route.ts  # Single command executor
├── components/
│   ├── AgentChat.tsx         # Chat UI: messages, composer, tool calls
│   ├── LiveViewport.tsx      # Canvas-rendered browser stream + idle screen
│   └── AgentStepsBar.tsx     # Collapsible agent steps + browser preview
├── lib/
│   ├── agent.ts              # runAgent: observe→act→verify loop, local planner
│   ├── browser.ts            # agent-browser CLI wrapper, command allow-list
│   ├── prompt.ts             # MDX system prompt compiler
│   └── types.ts              # TypeScript interfaces for events and steps
├── prompts/
│   └── megha.mdx             # MDX system prompt for the agent
├── src/themes/megha/         # Custom "megha" AstyX theme
├── themes/megha/             # Theme editor output files
├── astryx-themes.ts          # Theme registry (neutral + megha)
├── next.config.ts
├── package.json
├── tsconfig.json
├── logo.png
└── README.md
```


---

## Tech Stack

- **Next.js 16** — App Router, API routes
- **React 19** — Client components
- **AstryX Design 0.7.16** — UI components, theming, reset CSS
- **TypeScript** — Type safety
- **agent-browser** — Chrome automation daemon (WebSocket + screencasting)
- **Reflection AI Beam** — AI model for planning (optional)
- **MDX** — Composable system prompt

---

## Themes

Megha ships with two themes: `neutral` (default) and a custom `megha` theme.
Themes are managed with the AstyX theme editor:

```bash
astryx experimental theme editor show megha --png
astryx theme add megha
```

Edit `src/themes/megha/` or use the interactive editor; `astryx-themes.ts` is
auto-generated and should not be edited by hand.

---

## License

MIT License. See [LICENSE](./LICENSE) for details.
