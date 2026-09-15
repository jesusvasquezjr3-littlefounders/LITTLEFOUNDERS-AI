import { useId, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Icon } from './Icon';

/*
 * A single-open accordion: opening one item closes any other, which is what
 * keeps a long FAQ scannable rather than turning into every answer stacked
 * open at once. Each trigger is a real <button> inside an <h3> (`headingAs`
 * lets a caller downgrade that where a page already owns its own h3), with
 * `aria-expanded`/`aria-controls` wired to the panel it opens — no
 * `<details>`, which cannot be animated or single-open without extra JS
 * anyway.
 */

export interface AccordionItem {
  id: string;
  question: ReactNode;
  answer: ReactNode;
}

export function Accordion({
  items,
  className,
  headingAs: Heading = 'h3',
}: {
  items: AccordionItem[];
  className?: string;
  headingAs?: 'h3' | 'div';
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const baseId = useId();

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {items.map((item) => {
        const open = item.id === openId;
        const panelId = `${baseId}-panel-${item.id}`;
        const triggerId = `${baseId}-trigger-${item.id}`;
        return (
          <div
            key={item.id}
            className="overflow-hidden rounded-lg border border-outline/70 bg-surface shadow-glass-sm"
          >
            <Heading>
              <button
                type="button"
                id={triggerId}
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpenId(open ? null : item.id)}
                className="lf-press flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-surface-sunken/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span className="lf-label text-content">{item.question}</span>
                <Icon
                  name={open ? 'remove' : 'add'}
                  aria-hidden
                  className="shrink-0 text-content-faint transition-transform duration-150"
                />
              </button>
            </Heading>
            {open && (
              <div id={panelId} role="region" aria-labelledby={triggerId} className="border-t border-outline/50 px-4 py-3">
                <p className="lf-body text-content-muted">{item.answer}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
