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
const branches = ['primary-' + 'nested-control-'.repeat(12), 'secondary'];
let scanStarted, scanStopped, slowLinkOpen = false, queuedVisits = 0;
const slowLinkRequested = new Promise(done => { scanStarted = done; });
const slowLinkClosed = new Promise(done => { scanStopped = done; });
const site = createServer((req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path === '/deep-selectors') {
    const controls = branches.map((id, index) => '<section id="' + id + '">' + '<div>'.repeat(8) +
      '<button aria-label="Control ' + (index + 1) + '"></button>' + '</div>'.repeat(8) + '</section>').join('');
    res.writeHead(200, { 'content-type': 'text/html' }).end('<!doctype html><meta name="viewport" content="width=device-width"><title>Deep selectors</title><style>button{width:20px;height:20px;padding:0}</style>' + controls);
    return;
  }
  if (path === '/scan') {
    res.writeHead(200, { 'content-type': 'text/html' }).end('<!doctype html><title>Slow scan</title><a href="/slow-link">Slow link</a>');
    return;
  }
  if (path === '/slow-link' && req.method === 'HEAD') {
    slowLinkOpen = true;
    res.once('close', () => { slowLinkOpen = false; scanStopped(); });
    scanStarted();
    return;
  }
  if (path === '/queued') queuedVisits++;
  if (path.endsWith('/')) path += 'index.html';
  const file = resolve(ROOT, '.' + path);
  if (!file.startsWith(ROOT + sep)) { res.writeHead(403).end(); return; }
  try { if (!statSync(file).isFile()) throw new Error(); res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' }).end(readFileSync(file)); } catch { res.writeHead(404).end(); }
});
await new Promise(done => site.listen(0, '127.0.0.1', done));
const origin = `http://localhost:${site.address().port}`;
const page = origin + '/demo/index.html';

const server = spawn(process.execPath, [join(REPO, 'mcp/server.mjs')], { stdio: ['pipe', 'pipe', 'ignore'] });
let buffer = '', next = 0;
const pending = new Map();
server.stdout.on('data', chunk => {
  buffer += chunk;
  let end;
  while ((end = buffer.indexOf('\n')) >= 0) { const message = JSON.parse(buffer.slice(0, end)); buffer = buffer.slice(end + 1); pending.get(message.id)?.(message); pending.delete(message.id); }
});
const send = (method, params, id) => server.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
const request = (method, params, id = ++next) => {
  const reply = new Promise(done => pending.set(id, done));
  send(method, params, id);
  return { id, reply };
};
const rpc = (method, params) => request(method, params).reply;
const cancel = requestId => send('notifications/cancelled', { requestId });
async function within(promise, ms, message) {
  let timer;
  const timeout = new Promise((_, fail) => { timer = setTimeout(() => fail(Error(message)), ms); });
  try { return await Promise.race([promise, timeout]); }
  finally { clearTimeout(timer); }
}
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
  const deep = text(await tool('check_responsive', { url: origin + '/deep-selectors', devices: ['iphone'] }));
  const targets = deep.match(/2 tap targets under 24px[^\n]*\n  Elements: ([^\n]+)/)?.[1] || '';
  const expected = branches.map(id => '#' + id + ' > ' + 'div > '.repeat(8) + 'button');
  check('Distinguishes deep repeated controls and preserves long selectors',
    expected.every(selector => targets.includes('`' + selector + '`')), targets);
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

  const scan = request('tools/call', { name: 'check_responsive', arguments: {
    url: origin + '/scan', devices: ['iphone'], check_links: true
  } }, 'slow-scan');
  await within(slowLinkRequested, 20000, 'The link scan did not start');
  const queued = request('tools/call', { name: 'screenshot', arguments: { url: origin + '/queued' } });
  cancel(queued.id);
  await rpc('ping');
  check('Cancelling a queued call leaves the active scan running', slowLinkOpen && pending.has(scan.id));
  cancel(scan.id);
  await within(slowLinkClosed, 3500, 'Cancellation did not close the pending link request before its own timeout');
  const nextDevices = await within(tool('list_devices', {}), 15000, 'The queue did not recover after cancellation');
  check('Cancels an active scan and restarts Chrome for the next call', /^iphone —/m.test(text(nextDevices)));
  check('Skips the queued call and sends no cancellation responses',
    queuedVisits === 0 && pending.has(queued.id) && pending.has(scan.id));
} finally {
  server.stdin.end();
  site.close();
  site.closeAllConnections();
}
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} MCP server checks passed`);
process.exit(passed === results.length ? 0 : 1);
