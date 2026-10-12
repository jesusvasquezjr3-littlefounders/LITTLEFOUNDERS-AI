import { useSearchParams } from 'react-router-dom';
import { HomeView, type DayValues } from '@/features/app/Home';
import type { Home } from '@/features/app/homeData';

/*
 * The home with its board of the day full, for looking at what it becomes once features exist:
 * `/dev/home`, only in the dev server (App.tsx does not mount it in a production build). The real
 * home passes no values, because no feature has anything for the day yet; here they are made up. A
 * tool, not a product screen, so its words are not in the locale files and nothing here is real.
 *
 *   ?empty           the board as the real home has it today, every tile saying "soon"
 *   ?scene=<name>    which composition is on the stage
 *   ?as=adult        a grown-up's pile, with Family
 */
const VALUES: DayValues = {
  lesson: { label: 'Lección 3 de 5', value: '8 min', progress: 0.4 },
  tasks: { value: '1 de 3', progress: 0.33 },
  seeds: { value: '1,240' },
  streak: { value: '3 días' },
};

const NOTHING: DayValues = {};

export default function DevHome() {
  const [params] = useSearchParams();

  const home: Home = {
    displayName: 'Nico', mentor: 'liruf',
    destinations: ['home', 'learn', 'mentor', 'wallet', 'tasks', ...(params.get('as') === 'adult' ? ['family' as const] : [])],
    composition: { name: params.get('scene') ?? 'jungle', day: '2026-10-11', number: 12, total: 30 },
    cards: [],
  };

  return <div className="p-6"><HomeView home={home} values={params.has('empty') ? NOTHING : VALUES} /></div>;
}
