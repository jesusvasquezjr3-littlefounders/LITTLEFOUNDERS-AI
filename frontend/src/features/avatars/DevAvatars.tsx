import { useRef, useState } from 'react';
import { Avatar, type AvatarHandle, type Character, type Gaze } from './Avatar';
import { EXPRESSION_NAMES, type ExpressionName } from './expressions';

/*
 * A development page for looking at the avatars alive: `/dev/avatars`, only in the dev server (App.tsx does not mount
 * it in a production build). It is a tool, not a product screen, so its labels are not in the locale files.
 */
const CHARACTERS: Character[] = ['rho', 'zara', 'liruf', 'dina'];

const PHRASES = { en: 'Great job! Let us try the next one together.', es: '¡Muy bien! Vamos a intentar el siguiente juntos.', pt: 'Muito bem! Vamos tentar o próximo juntos.' };

export default function DevAvatars() {
  const [expression, setExpression] = useState<ExpressionName>('neutral');
  const [mode, setMode] = useState<'cursor' | 'idle' | 'fixed'>('cursor');
  const [look, setLook] = useState({ x: 0, y: 0 });
  const refs = useRef<Partial<Record<Character, AvatarHandle | null>>>({});
  const gaze: Gaze = mode === 'fixed' ? look : mode;

  const all = (action: (handle: AvatarHandle) => void) => {
    for (const character of CHARACTERS) {
      const handle = refs.current[character];

      if (handle) action(handle);
    }
  };

  return <div className="mx-auto max-w-[1120px] p-4" data-dev-avatars>
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {EXPRESSION_NAMES.map((name) => <button key={name} type="button" data-expression={name} className={`min-h-12 rounded-full border px-4 ${expression === name ? 'bg-[var(--primary)] text-[var(--primary-foreground)]' : ''}`} onClick={() => setExpression(name)}>{name}</button>)}
      <span className="mx-2" />
      {(['cursor', 'idle', 'fixed'] as const).map((value) => <button key={value} type="button" data-gaze={value} className={`min-h-12 rounded-full border px-4 ${mode === value ? 'bg-[var(--primary)] text-[var(--primary-foreground)]' : ''}`} onClick={() => setMode(value)}>{value}</button>)}
      <span className="mx-2" />
      {(['en', 'es', 'pt'] as const).map((key) => <button key={key} type="button" data-speak={key} className="min-h-12 rounded-full border px-4" onClick={() => all((handle) => void handle.speak(PHRASES[key]))}>speak {key}</button>)}
      <button type="button" data-react="nod" className="min-h-12 rounded-full border px-4" onClick={() => all((handle) => handle.react('nod'))}>nod</button>
      <button type="button" data-react="wiggle" className="min-h-12 rounded-full border px-4" onClick={() => all((handle) => handle.react('wiggle'))}>wiggle</button>
    </div>
    <div className="mb-4 flex items-center gap-4">
      <label className="flex items-center gap-2">x<input type="range" min={-1} max={1} step={0.05} value={look.x} data-look="x" onChange={(event) => setLook({ ...look, x: Number(event.target.value) })} /></label>
      <label className="flex items-center gap-2">y<input type="range" min={-1} max={1} step={0.05} value={look.y} data-look="y" onChange={(event) => setLook({ ...look, y: Number(event.target.value) })} /></label>
    </div>
    <div className="grid grid-cols-2 items-end gap-4 md:grid-cols-4">
      {CHARACTERS.map((character) => <Avatar key={character} ref={(handle) => { refs.current[character] = handle; }} character={character} expression={expression} gaze={gaze} label={character} className="w-full" />)}
    </div>
  </div>;
}
