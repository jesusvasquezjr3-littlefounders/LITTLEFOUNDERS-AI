/*
 * The room a board's name takes, in CSS pixels, before it is drawn: a name is 14 px bold HTML (BoardLabel), so a drawing that
 * reserves its room must count it in pixels, by an average glyph a little wider than the real one.
 */

/** A 14 px bold glyph is at most this wide on average (the real average is a little under), and a line is this tall. */
export const CHAR_PX = 8.2;
export const LINE_PX = 16.5;
/** A name wraps at this width unless one word is wider. */
export const ROOM_PX = 64;

/** A name's block in pixels, and the width it wraps at. A wrapped name keeps the full width, as its box does. */
export interface Block { w: number; h: number; room: number }

/** Greedy word wrap at `room` CSS pixels, by the average glyph width. */
function wrap(text: string, room: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && next.length * CHAR_PX > room) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [text];
}

/** `tag` is a second line under the name (a role such as the start); `wide` is the width the name may take before it wraps. */
export function blockOf(name: string, tag?: string, wide: number = ROOM_PX): Block {
  const longest = Math.max(...name.split(/\s+/).map((word) => word.length));
  /* A word never breaks: the room is at least the longest word, with a margin for a wide glyph. */
  const room = Math.max(wide, longest * CHAR_PX * 1.12);
  const lines = wrap(name, room);
  const width = Math.max(lines.length > 1 ? room : name.length * CHAR_PX, (tag?.length ?? 0) * CHAR_PX);
  return { w: width, h: (lines.length + (tag ? 1 : 0)) * LINE_PX, room };
}
