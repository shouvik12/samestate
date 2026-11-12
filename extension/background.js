// Only explicitly opened origins can be framed and connect preview agents in a Samestate tab.
const APP = chrome.runtime.getURL('app.html');
const previewKey = tabId => 'preview-origin-' + tabId;
const HEADERS = ['x-frame-options', 'content-security-policy', 'content-security-policy-report-only', 'cross-origin-opener-policy', 'cross-origin-embedder-policy', 'cross-origin-resource-policy'];

async function unregister(tabId) {
  await chrome.storage.session.remove(previewKey(tabId));
  await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [tabId] });
}

async function register(tabId, origin, sites) {
  const origins = [...new Set([...(origin === null ? [] : [origin]), ...sites])];
  if (!origins.length) return unregister(tabId);
  const permissions = origins.map(value => {
    const url = new URL(value);
    if (url.origin !== value || !['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid preview origin');
    return `${url.protocol}//${url.hostname}/*`;
  });
  if (!await chrome.permissions.contains({ origins: permissions })) throw new Error('Missing preview permission');

  const escaped = origins.map(value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [tabId],
    addRules: [{
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
}

chrome.action.onClicked.addListener(tab => {
  chrome.tabs.create({ url: APP, index: tab.index + 1 });
});

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (message?.type !== 'register' || sender.frameId !== 0 || sender.url !== APP || !sender.tab) return;
  register(sender.tab.id, message.origin, message.sites || []).then(() => reply({ ok: true }), () => reply({ ok: false }));
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
