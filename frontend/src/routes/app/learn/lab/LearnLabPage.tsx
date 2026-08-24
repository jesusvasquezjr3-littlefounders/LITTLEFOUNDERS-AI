/*
 * /dev/learn-lab — DEV-ONLY visual harness for the learn surfaces, in the
 * spirit of /dev/lesson-lab and /dev/tutor-lab. Every defect this directory
 * has produced was a COMPOSITION defect, and a composition defect passes
 * type-check, lint and the whole unit suite. This route mounts the REAL
 * pages, inside the REAL app-shell measurements, so that the §1.11
 * "screenshot 375 and 1280 before closing" gate is something you can
 * actually do without the whole Supabase stack running locally.
 *
 * Only the network edge is stubbed: `window.fetch` answers the four learn
 * endpoints from `./fixtures` and passes everything else through.
 *
 * The route carries a `:courseSlug` because the pages read it with
 * `useParams`, and it is what decides whether a territory chip is a link or a
 * padlock. Mounted without one, every chip falls to its locked branch and the
 * lab shows a state no learner is ever in.
 */
import { useState } from 'react'
import { AuthProvider } from '@/auth/AuthContext'
import { ThemeToggle } from '@/components/ui'
import { LearnPage } from '@/routes/app/LearnPage'
import { CoursePage } from '../CoursePage'
import { TerritoryPage } from '../TerritoryPage'
import { PlacementPage } from '../PlacementPage'
import { FIXTURE_COURSES, FIXTURE_PROBE, FIXTURE_TREE } from './fixtures'

type View = 'home' | 'course' | 'territory' | 'placement'

const VIEWS: View[] = ['home', 'course', 'territory', 'placement']

const FIXTURE_ME = {
  profile: { display_name: 'Ana Sofía', username: 'anasofia' },
  roles: ['universal'],
  avatarOptions: {},
  analyticsEnabled: false,
  newAccount: false,
  onboardingComplete: true,
}

function fixtureFor(path: string): unknown | undefined {
  if (path.endsWith('/auth/me')) return FIXTURE_ME
  if (path.endsWith('/learn/courses')) return FIXTURE_COURSES
  if (path.includes('/learn/courses/') && path.endsWith('/tree')) return FIXTURE_TREE
  if (path.includes('/placement/') && path.endsWith('/probe')) return FIXTURE_PROBE
  return undefined
}

/*
 * A session shaped exactly like AuthContext's stored one, far enough from
 * expiry that `getToken` never tries to refresh. It exists because
 * TerritoryPage refuses to fetch without a token, which is correct in the
 * product and would leave the lab stuck on its spinner.
 */
function installSession(): void {
  window.localStorage.setItem(
    'lf.session.v1',
    JSON.stringify({
      accessToken: 'dev-learn-lab-token',
      refreshToken: 'dev-learn-lab-refresh',
      expiresAt: Date.now() + 86_400_000,
      user: { id: '4f2b1a7c-9d3e-4c8b-a5f6-000000000999', email: 'lab@example.test' },
      isGuest: false,
    }),
  )
}

function installStub(): void {
  const real = window.fetch.bind(window)
  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const data = fixtureFor(new URL(url, window.location.origin).pathname)
    if (data === undefined) return real(input as RequestInfo, init)
    return new Response(JSON.stringify({ data, error: null }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }) as typeof window.fetch
}

// Both run when this lazy chunk loads, which is before the nested
// AuthProvider below mounts and reads either of them.
installSession()
installStub()

export function LearnLabPage() {
  const [view, setView] = useState<View>('home')

  return (
    <AuthProvider>
    <div className="min-h-screen bg-base pt-14">
      <div className="lf-glass fixed inset-x-0 top-0 z-50 flex items-center gap-2 overflow-x-auto border-x-0 border-t-0 px-4 py-2">
        <span className="lf-caption font-bold text-content-faint">learn lab</span>
        {VIEWS.map((candidate) => (
          <button
            key={candidate}
            type="button"
            onClick={() => setView(candidate)}
            className={`lf-caption shrink-0 rounded-full px-3 py-1.5 font-bold ${
              view === candidate ? 'bg-accent text-on-accent' : 'bg-surface-sunken text-content-muted'
            }`}
          >
            {candidate}
          </button>
        ))}
        <span className="ml-auto flex shrink-0 items-center gap-2">
          <span className="lf-caption lf-number text-content-faint">{window.innerWidth}px</span>
          <ThemeToggle />
        </span>
      </div>

      {/* Mirrors AppLayout's content box so widths here are the widths shipped. */}
      {view === 'placement' ? (
        <PlacementPage />
      ) : (
        <main className="px-5 pb-24 pt-6 md:px-8 lg:pb-10 lg:pt-10">
          <div className="mx-auto max-w-container">
            {view === 'home' && <LearnPage />}
            {view === 'course' && <CoursePage />}
            {view === 'territory' && <TerritoryPage />}
          </div>
        </main>
      )}
    </div>
    </AuthProvider>
  )
}

export default LearnLabPage
