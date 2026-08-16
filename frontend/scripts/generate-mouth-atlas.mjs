#!/usr/bin/env node
/*
 * generate-mouth-atlas — draws the viseme atlas for a character's mouth card.
 *
 * WHY A CARD AND NOT THE MODEL'S OWN MOUTH:
 * Not one jaw, mouth, brow or eye bone exists on any export (/TUTOR_3D.md §3),
 * and the mouths are PAINTED INTO THE TEXTURE rather than modelled — so there
 * is no geometry to deform and blendshapes would only stretch a decal. The
 * handoff proposed sliding the mouth region's UV offset instead, but that is
 * not implementable on these assets either: the exports carry a per-facet
 * shattered UV atlas, verified by resolving the UV under seven probe points on
 * Zara's face, where two points 4 cm apart landed at (0.096, 0.153) and
 * (0.447, 0.300). There is no contiguous mouth island to slide, and at 3k
 * triangles the lips share a triangle with the cheek.
 *
 * So the mouth is a separate card laid over the painted one. Its skin colour is
 * sampled from the character's ALBEDO, never from a render — Blender's view
 * transform darkens and desaturates, and a card matched to a rendered pixel
 * goes wrong the instant the app's own lighting hits it. Zara's albedo reads
 * #FECBA6 within ±2 across four widely separated UV locations, which is what
 * makes an overlay invisible at its edges.
 *
 * Usage:
 *   npm run assets:mouth                 # every character
 *   npm run assets:mouth -- zara         # one
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(HERE, '../public/scenes/mouth');

/*
 * Atlas geometry. Frames are laid out 2 across by 4 down, so each cell is
 * 256x128 — TWICE AS WIDE AS TALL, because a mouth is. Square cells would waste
 * half of every frame and halve the horizontal resolution where all the shape
 * information actually is.
 */
export const ATLAS_SIZE = 512;
export const ATLAS_COLUMNS = 2;
export const ATLAS_ROWS = 4;
const CELL_W = ATLAS_SIZE / ATLAS_COLUMNS; // 256
const CELL_H = ATLAS_SIZE / ATLAS_ROWS; // 128

/*
 * Frame order is the CONTRACT with the runtime — `mouthAtlas.ts` indexes into
 * this array, so appending is safe and reordering is not.
 */
export const VISEMES = ['closed', 'A', 'E', 'I', 'O', 'U', 'MBP', 'FV'];

/**
 * Per-character palette and proportions.
 *
 * `skin` and `interior` are sampled albedo values, not art direction. `spread`
 * and `openness` scale the drawn shapes to the character's own mouth, measured
 * from a gridded front render.
 */
const CHARACTERS = {
  zara: {
    family: 'ellipse',
    skin: '#FECBA6',
    interior: '#A91F19',
    teeth: '#FFF7F0',
    tongue: '#E0736A',
    lipLine: '#C4826B',
    /*
     * Sized so the drawn mouth reads at roughly the same scale as the painted
     * one it replaces (measured at 0.0862 x 0.0372 m against a 0.135 x 0.0675 m
     * card). A visibly smaller mouth than the character had reads as a
     * different character, not as a talking one.
     */
    spread: 1.34,
    openness: 0.95,
  },
  /*
   * Rho had NO MOUTH to replace — his moustache covers the whole region and
   * nothing is painted underneath it. So his card does not cover a mouth, it
   * ADDS one, in the clean patch of skin that sits below the moustache's centre
   * and above his chin (measured at 8.3 x 6.8 cm).
   *
   * That patch is why he does not need an animated moustache after all: a
   * moustachioed man's mouth is exactly there, so a normal card in a normal
   * place reads correctly and reuses the ellipse family. The moustache's curled
   * tips stay painted and static, which is what a moustache does.
   */
  rho: {
    family: 'ellipse',
    skin: '#EB926A',
    // Invented rather than sampled: there is no painted mouth interior on this
    // character to sample FROM. Chosen against his own albedo so it reads as
    // the same illustration.
    interior: '#8E2A22',
    teeth: '#FFF3E8',
    tongue: '#D4736A',
    lipLine: '#B5654A',
    // The card is small — it must stay inside the skin patch, because a
    // soft skin-coloured edge overlapping that very dark moustache would be
    // the one part of the card the eye finds immediately.
    spread: 1.25,
    openness: 1.0,
  },
  /*
   * Liruf is not a palette swap of Zara, and assuming he was would have shipped
   * two visible defects:
   *
   *   - His mouth is a wide upward ARC with triangular teeth, ~3:1, not an
   *     ellipse. An ellipse pasted on that snout reads as a sticker.
   *   - His skin is NOT one colour across the mouth. The upper snout is
   *     #587D5C and the jaw below is #B2DC86 — the mouth sits exactly on that
   *     boundary, so a single-tone card is wrong on one side of itself
   *     whichever tone it picks.
   */
  liruf: {
    family: 'arc',
    skin: '#587D5C',
    skinLower: '#B2DC86',
    // Where the snout's colour gives way to the jaw's, as a fraction of cell
    // height from the top. Measured against the mouth's own arc.
    // The ribbon is centred ON the mouth line, so the snout/jaw colour change
    // sits at the middle of the card rather than somewhere up its face.
    skinSplit: 0.5,
    interior: '#E74A51',
    teeth: '#F9F7F8',
    tongue: '#D94A55',
    lipLine: '#3F5C44',
    spread: 1.0,
    openness: 1.0,
    /*
     * NO corner lift. The grin's curve used to be drawn INTO the atlas, back
     * when the card was a flat rectangle that had to fake it. His card is now a
     * ribbon traced along the mouth line, so the curve lives in the geometry —
     * drawing it again here would bend an already-bent mouth.
     */
    rise: 0,
    teethTop: 7,
    teethBottom: 6,
  },
};

