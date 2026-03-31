const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');

function readSource(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

test('ForbiddenView keeps link action as the default recovery path', () => {
  const source = readSource('components/ForbiddenView.js');

  assert.match(source, /actionKind = 'link'/);
  assert.match(source, /<Link href=\{actionHref\} className="btn-primary"/);
});

test('ForbiddenView supports button-based recovery flows', () => {
  const source = readSource('components/ForbiddenView.js');

  assert.match(source, /actionKind === 'button'/);
  assert.match(source, /<button type="button" className="btn-primary".*onClick=\{onAction\}/s);
});

test('AuthProvider tracks role lookup failures without assigning a fallback role', () => {
  const source = readSource('components/AuthProvider.js');

  assert.match(source, /const \[roleLoadError, setRoleLoadError\] = useState\(false\);/);
  assert.match(source, /setRoleLoadError\(true\)/);
  assert.doesNotMatch(source, /setRole\('staff'\)/);
});

test('AuthGate switches to logout recovery when the role cannot be resolved', () => {
  const source = readSource('components/AuthGate.js');

  assert.match(source, /const forbiddenTitle = roleLoadError \? '권한 확인 필요' : '권한 없음';/);
  assert.match(source, /const actionKind = roleLoadError \? 'button' : 'link';/);
  assert.match(source, /onAction=\{roleLoadError \? handleRoleRecovery : null\}/);
});

test('TabBar hides settings for non-owner users and stays hidden while auth is unresolved', () => {
  const source = readSource('components/TabBar.js');

  assert.match(source, /if \(!user \|\| roleLoadError \|\| !role\) \{\s*return \[\];/s);
  assert.match(source, /return baseTabs\.filter\(\(tab\) => tab\.href !== '\/settings'\);/);
});
