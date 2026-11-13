'use client';
import { useEffect, useMemo } from 'react';
import { useEditor, EditorContent, useEditorState } from '@tiptap/react';
import { type RichDocument } from '@inkwell/contracts';
import { createEditorExtensions } from './index';
export function RichTextEditor({
  value,
  onChange,
  disabled = false,
  label = 'Idea content',
}: {
  value: RichDocument;
  onChange: (doc: RichDocument) => void;
  disabled?: boolean;
  label?: string;
}) {
  const extensions = useMemo(createEditorExtensions, []);
  const editor = useEditor({
    extensions,
    content: value,
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: {
        role: 'textbox',
        'aria-label': label,
        'aria-multiline': 'true',
        class: 'rich-input',
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getJSON() as RichDocument),
  });
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor?.isActive('bold') ?? false,
      italic: editor?.isActive('italic') ?? false,
      list: editor?.isActive('bulletList') ?? false,
      ordered: editor?.isActive('orderedList') ?? false,
      heading: editor?.isActive('heading', { level: 2 }) ?? false,
      undo: editor?.can().undo() ?? false,
      redo: editor?.can().redo() ?? false,
    }),
  });
  useEffect(() => {
    if (editor) {
      editor.setEditable(!disabled, false);
      editor.view.dom.setAttribute('aria-disabled', String(disabled));
    }
  }, [editor, disabled]);
  return (
    <div className="rich-editor">
      <span className="field-label">{label}</span>
      <div role="toolbar" aria-label="Text formatting" className="editor-toolbar">
        <button
          type="button"
          disabled={!editor || disabled}
          aria-pressed={state?.bold}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          Bold
        </button>
        <button
          type="button"
          disabled={!editor || disabled}
          aria-pressed={state?.italic}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          Italic
        </button>
        <button
          type="button"
          disabled={!editor || disabled}
          aria-pressed={state?.heading}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          Heading
        </button>
        <button
          type="button"
          disabled={!editor || disabled}
          aria-pressed={state?.list}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          List
        </button>
        <button
          type="button"
          disabled={!editor || disabled}
          aria-pressed={state?.ordered}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        >
          Numbered list
        </button>
        <button
          type="button"
          disabled={!editor || disabled || !state?.undo}
          onClick={() => editor?.chain().focus().undo().run()}
        >
          Undo
        </button>
        <button
          type="button"
          disabled={!editor || disabled || !state?.redo}
          onClick={() => editor?.chain().focus().redo().run()}
        >
          Redo
        </button>
      </div>
      <EditorContent editor={editor} />
      <p className="field-help">
        Write with simple formatting. Up to 10,000 text characters; save changes explicitly.
      </p>
    </div>
  );
}
