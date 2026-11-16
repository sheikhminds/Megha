import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Fragment, jsx, jsxs } from 'react/jsx-runtime';

/**
 * The system prompt is authored in MDX (Markdown + JSX) at prompts/megha.mdx.
 * At runtime we compile it and flatten the resulting element tree into plain
 * text, using small presentational components. This keeps the instructions
 * modular, composable and dynamic (name, commands and model are injected as
 * props) while still producing a regular string system message for the model.
 */

type ElementNode = {
  type?: unknown;
  props?: Record<string, unknown> & { children?: unknown };
};

export function toText(node: unknown): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(toText).join('');
  if (typeof node === 'object') {
    const element = node as ElementNode;
    if (element.props) {
      const children = toText(element.props.children);
      if (typeof element.type === 'function') {
        return String((element.type as (props: Record<string, unknown>) => unknown)({
          ...element.props,
          children,
        }));
      }
      if (typeof element.type === 'string' &&
          ['p', 'h1', 'h2', 'h3', 'li', 'pre', 'blockquote', 'section'].includes(element.type)) {
        return `\n${children}\n`;
      }
      return children;
    }
  }
  return String(node);
}

const inline = (children: unknown) => toText(children).trim();

interface CommandDoc {
  name: string;
  description: string;
}

const promptComponents = {
  Identity: ({ name, tagline }: { name: string; tagline: string }) =>
    `Agent name: ${name}\nTagline: ${tagline}\n`,

  CommandGuide: ({ commands }: { commands: CommandDoc[] }) =>
    `Available commands (use at most one per turn):\n${commands
      .map((command) => `- ${command.name} — ${command.description}`)
      .join('\n')}\n`,

  AgentLoop: ({ maxSteps }: { maxSteps: number }) =>
    [
      `Agent loop (up to ${maxSteps} steps):`,
      '- You will receive the result of each command before your next turn. Read it carefully.',
      '- If the task is not finished, return another command. DO NOT stop after just opening a page.',
      '- For example, "open google and search for X" means: open google, then fill the search box, then press Enter, then read the results.',
      '- Verify the result of each action before moving on; take a new snapshot after navigation or DOM changes because refs go stale.',
      '- When the task is genuinely complete, return an empty command with your final answer.',
      '- Never ask the user for permission between steps — keep working autonomously.',
      '',
    ].join('\n'),

  Steps: ({ children }: { children: unknown }) => `Workflow:\n${inline(children)}\n`,

  Step: ({ title, children }: { title: string; children: unknown }) =>
    `- ${title}: ${inline(children)}`,

  ResponseContract: () =>
    [
      'Response contract:',
      'Return ONLY a JSON object, with no prose around it:',
      '{"command": "<one agent-browser command, or an empty string>", "answer": "<short message to the user>"}',
      'Set command to "" only when the task is complete or you can answer from information you already have.',
      '',
    ].join('\n'),

  Guardrails: ({ children }: { children: unknown }) => `Guardrails:\n${inline(children)}\n`,
};

export interface PromptContext {
  [key: string]: unknown;
  name: string;
  model: string;
  commands: CommandDoc[];
}

const cache = new Map<string, string>();

export async function buildSystemPrompt(context: PromptContext): Promise<string> {
  const key = JSON.stringify(context);
  const cached = cache.get(key);
  if (cached) return cached;

  const source = await readFile(path.join(process.cwd(), 'prompts', 'megha.mdx'), 'utf8');
  const { evaluate } = await import('@mdx-js/mdx');

  const { default: Content } = await evaluate(source, {
    development: false,
    Fragment,
    jsx,
    jsxs,
    useMDXComponents: () => promptComponents,
  } as unknown as Parameters<typeof evaluate>[1]);

  const tree = (Content as unknown as (props: PromptContext) => unknown)(context);
  const prompt = toText(tree).replace(/\n{3,}/g, '\n\n').trim();
  cache.set(key, prompt);
  return prompt;
}
