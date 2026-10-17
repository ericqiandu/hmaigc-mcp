import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const validator = resolve(root, 'scripts/validate-package.mjs');
const endpoint = 'https://hm.kunagent.com/mcp';

function fixture(t, mutate = () => {}) {
  const dir = mkdtempSync(resolve(tmpdir(), 'hmaigc-package-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const files = {
    '.agents/plugins/marketplace.json': {
      name: 'hmaigc', plugins: [{ name: 'hmaigc', version: '0.1.0-rc.1',
        source: { source: 'local', path: './plugins/hmaigc' },
        policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' }, category: 'Creativity' }],
    },
    'plugins/hmaigc/.codex-plugin/plugin.json': {
      name: 'hmaigc', version: '0.1.0-rc.1', skills: './skills/', mcpServers: './.mcp.json',
      interface: { displayName: 'HMAIGC', capabilities: ['Read', 'Write', 'Interactive'],
        composerIcon: './assets/mark.png', logo: './assets/mark.png' },
    },
    'plugins/hmaigc/.mcp.json': { mcpServers: { hmaigc: { type: 'http', url: endpoint, oauth_resource: endpoint } } },
    'plugins/hmaigc/skills/hmaigc-create/SKILL.md': '---\nname: hmaigc-create\ndescription: Work on HMAIGC canvases.\n---\nRead capabilities before writing.\n',
    'plugins/hmaigc/assets/mark.png': Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  };
  mutate(files);
  for (const [name, value] of Object.entries(files)) {
    const path = resolve(dir, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, typeof value === 'object' && !Buffer.isBuffer(value) ? JSON.stringify(value) : value);
  }
  return dir;
}

function run(dir) {
  const result = spawnSync(process.execPath, [validator, dir], { encoding: 'utf8' });
  return { status: result.status, output: result.stdout + result.stderr };
}

test('accepts a self-contained OAuth marketplace package', t => {
  const result = run(fixture(t));
  assert.equal(result.status, 0, result.output);
});

for (const [name, mutate, reason] of [
  ['marketplace path traversal', f => { f['.agents/plugins/marketplace.json'].plugins[0].source.path = '../outside'; }, 'path'],
  ['absolute component path', f => { f['plugins/hmaigc/.codex-plugin/plugin.json'].skills = '/outside'; }, 'path'],
  ['missing icon', f => { delete f['plugins/hmaigc/assets/mark.png']; }, 'missing'],
  ['version mismatch', f => { f['.agents/plugins/marketplace.json'].plugins[0].version = '9.0.0'; }, 'version'],
  ['wrong remote origin', f => { f['plugins/hmaigc/.mcp.json'].mcpServers.hmaigc.url = 'https://other.example/mcp'; }, 'endpoint'],
  ['HTTP resource', f => { f['plugins/hmaigc/.mcp.json'].mcpServers.hmaigc.oauth_resource = 'http://hm.kunagent.com/mcp'; }, 'resource'],
  ['local server command', f => { f['plugins/hmaigc/.mcp.json'].mcpServers.hmaigc.command = 'node'; }, 'field'],
  ['embedded authorization', f => { f['plugins/hmaigc/.mcp.json'].mcpServers.hmaigc.headers = { Authorization: 'Bearer fixture-value' }; }, 'field'],
  ['secret field', f => { f['plugins/hmaigc/.codex-plugin/plugin.json'].clientSecret = 'fixture-value'; }, 'credential'],
  ['extra environment file', f => { f['.env'] = 'EXAMPLE=value'; }, 'file'],
  ['private key in prose', f => { f['README.md'] = '-----BEGIN ' + 'PRIVATE KEY-----'; }, 'credential'],
  ['malformed JSON', f => { f['.agents/plugins/marketplace.json'] = '{'; }, 'JSON'],
]) {
  test(`rejects ${name}`, t => {
    const result = run(fixture(t, mutate));
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, new RegExp(reason, 'i'));
  });
}

test('rejects a package symlink before following it', t => {
  const dir = fixture(t);
  symlinkSync(tmpdir(), resolve(dir, 'plugins/hmaigc/assets/outside'), process.platform === 'win32' ? 'junction' : 'dir');
  const result = run(dir);
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /symlink/i);
});

test('repository candidate passes the same publication gate', () => {
  const result = run(root);
  assert.equal(result.status, 0, result.output);
});
