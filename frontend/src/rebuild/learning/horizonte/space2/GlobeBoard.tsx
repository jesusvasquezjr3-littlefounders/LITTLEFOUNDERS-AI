import { useEffect, useId, useMemo, useState, type KeyboardEvent } from 'react';
import { geoDistance, geoGraticule10, geoInterpolate, geoOrthographic, geoPath, type GeoLineString, type GeoObject, type GeoSphere } from 'd3-geo';
import { Button, ChoiceChip } from '../../../design/controls';
import type { Locale } from '../../../design/copyBudget';
import { BoardShell, GradedFoot, useSegmentGrade } from '../../segmentKit';
import { BoardLabel, LabelledDrawing } from '../BoardLabel';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { PLACES, globePlaces, readGlobePayload, routeCenter, routeDistances, routeFees, type GlobePayload, type GlobeRoute, type PlaceId } from './globe.generated';
import { layoutLabels, placeTags } from './globeLabels';
import { loadLand } from './landLoader';
import { ScrollRegion } from './ScrollRegion';
import { count, degrees, fill, money, percent, placeLabel, spaceText, type SpaceText } from './spaceText';
import '../horizonte.css';
import './space2.css';

type Segment = Extract<HorizonteSegment, { type: 'geography.globe-route.v2' }>;
type Turn = 'west' | 'east' | 'north' | 'south';
interface Center { lon: number; lat: number }

const SIZE = 240;
const BOX = { width: SIZE, height: SIZE } as const;
const RADIUS = 104;
const ARC_SAMPLES = 24;
const STEP_LON = 30;
const STEP_LAT = 20;
const MAX_LAT = 80;
const SPHERE: GeoSphere = { type: 'Sphere' };
const ARROW_TURNS: Readonly<Record<string, Turn>> = { ArrowLeft: 'west', ArrowRight: 'east', ArrowUp: 'north', ArrowDown: 'south' };

const wrapLon = (lon: number): number => ((((lon + 180) % 360) + 360) % 360) - 180;

/** One step of the globe: 30 degrees round, 20 degrees up or down, never past 80 degrees so the poles stay readable. */
function turned(center: Center, turn: Turn): Center {
  if (turn === 'west') return { lon: wrapLon(center.lon - STEP_LON), lat: center.lat };
  if (turn === 'east') return { lon: wrapLon(center.lon + STEP_LON), lat: center.lat };
  return { lon: center.lon, lat: Math.max(-MAX_LAT, Math.min(MAX_LAT, center.lat + (turn === 'north' ? STEP_LAT : -STEP_LAT))) };
}

const placeCenter = (place: PlaceId): Center => ({ lon: Math.round(PLACES[place].lon), lat: Math.round(PLACES[place].lat) });

