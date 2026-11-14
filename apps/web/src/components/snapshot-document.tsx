import type { SnapshotDocument as Document } from '@inkwell/contracts';
import { RichTextView } from '@inkwell/editor/render';
const labels: Record<string, string> = {
  PROJECT: 'Project',
  STORY: 'Story',
  IDEA: 'Idea',
  CANON: 'Story Bible',
  SCENE: 'Scene',
  GROUP: 'Plot group',
  STORY_IDEA: 'Story idea',
  SCENE_IDEA: 'Scene idea',
  SCENE_CHARACTER: 'Character in scene',
  SCENE_LOCATION: 'Location in scene',
  RELATED: 'Related',
  KNOWS: 'Knows',
  MEMBER_OF: 'Member of',
  LOCATED_IN: 'Located in',
  PART_OF: 'Part of',
  PRECEDES: 'Precedes',
};
export function SnapshotDocumentView({
  document: doc,
  preview = false,
}: {
  document: Document;
  preview?: boolean;
}) {
  const Heading = preview ? 'h2' : 'h1',
    RecordHeading = preview ? 'h3' : 'h2',
    names = new Map(doc.records.map((r) => [r.id, r.title || 'Name explicitly cleared']));
  return (
    <div className="snapshot-document">
      <Heading>{doc.title}</Heading>
      <p className="field-help">
        A fixed copy created {new Date(doc.createdAt).toLocaleString()}. Changes to the original
        stay private.
      </p>
      {doc.records.map((r) => (
        <article className="snapshot-record" id={'copy-' + r.id} key={r.id}>
          <p className="eyebrow">
            {labels[r.kind]}
            {r.kind === 'CANON' ? ' · ' + r.canonKind.toLowerCase() : ''}
          </p>
          <RecordHeading>{r.title || 'Name explicitly cleared'}</RecordHeading>
          {r.kind === 'SCENE' && <p className="field-help">{r.status.toLowerCase()}</p>}
          {r.kind === 'STORY' && r.format && <p>{r.format}</p>}
          {'content' in r ? (
            <RichTextView document={r.content} />
          ) : (
            <p className="snapshot-plain">{r.text}</p>
          )}
        </article>
      ))}
      {doc.relationships.length > 0 && (
        <section aria-label="Selected relationships">
          <RecordHeading>Connections in this copy</RecordHeading>
          <ul>
            {doc.relationships.map((r, i) => (
              <li key={i}>
                <a href={'#copy-' + r.fromId}>{names.get(r.fromId)}</a> —{' '}
                {r.label || labels[r.kind]} → <a href={'#copy-' + r.toId}>{names.get(r.toId)}</a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
