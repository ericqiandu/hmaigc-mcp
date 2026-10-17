import { readdirSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import { resolve, relative, sep } from 'node:path';

const root = realpathSync(resolve(process.argv[2] ?? '.'));
const endpoint = 'https://hm.kunagent.com/mcp';
const allowed = new Set([
  'README.md', '.gitignore', 'package.json', '.agents/plugins/marketplace.json',
  'plugins/hmaigc/.codex-plugin/plugin.json', 'plugins/hmaigc/.mcp.json',
  'plugins/hmaigc/assets/mark.png', 'plugins/hmaigc/assets/logo.png',
  'plugins/hmaigc/skills/hmaigc-create/SKILL.md',
  'scripts/validate-package.mjs', 'test/package.test.mjs',
]);
const errors = [];
function check(ok, reason) { if (!ok) errors.push(reason); }
function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (dir === root && name === '.git') continue;
    const path = resolve(dir, name);
    const stat = lstatSync(path);
    const key = relative(root, path).split(sep).join('/');
    if (stat.isSymbolicLink()) { errors.push(`symlink rejected: ${key}`); continue; }
    if (stat.isDirectory()) { walk(path); continue; }
    check(stat.isFile() && allowed.has(key), `unexpected file: ${key}`);
    if (stat.isFile() && !key.endsWith('.png')) {
      const body = readFileSync(path, 'utf8');
      check(!/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9]{20,})/.test(body), `credential material: ${key}`);
    }
  }
}
function localPath(base, path, label) {
  if (typeof path !== 'string' || !path.startsWith('./') || path.includes('\\') || path.split('/').includes('..')) {
    errors.push(`invalid ${label} path`); return null;
  }
  const target = resolve(base, path);
  const child = relative(base, target);
  if (!child || child.startsWith('..') || resolve(base, child) !== target) {
    errors.push(`escaping ${label} path`); return null;
  }
  try {
    const actual = realpathSync(target);
    check(actual === target, `symlink ${label} path`);
    return target;
  } catch { errors.push(`missing ${label} path`); return null; }
}
function noCredentials(value) {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    check(!/^(?:clientSecret|client_secret|access_token|refresh_token|token|password|privateKey|apiKey|api_key|authorization)$/i.test(key), `credential field: ${key}`);
    noCredentials(child);
  }
}
function json(path) {
  try {
    const value = JSON.parse(readFileSync(path, 'utf8'));
    check(value !== null && typeof value === 'object' && !Array.isArray(value), 'JSON object required');
    noCredentials(value);
    return value;
  } catch { errors.push('missing or malformed JSON'); return null; }
}

walk(root);
// Resolve declared paths only after rejecting links anywhere in the candidate.
if (!errors.some(error => error.includes('symlink'))) {
  const market = json(resolve(root, '.agents/plugins/marketplace.json'));
  check(market?.name === 'hmaigc' && market?.plugins?.length === 1, 'one hmaigc marketplace entry required');
  const entry = market?.plugins?.[0];
  check(entry?.name === 'hmaigc' && entry?.source?.source === 'local', 'local hmaigc source required');
  check(entry?.policy?.installation === 'AVAILABLE' && entry?.policy?.authentication === 'ON_INSTALL', 'explicit install/authentication policy required');
  check(entry?.category === 'Creativity', 'Creativity category required');
  const pluginRoot = localPath(root, entry?.source?.path, 'marketplace');
  if (pluginRoot) {
    const plugin = json(resolve(pluginRoot, '.codex-plugin/plugin.json'));
    check(plugin?.name === entry?.name, 'plugin name mismatch');
    check(/^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/.test(plugin?.version ?? '') && plugin?.version === entry?.version, 'version mismatch');
    check(plugin?.skills === './skills/' && plugin?.mcpServers === './.mcp.json', 'component path contract mismatch');
    localPath(pluginRoot, plugin?.skills, 'skills');
    const mcpPath = localPath(pluginRoot, plugin?.mcpServers, 'MCP');
    for (const icon of ['composerIcon', 'logo']) localPath(pluginRoot, plugin?.interface?.[icon], icon);
    check(['Read', 'Write', 'Interactive'].every(cap => plugin?.interface?.capabilities?.includes(cap)), 'plugin capabilities missing');
    if (mcpPath) {
      const config = json(mcpPath);
      check(config?.mcpServers && Object.keys(config.mcpServers).length === 1, 'one remote MCP server required');
      const server = config?.mcpServers?.hmaigc;
      check(server?.type === 'http' && server?.url === endpoint, 'HTTPS MCP endpoint mismatch');
      check(server?.oauth_resource === endpoint, 'OAuth resource mismatch');
      for (const field of Object.keys(server ?? {})) check(['type', 'url', 'oauth_resource'].includes(field), `unexpected server field: ${field}`);
    }
    try {
      const skill = readFileSync(resolve(pluginRoot, 'skills/hmaigc-create/SKILL.md'), 'utf8');
      check(/^---\r?\nname: hmaigc-create\r?\ndescription: [^\r\n]+\r?\n---/.test(skill), 'skill frontmatter missing');
    } catch { errors.push('missing skill'); }
  }
}
if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ ok: true, endpoint, marketplace: 'hmaigc', plugin: 'hmaigc' }));
}