/** The globe: an orthographic view with the land, a graticule, the route arcs along great circles, and the places on the near side. */
function GlobeDrawing({ payload, center, chosen, land, t, name }: { payload: GlobePayload; center: Center; chosen: string | null; land: GeoObject | null; t: SpaceText; name: string }) {
  const scene = useMemo(() => {
    const projection = geoOrthographic().translate([SIZE / 2, SIZE / 2]).scale(RADIUS).clipAngle(90).rotate([-center.lon, -center.lat]).precision(0.5);
    const path = geoPath(projection);
    const near = (lon: number, lat: number): boolean => geoDistance([lon, lat], [center.lon, center.lat]) < Math.PI / 2;
    const arcs = payload.routes.map((route) => {
      const line: GeoLineString = { type: 'LineString', coordinates: [[PLACES[route.from].lon, PLACES[route.from].lat], [PLACES[route.to].lon, PLACES[route.to].lat]] };
      return { id: route.id, d: path(line) };
    });
    // Points along each route, so a place name can be set clear of the lines.
    const marks = payload.routes.flatMap((route) => {
      const along = geoInterpolate([PLACES[route.from].lon, PLACES[route.from].lat], [PLACES[route.to].lon, PLACES[route.to].lat]);
      return Array.from({ length: ARC_SAMPLES + 1 }, (_, step) => along(step / ARC_SAMPLES)).flatMap(([lon, lat]) => {
        const at = near(lon, lat) ? projection([lon, lat]) : null;
        return at ? [{ x: at[0], y: at[1] }] : [];
      });
    });
    const places = globePlaces(payload).flatMap((place) => {
      const { lon, lat } = PLACES[place];
      const at = near(lon, lat) ? projection([lon, lat]) : null;
      return at ? [{ id: place, x: at[0], y: at[1] }] : [];
    });
    const tags = placeTags(SIZE, RADIUS, payload.routes.map((route) => {
      const along = geoInterpolate([PLACES[route.from].lon, PLACES[route.from].lat], [PLACES[route.to].lon, PLACES[route.to].lat]);
      return { id: route.id, at: (t: number) => {
        const [lon, lat] = along(t);
        const at = near(lon, lat) ? projection([lon, lat]) : null;
        return at ? { x: at[0], y: at[1] } : null;
      } };
    }), places);
    return { sea: path(SPHERE), grid: path(geoGraticule10()), land: land ? path(land) : null, arcs, marks, places, tags };
  }, [payload, center.lon, center.lat, land]);
  const drawn = [...scene.arcs].sort((left, right) => Number(left.id === chosen) - Number(right.id === chosen));
  const labels = layoutLabels(SIZE, scene.places.map((place) => ({ id: place.id, text: placeLabel(t, place.id), x: place.x, y: place.y })), scene.tags, scene.marks);
  return <LabelledDrawing>
    <svg className="lf-s2-svg" viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={name} focusable="false" data-copy-role="data">
      {scene.sea ? <path className="lf-s2-sea" d={scene.sea} /> : null}
      {scene.grid ? <path className="lf-s2-grat" d={scene.grid} data-board-decoration="" /> : null}
      {scene.land ? <path className="lf-s2-land" d={scene.land} /> : null}
      {drawn.map((arc) => arc.d ? <path key={arc.id} className="lf-s2-arc" data-chosen={chosen === arc.id ? 'true' : 'false'} d={arc.d} /> : null)}
      {scene.places.map((place) => <circle key={place.id} className="lf-s2-place" cx={place.x} cy={place.y} r="3.5" />)}
      {scene.tags.map((tag) => <g key={tag.id} className="lf-s2-route-tag" data-chosen={chosen === tag.id ? 'true' : 'false'}>
        <circle cx={tag.x} cy={tag.y} r="9" />
        <text x={tag.x} y={tag.y} textAnchor="middle" dominantBaseline="central">{tag.id.toUpperCase()}</text>
      </g>)}
    </svg>
    {labels.map((label) => <BoardLabel key={label.id} box={BOX} x={label.x} y={label.y} align={label.align} valign={label.valign} room={label.room}>{label.text}</BoardLabel>)}
  </LabelledDrawing>;
}

function feeTerms(t: SpaceText, locale: Locale, route: GlobeRoute): string {
  return fill(t.feeTerms, { rate: percent(route.feeBps, locale), flat: money(route.flatCents, locale) });
}

/*
 * F4.8: routes on a globe. The learner turns an orthographic globe (arrow keys or four buttons), compares remittance routes
 * by the great circle each one follows and by its fee, and picks the one the question asks for. A route chip also turns the
 * globe to look at that route. The answer is { choice }; Core holds the key and the browser never says met.
 */
