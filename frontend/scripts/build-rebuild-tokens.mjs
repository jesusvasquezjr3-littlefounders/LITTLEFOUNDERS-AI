import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve as resolvePath } from 'node:path';

// The specification owns the values. This generator does not edit the legacy theme.
const source = new URL('../../docs/littlefounders-spec/frontend/frontend-bible/02-FOUNDATIONS.md', import.meta.url);
const output = new URL('../src/rebuild/design/tokens.css', import.meta.url);

/** Reads `key: { a: 1, b: "x" }` single-line YAML maps as used by the Bible's token block. */
function inlineMap(text) {
  const entries = {};
  for (const match of text.matchAll(/([\w-]+):\s*("[^"]*"|[^,}]+)/g)) entries[match[1]] = match[2].trim().replace(/^"|"$/g, '');
  return entries;
}

function block(yaml, name) {
  const body = yaml.match(new RegExp(`^${name}:[^\\n]*\\n((?:[ ]{2}.*\\n?)+)`, 'm'))?.[1];
  if (!body) throw new Error(`Missing ${name} block`);
  return body;
}

export function generateTokens(markdown) {
  const yaml = markdown.match(/```yaml\r?\n([\s\S]+?)\r?\n```/)?.[1]?.replace(/\r/g, '');
  if (!yaml) throw new Error('Foundation token block missing');
  const colorBlock = yaml.split('colors:')[1]?.split('typography:')[0];
  const colors = Object.fromEntries([...colorBlock.matchAll(/^  ([\w-]+): "([^"]+)"/gm)].map((m) => [m[1], m[2]]));
  if (Object.keys(colors).length < 80) throw new Error('Foundation color extraction incomplete');
  const resolve = (value) => value.replace(/\{colors\.([\w-]+)\}/g, (_, name) => colors[name]);
  const light = [], dark = [], medium = [], wide = [];
  for (const [name, value] of Object.entries(colors)) {
    const isDark = name.startsWith('dark-');
    (isDark ? dark : light).push(`  --${isDark ? name.slice(5) : name}: ${resolve(value)};`);
  }
  for (const section of ['rounded', 'spacing', 'target']) {
    const values = yaml.match(new RegExp(`^${section}: \\{([^}]+)\\}`, 'm'))?.[1];
    if (!values) throw new Error(`Missing ${section}`);
    for (const match of values.matchAll(/([\w-]+): (\d+px)/g)) light.push(`  --${section}-${match[1]}: ${match[2]};`);
  }

  // Typography: one shorthand per named step, plus tracking. Display and numeral
  // sizes step at the `app` container widths named in the comments (03 §3.2).
  const typography = block(yaml, 'typography');
  let typeCount = 0;
  for (const line of typography.split('\n')) {
    const match = line.match(/^  ([\w-]+):\s*\{([^}]+)\}(.*)$/);
    if (!match) continue;
    const [, name, body, comment] = match;
    const t = inlineMap(body);
    if (!t.fontFamily || !t.fontSize || !t.fontWeight || !t.lineHeight) throw new Error(`Incomplete type token ${name}`);
    const font = (size) => `  --type-${name}: ${t.fontWeight} ${size}/${t.lineHeight} ${t.fontFamily}, sans-serif;`;
    light.push(font(t.fontSize));
    light.push(`  --type-${name}-tracking: ${t.letterSpacing ?? 'normal'};`);
    const at640 = comment.match(/(\d+px) at >=640/)?.[1];
    const at1120 = comment.match(/(\d+px) at >=1120/)?.[1];
    if (at640) medium.push(font(at640));
    if (at1120) wide.push(font(at1120));
    else if (at640) wide.push(font(at640));
    typeCount++;
  }
  if (typeCount < 16) throw new Error('Foundation typography extraction incomplete');

  // Elevation is a light-mode ambient shadow; dark mode separates by surface step
  // instead (02 §5: "Dark elevation is a lighter surface step, never a shadow").
  for (const match of block(yaml, 'elevation').matchAll(/^  ([\w-]+):\s*"([^"]+)"/gm)) {
    light.push(`  --elevation-${match[1]}: ${match[2]};`);
    dark.push(`  --elevation-${match[1]}: none;`);
  }

  // Focus colour stays a reference so it follows the mode's primary-strong.
  const focus = inlineMap(yaml.match(/^focus: \{(.*)\}/m)?.[1] ?? '');
  if (!focus.width || !focus.offset || !focus.color) throw new Error('Missing focus');
  light.push(`  --focus-width: ${focus.width};`, `  --focus-offset: ${focus.offset};`,
    `  --focus-color: ${focus.color.replace(/\{colors\.([\w-]+)\}/, 'var(--$1)')};`);

  const motion = block(yaml, 'motion');
  const durations = motion.split('duration:')[1]?.split('easing:')[0] ?? '';
  const easings = motion.split('easing:')[1]?.split(/\n  \w/)[0] ?? '';
  for (const match of durations.matchAll(/^\s{4}([\w-]+):\s*(\d+ms)/gm)) light.push(`  --dur-${match[1]}: ${match[2]};`);
  for (const match of easings.matchAll(/^\s{4}([\w-]+):\s*"([^"]+)"/gm)) light.push(`  --ease-${match[1]}: ${match[2]};`);
  const press = inlineMap(motion.match(/^\s{2}press: \{(.*)\}/m)?.[1] ?? '');
  if (!press.scale) throw new Error('Missing press motion');
  light.push(`  --press-scale: ${press.scale};`);

  // Layering (02 §9.8): the one fixed z-index order, read from the Bible's own
  // sentence so overlays can never be reordered by hand.
  const layers = markdown.match(/sticky nav \((\d+)\) → mobile menu sheet \((\d+)\) → dialog scrim \((\d+)\) → toast \((\d+)\)/);
  if (!layers) throw new Error('Missing the 02 §9.8 z-index order');
  light.push(`  --layer-nav: ${layers[1]};`, `  --layer-sheet: ${layers[2]};`, `  --layer-scrim: ${layers[3]};`, `  --layer-toast: ${layers[4]};`);

  const container = (width, lines) => lines.length
    ? `@container app (min-width: ${width}px) {\n  .lf-rebuild > * {\n${lines.map((line) => `  ${line}`).join('\n')}\n  }\n}\n` : '';
  return `/* Generated from Frontend Bible 02. Run node scripts/build-rebuild-tokens.mjs. */\n.lf-rebuild {\n${light.join('\n')}\n}\n.lf-rebuild[data-theme="dark"] {\n${dark.join('\n')}\n}\n`
    + container(640, medium) + container(1120, wide);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolvePath(process.argv[1])) {
  const generated = generateTokens(readFileSync(source, 'utf8'));
  if (process.argv.includes('--check')) {
    if (readFileSync(output, 'utf8') !== generated) throw new Error('Rebuild tokens drifted from the binding specification');
    console.log('Rebuild tokens match the binding specification.');
  } else {
    writeFileSync(output, generated);
  }
}
