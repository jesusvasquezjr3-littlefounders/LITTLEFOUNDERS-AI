import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { RebuildRoot } from '../../src/rebuild/design/root';
import { LessonDocumentView } from '../../src/rebuild/learning/LessonDocumentView';
import { loadLessonClientDocument } from '../../src/rebuild/learning/lessonDocument';
import type { Locale } from '../../src/rebuild/design/copyBudget';
import '../../src/rebuild/design/tokens.css';
import '../../src/rebuild/design/system.css';

type Entry = { lesson: string; locale: Locale; title: string };
const copy = {
  'es-MX': { notice: 'Vista previa local: no registra progreso.', lesson: 'Lección', language: 'Idioma', loading: 'Cargando…', error: 'No se pudo cargar la vista previa.', complete: 'Recorrido terminado. Puedes elegir otra lección.' },
  'en-US': { notice: 'Local preview: no progress is recorded.', lesson: 'Lesson', language: 'Language', loading: 'Loading…', error: 'The preview could not load.', complete: 'Preview finished. You can choose another lesson.' },
  'pt-BR': { notice: 'Prévia local: não registra progresso.', lesson: 'Lição', language: 'Idioma', loading: 'Carregando…', error: 'Não foi possível carregar a prévia.', complete: 'Prévia concluída. Pode escolher outra lição.' },
};
function CourseReview() {
  const [query] = useState(() => new URLSearchParams(window.location.search));
  const requestedLocale = query.get('locale');
  const theme = query.get('theme') === 'dark' ? 'dark' : 'light';
  const [entries, setEntries] = useState<Entry[]>([]);
  const [locale, setLocale] = useState<Locale>(requestedLocale === 'en-US' || requestedLocale === 'pt-BR' ? requestedLocale : 'es-MX');
  const [lesson, setLesson] = useState('');
  const [startAt, setStartAt] = useState(() => Math.max(0, Number.parseInt(query.get('step') ?? '0', 10) || 0));
  const [raw, setRaw] = useState<unknown>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'complete'>('loading');
  const labels = copy[locale];
  const loaded = loadLessonClientDocument(raw);
  const ageBand = loaded.status === 'ready' ? loaded.document.age_band : 'adult';
  const steps = loaded.status === 'ready' ? loaded.document.segments : [];
  const preceding = steps.slice(0, startAt);
  const endpoint = `/__course_review?lesson=${encodeURIComponent(lesson)}&locale=${locale}`;
  const grade = async (answer: unknown, id: string) => {
    const response = await fetch(endpoint, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,answer})});
    if (!response.ok) throw new Error('Local grading failed');
    return response.json() as Promise<{verdict: 'met' | 'review'}>;
  };
  useEffect(() => { fetch('/__course_review').then(response => { if (!response.ok) throw new Error(); return response.json(); }).then((list: Entry[]) => { setEntries(list); setLesson(list.find(entry => entry.lesson === query.get('lesson'))?.lesson ?? list[0]?.lesson ?? ''); }).catch(() => setStatus('error')); }, [query]);
  useEffect(() => {
    if (!lesson) return;
    const controller = new AbortController(); setStatus('loading'); setRaw(null);
    fetch(endpoint, {signal: controller.signal}).then(response => { if (!response.ok) throw new Error(); return response.json(); }).then(document => { setRaw(document); setStatus('ready'); }).catch(() => { if (!controller.signal.aborted) setStatus('error'); });
    return () => controller.abort();
  }, [lesson, endpoint]);
  return <>
    <aside data-review-step={startAt} hidden={query.get('audit') === '1'} style={{padding:16,fontFamily:'system-ui',background:'#fff',color:'#18222e',display:query.get('audit') === '1' ? 'none' : 'flex',gap:16,flexWrap:'wrap',alignItems:'center'}}>
      <span>{labels.notice}</span>
      <label>{labels.language} <select value={locale} onChange={event => { setLocale(event.target.value as Locale); setStartAt(0); }}><option value="es-MX">Español</option><option value="en-US">English</option><option value="pt-BR">Português</option></select></label>
      <label>{labels.lesson} <select value={lesson} onChange={event => { setLesson(event.target.value); setStartAt(0); }}>{entries.filter(entry => entry.locale === locale).map((entry, index) => <option key={entry.lesson} value={entry.lesson}>{index + 1}. {entry.title}</option>)}</select></label>
      {steps.length ? <label>{locale === 'es-MX' ? 'Revisar desde' : locale === 'pt-BR' ? 'Revisar a partir de' : 'Review from'} <select data-review-control="step" value={startAt} onChange={event => { setStartAt(Number(event.target.value)); setStatus('ready'); }}>{steps.map((step, index) => <option key={step.id} value={index}>{index + 1}. {step.prompt}</option>)}</select></label> : null}
      {status !== 'ready' ? <span role="status">{labels[status]}</span> : null}
      {status === 'complete' ? <button onClick={() => setStatus('ready')}>{locale === 'en-US' ? 'Restart' : 'Repetir'}</button> : null}
    </aside>
    {raw && status !== 'complete' ? <RebuildRoot theme={theme} ageBand={ageBand} locale={locale}>
      <LessonDocumentView key={`${lesson}:${locale}:${startAt}`} raw={raw} locale={locale} ageBand={ageBand} theme={theme} mentorStage={loaded.status === 'ready' ? loaded.document.mentor_stage ?? null : null}
        metSegmentIds={preceding.filter(step => step.grading === 'server').map(step => step.id)}
        viewedSegmentIds={preceding.filter(step => step.grading !== 'server').map(step => step.id)}
        onBack={() => setStatus('complete')} onView={async () => true} onComplete={async () => {setStatus('complete');return true;}}
        onGradeWorkedExample={async (answer,id) => (await grade(answer,id)).verdict}
        onGradeAny={grade}/>
    </RebuildRoot> : null}
  </>;
}
if (import.meta.env.DEV) createRoot(document.getElementById('root')!).render(<CourseReview />);
