import assert from 'node:assert/strict';
import test from 'node:test';
import { hasEmoji, hasMojibake, inspectEncoding, inspectPublicAsset, inspectDependencies, inspectCopy, inspectMarkup, inspectSource } from './check-authored-ui.mjs';

test('valid UTF-8 cannot conceal Latin-1 corruption of localized labels', () => {
  assert.equal(hasMojibake('Português; Español; São Tomé; Ângela; ©'), false);
  for (const label of ['Português', 'Español', '©']) {
    const corrupted = Buffer.from(label, 'utf8').toString('latin1');
    assert.equal(hasMojibake(corrupted), true);
    assert.equal(inspectSource(`const label = ${JSON.stringify(corrupted)};`).length, 1);
    assert.equal(inspectCopy({ options: [{ label: corrupted }] }, 'copy.json').length, 1);
    assert.equal(inspectMarkup(`<span>${corrupted}</span>`, 'page.html').length, 1);
  }
});

test('translated UI labels require valid UTF-8 rather than silent replacement bytes', () => {
  assert.deepEqual(inspectEncoding(Buffer.from('Português; Español; © LittleFounders', 'utf8')), []);
  assert.equal(inspectEncoding(Buffer.from('Português', 'latin1'), 'header.tsx').length, 1);
  assert.equal(inspectEncoding(Buffer.from([0xe2, 0x82]), 'copy.json').length, 1);
});

test('authored UI rejects emoji literals, escaped emoji and keycap flags', () => {
  for (const source of ['const icon = "\\u{1F31E}";', 'const icon = "☀";', 'const item = <span>🏁</span>;', 'const item = `hello ${name} 🌟`;', 'const item = "🇲🇽";', 'const item = "1️⃣";']) {
    assert.ok(inspectSource(source).some((line) => line.includes('Authored emoji')), source);
  }
  assert.deepEqual(inspectCopy({ menu: { icon: '🌟' } }, 'copy.json').map((line) => line.split(':')[1]), ['$.menu.icon']);
});

test('textual math and copyright symbols, comments and user expressions stay intact', () => {
  for (const symbol of ['©', '®', '™', '↔', '→', '✓', '$', '€', '×', '÷', '∞']) assert.equal(hasEmoji(symbol), false, symbol);
  assert.deepEqual(inspectSource('// 🌟 documentation\nconst item = <span>{user.displayName}</span>;'), []);
  assert.deepEqual(inspectCopy({ text: '© 2026 LittleFounders; 2 × 3 = 6' }, 'copy.json'), []);
});

test('native selects are rejected in JSX and factory calls; proprietary controls pass', () => {
  for (const source of ['const item = <select><option>EN</option></select>;', 'const item = <select />;', 'const item = <datalist />;', 'React.createElement("select", {});', 'jsx("select", {});', 'const html = "<select></select>";']) assert.ok(inspectSource(source).some((line) => line.includes('Native select')), source);
  assert.deepEqual(inspectSource('const item = <SelectField label="Language" />;'), []);
});

test('standalone HTML and styles cannot introduce emoji, icon fonts or native pickers', () => {
  for (const text of ['<datalist></datalist>', '<SELECT></SELECT>', '<span>☀</span>', '<link href="https://fonts.googleapis.com/icon?family=Material+Icons">', '.icon { font-family: "Material Symbols"; }']) assert.ok(inspectMarkup(text, 'surface.html').length, text);
  assert.deepEqual(inspectMarkup('<!-- 🌟 comment --><footer>© LittleFounders</footer>', 'email.html'), []);
});

test('external icon imports cannot bypass the gate through exports or dynamic loading', () => {
  for (const source of ['import { Sun } from "lucide-react";', 'export { Star } from "react-icons/fa";', 'const pack = await import("@heroicons/react/24/solid");', 'const pack = require("@phosphor-icons/react");']) assert.ok(inspectSource(source).some((line) => line.includes('External icon')), source);
  assert.deepEqual(inspectSource('import { Glyph } from "./rebuild/design/glyphs";'), []);
});

test('external public icon fonts and retired motion archives cannot return', () => {
  assert.equal(inspectPublicAsset('frontend/public/fonts/material-symbols-outlined.woff2').length, 1);
  assert.equal(inspectPublicAsset('frontend/public/lottie/followers.lottie').length, 1);
  assert.deepEqual(inspectPublicAsset('frontend/public/rebuild/motion/lesson-complete.lottie'), []);
  assert.deepEqual(inspectPublicAsset('frontend/public/fonts/Latin-Bold.woff2'), []);
});

test('unused external icon dependencies are forbidden as well as runtime imports', () => {
  assert.equal(inspectDependencies({ dependencies: { 'lucide-react': '1.0', '@dicebear/core': '1.0' } }).length, 2);
  assert.deepEqual(inspectDependencies({ dependencies: { react: '18', 'lottie-web': '5' } }), []);
});

test('CSS hexadecimal escapes cannot conceal authored emoji', () => {
  assert.ok(inspectMarkup('.icon::after { content: "\\1f31e "; }', 'style.css').some(line => line.includes('Authored emoji')));
});

test('rejects authored native calendar menus', () => {
  assert.equal(inspectSource('<input type="date" />').length, 1);
  assert.equal(inspectSource("<input type={'date'} />").length, 1);
  assert.equal(inspectMarkup('<input type="date">', 'index.html').length, 1);
  assert.equal(inspectSource("React.createElement('input', {type:'date'})").length, 1);
  assert.equal(inspectSource("const markup = '<input type=date>';").length, 1);
});
