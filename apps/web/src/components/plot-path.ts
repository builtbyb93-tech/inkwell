export type PlotContext = { projectId: string; storyId: string };
export const plotPath = (c: PlotContext, suffix = '') =>
  `/projects/${c.projectId}/stories/${c.storyId}/plot${suffix}`;
export const plotUrl = plotPath;
export function queryPath(path: string, query: Record<string, string>) {
  const q = new URLSearchParams(query);
  return path + (q.size ? '?' + q.toString() : '');
}
export function plotLabel(value: string) {
  return value.toLowerCase().replaceAll('_', ' ');
}
