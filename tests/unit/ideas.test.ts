import { describe, it, expect } from 'vitest';
import {
  IdeaInput,
  IdeaPatch,
  IdeaLinkInput,
  IdeaConversionInput,
  RichDocumentSchema,
  plainDocument,
  documentText,
  validateRichDocument,
} from '@inkwell/contracts';
import { ideaTitle, taxonomyNameKey } from '@inkwell/domain';

describe('portable idea contracts and safe structured text', () => {
  it('preserves supported formatting and produces complete plain text for search/story seeds', () => {
    const doc = validateRichDocument({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'A bright comet',
              marks: [
                { type: 'bold' },
                {
                  type: 'link',
                  attrs: {
                    href: 'https://example.test/story',
                    target: '_blank',
                    rel: 'noopener',
                    class: null,
                  },
                },
              ],
            },
          ],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Find its home' }] }],
            },
          ],
        },
      ],
    });
    expect(documentText(doc)).toBe('A bright comet\nFind its home');
    expect(doc.content[0]?.content?.[0]?.marks?.[1]?.attrs).toEqual({
      href: 'https://example.test/story',
    });
    expect(documentText(plainDocument('First\n\nThird'))).toBe('First\n\nThird');
  });
  it('rejects executable URLs, unknown nodes/attributes and malformed/deep/oversized documents', () => {
    const malicious = [
      { type: 'doc', content: [{ type: 'image', attrs: { src: 'https://external.example' } }] },
      { type: 'doc', content: [{ type: 'paragraph', attrs: { onclick: 'alert(1)' } }] },
      { type: 'doc', content: [{ type: 'text', text: 'invalid block' }] },
      {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'click',
                marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
              },
            ],
          },
        ],
      },
      plainDocument('x'.repeat(10001)),
    ];
    let nested: unknown = { type: 'paragraph' };
    for (let i = 0; i < 15; i++) nested = { type: 'blockquote', content: [nested] };
    malicious.push({ type: 'doc', content: [nested] } as never);
    for (const doc of malicious) expect(RichDocumentSchema.safeParse(doc).success).toBe(false);
  });
  it('rejects ownership injection and ambiguous targets while keeping omitted patch fields absent', () => {
    expect(
      IdeaInput.safeParse({ title: 'Idea', content: plainDocument('text'), workspaceId: 'foreign' })
        .success,
    ).toBe(false);
    expect(IdeaPatch.parse({ archived: true })).toEqual({ archived: true });
    expect(IdeaPatch.safeParse({}).success).toBe(false);
    expect(
      IdeaLinkInput.safeParse({
        kind: 'SCENE',
        projectId: crypto.randomUUID(),
        storyId: crypto.randomUUID(),
      }).success,
    ).toBe(false);
    expect(
      IdeaConversionInput.safeParse({
        kind: 'STORY',
        projectId: crypto.randomUUID(),
        sceneId: crypto.randomUUID(),
      }).success,
    ).toBe(false);
  });
  it('normalizes label identity and derives a bounded title without AI', () => {
    expect(taxonomyNameKey('  WORLD   Building ')).toBe('world building');
    expect(ideaTitle('  First thought\nMore detail')).toBe('First thought');
    expect(ideaTitle('x'.repeat(200))).toHaveLength(120);
  });
});