/*
 * The card's opaque region has to COVER the mouth already painted into the
 * character's texture, and that painted mouth is a wide, flat shape.
 *
 * A radial fade cannot do it: with the ellipse sized to the cell, the painted
 * mouth's CORNERS sit at ~0.84 of the ellipse's radius while its centre sits at
 * ~0.64, so tuning the fade to cover the corners destroys the soft edge and
 * tuning it for the edge leaves the corners showing through at about half
 * opacity. The corner is the failure case, and an ellipse fails it by
 * construction.
 *
 * So the alpha is a rounded RECTANGLE, feathered by a blur: flat-topped
 * opacity across the whole mouth, with the falloff spent entirely in the margin
 * where there is nothing to hide. The blur is kept clear of the cell border so
 * neighbouring atlas frames cannot bleed into each other.
 */
/*
 * The feather is ANISOTROPIC, and the asymmetry is forced by the face, not
 * chosen for looks.
 *
 * Sideways there is room: the painted mouth leaves ~46 px of card on each side,
 * so the alpha can fall off gently and the card's vertical edges never read as
 * an edge. Vertically there is almost none — Zara's nose sits 17.5 px below the
 * top of the card while the mouth starts at 28.8 px, so the ENTIRE ramp from
 * transparent to opaque has 11 px to happen in. An isotropic blur wide enough
 * to hide the side edges also erased her nose, which a symmetric parameter
 * cannot express and a contact sheet against the untouched face caught
 * immediately.
 */
const FEATHER_STD_DEV_X = 8;
const FEATHER_STD_DEV_Y = 3;
const COVER_RECT = { x: 26, y: 23, width: CELL_W - 52, height: 82, rx: 24 };

function backgroundDefs(id, palette) {
  /*
   * A character whose skin changes colour across the mouth needs the card to
   * change with it. The transition is a short ramp rather than a hard line: the
   * model's own boundary is soft, and a crisp edge on the card would be the one
   * part of it the eye can find.
   */
  const split = palette.skinLower
    ? `
    <linearGradient id="skin-${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${palette.skin}"/>
      <stop offset="${Math.max(0, palette.skinSplit * 100 - 9).toFixed(1)}%" stop-color="${palette.skin}"/>
      <stop offset="${Math.min(100, palette.skinSplit * 100 + 9).toFixed(1)}%" stop-color="${palette.skinLower}"/>
      <stop offset="100%" stop-color="${palette.skinLower}"/>
    </linearGradient>`
    : '';

  return `${split}
    <filter id="feather-${id}" x="-25%" y="-25%" width="150%" height="150%">
      <feGaussianBlur stdDeviation="${FEATHER_STD_DEV_X} ${FEATHER_STD_DEV_Y}"/>
    </filter>
    <mask id="cover-${id}">
      <rect x="${COVER_RECT.x}" y="${COVER_RECT.y}"
            width="${COVER_RECT.width}" height="${COVER_RECT.height}" rx="${COVER_RECT.rx}"
            fill="#ffffff" filter="url(#feather-${id})"/>
    </mask>`;
}

function skinFill(id, palette) {
  return palette.skinLower ? `url(#skin-${id})` : palette.skin;
}

/**
 * An arc mouth: the band between two curves that meet at lifted corners.
 *
 * Liruf's grin curves UP by 26 px at its corners across a 3:1 span. Drawing it
 * as an ellipse would read as a sticker on the snout however the colours were
 * matched, because the shape — not the palette — is what identifies him.
 */
