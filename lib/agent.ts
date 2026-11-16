import { runBrowser, safeArgs } from './browser';
import { buildSystemPrompt } from './prompt';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  /** When the assistant asked the user for help, this is the question posed. */
  question?: string;
  /** Beam requires the reasoning of every earlier assistant message to be echoed back. */
  reasoning_content?: string;
}

export interface AgentReply {
  answer: string;
  steps: Array<{ command: string; output: string; success: boolean }>;
  mode: 'local' | 'ai';
  reasoning_content?: string;
  iterations: number;
  /** When set, the agent paused and is waiting for the user to answer this question. */
  question?: string;
}

const COMMANDS = [
  { name: 'open <url>', description: 'navigate to a URL' },
  { name: 'snapshot -i', description: 'read interactive elements with @refs' },
  { name: 'click @eN', description: 'click a ref from the latest snapshot' },
  { name: 'fill @eN "text"', description: 'clear and fill an input' },
  { name: 'type @eN "text"', description: 'type into an element' },
  { name: 'press <key>', description: 'press a key (Enter, Tab, Control+a)' },
  { name: 'find role <role> click --name "Name"', description: 'click by accessible name' },
  { name: 'get title / get url', description: 'read page facts' },
  { name: 'console / errors', description: 'read console logs or JavaScript errors' },
  { name: 'screenshot', description: 'capture the viewport' },
  { name: 'back / forward / reload', description: 'navigate history' },
  { name: 'wait <ms>', description: 'wait for the page to settle' },
];

