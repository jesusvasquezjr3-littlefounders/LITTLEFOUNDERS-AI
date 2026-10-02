import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../../../design/controls';
import { BoardShell, ViewedFoot } from '../../segmentKit';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { DEFAULT_VIEW, SCENE_SIZE, projectPoint, type SolidView } from '../solids/projection.generated';
import { AR_OBJECTS, arPilotGate, arVolumeMl, arWire, readArPayload, type ArObjectId, type ArPayload } from './ar.generated';
import { useArPilot, type ArSessionHandle } from './arPilot';
import { count, fill, objectLabel, spaceText } from './spaceText';
import { TurnStage } from './TurnStage';
import '../horizonte.css';
import './space2.css';

type Segment = Extract<HorizonteSegment, { type: 'space.ar-table.v2' }>;
type Phase = 'idle' | 'asking' | 'declined' | 'starting' | 'running' | 'ended' | 'failed';

/** The object as a wireframe on the solids projection, nearer edges drawn last. */
function WireSvg({ object, view, name }: { object: ArObjectId; view: SolidView; name: string }) {
  const lines = useMemo(() => {
    const wire = arWire(object);
    const projected = wire.vertices.map((vertex) => projectPoint(vertex, view));
    return wire.edges.map(([from, to], key) => ({ key, depth: (projected[from]!.depth + projected[to]!.depth) / 2, x1: projected[from]!.x, y1: projected[from]!.y, x2: projected[to]!.x, y2: projected[to]!.y }))
      .sort((left, right) => left.depth - right.depth);
  }, [object, view]);
  return <svg className="lf-s2-svg" viewBox={`0 0 ${SCENE_SIZE} ${SCENE_SIZE}`} role="img" aria-label={name} focusable="false" data-copy-role="data">
    {lines.map((line) => <line key={line.key} className="lf-s2-wire-edge" x1={line.x1.toFixed(1)} y1={line.y1.toFixed(1)} x2={line.x2.toFixed(1)} y2={line.y2.toFixed(1)} />)}
  </svg>;
}

/*
 * F4.9: the "see it on your table" pilot. Ungraded: there is no answer, no scorer and no verdict. Everyone gets a turnable
 * drawing of a real object with its true measurements in a table. Only when the pilot is open (flag on, learner 13 or older,
 * consent recorded; a guardian's for a minor) AND the browser has WebXR does the learner also get "See on table", and then
 * only an in-app consent panel comes first: the browser's own camera prompt appears only after the learner taps "Allow camera".
 * No frame is read, stored or sent, and there is no third-party SDK.
 */
