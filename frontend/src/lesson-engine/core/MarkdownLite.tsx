import { Fragment, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * MarkdownLite — LESSON_ENGINE.md §8. Renders ONLY **bold**, *italic*, `code`,
 * line breaks and `- ` lists. Hand-rolled and injection-safe: raw HTML renders as
 * literal text (we never use dangerouslySetInnerHTML).
 */

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  // Tokenize: **bold** | *italic* | `code`
  const re = /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(`([^`]+)`)/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(<Fragment key={`${keyPrefix}-t${i++}`}>{text.slice(last, m.index)}</Fragment>)
    if (m[2] !== undefined) nodes.push(<strong key={`${keyPrefix}-b${i++}`} className="font-bold">{m[2]}</strong>)
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

export function MarkdownLite({ text, className, as }: { text: string; className?: string; as?: 'div' | 'span' }) {
  // Inline mode — for fragments composed INSIDE another element (eavesdrop
  // splits a sentence around tappable highlight terms): no block wrappers,
  // just the inline tokens, valid inside a <p>.
  if (as === 'span') {
    return <span className={className}>{renderInline(text, 'inline')}</span>
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
          <li key={j}>{renderInline(item, `${key}-li${j}`)}</li>
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
    blocks.push(<p key={`p-${idx}`}>{renderInline(trimmed, `p-${idx}`)}</p>)
  })
  flushList('ul-end')

  return <div className={cn('space-y-2', className)}>{blocks}</div>
}

export default MarkdownLite