/** Local natural-language planner — maps plain English to agent-browser commands. */
export function planLocally(text: string): Array<{ command: string; reason: string }> {
  const input = text.trim();
  const lower = input.toLowerCase();
  const steps: Array<{ command: string; reason: string }> = [];
  const push = (command: string, reason: string) => {
    if (!steps.some((s) => s.command === command)) steps.push({ command, reason });
  };

  // Compound "open X and search for Y" requests: complete the whole task.
  const searchQuery = input
    .match(/(?:search|look up|look for|find)\s+(?:details\s+)?(?:about|on|for)?\s*["“]?([^"”]+?)["”]?\s*$/i)?.[1]
    ?.trim();
  const wantsSearch = /\b(search|look up|look for)\b/i.test(input);
  const openTarget =
    input.match(/https?:\/\/[^\s"'“”]+/)?.[0] ||
    input.match(/\b(?:[a-z0-9-]+\.)+(?:com|org|net|dev|io|ai|co)\b/i)?.[0];
  const wantsOpen = /\b(open|go to|navigate|visit)\b/i.test(input);

  if (wantsSearch && searchQuery) {
    if (wantsOpen && openTarget) push(`open ${openTarget}`, 'Opening the requested site');
    push('snapshot -i', 'Finding the search box');
    push(`find role textbox fill "${searchQuery}"`, `Searching for "${searchQuery}"`);
    push('press Enter', 'Submitting the search');
    push('wait 2000', 'Waiting for results');
    push('snapshot -i', 'Reading the search results');
    return steps;
  }

  if (wantsOpen && openTarget && /\b(title)\b/.test(input)) {
    push(`open ${openTarget}`, 'Opening the requested page');
    push('get title', 'Reading the page title');
    return steps;
  }

  // Explicit "then" / chained requests.
  const segments = lower
    .split(/\s+(?:and then|then|after that)\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  for (const segment of segments) {
    const url = segment.match(/https?:\/\/[^\s"'“”]+/)?.[0];
    const bareDomain = segment.match(/\b(?:[a-z0-9-]+\.)+(?:com|org|net|dev|io|ai|co)\b/i)?.[0];

    if (/\b(open|go to|navigate|visit|load)\b/.test(segment) && (url || bareDomain)) {
      push(`open ${url || bareDomain}`, 'Opening the requested page');
      continue;
    }

    if (/\b(snapshot|elements|what('| i)?s on (the )?page|interactive)\b/.test(segment)) {
      push('snapshot -i', 'Reading the page as an accessibility tree');
      continue;
    }

    if (/\b(title)\b/.test(segment)) {
      push('get title', 'Reading the page title');
      continue;
    }

    if (/\b(url|address|link)\b/.test(segment) && /\b(get|current|what|show)\b/.test(segment)) {
      push('get url', 'Reading the current URL');
      continue;
    }

    if (/\b(console errors|errors|javascript errors)\b/.test(segment)) {
      push('errors', 'Checking for JavaScript errors');
      continue;
    }

    if (/\b(console logs|console|logs)\b/.test(segment)) {
      push('console', 'Reading console output');
      continue;
    }

    if (/\b(screenshot|capture|take a picture)\b/.test(segment)) {
      push('screenshot', 'Capturing the current viewport');
      continue;
    }

    if (/\b(go back|back button)\b/.test(segment)) {
      push('back', 'Navigating back');
      continue;
    }

    if (/\b(reload|refresh)\b/.test(segment)) {
      push('reload', 'Reloading the page');
      continue;
    }

    if (/\b(scroll down)\b/.test(segment)) {
      push('scroll down', 'Scrolling the page down');
      continue;
    }

    if (/\b(click|press|tap)\b/.test(segment)) {
      const name = segment.match(/["“]([^"”]+)["”]/)?.[1] || segment.split(/\b(?:on|the)\b/).pop()?.trim();
      const role = /\b(button|link)\b/.test(segment) ? (segment.includes('link') ? 'link' : 'button') : 'button';
      if (name && name.length < 80) {
        push(`find role ${role} click --name "${name}"`, `Clicking "${name}"`);
      } else {
        push('snapshot -i', 'Finding the element to click');
      }
      continue;
    }

    if (/\b(type|enter text|write)\b/.test(segment) && !/\b(keyboard)\b/.test(segment)) {
      const text = segment.match(/["“]([^"”]+)["”]/)?.[1];
      if (text) push(`keyboard type "${text}"`, `Typing "${text}"`);
      continue;
    }

    // Already an agent-browser command.
    if (safeArgs(segment)) {
      push(segment, 'Running command');
    }
  }

  return steps;
}

interface Provider {
  name: 'reflection' | 'ai-gateway';
  url: string;
  key: string;
  model: string;
}

export function getProvider(): Provider | null {
  if (process.env.REFLECTION_API_KEY) {
    return {
      name: 'reflection',
      url: 'https://api.reflection.ai/openai/v1/chat/completions',
      key: process.env.REFLECTION_API_KEY,
      model: process.env.REFLECTION_MODEL || 'Beam-1.0-501B-A23B',
    };
  }
  if (process.env.AI_GATEWAY_API_KEY) {
    const base = (process.env.AI_GATEWAY_URL || 'https://ai-gateway.vercel.sh').replace(/\/$/, '');
    return {
      name: 'ai-gateway',
      url: `${base}/v1/chat/completions`,
      key: process.env.AI_GATEWAY_API_KEY,
      model: process.env.AI_GATEWAY_MODEL || 'openai/gpt-4o-mini',
    };
  }
  return null;
}

interface AIPlan {
  command: string;
  answer: string;
  /** Set when the model needs the user's help before it can continue. */
  question?: string;
  reasoning_content?: string;
  raw: string;
}

async function planWithAI(messages: ChatMessage[]): Promise<AIPlan | null> {
  const provider = getProvider();
  if (!provider) return null;

  // Beam is a reasoning model — it needs a large budget to finish thinking and
  // still emit a final `content` message (the same budget used in its API example).
  const maxTokens = provider.name === 'reflection' ? 4000 : 500;

  const systemPrompt = await buildSystemPrompt({
    name: 'Megha',
    model: provider.model,
    commands: COMMANDS,
  });

  // Beam requires the reasoning of every earlier assistant message to be
  // echoed back. Drop assistant turns that have no captured reasoning.
  const history = messages
    .filter((m) => m.role === 'user' || provider.name !== 'reflection' || Boolean(m.reasoning_content))
    .map((m) =>
      provider.name === 'reflection' && m.role === 'assistant'
        ? { role: m.role, content: m.content, reasoning_content: m.reasoning_content }
        : { role: m.role, content: m.content },
    );

  // Last resort: a very short prompt that the reasoning model reliably answers.
  const minimalPrompt =
    'You are Megha, a browser agent. Respond with ONLY JSON: ' +
    '{"command":"<one agent-browser command or empty>","answer":"<short answer>"}';

  let lastError = '';
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const attemptPrompt = attempt === 2 ? minimalPrompt : systemPrompt;
    const response = await fetch(provider.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provider.key}`,
      },
      body: JSON.stringify({
        model: provider.model,
        temperature: 0,
        max_tokens: maxTokens,
        stream: false,
        messages: [
          {
            role: 'system',
            content: attemptPrompt,
          },
          ...history,
        ],
      }),
      signal: AbortSignal.timeout(180_000),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`${provider.name} returned ${response.status}: ${detail.slice(0, 600)}`);
    }
    const json = await response.json();
    const message = json?.choices?.[0]?.message ?? {};
    const content = String(message.content ?? '').trim();
    if (!content) {
      lastError = 'model returned no final content';
      continue;
    }
    const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    try {
      return {
        ...(JSON.parse(cleaned) as { command: string; answer: string }),
        reasoning_content: message.reasoning_content || undefined,
        raw: cleaned,
      };
    } catch {
      lastError = `invalid JSON: ${cleaned.slice(0, 200)}`;
    }
  }
  throw new Error(lastError || 'model returned no usable plan');
}

const MAX_AGENT_STEPS = 8;

export async function runAgent(messages: ChatMessage[]): Promise<AgentReply> {
  const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
  const mode: 'local' | 'ai' = getProvider() ? 'ai' : 'local';
  const steps: AgentReply['steps'] = [];
  let aiFailed = false;

  const execute = async (command: string): Promise<{ output: string; success: boolean }> => {
    const args = safeArgs(command);
    if (!args) {
      const output = `Command not allowed: ${command}`;
      steps.push({ command, output, success: false });
      return { output, success: false };
    }
    try {
      const output = await runBrowser(args, 60_000);
      steps.push({ command, output, success: true });
      return { output, success: true };
    } catch (error) {
      const output = error instanceof Error ? error.message : String(error);
      steps.push({ command, output, success: false });
      return { output, success: false };
    }
  };

  if (mode === 'ai') {
    const transcript: ChatMessage[] = [...messages];
    let lastPlan: AIPlan | null = null;

    for (let iteration = 0; iteration < MAX_AGENT_STEPS; iteration += 1) {
      let plan: AIPlan | null;
      try {
        plan = await planWithAI(transcript);
      } catch {
        aiFailed = true;
        plan = null;
        break;
      }

      if (!plan) break;
      lastPlan = plan;

      const command = String(plan.command || '').trim();

      // The model needs the user's help before it can continue — pause and ask.
      if (plan.question) {
        return {
          answer: plan.answer || `I need your help: ${plan.question}`,
          steps,
          mode,
          question: plan.question,
          reasoning_content: plan.reasoning_content,
          iterations: steps.length,
        };
      }

      if (!command) break; // the model signalled that the task is complete

      // Runaway guard: stop if the same command is issued three times in a row.
      if (steps.slice(-2).every((step) => step.command === command) && steps.length >= 2) {
        steps.push({
          command: '(loop)',
          output: 'Stopped: the same command repeated three times.',
          success: false,
        });
        break;
      }

      const result = await execute(command);

      // Feed the observation back so the next iteration can decide what to do.
      transcript.push({
        role: 'assistant',
        content: plan.raw,
        reasoning_content: plan.reasoning_content,
      });
      transcript.push({
        role: 'user',
        content:
          `Command result for "${command}" (success: ${result.success}):\n${result.output.slice(0, 4000)}` +
          '\nIf the task is not finished, return another command. When finished, return an empty command with your final answer.',
      });
    }

    // If the model never produced a usable plan, continue with the local
    // multi-step planner instead of surfacing an error to the user.
    if (aiFailed && steps.length === 0) {
      // fall through to local planning below
    } else {
    const hitLimit = Boolean(lastPlan?.command) && steps.length >= MAX_AGENT_STEPS;
    return {
      answer:
        (lastPlan?.answer || (steps.length ? 'Done.' : 'How can I help with the browser?')) +
        (hitLimit ? ` (Stopped after ${MAX_AGENT_STEPS} steps.)` : ''),
      steps,
      mode,
      reasoning_content: lastPlan?.reasoning_content,
      iterations: steps.length,
    };
    }
  }

  const planned = planLocally(lastUser);
  if (planned.length === 0) {
    return {
      answer:
        'I can control the browser for you. Try things like “open example.com”, ' +
        '“show me the interactive elements”, “what is the page title”, “click the Learn more button”, ' +
        '“check console errors”, or “take a screenshot”.',
      steps,
      mode: 'local',
      iterations: 0,
    };
  }

  for (const step of planned) await execute(step.command);

  const outputs = steps
    .map((s) => `$ agent-browser ${s.command}\n${s.output}`)
    .join('\n\n')
    .trim();

  return {
    answer: steps.length === 1 ? `Ran \`${steps[0].command}\`.` : `Ran ${steps.length} commands.`,
    steps,
    mode: aiFailed ? 'local' : mode,
    iterations: steps.length,
  };
}
