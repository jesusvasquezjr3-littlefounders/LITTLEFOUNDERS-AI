import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(join(repo, 'frontend/package.json'));
const ts = require('typescript');
const iconPackages = /^(?:lucide(?:-react)?|react-icons|@heroicons|@mui\/icons-material|@tabler\/icons[^/]*|@phosphor-icons|phosphor-react|feather-icons|react-feather|@fortawesome|@radix-ui\/react-icons|@iconify|@dicebear)(?:\/|$)/;

/** Textual copyright/trademark and mathematical arrows are not emoji artwork. */
export function hasEmoji(value) {
  const text = value.replace(/[©®™↔↕↖↗↘↙]/gu, '');
  return /[\p{Extended_Pictographic}\p{Regional_Indicator}\uFE0F\u20E3]/u.test(text);
}

/** Detect common UTF-8 bytes mistakenly decoded as Latin-1 in authored copy. */
export function hasMojibake(value) {
  return /[\u00c3\u00c2][\u0080-\u00bf]|\u00e2(?:\u0080|\u20ac)|\ufffd/u.test(value);
}

/** Inspect parsed authored literals, not comments, identifier names or user input. */
export function inspectSource(text, file = 'surface.tsx') {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const failures = [];
  const report = (node, message) => {
    const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
    failures.push(`${file}:${line + 1}: ${message}`);
  };
  const visit = (node) => {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && ['select', 'datalist'].includes(node.tagName.getText(source))) {
      report(node, 'Native select/datalist is forbidden; use the proprietary SelectField.');
    }
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(source) === 'input') {
      const nativeDate = node.attributes.properties.some((attribute) => ts.isJsxAttribute(attribute) && attribute.name.getText(source) === 'type' && attribute.initializer && (ts.isStringLiteral(attribute.initializer) ? attribute.initializer.text === 'date' : ts.isJsxExpression(attribute.initializer) && attribute.initializer.expression && ts.isStringLiteral(attribute.initializer.expression) && attribute.initializer.expression.text === 'date'));
      if (nativeDate) report(node, 'Native calendar is forbidden; use the proprietary date control.');
    }
    if (ts.isCallExpression(node) && /(?:^|\.)(?:createElement|jsx|jsxs)$/.test(node.expression.getText(source)) && node.arguments[0] && ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text === 'input' && node.arguments[1] && ts.isObjectLiteralExpression(node.arguments[1])) {
      const nativeDate = node.arguments[1].properties.some((property) => ts.isPropertyAssignment(property) && property.name.getText(source).replace(/['"]/g, '') === 'type' && ts.isStringLiteral(property.initializer) && property.initializer.text === 'date');
      if (nativeDate) report(node, 'Native calendar is forbidden; use the proprietary date control.');
    }
    // Include createElement/jsx calls so a non-JSX spelling cannot bypass the gate.
    if (ts.isCallExpression(node) && /(?:^|\.)(?:createElement|jsx|jsxs)$/.test(node.expression.getText(source)) && node.arguments[0] && ts.isStringLiteral(node.arguments[0]) && ['select', 'datalist'].includes(node.arguments[0].text)) {
      report(node, 'Native select/datalist is forbidden; use the proprietary SelectField.');
    }
    if (ts.isStringLiteralLike(node) || ts.isJsxText(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
      if (hasMojibake(node.text)) report(node, 'Corrupted authored text is forbidden; preserve the original UTF-8 copy.');
      if (hasEmoji(node.text)) report(node, 'Authored emoji is forbidden; use a registered proprietary asset.');
      if (/<input\b[^>]*\btype\s*=\s*['\"]?date\b/i.test(node.text)) report(node, 'Native calendar is forbidden; use the proprietary date control.');
      if (/<(?:select|datalist)\b/i.test(node.text)) report(node, 'Native select/datalist markup is forbidden; use the proprietary SelectField.');
      if (/material[- +](?:icons|symbols)|font[- ]awesome/i.test(node.text)) report(node, 'External icon font is forbidden.');
    }
    let moduleName;
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) moduleName = node.moduleSpecifier.text;
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || node.expression.getText(source) === 'require') && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) moduleName = node.arguments[0].text;
    if (moduleName && iconPackages.test(moduleName)) report(node, `External icon library is forbidden: ${moduleName}`);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return failures;
}

/** Standalone HTML and CSS are authored UI too, including generated emails. */
export function inspectMarkup(text, file) {
  const source = text.replace(/<!--[\s\S]*?-->|\/\*[\s\S]*?\*\//g, '')
    .replace(/\\([a-f0-9]{1,6})(?:\s)?/gi, (_match, hex) => { const code = Number.parseInt(hex, 16); return code <= 0x10ffff ? String.fromCodePoint(code) : ''; });
  const failures = [];
  if (/<(?:select|datalist)\b/i.test(source)) failures.push(`${file}: Native select/datalist is forbidden; use the proprietary SelectField.`);
  if (hasMojibake(source)) failures.push(`${file}: Corrupted authored text is forbidden; preserve the original UTF-8 copy.`);
  if (/<input\b[^>]*\btype\s*=\s*['\"]?date\b/i.test(source)) failures.push(`${file}: Native calendar is forbidden; use the proprietary date control.`);
  if (hasEmoji(source)) failures.push(`${file}: Authored emoji is forbidden; use a registered proprietary asset.`);
  if (/(?:material[- +](?:icons|symbols)|font[- ]awesome|(?:https?:)?\/\/[^\s"']*(?:lucide|heroicons|iconify|dicebear)|@import[^;]*(?:react-icons|phosphor|tabler\/icons))/i.test(source)) failures.push(`${file}: External icon library or icon font is forbidden.`);
  return failures;
}

export function inspectCopy(value, file, path = '$') {
  if (typeof value === 'string') return [
    ...(hasEmoji(value) ? [`${file}:${path}: Authored emoji is forbidden; use a registered proprietary asset.`] : []),
    ...(hasMojibake(value) ? [`${file}:${path}: Corrupted authored text is forbidden; preserve the original UTF-8 copy.`] : []),
  ];
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, child]) => inspectCopy(child, file, `${path}.${key}`));
}

function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

export function inspectDependencies(manifest) {
  return Object.keys({ ...manifest.dependencies, ...manifest.optionalDependencies }).filter(name => iconPackages.test(name))
    .map(name => `frontend/package.json: External icon dependency ${name} is forbidden.`);
}

/** Root public archives are retired; approved motion lives under public/rebuild/motion. */
export function inspectPublicAsset(file) {
  return /(?:^|\/)frontend\/public\/(?:fonts\/[^/]*(?:material|icon|symbol|awesome)[^/]*\.(?:woff2?|ttf|otf)|lottie\/)/i.test(file)
    ? [`${file}: Retired external icon font or legacy motion archive is forbidden.`] : [];
}

/** Refuse invalid source bytes before a decoder can silently replace visible copy. */
export function inspectEncoding(bytes, file = 'source') {
  try { new TextDecoder('utf-8', { fatal: true }).decode(bytes); return []; }
  catch { return [`${file}: Authored UI must use valid UTF-8; replacement characters can corrupt translated labels.`]; }
}

function readUiText(path, file, failures) {
  const bytes = readFileSync(path);
  const encodingFailures = inspectEncoding(bytes, file);
  failures.push(...encodingFailures);
  return encodingFailures.length ? null : bytes.toString('utf8');
}

export function checkAuthoredUi(root = repo) {
  const failures = inspectDependencies(JSON.parse(readFileSync(join(root, 'frontend/package.json'), 'utf8')));
  let checked = 0;
  for (const path of files(join(root, 'frontend/src'))) {
    const file = relative(root, path).replaceAll('\\', '/');
    if (/(?:\.test\.|\.spec\.|\/__tests__\/|\/__mocks__\/)/.test(file)) continue;
    if (!/\.(?:[cm]?[jt]sx?|json|css)$/.test(file)) continue;
    const source = readUiText(path, file, failures);
    if (source === null) { checked++; continue; }
    if (/\.[cm]?[jt]sx?$/.test(file)) {
      failures.push(...inspectSource(source, file));
      checked++;
    } else if (file.endsWith('.json')) {
      failures.push(...inspectCopy(JSON.parse(source), file));
      checked++;
    } else if (file.endsWith('.css')) {
      failures.push(...inspectMarkup(source, file));
      checked++;
    }
  }
  for (const path of [...files(join(root, 'frontend/public')), ...readdirSync(join(root, 'frontend')).filter((name) => name.endsWith('.html')).map((name) => join(root, 'frontend', name))]) {
    const file = relative(root, path).replaceAll('\\', '/');
    failures.push(...inspectPublicAsset(file));
    if (!/\.(?:html|css)$/.test(path)) continue;
    const source = readUiText(path, file, failures);
    if (source !== null) failures.push(...inspectMarkup(source, file));
    checked++;
  }
  return { checked, failures };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = checkAuthoredUi();
  if (result.failures.length) {
    console.error(result.failures.join('\n'));
    process.exitCode = 1;
  } else console.log(`Authored UI integrity OK: ${result.checked} source/copy files; no native selects, emoji artwork or external icon imports.`);
}
