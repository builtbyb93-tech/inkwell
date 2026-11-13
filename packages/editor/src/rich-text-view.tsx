import type { ReactNode } from 'react';
import {
  type RichDocument,
  type RichNode,
  validateRichDocument,
  safeLink,
} from '@inkwell/contracts';
function render(node: RichNode, key: string): ReactNode {
  const children = node.content?.map((child, i) => render(child, `${key}-${i}`));
  if (node.type === 'text') {
    let text: ReactNode = node.text ?? '';
    for (const mark of node.marks ?? []) {
      switch (mark.type) {
        case 'bold':
          text = <strong>{text}</strong>;
          break;
        case 'italic':
          text = <em>{text}</em>;
          break;
        case 'underline':
          text = <u>{text}</u>;
          break;
        case 'strike':
          text = <s>{text}</s>;
          break;
        case 'code':
          text = <code>{text}</code>;
          break;
        case 'link':
          if (mark.attrs && safeLink(mark.attrs.href))
            text = (
              <a href={mark.attrs.href} rel="noopener noreferrer nofollow" target="_blank">
                {text}
              </a>
            );
          break;
      }
    }
    return <span key={key}>{text}</span>;
  }
  switch (node.type) {
    case 'doc':
      return <div key={key}>{children}</div>;
    case 'paragraph':
      return <p key={key}>{children ?? <br />}</p>;
    case 'heading':
      return node.attrs?.level === 3 ? (
        <h3 key={key}>{children}</h3>
      ) : (
        <h2 key={key}>{children}</h2>
      );
    case 'bulletList':
      return <ul key={key}>{children}</ul>;
    case 'orderedList':
      return (
        <ol key={key} start={node.attrs?.start ?? 1}>
          {children}
        </ol>
      );
    case 'listItem':
      return <li key={key}>{children}</li>;
    case 'blockquote':
      return <blockquote key={key}>{children}</blockquote>;
    case 'codeBlock':
      return (
        <pre key={key}>
          <code>{children}</code>
        </pre>
      );
    case 'hardBreak':
      return <br key={key} />;
    case 'horizontalRule':
      return <hr key={key} />;
    default:
      return null;
  }
}
export function RichTextView({ document }: { document: RichDocument }) {
  return <div className="rich-view">{render(validateRichDocument(document), 'document')}</div>;
}
