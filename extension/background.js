// Only explicitly opened origins can be framed and connect preview agents in a Samestate tab.
const APP = chrome.runtime.getURL('app.html');
const previewKey = tabId => 'preview-origin-' + tabId;
const HEADERS = ['x-frame-options', 'content-security-policy', 'content-security-policy-report-only', 'cross-origin-opener-policy', 'cross-origin-embedder-policy', 'cross-origin-resource-policy'];

// Phone and tablet previews ask for the device's user-agent with samestate-ua in a page load's address. One rule
// per device type, for this tab's preview frames only; requests without the mark are untouched.
const UA_TYPES = ['iphone', 'ipad', 'android', 'android-tablet'];
// Rule ids are numbers no other session rule uses, kept per tab (the header rule's id is the tab id).
const uaKey = tabId => 'ua-rules-' + tabId;
async function uaRuleIds(tabId, create) {
  const { [uaKey(tabId)]: stored } = await chrome.storage.session.get(uaKey(tabId));
  if (stored || !create) return stored || [];
  const used = new Set((await chrome.declarativeNetRequest.getSessionRules()).map(rule => rule.id));
  const ids = [];
  while (ids.length < UA_TYPES.length) {
    const id = 1 + Math.floor(Math.random() * 2_000_000_000);
    if (!used.has(id) && id !== tabId && !ids.includes(id)) ids.push(id);
  }
  await chrome.storage.session.set({ [uaKey(tabId)]: ids });
  return ids;
}
const CLIENT_HINTS = ['sec-ch-ua', 'sec-ch-ua-mobile', 'sec-ch-ua-platform', 'sec-ch-ua-model', 'sec-ch-ua-platform-version', 'sec-ch-ua-full-version-list'];
function uaRules(tabId, ids, origins, agents) {
  const escaped = origins.map(value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  return UA_TYPES.flatMap((type, i) => {
    const ua = agents?.[type];
    if (typeof ua !== 'string' || !/^Mozilla\/5\.0 [\x20-\x7e]{10,300}$/.test(ua)) return [];
    const ios = type === 'iphone' || type === 'ipad';
    const requestHeaders = [{ header: 'user-agent', operation: 'set', value: ua }];
    // Safari sends no client hints; Chrome on Android says it is Android, and whether it is a phone.
    if (ios) requestHeaders.push(...CLIENT_HINTS.map(header => ({ header, operation: 'remove' })));
    else requestHeaders.push({ header: 'sec-ch-ua-mobile', operation: 'set', value: type === 'android' ? '?1' : '?0' }, { header: 'sec-ch-ua-platform', operation: 'set', value: '"Android"' });
    return [{
      id: ids[i], priority: 1,
      action: { type: 'modifyHeaders', requestHeaders },
      condition: { tabIds: [tabId], resourceTypes: ['sub_frame'], regexFilter: '^(?:' + escaped + ')/[^#]*[?&]samestate-ua=' + type + '(?:[&#]|$)', isUrlFilterCaseSensitive: true }
    }];
  });
}

async function unregister(tabId) {
  const ids = await uaRuleIds(tabId, false);
  await chrome.storage.session.remove([previewKey(tabId), uaKey(tabId)]);
  await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [tabId, ...ids] });
  await syncEmulation();
}

// emulate.js gives phone and tablet previews their device identity. It has to run in the page's own world before the
// page's scripts, which only a registered content script can do. It is registered for the sites open in Samestate
// tabs and does nothing outside a Samestate preview frame that names a device.
const EMULATION = 'samestate-device-identity';
let emulationQueue = Promise.resolve();
function syncEmulation() {
  emulationQueue = emulationQueue.catch(() => {}).then(async () => {
    const stored = await chrome.storage.session.get(null);
    const matches = [...new Set(Object.entries(stored)
      .filter(([key]) => key.startsWith('preview-origin-'))
      .flatMap(([, preview]) => preview?.origins || [])
      .map(origin => { const url = new URL(origin); return `${url.protocol}//${url.hostname}/*`; }))];
    const [current] = await chrome.scripting.getRegisteredContentScripts({ ids: [EMULATION] });
    if (!matches.length) {
      if (current) await chrome.scripting.unregisterContentScripts({ ids: [EMULATION] });
      return;
    }
    const script = { id: EMULATION, matches, js: ['emulate.js'], allFrames: true, runAt: 'document_start', world: 'MAIN', persistAcrossSessions: false };
    if (current) await chrome.scripting.updateContentScripts([script]);
    else await chrome.scripting.registerContentScripts([script]);
  });
  return emulationQueue;
}

