import { Fragment, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * MarkdownLite — LESSON_ENGINE.md §8. Renders ONLY **bold**, *italic*, `code`,
 * line breaks and `- ` lists. Hand-rolled and injection-safe: raw HTML renders as
 * literal text (we never use dangerouslySetInnerHTML).
 */

/*
 * `markTerms` turns **bold** into a marked TERM rather than plain bold weight
 * (/DESIGN.md §Tactile → gamified surfaces). The design study highlights the
 * numbers that matter inside the mentor's own sentence — "reparte 4 monedas in
 * each of the 3 chests" — instead of leaving a wall of one colour, and it is
 * what makes a prompt read as a puzzle rather than as a paragraph.
 *
 * It is CONTENT-DRIVEN and not decoration: a lesson author already bolds the
 * quantity the question turns on, so this renders the emphasis the content
 * already carries. Opt-in, because the same emphasis inside a results screen or
 * a hint is ordinary emphasis and a page of chips is a page of noise.
 */
function renderInline(text: string, keyPrefix: string, markTerms = false): ReactNode[] {
  const nodes: ReactNode[] = []
  // Tokenize: **bold** | *italic* | `code`
  const re = /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(`([^`]+)`)/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(<Fragment key={`${keyPrefix}-t${i++}`}>{text.slice(last, m.index)}</Fragment>)
    if (m[2] !== undefined)
      nodes.push(
        <strong key={`${keyPrefix}-b${i++}`} className={markTerms ? 'lf-term' : 'font-bold'}>
          {m[2]}
        </strong>,
      )
    else if (m[4] !== undefined) nodes.push(<em key={`${keyPrefix}-i${i++}`}>{m[4]}</em>)
    else if (m[6] !== undefined)
      nodes.push(
        <code key={`${keyPrefix}-c${i++}`} className="lf-well rounded-sm px-1.5 py-0.5 font-code text-[0.9em]">
          {m[6]}
        </code>,
      )
    last = re.lastIndex
  }
  if (last < text.length) nodes.push(<Fragment key={`${keyPrefix}-t${i++}`}>{text.slice(last)}</Fragment>)
  return nodes
}

export function MarkdownLite({
  text,
  className,
  as,
  markTerms = false,
}: {
  text: string
  className?: string
  as?: 'div' | 'span'
  /** Render **bold** as a marked term chip — mentor prompts only. */
  markTerms?: boolean
}) {
  // Inline mode — for fragments composed INSIDE another element (eavesdrop
  // splits a sentence around tappable highlight terms): no block wrappers,
  // just the inline tokens, valid inside a <p>.
  if (as === 'span') {
    return <span className={className}>{renderInline(text, 'inline', markTerms)}</span>
  }
  const lines = text.split(/\r?\n/)
  const blocks: ReactNode[] = []
  let listItems: string[] = []

  const flushList = (key: string) => {
    if (listItems.length === 0) return
    const items = listItems
    listItems = []
    blocks.push(
      <ul key={key} className="ml-5 list-disc space-y-1">
        {items.map((item, j) => (
          <li key={j}>{renderInline(item, `${key}-li${j}`, markTerms)}</li>
        ))}
      </ul>,
    )
  }

  lines.forEach((line, idx) => {
    const trimmed = line.trim()
    if (trimmed.startsWith('- ')) {
      listItems.push(trimmed.slice(2))
      return
    }
    flushList(`ul-${idx}`)
    if (trimmed.length === 0) return
    blocks.push(<p key={`p-${idx}`}>{renderInline(trimmed, `p-${idx}`, markTerms)}</p>)
  })
  flushList('ul-end')

  return <div className={cn('space-y-2', className)}>{blocks}</div>
}

export default MarkdownLite
