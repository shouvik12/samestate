// Checks the MCP server (mcp/server.mjs) the way an AI assistant uses it: JSON-RPC over stdio, against the
// sample site served on localhost. Needs Node 22+ and Google Chrome (or CHROME_PATH). No npm packages.
//
//   node tests/mcp.mjs
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, statSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(fileURLToPath(new URL('..', import.meta.url)));
const ROOT = join(REPO, 'docs');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2' };
const branches = ['primary-' + 'nested-control-'.repeat(12), 'secondary'];
let scanStarted, scanStopped, slowLinkOpen = false, queuedVisits = 0;
const slowLinkRequested = new Promise(done => { scanStarted = done; });
const slowLinkClosed = new Promise(done => { scanStopped = done; });
const sessionValue = 'samestate-test-account-session';
const site = createServer((req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path === '/account') {
    if (!req.headers.cookie?.includes('samestate_test=' + sessionValue)) {
      res.writeHead(302, { location: '/login' }).end();
    } else {
      res.writeHead(200, { 'content-type': 'text/html' }).end('<!doctype html><meta name="viewport" content="width=device-width"><title>Test dashboard</title><button id="account-only" style="width:10px;height:10px;padding:0">Account</button>');
    }
    return;
  }
  if (path === '/storage-account') {
    res.writeHead(200, { 'content-type': 'text/html' }).end(`<!doctype html><meta name="viewport" content="width=device-width"><title>Storage dashboard</title>
      <button id="storage-only" style="width:10px;height:10px;padding:0">Account</button>
      <script>if(localStorage.getItem('test_token')!==${JSON.stringify(sessionValue)})location.replace('/login');</script>`);
    return;
  }
  if (path === '/login' || path === '/test-login') {
    res.writeHead(200, { 'content-type': 'text/html' }).end(`<!doctype html><meta name="viewport" content="width=device-width"><title>Test login</title>
      <button id="login-only" style="width:10px;height:10px;padding:0">Login</button>
      ${path === '/test-login' ? '<script>localStorage.setItem("test_token",' + JSON.stringify(sessionValue) + ');setTimeout(()=>location.assign("/complete-test-login"),400)</script>' : ''}`);
    return;
  }
  if (path === '/complete-test-login') {
    res.writeHead(302, { location: '/account', 'set-cookie': 'samestate_test=' + sessionValue + '; Path=/; HttpOnly; SameSite=Lax' }).end();
    return;
  }
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

const project = mkdtempSync(join(tmpdir(), 'samestate-mcp-project-'));
mkdirSync(join(project, '.samestate/auth'), { recursive: true });
const stateFile = '.samestate/auth/test-account.json';
writeFileSync(join(project, stateFile), JSON.stringify({
  cookies: [{ name: 'samestate_test', value: sessionValue, domain: 'localhost', path: '/', expires: -1, httpOnly: true, secure: false, sameSite: 'Lax' }],
  origins: [{ origin, localStorage: [{ name: 'test_token', value: sessionValue }] }]
}));
writeFileSync(join(project, '.samestate/auth/expired.json'), JSON.stringify({
  cookies: [{ name: 'samestate_test', value: 'expired', domain: 'localhost', path: '/' }], origins: []
}));
writeFileSync(join(project, '.samestate/auth/invalid.json'), '{' + sessionValue);
const server = spawn(process.execPath, [join(REPO, 'mcp/server.mjs')], { cwd: project, stdio: ['pipe', 'pipe', 'pipe'] });
let diagnostics = '';
server.stderr.on('data', chunk => { diagnostics += chunk; });
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
  const definitions = (await rpc('tools/list')).result.tools;
  const tools = definitions.map(t => t.name);
  check('Lists its four tools', ['list_devices', 'check_responsive', 'run_checks', 'screenshot'].every(t => tools.includes(t)), tools.join(', '));
  check('Offers sign_in on all page tools', definitions.filter(t => t.name !== 'list_devices').every(t => t.inputSchema.properties.sign_in?.oneOf?.length === 2));
  check('Reports the plugin release version', init.result.serverInfo.version === JSON.parse(readFileSync(join(REPO, '.claude-plugin/plugin.json'))).version);

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

  const authenticated = text(await tool('check_responsive', {
    url: origin + '/account', devices: ['iphone', 'desktop'], sign_in: { state_file: stateFile }
  }));
  check('Uses a saved test-account cookie on both screens', authenticated.includes('`#account-only`') && !authenticated.includes('`#login-only`') && /iPhone 11 Pro:/.test(authenticated) && /Desktop:/.test(authenticated));
  const privateShots = await tool('screenshot', {
    url: origin + '/account', devices: ['iphone'], sign_in: { state_file: stateFile }
  });
  check('Screenshots can reuse an explicitly selected test session', !privateShots.isError && privateShots.content.some(item => item.type === 'image'));
  const privateChecks = await tool('run_checks', {
    url: origin + '/account', devices: ['iphone'], groups: ['layout'], sign_in: { state_file: stateFile }
  });
  check('Combined checks accept a saved test session', !privateChecks.isError && /Samestate checks for/.test(text(privateChecks)));
  const stored = await tool('check_responsive', {
    url: origin + '/storage-account', devices: ['iphone', 'desktop'], sign_in: { state_file: stateFile }
  });
  check('Restores localStorage before page scripts on both screens', !stored.isError && text(stored).includes('`#storage-only`'));
  const withoutSession = text(await tool('check_responsive', { url: origin + '/account', devices: ['iphone'] }));
  check('Calls without sign_in start without the test session', withoutSession.includes('`#login-only`') && !withoutSession.includes('`#account-only`'));
  const expired = await tool('check_responsive', {
    url: origin + '/account', devices: ['iphone'], sign_in: { state_file: '.samestate/auth/expired.json' }
  });
  check('Reports an expired session redirect instead of checking the login page', expired.isError && /Authenticated previews reached a different page/.test(text(expired)));
  const invalid = await tool('screenshot', {
    url: origin + '/account', sign_in: { state_file: '.samestate/auth/invalid.json' }
  });
  check('Malformed login files produce errors without their contents', invalid.isError && !text(invalid).includes(sessionValue) && /valid JSON/.test(text(invalid)));
  const outside = await tool('screenshot', {
    url: origin + '/account', sign_in: { state_file: join(REPO, '.claude-plugin/plugin.json') }
  });
  check('Only reads session files inside the project', outside.isError && /inside the project/.test(text(outside)));
  const manual = await tool('check_responsive', {
    url: origin + '/account', devices: ['iphone', 'desktop'],
    sign_in: { login_url: origin + '/test-login', success_url: origin + '/account', timeout_seconds: 15 }
  });
  check('Login URL completion signs in the separate Chrome profile', !manual.isError && text(manual).includes('`#account-only`'));
  const manualStorage = await tool('check_responsive', {
    url: origin + '/storage-account', devices: ['iphone', 'desktop'],
    sign_in: { login_url: origin + '/test-login', success_url: origin + '/account', timeout_seconds: 15 }
  });
  check('Login-window localStorage reaches the isolated previews', !manualStorage.isError && text(manualStorage).includes('`#storage-only`'),
    manualStorage.isError ? text(manualStorage) : '');
  const timeout = await tool('screenshot', {
    url: origin + '/account', devices: ['iphone'],
    sign_in: { login_url: origin + '/login', success_url: origin + '/account', timeout_seconds: 1 }
  });
  check('A login timeout is actionable and leaves the queue usable', timeout.isError && /sign-in did not reach success_url/.test(text(timeout)));
  check('Session contents stay out of server diagnostics', !diagnostics.includes(sessionValue));

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
  await new Promise(done => server.once('exit', done));
  rmSync(project, { recursive: true, force: true });
  site.close();
  site.closeAllConnections();
}
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} MCP server checks passed`);
process.exit(passed === results.length ? 0 : 1);