async function register(tabId, origin, sites, agents) {
  const origins = [...new Set([...(origin === null ? [] : [origin]), ...sites])];
  if (!origins.length) return unregister(tabId);
  const permissions = origins.map(value => {
    const url = new URL(value);
    if (url.origin !== value || !['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid preview origin');
    return `${url.protocol}//${url.hostname}/*`;
  });
  if (!await chrome.permissions.contains({ origins: permissions })) throw new Error('Missing preview permission');

  const escaped = origins.map(value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const ids = await uaRuleIds(tabId, true);
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [tabId, ...ids],
    addRules: [...uaRules(tabId, ids, origins, agents), {
      id: tabId,
      priority: 1,
      action: {
        type: 'modifyHeaders',
        responseHeaders: HEADERS.map(header => ({ header, operation: 'remove' }))
      },
      condition: {
        tabIds: [tabId],
        resourceTypes: ['sub_frame'],
        regexFilter: '^(?:' + escaped.join('|') + ')/',
        isUrlFilterCaseSensitive: true
      }
    }]
  });
  await chrome.storage.session.set({ [previewKey(tabId)]: { origin, origins } });
  await syncEmulation();
}

chrome.action.onClicked.addListener(tab => {
  chrome.tabs.create({ url: APP, index: tab.index + 1 });
});

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (message?.type !== 'register' || sender.frameId !== 0 || sender.url !== APP || !sender.tab) return;
  register(sender.tab.id, message.origin, message.sites || [], message.agents).then(() => reply({ ok: true }), error => reply({ ok: false, error: String(error?.message || error) }));
  return true;
});

// A preview frame that starts on the selected origin and lands on another one was redirected by the
// site (example.com → www.example.com). The app is told so it can reopen the preview there.
const started = new Map(); // "tabId:frameId" → URL the navigation started on
const frameKey = details => details.tabId + ':' + details.frameId;

function takeStart(details) {
  const key = frameKey(details), url = started.get(key);
  started.delete(key);
  return url;
}

function reportRedirect(details, origins, from) {
  let start, end;
  try { start = new URL(from); end = new URL(details.url); } catch { return; }
  if (!origins.includes(start.origin) || end.origin === start.origin || !['http:', 'https:'].includes(end.protocol)) return;
  chrome.runtime.sendMessage({ type: 'redirected', tabId: details.tabId, from, url: end.href }).catch(() => {});
}

chrome.webNavigation.onBeforeNavigate.addListener(details => {
  if (details.parentFrameId === 0) started.set(frameKey(details), details.url);
});

// A redirect target that still refuses to be framed fails instead of committing.
chrome.webNavigation.onErrorOccurred.addListener(async details => {
  const from = takeStart(details);
  if (!from || details.parentFrameId !== 0) return;
  const key = previewKey(details.tabId);
  const { [key]: preview } = await chrome.storage.session.get(key);
  if (preview) reportRedirect(details, preview.origins, from);
});

chrome.webNavigation.onCommitted.addListener(async details => {
  const from = takeStart(details);
  if (details.frameId !== 0 && details.parentFrameId !== 0) return;
  const key = previewKey(details.tabId);
  const { [key]: preview } = await chrome.storage.session.get(key);
  if (!preview) return;
  if (details.frameId === 0) {
    if (details.url !== APP) await unregister(details.tabId).catch(() => {});
    return;
  }
  if (from) reportRedirect(details, preview.origins, from);
  if (!preview.origins.includes(new URL(details.url).origin)) return;

  try {
    await chrome.scripting.executeScript({
      target: { tabId: details.tabId, documentIds: [details.documentId] },
      files: ['agent.js'],
      injectImmediately: true
    });
  } catch {}
});

chrome.tabs.onRemoved.addListener(tabId => {
  for (const key of started.keys()) if (key.startsWith(tabId + ':')) started.delete(key);
  unregister(tabId).catch(() => {});
});
