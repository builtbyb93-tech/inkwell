import StarterKit from '@tiptap/starter-kit';

/** Core, free extensions only. Rich-text authoring ships with the Idea Vault. */
export function createEditorExtensions() {
  return [StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: { openOnClick: false } })];
}
