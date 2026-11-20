// Checks the MCP server (mcp/server.mjs) the way an AI assistant uses it: JSON-RPC over stdio, against the
// sample site served on localhost. Needs Node 22+ and Google Chrome (or CHROME_PATH). No npm packages.
//
//   node tests/mcp.mjs
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { join, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(fileURLToPath(new URL('..', import.meta.url)));
const ROOT = join(REPO, 'docs');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2' };
const site = createServer((req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path.endsWith('/')) path += 'index.html';
  const file = resolve(ROOT, '.' + path);
  if (!file.startsWith(ROOT + sep)) { res.writeHead(403).end(); return; }
  try { if (!statSync(file).isFile()) throw new Error(); res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' }).end(readFileSync(file)); } catch { res.writeHead(404).end(); }
});
await new Promise(done => site.listen(0, '127.0.0.1', done));
const page = `http://localhost:${site.address().port}/demo/index.html`;

const server = spawn(process.execPath, [join(REPO, 'mcp/server.mjs')], { stdio: ['pipe', 'pipe', 'ignore'] });
let buffer = '', next = 0;
const pending = new Map();
server.stdout.on('data', chunk => {
  buffer += chunk;
  let end;
  while ((end = buffer.indexOf('\n')) >= 0) { const message = JSON.parse(buffer.slice(0, end)); buffer = buffer.slice(end + 1); pending.get(message.id)?.(message); pending.delete(message.id); }
});
const rpc = (method, params) => new Promise(done => { const id = ++next; pending.set(id, done); server.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'); });
const tool = async (name, args) => (await rpc('tools/call', { name, arguments: args })).result;
const text = result => result.content.filter(c => c.type === 'text').map(c => c.text).join('\n');
const pngWidth = data => Buffer.from(data, 'base64').readUInt32BE(16);

const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };
try {
  const init = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'samestate-test', version: '1' } });
  check('Starts and names itself', init.result?.serverInfo?.name === 'samestate' && !!init.result.capabilities.tools);
  server.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  const tools = (await rpc('tools/list')).result.tools.map(t => t.name);
  check('Lists its four tools', ['list_devices', 'check_responsive', 'run_checks', 'screenshot'].every(t => tools.includes(t)), tools.join(', '));

  const devices = text(await tool('list_devices', {}));
  check('Lists the screens with ids and sizes', /^iphone — iPhone 11 Pro 375×812/m.test(devices) && /^desktop — Desktop 1920×1080/m.test(devices));

  const report = await tool('check_responsive', { url: page, devices: ['iphone', 'desktop'] });
  const body = text(report);
  check('Reports sideways scroll on the phone', /Page scrolls sideways — iPhone 11 Pro/.test(body), body.split('\n')[2]);
  check('Reports the table wider than its container', /Table is wider than its container — iPhone 11 Pro/.test(body));
  check('Includes the CSS that usually fixes it', /Usually fixed by this CSS on the affected elements: max-width: 100%;/.test(body));
  check('Names the element that pushes the page sideways', /Page scrolls sideways \(\+\d+px\)[^\n]*\n  Elements: `table`/.test(body));
  check('Names the overlay that hides controls', /Overlay hides \d+ controls[^\n]*\n  Elements: `#cookies`/.test(body));
  check('Gives unique selectors for small tap targets', /Elements: `div\.tabs > button:nth-of-type\(1\)`, `div\.tabs > button:nth-of-type\(2\)`/.test(body));
  check('Leaves adaptations out unless asked', /adaptations \(not listed\)/.test(body) && !/ADAPTATION ·/.test(body));
  const all = text(await tool('check_responsive', { url: page, devices: ['iphone', 'desktop'], include_adaptations: true }));
  check('Lists adaptations when asked', /ADAPTATION · Navigation · Navigation collapses behind a menu button/.test(all));

  const shots = await tool('screenshot', { url: page, devices: ['iphone', 'desktop'] });
  const reversed = await tool('screenshot', { url: page, devices: ['desktop', 'iphone'] });
  check('Returns screenshots in the order asked for', reversed.content.filter(c => c.type === 'text').slice(1).map(c => c.text).join(',') === 'Desktop,iPhone 11 Pro');
  const images = shots.content.filter(c => c.type === 'image');
  check('Returns one sharp screenshot per screen', images.length === 2 && pngWidth(images[0].data) === 375 && pngWidth(images[1].data) === 900, images.map(i => pngWidth(i.data)).join(' and ') + ' px wide');

  const checks = text(await tool('run_checks', { url: page, devices: ['iphone', 'desktop'], groups: ['layout'] }));
  check('Runs the combined checks', /^Samestate checks for .*: Issues found/.test(checks) && /## FAILED · Layout & content/.test(checks));

  const unknown = await tool('check_responsive', { url: page, devices: ['nope'] });
  check('Rejects an unknown screen id', unknown.isError && /Unknown device id: nope/.test(text(unknown)));
  const scheme = await tool('check_responsive', { url: 'ftp://example.com' });
  check('Rejects addresses that are not http or https', scheme.isError && /Only http and https/.test(text(scheme)));
  const down = await tool('check_responsive', { url: 'http://localhost:9/', devices: ['iphone'] });
  check('Says so when the page never loads', down.isError && /did not load on any screen/.test(text(down)));
} finally {
  server.stdin.end();
  site.close();
}
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} MCP server checks passed`);
process.exit(passed === results.length ? 0 : 1);
