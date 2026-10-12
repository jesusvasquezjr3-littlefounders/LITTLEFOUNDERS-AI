import type { SVGProps } from 'react';

/*
 * The four social marks, drawn here as simple one-color glyphs on a 24 px grid. They are the
 * product's own drawings of those marks (no icon pack), filled with `currentColor`, and always
 * decorative: the link or label that holds one carries the name.
 */
type Glyph = (props: SVGProps<SVGSVGElement>) => React.JSX.Element;

const base = { viewBox: '0 0 24 24', 'aria-hidden': true, focusable: false, fill: 'currentColor' } as const;

export const Facebook: Glyph = (props) => <svg {...base} {...props}>
  <path d="M13.6 21.5v-8.2h2.8l.5-3.4h-3.3V7.8c0-1 .4-1.7 1.8-1.7h1.6V3.2c-.3 0-1.3-.2-2.4-.2-2.5 0-4.1 1.5-4.1 4.2v2.7H7.7v3.4h2.8v8.2h3.1z" />
</svg>;

export const Instagram: Glyph = (props) => <svg {...base} {...props}>
  <path d="M7.5 2h9A5.5 5.5 0 0 1 22 7.5v9a5.5 5.5 0 0 1-5.5 5.5h-9A5.5 5.5 0 0 1 2 16.5v-9A5.5 5.5 0 0 1 7.5 2zm0 2A3.5 3.5 0 0 0 4 7.5v9A3.5 3.5 0 0 0 7.5 20h9a3.5 3.5 0 0 0 3.5-3.5v-9A3.5 3.5 0 0 0 16.5 4h-9zM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm5.2-3.2a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4z" />
</svg>;

export const X: Glyph = (props) => <svg {...base} {...props}>
  <path d="M17.8 3h3.1l-6.8 7.8L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.3-8.3L2 3h6.4l4.4 5.8L17.8 3zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5z" />
</svg>;

export const LinkedIn: Glyph = (props) => <svg {...base} {...props}>
  <path d="M5 3.2a2.1 2.1 0 1 1 0 4.2 2.1 2.1 0 0 1 0-4.2zM3.2 9h3.6v11.8H3.2V9zm6 0h3.4v1.6h.1c.5-.9 1.6-1.9 3.4-1.9 3.6 0 4.3 2.4 4.3 5.5v6.6h-3.6v-5.8c0-1.4 0-3.2-2-3.2s-2.2 1.5-2.2 3.1v5.9H9.2V9z" />
</svg>;

export const SOCIAL_GLYPHS = { facebook: Facebook, instagram: Instagram, x: X, linkedin: LinkedIn } as const;
