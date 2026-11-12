// Only the origin selected in a Samestate tab can be framed and inspected.
const APP = chrome.runtime.getURL('app.html');
const previewKey = tabId => 'preview-origin-' + tabId;
const HEADERS = ['x-frame-options', 'content-security-policy', 'content-security-policy-report-only', 'cross-origin-opener-policy', 'cross-origin-embedder-policy', 'cross-origin-resource-policy'];

async function unregister(tabId) {
  await chrome.storage.session.remove(previewKey(tabId));
  await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [tabId] });
}

async function register(tabId, origin) {
  await unregister(tabId);
  if (origin === null) return;

  const url = new URL(origin);
  if (url.origin !== origin || !['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid preview origin');
  const allowed = await chrome.permissions.contains({ origins: [url.protocol + '//' + url.hostname + '/*'] });
  if (!allowed) throw new Error('Missing preview permission');

  const escaped = origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  await chrome.declarativeNetRequest.updateSessionRules({
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
        regexFilter: '^' + escaped + '/',
        isUrlFilterCaseSensitive: true
      }
    }]
  });
  await chrome.storage.session.set({ [previewKey(tabId)]: origin });
}

chrome.action.onClicked.addListener(tab => {
  chrome.tabs.create({ url: APP, index: tab.index + 1 });
});

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (message?.type !== 'register' || sender.frameId !== 0 || sender.url !== APP || !sender.tab) return;
  register(sender.tab.id, message.origin).then(() => reply({ ok: true }), () => reply({ ok: false }));
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

function reportRedirect(details, origin, from) {
  let start, end;
  try { start = new URL(from); end = new URL(details.url); } catch { return; }
  if (start.origin !== origin || end.origin === origin || !['http:', 'https:'].includes(end.protocol)) return;
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
  const { [key]: origin } = await chrome.storage.session.get(key);
  if (origin) reportRedirect(details, origin, from);
});

chrome.webNavigation.onCommitted.addListener(async details => {
  const from = takeStart(details);
  if (details.frameId !== 0 && details.parentFrameId !== 0) return;
  const key = previewKey(details.tabId);
  const { [key]: origin } = await chrome.storage.session.get(key);
  if (!origin) return;
  if (details.frameId === 0) {
    if (details.url !== APP) await unregister(details.tabId).catch(() => {});
    return;
  }
  if (new URL(details.url).origin !== origin) {
    if (from) reportRedirect(details, origin, from);
    return;
  }

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
