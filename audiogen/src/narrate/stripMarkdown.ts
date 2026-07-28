/*
 * Strips MarkdownLite syntax (LESSON_ENGINE.md §8: **bold**, *italic*, `code`,
 * line breaks, "- " lists — nothing else is valid) down to plain narration
 * text for TTS. Mirrors what frontend/src/lesson-engine/core/MarkdownLite.tsx
 * renders visually, but flattens to prose instead of DOM nodes.
 */
export function stripMarkdown(text: string): string {
  const lines = text.split(/\r?\n/);
  const sentences: string[] = [];

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (trimmed.length === 0) continue;
    const isListItem = trimmed.startsWith('- ');
    const body = isListItem ? trimmed.slice(2) : trimmed;
    const plain = body
      .replace(/==([^=\n]+)==/g, '$1') // eavesdrop ==highlight== markers — visual, never spoken
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .trim();
    if (plain.length > 0) sentences.push(plain);
  }

  return sentences.join('. ').replace(/\.\s*\./g, '.').trim();
}
