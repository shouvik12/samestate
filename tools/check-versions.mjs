// Both packages ship the extension, so they must publish the same release version.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const plugin = read('../.claude-plugin/plugin.json');
const extension = read('../extension/manifest.json');
assert.match(extension.version, /^\d+(?:\.\d+){1,3}$/, 'Use a Chrome-compatible numeric release version.');
assert.equal(plugin.version, extension.version,
  'Release the plugin and extension together. Update both version fields.');
const base = process.env.SAMESTATE_VERSION_BASE;
if (base && !/^0+$/.test(base)) {
  const git = args => execFileSync('git', args, {cwd: root, encoding: 'utf8'});
  const changed = git(['diff', '--name-only', base, '--', 'extension', 'mcp', 'skills', '.claude-plugin'])
    .trim().split('\n').filter(path => path && !(path.startsWith('mcp/') && path.endsWith('.md')));
  if (changed.length) {
    const previous = JSON.parse(git(['show', base + ':.claude-plugin/plugin.json']));
    const before = previous.version.split('.').map(Number);
    const after = plugin.version.split('.').map(Number);
    const part = [0, 1, 2, 3].find(index => (after[index] || 0) !== (before[index] || 0));
    assert.ok(part !== undefined && (after[part] || 0) > (before[part] || 0),
      'Bundled plugin files changed. Increment both release versions so installed plugins receive the update.');
  }
}
console.log('Plugin and extension versions match at ' + extension.version);
