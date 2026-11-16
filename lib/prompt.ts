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
  Identity: ({ name }: { name: string }) => `You are ${name}.`,

  CommandGuide: ({ commands }: { commands: CommandDoc[] }) =>
    `Commands: ${commands.map((command) => command.name).join(', ')}.\n`,

  ResponseContract: () =>
    `{"command":"<one command or empty>","answer":"<short answer>"}\n`,
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
