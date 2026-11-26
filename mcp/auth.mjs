// Explicit test-account state for the plugin's temporary browser.
import {createHash} from 'node:crypto';
import {readFileSync, realpathSync} from 'node:fs';
import {isAbsolute, relative, resolve} from 'node:path';

function webAddress(value) {
  let url;
  try { url = new URL(value); } catch { throw Error('Sign-in addresses must be full HTTP or HTTPS URLs.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw Error('Sign-in addresses must be HTTP or HTTPS URLs without embedded credentials.');
  }
  return url;
}

function cookieForHost(cookie, host) {
  if (typeof cookie?.domain !== 'string') throw Error('Invalid cookie in the saved sign-in file.');
  const domain = cookie.domain.replace(/^\./, '').toLowerCase();
  if (host !== domain && !(cookie.domain.startsWith('.') && host.endsWith('.' + domain))) return null;
  if (typeof cookie.name !== 'string' || typeof cookie.value !== 'string' ||
      typeof cookie.path !== 'string' || !cookie.path.startsWith('/')) {
    throw Error('Invalid cookie in the saved sign-in file.');
  }
  const result = {name: cookie.name, value: cookie.value, domain: cookie.domain, path: cookie.path};
  for (const key of ['httpOnly', 'secure']) {
    if (cookie[key] !== undefined) {
      if (typeof cookie[key] !== 'boolean') throw Error('Invalid cookie in the saved sign-in file.');
      result[key] = cookie[key];
    }
  }
  if (cookie.sameSite !== undefined) {
    if (!['Strict', 'Lax', 'None'].includes(cookie.sameSite)) throw Error('Invalid cookie in the saved sign-in file.');
    result.sameSite = cookie.sameSite;
  }
  if (cookie.expires !== undefined) {
    if (!Number.isFinite(cookie.expires) || cookie.expires < -1) throw Error('Invalid cookie in the saved sign-in file.');
    if (cookie.expires >= 0) result.expires = cookie.expires;
  }
  if (cookie.partitionKey !== undefined) {
    // Playwright's partitionKey is a top-level site URL.
    const site = webAddress(cookie.partitionKey);
    result.partitionKey = {topLevelSite: site.origin, hasCrossSiteAncestor: true};
  }
  return result;
}

function readState(file, target, project) {
  let path, root;
  try { path = realpathSync(resolve(project, file)); root = realpathSync(project); }
  catch { throw Error('Could not read the saved sign-in file in the project.'); }
  const within = relative(root, path);
  if (within === '..' || within.startsWith('../') || within.startsWith('..\\') || isAbsolute(within)) {
    throw Error('The saved sign-in file must be inside the project directory.');
  }
  let state;
  try { state = JSON.parse(readFileSync(path, 'utf8')); }
  catch { throw Error('The saved sign-in file must contain valid JSON.'); }
  if (!state || !Array.isArray(state.cookies) || !Array.isArray(state.origins)) {
    throw Error('Use a storage-state JSON file with cookies and origins arrays.');
  }
  const cookies = state.cookies.map(cookie => cookieForHost(cookie, target.hostname)).filter(Boolean);
  const localStorage = state.origins.filter(entry => entry?.origin === target.origin).flatMap(entry => {
    if (!Array.isArray(entry.localStorage) || entry.localStorage.some(item =>
      typeof item?.name !== 'string' || typeof item.value !== 'string')) {
      throw Error('Invalid localStorage in the saved sign-in file.');
    }
    return entry.localStorage;
  });
  if (!cookies.length && !localStorage.length) throw Error('The saved sign-in file has no state for this site.');
  return {mode: 'state', cookies, localStorage};
}

export function readSignIn(option, target, project = process.cwd()) {
  if (option === undefined) return {key: 'public'};
  if (!option || typeof option !== 'object' || Array.isArray(option)) throw Error('sign_in must be an object.');
  const stateFile = typeof option.state_file === 'string' && !!option.state_file.trim();
  const loginUrl = typeof option.login_url === 'string' && !!option.login_url.trim();
  if (stateFile === loginUrl || (option.state_file !== undefined && !stateFile) ||
      (option.login_url !== undefined && !loginUrl)) {
    throw Error('Choose either sign_in.state_file or sign_in.login_url.');
  }
  let auth;
  if (stateFile) {
    auth = readState(option.state_file, target, project);
  } else {
    if (typeof option.success_url !== 'string' || !option.success_url.trim()) {
      throw Error('sign_in.success_url is required with login_url.');
    }
    const login = webAddress(option.login_url);
    const success = webAddress(option.success_url);
    const timeout = option.timeout_seconds ?? 120;
    if (success.origin !== target.origin || success.href === login.href) {
      throw Error('sign_in.success_url must be a page on the tested site reached after login.');
    }
    if (!Number.isFinite(timeout) || timeout < 1 || timeout > 600) {
      throw Error('sign_in.timeout_seconds must be between 1 and 600 seconds.');
    }
    auth = {mode: 'login', loginUrl: login.href, successUrl: success.href, timeout};
  }
  const key = createHash('sha256').update(JSON.stringify({origin: target.origin, ...auth})).digest('hex');
  return {...auth, key, origin: target.origin};
}