function arcMouth(index, palette, { up, down, closed = false }) {
  const cx = CELL_W / 2;
  const cy = CELL_H / 2;
  const halfWidth = 104 * palette.spread;
  const rise = palette.rise ?? 0;
  const openUp = up * palette.openness;
  const openDown = down * palette.openness;
  const clip = `arc-clip-${index}`;

  const left = `${cx - halfWidth} ${cy - rise}`;
  const right = `${cx + halfWidth} ${cy - rise}`;
  // Quadratic control points chosen so each curve's MIDPOINT lands exactly at
  // the requested opening: midY = (P0.y + 2·Cy + P2.y) / 4.
  const upperControl = `${cx} ${cy - 2 * openUp + rise}`;
  const lowerControl = `${cx} ${cy + 2 * openDown + rise}`;
  const path = `M ${left} Q ${upperControl} ${right} Q ${lowerControl} ${left} Z`;

  if (closed) {
    return `<path d="M ${left} Q ${cx} ${cy + rise * 0.6} ${right}"
                  fill="none" stroke="${palette.lipLine}" stroke-width="6" stroke-linecap="round"/>`;
  }

  /** Triangular teeth marching along a curve, clipped so they cannot escape the mouth. */
  const teeth = (count, fromTop) => {
    if (!count) return '';
    const shapes = [];
    for (let i = 0; i < count; i += 1) {
      const t = (i + 0.5) / count;
      const x = cx - halfWidth + t * halfWidth * 2;
      // Height of the curve at this x, from the quadratic's own formula.
      const s = t;
      const curveY = fromTop
        ? (1 - s) ** 2 * (cy - rise) + 2 * (1 - s) * s * (cy - 2 * openUp + rise) + s ** 2 * (cy - rise)
        : (1 - s) ** 2 * (cy - rise) + 2 * (1 - s) * s * (cy + 2 * openDown + rise) + s ** 2 * (cy - rise);
      const size = (halfWidth * 2) / count / 2.1;
      /*
       * Tooth LENGTH follows the mouth's opening, not the tooth's width.
       * Deriving it from width alone made every tooth 21 px long inside a
       * 50 px gap, so the upper and lower rows met and the grin read as a
       * solid white bar — worst on the narrow visemes, where there was no gap
       * to begin with.
       */
      const gap = openUp + openDown;
      const length = Math.min(size * 1.5, gap * 0.42);
      const tip = fromTop ? curveY + length : curveY - length;
      shapes.push(
        `<path d="M ${x - size} ${curveY} L ${x + size} ${curveY} L ${x} ${tip} Z"
               fill="${palette.teeth}" clip-path="url(#${clip})"/>`,
      );
    }
    return shapes.join('');
  };

  return `
    <defs><clipPath id="${clip}"><path d="${path}"/></clipPath></defs>
    <path d="${path}" fill="${palette.interior}"/>
    ${teeth(palette.teethTop ?? 0, true)}
    ${teeth(palette.teethBottom ?? 0, false)}
    <path d="${path}" fill="none" stroke="${palette.lipLine}" stroke-width="4" stroke-opacity="0.6"/>`;
}

/**
 * Draw one viseme, in cell-local coordinates with the mouth centred.
 *
 * Every open shape is an ellipse of interior colour with the teeth clipped to
 * it, so the teeth can never spill outside the lips however the shape is
 * scaled.
 */
/** Openings per viseme for the arc family, as (above the lip line, below). */
const ARC_OPENINGS = {
  closed: null,
  A: { up: 20, down: 30 },
  E: { up: 13, down: 18 },
  I: { up: 7, down: 9 },
  O: { up: 17, down: 22 },
  U: { up: 10, down: 13 },
  MBP: null,
  FV: { up: 4, down: 12 },
};

