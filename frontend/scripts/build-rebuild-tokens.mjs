import { readFileSync, writeFileSync } from 'node:fs';

// The specification owns the values. This generator does not edit the legacy theme.
const source = new URL('../../docs/littlefounders-spec/frontend/frontend-bible/02-FOUNDATIONS.md', import.meta.url);
const output = new URL('../src/rebuild/design/tokens.css', import.meta.url);
export function generateTokens(markdown) {
  const yaml = markdown.match(/```yaml\r?\n([\s\S]+?)\r?\n```/)?.[1];
  if (!yaml) throw new Error('Foundation token block missing');
  const colorBlock = yaml.split('colors:')[1]?.split('typography:')[0];
  const colors = Object.fromEntries([...colorBlock.matchAll(/^  ([\w-]+): "([^"]+)"/gm)].map((m) => [m[1], m[2]]));
  if (Object.keys(colors).length < 80) throw new Error('Foundation color extraction incomplete');
  const resolve = (value) => value.replace(/\{colors\.([\w-]+)\}/g, (_, name) => colors[name]);
  const light = [], dark = [];
  for (const [name, value] of Object.entries(colors)) {
    const isDark = name.startsWith('dark-');
    (isDark ? dark : light).push(`  --${isDark ? name.slice(5) : name}: ${resolve(value)};`);
  }
  for (const section of ['rounded', 'spacing', 'target']) {
    const values = yaml.match(new RegExp(`^${section}: \\{([^}]+)\\}`, 'm'))?.[1];
    if (!values) throw new Error(`Missing ${section}`);
    for (const match of values.matchAll(/([\w-]+): (\d+px)/g)) light.push(`  --${section}-${match[1]}: ${match[2]};`);
  }
  return `/* Generated from Frontend Bible 02. Run node scripts/build-rebuild-tokens.mjs. */\n.lf-rebuild {\n${light.join('\n')}\n}\n.lf-rebuild[data-theme="dark"] {\n${dark.join('\n')}\n}\n`;
}

const generated = generateTokens(readFileSync(source, 'utf8'));
if (process.argv.includes('--check')) {
  if (readFileSync(output, 'utf8') !== generated) throw new Error('Rebuild tokens drifted from the binding specification');
  console.log('Rebuild tokens match the binding specification.');
} else {
  writeFileSync(output, generated);
}