function ArTableBoardView({ document, segment, payload, onBack, sequence }: Omit<HorizonteBoardProps, 'segment' | 'onGrade'> & { segment: Segment; payload: ArPayload }) {
  const { locale } = document;
  const t = spaceText(locale);
  const env = useArPilot();
  const open = arPilotGate({ flag: env.flag, age: document.eligibility.minimum_age, consent: env.consent }) === 'open';
  const [view, setView] = useState<SolidView>(DEFAULT_VIEW);
  const [engaged, setEngaged] = useState(false);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const alive = useRef(true);
  const running = useRef<ArSessionHandle | null>(null);
  const { size } = AR_OBJECTS[payload.object];

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; running.current?.end(); running.current = null; };
  }, []);

  useEffect(() => {
    if (!open) { setSupported(null); return; }
    const xr = env.xr();
    if (!xr) { setSupported(false); return; }
    let current = true;
    xr.isSessionSupported('immersive-ar').then((yes) => { if (current) setSupported(yes); }, () => { if (current) setSupported(false); });
    return () => { current = false; };
  }, [open, env]);

  const turn = (next: SolidView) => { setView(next); setEngaged(true); };
  const reset = () => { setView(DEFAULT_VIEW); setEngaged(false); };
  const allow = () => {
    const xr = env.xr();
    if (!xr) { setPhase('failed'); return; }
    setPhase('starting');
    env.start({ xr, object: payload.object, onEnd: () => { running.current = null; if (alive.current) setPhase('ended'); } }).then((started) => {
      if (!alive.current) { started.end(); return; }
      running.current = started;
      setPhase('running');
      setEngaged(true);
    }, () => { if (alive.current) setPhase('failed'); });
  };
  const message = phase === 'declined' ? t.arDeclined : phase === 'ended' ? t.arEnded : phase === 'failed' ? t.arFailed : phase === 'running' ? t.arRunning : null;

  return <BoardShell screen="ar-table" locale={locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    finished={engaged} onReset={reset} resetDisabled={view.yaw === DEFAULT_VIEW.yaw && view.pitch === DEFAULT_VIEW.pitch}
    foot={<ViewedFoot locale={locale} sequence={sequence} ready={engaged} />}>
    <section className="lf-learning-board lf-s2-board">
      <p className="lf-s2-tag" data-copy-role="data">{t.arTag}</p>
      <TurnStage view={view} onViewChange={turn} name={objectLabel(t, payload.object)} keys={t.arKeys} controls={t.arControls} locale={locale}>
        <WireSvg object={payload.object} view={view} name={objectLabel(t, payload.object)} />
      </TurnStage>
      <table className="lf-hz-table" data-hz-table="">
        <caption data-copy-role="heading">{t.tableSize}</caption>
        <thead><tr>
          <th scope="col" data-copy-role="data">{t.colMeasure}</th>
          <th scope="col" data-copy-role="data">{t.colValue}</th>
        </tr></thead>
        <tbody>
          <tr><th scope="row" data-copy-role="data">{t.rowWidth}</th><td data-copy-role="data">{fill(t.unitCm, { n: size[0] })}</td></tr>
          <tr><th scope="row" data-copy-role="data">{t.rowHeight}</th><td data-copy-role="data">{fill(t.unitCm, { n: size[1] })}</td></tr>
          <tr><th scope="row" data-copy-role="data">{t.rowDepth}</th><td data-copy-role="data">{fill(t.unitCm, { n: size[2] })}</td></tr>
          <tr><th scope="row" data-copy-role="data">{t.rowVolume}</th><td data-copy-role="data">{fill(t.unitMl, { n: count(arVolumeMl(payload.object), locale) })}</td></tr>
        </tbody>
      </table>
    </section>
    {open ? <section className="lf-learning-control-strip lf-s2-strip lf-s2-ar" aria-label={t.arName}>
      <h2 data-copy-role="heading">{t.arName}</h2>
      {supported === false ? <p data-copy-role="body">{t.arUnsupported}</p> : null}
      {supported === true && phase === 'idle' ? <Button size="sm" onClick={() => setPhase('asking')}>{t.arStart}</Button> : null}
      {supported === true && phase === 'asking' ? <div className="lf-s2-panel" role="group" aria-labelledby="lf-s2-consent">
        <h2 id="lf-s2-consent" data-copy-role="heading">{t.arConsentHeading}</h2>
        <p data-copy-role="body">{t.arConsentBody}</p>
        <div className="lf-s2-actions">
          <Button size="sm" variant="accent" onClick={allow}>{t.arAllow}</Button>
          <Button size="sm" onClick={() => setPhase('declined')}>{t.arDecline}</Button>
        </div>
      </div> : null}
      {phase === 'starting' ? <p className="lf-s2-status" role="status" data-copy-role="data">{t.arStarting}</p> : null}
      {message ? <p className="lf-s2-status" role="status" data-copy-role="body">{message}</p> : null}
      {supported === true && (phase === 'declined' || phase === 'ended' || phase === 'failed') ? <Button size="sm" onClick={() => setPhase('asking')}>{t.arStart}</Button> : null}
    </section> : null}
  </BoardShell>;
}

export default function ArTableBoard({ segment, document, onBack, sequence }: HorizonteBoardProps) {
  if (segment.type !== 'space.ar-table.v2') return null;
  const payload = readArPayload(segment.payload);
  return payload ? <ArTableBoardView document={document} segment={segment} payload={payload} onBack={onBack} sequence={sequence} /> : null;
}