function GlobeBoardView({ document, segment, payload, onBack, sequence, onGrade }: Omit<HorizonteBoardProps, 'segment'> & { segment: Segment; payload: GlobePayload }) {
  const { locale } = document;
  const t = spaceText(locale);
  const id = useId();
  const start = useMemo(() => placeCenter(payload.routes[0]!.from), [payload]);
  const distances = useMemo(() => routeDistances(payload), [payload]);
  const fees = useMemo(() => routeFees(payload), [payload]);
  const [center, setCenter] = useState<Center>(start);
  const [land, setLand] = useState<GeoObject | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [table, setTable] = useState(false);
  const grading = useSegmentGrade(segment.id, onGrade);
  const locked = grading.pending || grading.met;
  const changed = chosen !== null || center.lon !== start.lon || center.lat !== start.lat;

  useEffect(() => {
    let alive = true;
    void loadLand().then((shape) => { if (alive) setLand(shape); });
    return () => { alive = false; };
  }, []);

  const go = (turn: Turn) => setCenter((current) => turned(current, turn));
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const turn = ARROW_TURNS[event.key];
    if (!turn || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    go(turn);
  };
  const reset = () => { grading.reset(); setCenter(start); setChosen(null); };
  const pick = (route: GlobeRoute) => {
    grading.reset();
    if (chosen === route.id) { setChosen(null); return; }
    setChosen(route.id);
    setCenter(routeCenter(route.from, route.to));
  };

  return <BoardShell screen="globe" locale={locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    finished={grading.met} verdict={grading.result && grading.result !== 'unavailable' ? grading.result.verdict : null}
    onReset={reset} resetDisabled={!changed || locked}
    controls={<Button size="sm" aria-expanded={table} onClick={() => setTable((open) => !open)} data-hz-table-toggle="">{table ? t.hideTable : t.showTable}</Button>}
    foot={<GradedFoot locale={locale} grading={grading} canCheck={chosen !== null && !locked} sequence={sequence} feedback={segment.feedback}
      named={{ met: t.metGlobe, hint: t.hintGlobe }} onCheck={() => grading.check({ choice: chosen })} />}>
    <section className="lf-learning-board lf-s2-board">
      <div className="lf-s2-turn">
        <div className="lf-s2-stage" role="group" tabIndex={0} aria-label={t.globeName} aria-describedby={`${id}-keys`} onKeyDown={onKeyDown}>
          <GlobeDrawing payload={payload} center={center} chosen={chosen} land={land} t={t} name={t.globeName} />
        </div>
        <p id={`${id}-keys`} className="lf-s2-keys" data-copy-role="body">{t.globeKeys}</p>
        <p className="lf-s2-readout" role="status" data-copy-role="data" data-hz-text-equivalent="">{fill(t.facing, { lat: degrees(t, center.lat, 'lat'), lon: degrees(t, center.lon, 'lon') })}</p>
        <div className="lf-s2-pad" role="group" aria-label={t.globeControls}>
          <Button size="sm" onClick={() => go('west')}>{t.turnWest}</Button>
          <Button size="sm" onClick={() => go('east')}>{t.turnEast}</Button>
          <Button size="sm" disabled={center.lat >= MAX_LAT} onClick={() => go('north')}>{t.tiltNorth}</Button>
          <Button size="sm" disabled={center.lat <= -MAX_LAT} onClick={() => go('south')}>{t.tiltSouth}</Button>
        </div>
      </div>
      {table ? <ScrollRegion label={t.tableRoutes}><table className="lf-hz-table" data-hz-table="">
        <caption data-copy-role="heading">{t.tableRoutes}</caption>
        <thead><tr>
          <th scope="col" data-copy-role="data">{t.colRoute}</th>
          <th scope="col" data-copy-role="data">{t.colFrom}</th>
          <th scope="col" data-copy-role="data">{t.colTo}</th>
          <th scope="col" data-copy-role="data">{t.colDistance}</th>
          <th scope="col" data-copy-role="data">{t.colFee}</th>
        </tr></thead>
        <tbody>{payload.routes.map((route, index) => <tr key={route.id}>
          <th scope="row" data-copy-role="data">{route.id.toUpperCase()}</th>
          <td data-copy-role="data">{placeLabel(t, route.from)}</td>
          <td data-copy-role="data">{placeLabel(t, route.to)}</td>
          <td data-copy-role="data">{fill(t.distanceKm, { n: count(distances[index]!, locale) })}</td>
          <td data-copy-role="data">{money(fees[index]!, locale)}</td>
        </tr>)}</tbody>
      </table></ScrollRegion> : null}
    </section>
    <section className="lf-learning-control-strip lf-s2-strip" aria-label={t.routesHeading}>
      <h2 data-copy-role="heading">{t.routesHeading}</h2>
      <p className="lf-s2-note" data-copy-role="data">{fill(t.sendLine, { amount: money(payload.sendCents, locale) })}</p>
      <div className="lf-s2-routes">
        {payload.routes.map((route) => <ChoiceChip key={route.id} selected={chosen === route.id} disabled={locked} onToggle={() => pick(route)}>
          <span className="lf-s2-route">
            <span data-copy-role="data">{fill(t.routeLine, { id: route.id.toUpperCase(), from: placeLabel(t, route.from), to: placeLabel(t, route.to) })}</span>{' '}
            <span className="lf-s2-route-fee" data-copy-role="data">{feeTerms(t, locale, route)}</span>
          </span>
        </ChoiceChip>)}
      </div>
      <p className="lf-s2-status" role="status" data-copy-role="data">{chosen === null ? t.chosenNone : fill(t.chosen, { option: chosen.toUpperCase() })}</p>
    </section>
  </BoardShell>;
}

export default function GlobeBoard({ segment, ...rest }: HorizonteBoardProps) {
  if (segment.type !== 'geography.globe-route.v2') return null;
  const payload = readGlobePayload(segment.payload);
  return payload ? <GlobeBoardView segment={segment} payload={payload} {...rest} /> : null;
}
