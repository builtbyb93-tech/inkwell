import { z } from 'zod';

export type RichMark = {
  type: 'bold' | 'italic' | 'strike' | 'underline' | 'code' | 'link';
  attrs?: { href: string };
};
export type RichNode = {
  type: string;
  text?: string;
  attrs?: { level?: number; start?: number; language?: string | null };
  marks?: RichMark[];
  content?: RichNode[];
};
export type RichDocument = RichNode & { type: 'doc'; content: RichNode[] };
const blocks = new Set([
  'paragraph',
  'heading',
  'bulletList',
  'orderedList',
  'blockquote',
  'codeBlock',
  'horizontalRule',
]);
const inline = new Set(['text', 'hardBreak']);
const marks = new Set(['bold', 'italic', 'strike', 'underline', 'code', 'link']);
function object(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
}
function keys(v: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(v).some((k) => !allowed.includes(k))) throw new Error('Unsupported content.');
}
export function safeLink(href: string) {
  try {
    return (
      href.length <= 2048 &&
      !Array.from(href).some((character) => character.charCodeAt(0) <= 32) &&
      ['https:', 'http:', 'mailto:'].includes(new URL(href).protocol)
    );
  } catch {
    return false;
  }
}

export function validateRichDocument(value: unknown): RichDocument {
  // Bound depth and size before recursive schema work; client HTML is never trusted.
  const stack: { value: unknown; depth: number }[] = [{ value, depth: 0 }];
  let count = 0;
  let characters = 0;
  while (stack.length) {
    const item = stack.pop()!;
    if (++count > 1000 || item.depth > 8 || !object(item.value))
      throw new Error('Content limit exceeded.');
    if (typeof item.value.text === 'string') characters += item.value.text.length;
    if (characters > 10000) throw new Error('Content limit exceeded.');
    if (item.value.content !== undefined) {
      if (!Array.isArray(item.value.content) || item.value.content.length > 1000)
        throw new Error('Invalid content.');
      for (const child of item.value.content) stack.push({ value: child, depth: item.depth + 1 });
    }
  }
  if (new TextEncoder().encode(JSON.stringify(value)).length > 24576)
    throw new Error('Content limit exceeded.');
  function node(v: unknown, parent?: string): RichNode {
    if (!object(v) || typeof v.type !== 'string') throw new Error('Invalid node.');
    keys(v, ['type', 'text', 'content', 'marks', 'attrs']);
    const type = v.type;
    if (
      type === 'doc'
        ? parent !== undefined
        : !blocks.has(type) && !inline.has(type) && type !== 'listItem'
    )
      throw new Error('Unsupported node.');
    if (parent === 'doc' || parent === 'blockquote') {
      if (!blocks.has(type)) throw new Error('Invalid block.');
    }
    if (parent === 'bulletList' || parent === 'orderedList') {
      if (type !== 'listItem') throw new Error('Invalid list.');
    }
    if (parent === 'paragraph' || parent === 'heading') {
      if (!inline.has(type)) throw new Error('Invalid inline.');
    }
    if (parent === 'codeBlock' && (type !== 'text' || v.marks !== undefined))
      throw new Error('Invalid code.');
    if (parent === 'listItem' && !blocks.has(type)) throw new Error('Invalid list item.');
    const result: RichNode = { type };
    if (type === 'text') {
      if (
        typeof v.text !== 'string' ||
        v.text.length === 0 ||
        v.content !== undefined ||
        v.attrs !== undefined
      )
        throw new Error('Invalid text.');
      result.text = v.text;
      if (v.marks !== undefined) {
        if (!Array.isArray(v.marks) || v.marks.length > 6) throw new Error('Invalid marks.');
        const seen = new Set<string>();
        result.marks = v.marks.map((mark: unknown) => {
          if (
            !object(mark) ||
            typeof mark.type !== 'string' ||
            !marks.has(mark.type) ||
            seen.has(mark.type)
          )
            throw new Error('Unsupported mark.');
          keys(mark, ['type', 'attrs']);
          seen.add(mark.type);
          if (mark.type === 'link') {
            if (
              !object(mark.attrs) ||
              typeof mark.attrs.href !== 'string' ||
              !safeLink(mark.attrs.href)
            )
              throw new Error('Invalid link.');
            keys(mark.attrs, ['href', 'target', 'rel', 'class']);
            return { type: 'link', attrs: { href: mark.attrs.href } };
          }
          if (mark.attrs !== undefined) throw new Error('Unsupported mark attributes.');
          return { type: mark.type as RichMark['type'] };
        });
      }
      if (result.marks?.some((mark) => mark.type === 'code') && result.marks.length > 1)
        throw new Error('Code cannot be combined with other marks.');
      return result;
    }
    if (v.text !== undefined || v.marks !== undefined) throw new Error('Invalid node fields.');
    if (v.attrs !== undefined) {
      if (!object(v.attrs)) throw new Error('Invalid attributes.');
      if (type === 'heading') {
        keys(v.attrs, ['level']);
        if (![1, 2, 3].includes(Number(v.attrs.level))) throw new Error('Invalid heading.');
        result.attrs = { level: Number(v.attrs.level) };
      } else if (type === 'orderedList') {
        keys(v.attrs, ['start', 'type']);
        const start = v.attrs.start ?? 1;
        if (
          !Number.isInteger(start) ||
          Number(start) < 1 ||
          Number(start) > 1000000 ||
          v.attrs.type != null
        )
          throw new Error('Invalid list attributes.');
        result.attrs = { start: Number(start) };
      } else if (type === 'codeBlock') {
        keys(v.attrs, ['language']);
        if (
          v.attrs.language !== null &&
          (typeof v.attrs.language !== 'string' || v.attrs.language.length > 40)
        )
          throw new Error('Invalid code language.');
        result.attrs = { language: v.attrs.language as string | null };
      } else throw new Error('Unsupported attributes.');
    }
    if (['hardBreak', 'horizontalRule'].includes(type)) {
      if (v.content !== undefined) throw new Error('Invalid leaf.');
      return result;
    }
    const children = v.content === undefined ? [] : v.content;
    if (!Array.isArray(children)) throw new Error('Invalid children.');
    if (
      ['doc', 'bulletList', 'orderedList', 'blockquote', 'listItem'].includes(type) &&
      children.length === 0
    )
      throw new Error('Empty container.');
    if (type === 'listItem' && (!object(children[0]) || children[0].type !== 'paragraph'))
      throw new Error('Invalid list start.');
    if (children.length) result.content = children.map((child) => node(child, type));
    return result;
  }
  const result = node(value);
  if (result.type !== 'doc' || !result.content) throw new Error('Document required.');
  if (documentText(result).length > 10000) throw new Error('Content limit exceeded.');
  return result as RichDocument;
}
export const RichDocumentSchema = z.unknown().transform((value, ctx) => {
  try {
    return validateRichDocument(value);
  } catch {
    ctx.addIssue({
      code: 'custom',
      message: 'Use supported text formatting within the 10,000-character content limit.',
    });
    return z.NEVER;
  }
});
export function plainDocument(text: string): RichDocument {
  return {
    type: 'doc',
    content: text
      .split(/\r?\n/)
      .map((line) =>
        line
          ? { type: 'paragraph', content: [{ type: 'text', text: line }] }
          : { type: 'paragraph' },
      ),
  };
}
export function documentText(doc: RichNode): string {
  if (doc.type === 'text') return doc.text ?? '';
  if (doc.type === 'hardBreak') return '\n';
  return (doc.content ?? [])
    .map(documentText)
    .join(['paragraph', 'heading', 'codeBlock'].includes(doc.type) ? '' : '\n');
}
