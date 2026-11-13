export type BibleContext = { projectId: string; storyId?: string };
export function bibleUrl(c: BibleContext, id?: string) {
  return `/projects/${c.projectId}${c.storyId ? `/stories/${c.storyId}` : ''}/canon${id ? '/' + id : ''}`;
}
export function canonPath(c: BibleContext, id?: string, suffix = '') {
  return `/projects/${c.projectId}/canon${id ? '/' + id : ''}${suffix}${c.storyId ? '?storyId=' + c.storyId : ''}`;
}
export function withQuery(path: string, key: string, value: string) {
  const url = new URL(path, 'http://local');
  url.searchParams.set(key, value);
  return url.pathname + url.search;
}
export function canonLabel(value: string) {
  return value.toLowerCase().replaceAll('_', ' ');
}
