import StarterKit from '@tiptap/starter-kit';

/** Core, free extensions only. Rich-text authoring ships with the Idea Vault. */
export function createEditorExtensions() {
  return [StarterKit.configure({ link: { openOnClick: false } })];
}
