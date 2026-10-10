import { useRef, useState, type ReactNode } from 'react';
import { Avatar, type AvatarHandle, type Character, type Gaze } from './Avatar';
import { EXPRESSION_NAMES, GESTURE_NAMES, type ExpressionName } from './expressions';
import { NEUTRAL_FRAME, type Frame } from './rig';
import { visemesFromText, type SpeechLanguage, type VisemeName } from './visemes';

/*
 * The avatars alive, for trying every result at once: `/dev/avatars`, only in the dev server (App.tsx does not mount
 * it in a production build). It is a tool, not a product screen, so its labels are not in the locale files.
 *
 * Change an SVG or a rig in tools/avatars, run `python tools/avatars/parts.py <Character>`, and this page updates by
 * itself (Vite reloads the file).
 */
const CHARACTERS: Character[] = ['rho', 'zara', 'liruf', 'dina'];

const VISEME_NAMES: readonly VisemeName[] = ['PP', 'FF', 'TH', 'DD', 'KK', 'SS', 'CH', 'RR', 'AA', 'EE', 'II', 'OO', 'UU'];

const SAMPLES: Record<SpeechLanguage, string> = {
  en: 'Great job! Let us try the next one together, step by step.',
  es: '¡Muy bien! Vamos a intentar el siguiente juntos, paso a paso.',
  pt: 'Muito bem! Vamos tentar o próximo juntos, passo a passo.',
};

/** The sliders: every number the rig takes, with its range. */
const SLIDERS: readonly (readonly [keyof Frame, number, number])[] = [
  ['turn', -1, 1], ['tilt', -12, 12], ['lean', 0, 1], ['lift', -1, 1], ['nod', 0, 1], ['bounce', 0, 1],
  ['lookX', -1, 1], ['lookY', -1, 1], ['eyeOpenL', 0, 1.5], ['eyeOpenR', 0, 1.5], ['eyeTilt', -1, 1], ['pupil', 0.5, 1.5],
  ['browLiftL', -1, 1], ['browLiftR', -1, 1], ['browTiltL', -1, 1], ['browTiltR', -1, 1], ['browSqueeze', 0, 1], ['noseWrinkle', 0, 1],
  ['mouthOpen', 0, 1.2], ['mouthWide', 0.4, 1.4], ['smile', -1, 1], ['smirk', -1, 1], ['pucker', 0, 1], ['press', 0, 1], ['cheek', 0, 1.5],
];

function Group({ title, children }: { title: string; children: ReactNode }) {
  return <section className="mb-4"><h2 className="mb-2 text-sm font-semibold uppercase tracking-wide opacity-70">{title}</h2><div className="flex flex-wrap gap-2">{children}</div></section>;
}

function Chip({ on, onClick, children, ...rest }: { on?: boolean; onClick: () => void; children: ReactNode; [key: `data-${string}`]: string }) {
  return <button type="button" {...rest} className={`min-h-10 rounded-full border px-3 text-sm ${on ? 'bg-[var(--primary)] text-[var(--primary-foreground)]' : ''}`} onClick={onClick}>{children}</button>;
}

