import type { LocalAllergyMatch } from '../services/localAllergyMatching';
/** Emphasize literal spans already reported by the matcher; never infer a match. */
export function ingredientHighlights(label: string, matches: LocalAllergyMatch[]) {
  const spans: { start: number; end: number }[] = [];
  for (const match of matches.filter(item => item.source === 'ingredients')) {
    const term = match.matchedIngredient.trim();
    if (!term) continue;
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(^|[^a-zA-Z0-9])(${escaped})(?=$|[^a-zA-Z0-9])`, 'gi');
    for (const result of label.matchAll(pattern)) {
      const start = result.index! + result[1].length;
      spans.push({ start, end: start + result[2].length });
    }
  }
  const merged: typeof spans = [];
  for (const span of spans.sort((a, b) => a.start - b.start)) {
    const last = merged[merged.length - 1];
    if (last && span.start <= last.end) last.end = Math.max(last.end, span.end);
    else merged.push({ ...span });
  }
  const parts: { text: string; highlighted: boolean }[] = [];
  let cursor = 0;
  for (const span of merged) {
    if (span.start > cursor) parts.push({ text: label.slice(cursor, span.start), highlighted: false });
    parts.push({ text: label.slice(span.start, span.end), highlighted: true }); cursor = span.end;
  }
  if (cursor < label.length) parts.push({ text: label.slice(cursor), highlighted: false });
  return parts;
}
