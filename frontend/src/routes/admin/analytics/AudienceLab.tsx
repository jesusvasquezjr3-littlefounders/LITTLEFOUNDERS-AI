import { AudienceChart } from './AudienceChart';
import type { AudienceSeriesPoint } from './analyticsShared';

/*
 * `/dev/audience-lab` — the audience chart, without an admin session.
 *
 * The chart it renders is the one genuinely new visual on /admin/analytics,
 * and it lives behind authentication, which makes it the hardest thing on the
 * page to look at and therefore the easiest to ship broken. Same reasoning as
 * `/dev/analytics-notices`: DEV-only, no route or byte of it reaches
 * production (App.tsx gates it on import.meta.env.DEV).
 *
 * THE FIXTURE IS REAL PRODUCTION DATA, read on 2026-08-28. That matters more
 * than it looks: invented numbers are always tidy, and the shape this chart
 * has to survive is the real one — a staff bar an order of magnitude taller
 * than everything else, long stretches of genuine zeros, and single-session
 * days that must still be visible rather than rounding into the axis.
 */
const REAL_SERIES: AudienceSeriesPoint[] = [
  { date: '2026-08-03', anonymous: 0, registered: 0, staff: 32 },
  { date: '2026-08-04', anonymous: 0, registered: 0, staff: 75 },
  { date: '2026-08-05', anonymous: 0, registered: 0, staff: 26 },
  { date: '2026-08-06', anonymous: 4, registered: 0, staff: 36 },
  { date: '2026-08-07', anonymous: 0, registered: 0, staff: 24 },
  { date: '2026-08-08', anonymous: 0, registered: 0, staff: 18 },
  { date: '2026-08-09', anonymous: 2, registered: 0, staff: 8 },
  { date: '2026-08-10', anonymous: 7, registered: 0, staff: 13 },
  { date: '2026-08-11', anonymous: 10, registered: 18, staff: 8 },
  { date: '2026-08-12', anonymous: 2, registered: 6, staff: 3 },
  { date: '2026-08-13', anonymous: 11, registered: 7, staff: 12 },
  { date: '2026-08-14', anonymous: 5, registered: 0, staff: 15 },
  { date: '2026-08-15', anonymous: 0, registered: 0, staff: 3 },
  { date: '2026-08-16', anonymous: 0, registered: 0, staff: 0 },
  { date: '2026-08-17', anonymous: 3, registered: 0, staff: 6 },
  { date: '2026-08-18', anonymous: 2, registered: 0, staff: 3 },
  { date: '2026-08-19', anonymous: 0, registered: 0, staff: 9 },
  { date: '2026-08-20', anonymous: 1, registered: 0, staff: 0 },
  { date: '2026-08-21', anonymous: 2, registered: 0, staff: 0 },
  { date: '2026-08-22', anonymous: 0, registered: 0, staff: 8 },
  { date: '2026-08-23', anonymous: 1, registered: 0, staff: 1 },
  { date: '2026-08-24', anonymous: 0, registered: 0, staff: 0 },
  { date: '2026-08-25', anonymous: 4, registered: 0, staff: 0 },
  { date: '2026-08-26', anonymous: 0, registered: 0, staff: 0 },
  { date: '2026-08-27', anonymous: 0, registered: 1, staff: 6 },
];

/** A window with nothing in it — the state that must not look like a fault. */
const EMPTY_SERIES: AudienceSeriesPoint[] = REAL_SERIES.slice(0, 7).map((p) => ({
  date: p.date,
  anonymous: 0,
  registered: 0,
  staff: 0,
}));

export default function AudienceLab() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-10">
      <header className="flex flex-col gap-1">
        <h1 className="lf-headline font-bold text-content">Audience chart</h1>
        <p className="lf-caption text-content-muted">
          Dev harness for the /admin/analytics audience chart. Fixture is real production data read 2026-08-28.
        </p>
      </header>

      <section className="flex flex-col gap-3" aria-label="Real production shape">
        <h2 className="lf-title text-content">1 — The real shape</h2>
        <p className="lf-caption text-content-muted">
          Staff dwarf everything else, and single-session days still have to be visible.
        </p>
        <AudienceChart series={REAL_SERIES} />
      </section>

      <section className="flex flex-col gap-3" aria-label="Empty window">
        <h2 className="lf-title text-content">2 — An empty window</h2>
        <p className="lf-caption text-content-muted">
          Must read as a measured zero, never as a failed load.
        </p>
        <AudienceChart series={EMPTY_SERIES} />
      </section>
    </main>
  );
}