export default function DevAvatars() {
  const [expression, setExpression] = useState<ExpressionName>('neutral');
  const [mode, setMode] = useState<'cursor' | 'idle' | 'fixed'>('cursor');
  const [look, setLook] = useState({ x: 0, y: 0 });
  const [focus, setFocus] = useState<Character | 'all'>('all');
  const [interactive, setInteractive] = useState(true);
  const [language, setLanguage] = useState<SpeechLanguage>('en');
  const [text, setText] = useState(SAMPLES.en);
  const [rate, setRate] = useState(1);
  const [overrides, setOverrides] = useState<Partial<Frame>>({});
  const [status, setStatus] = useState('');
  const refs = useRef<Partial<Record<Character, AvatarHandle | null>>>({});
  const gaze: Gaze = mode === 'fixed' ? look : mode;
  const shown = focus === 'all' ? CHARACTERS : [focus];

  const all = (action: (handle: AvatarHandle) => void) => {
    for (const character of shown) {
      const handle = refs.current[character];

      if (handle) action(handle);
    }
  };

  const speak = () => {
    const events = visemesFromText(text, { language, rate });

    setStatus(`${events.length} mouth shapes, ${(events[events.length - 1]?.at ?? 0).toFixed(1)} s`);
    all((handle) => void handle.speak(events));
  };

  const playFile = (file: File | undefined) => {
    if (!file) return;

    const audio = new Audio(URL.createObjectURL(file));

    setStatus(`playing ${file.name}${text ? ' (words fitted to the audio)' : ' (mouth follows the sound)'}`);
    all((handle) => void handle.speakAudio(audio, { text: text || undefined, language }));
    void audio.play().catch(() => setStatus('the browser did not allow sound; click the page first'));
  };

  const setSlider = (key: keyof Frame, value: number) => setOverrides((current) => ({ ...current, [key]: value }));

  return <div className="mx-auto grid max-w-[1400px] gap-6 p-4 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]" data-dev-avatars>
    <aside className="lg:max-h-[calc(100dvh-8rem)] lg:overflow-y-auto lg:pr-2">
      <Group title="Characters">
        {(['all', ...CHARACTERS] as const).map((name) => <Chip key={name} on={focus === name} data-focus={name} onClick={() => setFocus(name)}>{name}</Chip>)}
      </Group>
      <Group title="Expression">
        {EXPRESSION_NAMES.map((name) => <Chip key={name} on={expression === name} data-expression={name} onClick={() => setExpression(name)}>{name}</Chip>)}
      </Group>
      <Group title="Gesture (plays once)">
        {GESTURE_NAMES.map((name) => <Chip key={name} data-react={name} onClick={() => all((handle) => handle.react(name))}>{name}</Chip>)}
      </Group>
      <Group title="Mouth shape (held 1.6 s)">
        {VISEME_NAMES.map((name) => <Chip key={name} data-viseme={name} onClick={() => all((handle) => void handle.speak([{ at: 0, viseme: name }, { at: 1.6, viseme: 'rest' }]))}>{name}</Chip>)}
      </Group>
      <Group title="Look">
        {(['cursor', 'idle', 'fixed'] as const).map((value) => <Chip key={value} on={mode === value} data-gaze={value} onClick={() => setMode(value)}>{value}</Chip>)}
        <label className="flex items-center gap-2 text-sm">x<input type="range" min={-1} max={1} step={0.05} value={look.x} data-look="x" onChange={(event) => setLook({ ...look, x: Number(event.target.value) })} /></label>
        <label className="flex items-center gap-2 text-sm">y<input type="range" min={-1} max={1} step={0.05} value={look.y} data-look="y" onChange={(event) => setLook({ ...look, y: Number(event.target.value) })} /></label>
        <Chip on={interactive} onClick={() => setInteractive(!interactive)}>hover and tap reactions</Chip>
      </Group>
      <section className="mb-4">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide opacity-70">Speak</h2>
        <div className="mb-2 flex flex-wrap gap-2">
          {(['en', 'es', 'pt'] as const).map((value) => <Chip key={value} on={language === value} data-language={value} onClick={() => { setLanguage(value); setText(SAMPLES[value]); }}>{value}</Chip>)}
          <label className="flex items-center gap-2 text-sm">speed<input type="range" min={0.5} max={1.8} step={0.1} value={rate} onChange={(event) => setRate(Number(event.target.value))} />{rate.toFixed(1)}</label>
        </div>
        <textarea value={text} rows={3} data-speech-text className="mb-2 w-full rounded-lg border bg-transparent p-2 text-sm" onChange={(event) => setText(event.target.value)} />
        <div className="flex flex-wrap items-center gap-2">
          <Chip data-speak="text" onClick={speak}>speak the text</Chip>
          <Chip onClick={() => all((handle) => handle.stop())}>stop</Chip>
          <label className="min-h-10 cursor-pointer rounded-full border px-3 py-2 text-sm">play an audio file<input type="file" accept="audio/*" className="sr-only" onChange={(event) => playFile(event.target.files?.[0])} /></label>
        </div>
        <p className="mt-2 text-xs opacity-70" data-speech-status>{status || 'With an audio file, the text above is fitted to its length; clear the text and the mouth follows the sound.'}</p>
      </section>
      <section className="mb-4">
        <div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-semibold uppercase tracking-wide opacity-70">Every number by hand</h2><Chip onClick={() => setOverrides({})}>reset</Chip></div>
        <div className="grid gap-1">
          {SLIDERS.map(([key, min, max]) => <label key={key} className="grid grid-cols-[6.5rem_minmax(0,1fr)_3rem] items-center gap-2 text-xs">
            <span className={overrides[key] === undefined ? 'opacity-60' : 'font-semibold'}>{key}</span>
            <input type="range" min={min} max={max} step={(max - min) / 100} value={overrides[key] ?? NEUTRAL_FRAME[key]} data-slider={key} onChange={(event) => setSlider(key, Number(event.target.value))} />
            <span className="text-right tabular-nums">{(overrides[key] ?? NEUTRAL_FRAME[key]).toFixed(2)}</span>
          </label>)}
        </div>
      </section>
    </aside>
    <div className="grid content-start gap-4 self-start lg:sticky lg:top-24" style={{ gridTemplateColumns: focus === 'all' ? 'repeat(auto-fit, minmax(10rem, 1fr))' : 'minmax(0, 28rem)' }}>
      {shown.map((character) => <figure key={character} className="m-0 text-center">
        <Avatar ref={(handle) => { refs.current[character] = handle; }} character={character} expression={expression} gaze={gaze} interactive={interactive} overrides={overrides} label={character} className="w-full" />
        <figcaption className="text-xs opacity-60">{character}</figcaption>
      </figure>)}
    </div>
  </div>;
}