function viseme(name, index, palette) {
  if (palette.family === 'arc') {
    const opening = ARC_OPENINGS[name];
    if (!opening) {
      return arcMouth(index, palette, { up: 0, down: 0, closed: true });
    }
    return arcMouth(index, palette, opening);
  }

  const cx = CELL_W / 2;
  const cy = CELL_H / 2;
  const sx = palette.spread;
  const sy = palette.openness;
  const clip = `mouth-clip-${index}`;

  /** An open mouth: interior ellipse, teeth along the top, tongue at the base. */
  const open = (rx, ry, { teeth = true, tongue = false } = {}) => `
    <defs>
      <clipPath id="${clip}">
        <ellipse cx="${cx}" cy="${cy}" rx="${rx * sx}" ry="${ry * sy}"/>
      </clipPath>
    </defs>
    <ellipse cx="${cx}" cy="${cy}" rx="${rx * sx}" ry="${ry * sy}" fill="${palette.interior}"/>
    ${teeth
      ? `<rect x="${cx - rx * sx}" y="${cy - ry * sy}" width="${rx * sx * 2}" height="${Math.max(6, ry * sy * 0.42)}"
              fill="${palette.teeth}" clip-path="url(#${clip})"/>`
      : ''}
    ${tongue
      ? `<ellipse cx="${cx}" cy="${cy + ry * sy * 0.72}" rx="${rx * sx * 0.52}" ry="${ry * sy * 0.34}"
                  fill="${palette.tongue}" clip-path="url(#${clip})"/>`
      : ''}
    <ellipse cx="${cx}" cy="${cy}" rx="${rx * sx}" ry="${ry * sy}"
             fill="none" stroke="${palette.lipLine}" stroke-width="3" stroke-opacity="0.55"/>`;

  /** A closed mouth is a lip LINE, not a filled shape — filling reads as a bruise. */
  const line = (halfWidth, sag, width) => `
    <path d="M ${cx - halfWidth * sx} ${cy - sag} Q ${cx} ${cy + sag * 2.2} ${cx + halfWidth * sx} ${cy - sag}"
          fill="none" stroke="${palette.lipLine}" stroke-width="${width}" stroke-linecap="round"/>`;

  switch (name) {
    case 'closed':
      return line(50, 3, 5);
    case 'A':
      return open(50, 34, { tongue: true });
    case 'E':
      return open(56, 20);
    case 'I':
      return open(54, 11);
    case 'O':
      return open(32, 28, { teeth: false, tongue: true });
    case 'U':
      return open(22, 20, { teeth: false });
    case 'MBP':
      // Pressed lips: flatter and heavier than `closed`, which is what reading
      // an M/B/P off a still frame depends on.
      return line(46, 1, 8);
    case 'FV':
      // Upper teeth resting on the lower lip: a teeth band with no interior
      // above it, and the lip drawn under.
      return `
        <defs>
          <clipPath id="${clip}">
            <ellipse cx="${cx}" cy="${cy + 4}" rx="${46 * sx}" ry="${14 * sy}"/>
          </clipPath>
        </defs>
        <ellipse cx="${cx}" cy="${cy + 4}" rx="${46 * sx}" ry="${14 * sy}" fill="${palette.interior}"/>
        <rect x="${cx - 46 * sx}" y="${cy - 10}" width="${46 * sx * 2}" height="${12}"
              fill="${palette.teeth}" clip-path="url(#${clip})"/>
        ${line(44, 0, 5)}`;
    default:
      throw new Error(`generate-mouth-atlas: unknown viseme ${name}`);
  }
}

export function atlasSvg(palette) {
  const cells = VISEMES.map((name, index) => {
    const col = index % ATLAS_COLUMNS;
    const row = Math.floor(index / ATLAS_COLUMNS);
    return `
      <g transform="translate(${col * CELL_W}, ${row * CELL_H})">
        <defs>${backgroundDefs(index, palette)}</defs>
        <g mask="url(#cover-${index})">
          <rect width="${CELL_W}" height="${CELL_H}" fill="${skinFill(index, palette)}"/>
          ${viseme(name, index, palette)}
        </g>
      </g>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ATLAS_SIZE}" height="${ATLAS_SIZE}"
               viewBox="0 0 ${ATLAS_SIZE} ${ATLAS_SIZE}">${cells}</svg>`;
}

async function main() {
  const requested = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const ids = requested.length ? requested : Object.keys(CHARACTERS);

  await mkdir(OUT_DIR, { recursive: true });
  for (const id of ids) {
    const palette = CHARACTERS[id];
    if (!palette) {
      console.error(`generate-mouth-atlas: no palette for '${id}' — known: ${Object.keys(CHARACTERS).join(', ')}`);
      process.exitCode = 1;
      continue;
    }
    const out = resolve(OUT_DIR, `${id}.png`);
    const png = await sharp(Buffer.from(atlasSvg(palette))).png({ compressionLevel: 9 }).toBuffer();
    await writeFile(out, png);
    console.log(`  ${id.padEnd(6)} ${ATLAS_SIZE}²  ${VISEMES.length} frames  ${(png.length / 1024).toFixed(1)} kB  → ${out}`);
  }
}

// `pathToFileURL`, not a hand-built `file://` string: on Windows the manual
// form yields `file://C:/…` while `import.meta.url` is `file:///C:/…`, so the
// comparison silently fails and the script exits having done nothing at all.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
