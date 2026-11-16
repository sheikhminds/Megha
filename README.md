<p align="center">
  <img src="./logo.png" alt="Megha logo" width="220" />
</p>

<h1 align="center">Megha</h1>

<p align="center">A live browser stream on the left. An AI browser agent named Megha on the right.</p>

## Interface

- **Left — Live Viewport:** real-time JPEG frames from the browser, rendered to a canvas.
- **Right — Agent Chat:** talk to **Megha**, an AI agent that drives the browser with
  `agent-browser` commands. Each command and its output appear as expandable steps in
  the conversation, and the result is visible immediately in the live stream.

The agent's system prompt is authored in **MDX** (`prompts/megha.mdx`), so the
instructions are structured, modular and dynamically composed with JSX components.
It is compiled at runtime and injected as the system message.

## Architecture

```
agent-browser (Chrome daemon) ──WebSocket──▶ /api/stream (SSE) ──▶ Live viewport
                                                   ▲
Agent Chat ──▶ /api/chat ──MDX system prompt──▶ Reflection Beam ──▶ /api/command
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

Without a key the agent falls back to a local natural-language command planner, so
the interface still works.

Beam is a reasoning model: the app requests enough tokens for a final `content`
message, captures `reasoning_content` from each reply, and echoes it back with every
earlier assistant message on the next turn (which the API requires).

## Run

```bash
npm run dev      # http://localhost:3000
# or
npm run build && npm start
```

If no browser session exists, the app opens one automatically. Example prompts for
the agent:

- “Open example.com and tell me the page title”
- “Show me the interactive elements”
- “Click the Learn more link”
- “Check the console for errors”
- “Take a screenshot”
