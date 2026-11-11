// Samestate background worker.
// 1. Toolbar click opens the device wall for the current page.
// 2. For Samestate tabs only: lets pages load inside the device frames (removes frame-blocking
//    response headers on sub-frames of that tab) and injects the sync agent into each device frame.
const KEY = 'shellTabs', APP = chrome.runtime.getURL('app.html');
const getTabs = async () => (await chrome.storage.session.get(KEY))[KEY] || [];
const setTabs = t => chrome.storage.session.set({ [KEY]: t });
const HEADERS = ['x-frame-options', 'content-security-policy', 'content-security-policy-report-only', 'cross-origin-opener-policy', 'cross-origin-embedder-policy', 'cross-origin-resource-policy'];
const rule = tabId => ({ id: tabId, priority: 1, action: { type: 'modifyHeaders', responseHeaders: HEADERS.map(header => ({ header, operation: 'remove' })) }, condition: { tabIds: [tabId], resourceTypes: ['sub_frame'] } });

async function unregister(tabId) {
  const t = await getTabs(); if (!t.includes(tabId)) return;
  await setTabs(t.filter(x => x !== tabId));
  try { await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [tabId] }); } catch (e) {}
}

chrome.action.onClicked.addListener(tab => {
  const q = /^https?:/.test(tab.url || '') ? '?url=' + encodeURIComponent(tab.url) : '';
  chrome.tabs.create({ url: APP + q, index: tab.index + 1 });
});

chrome.runtime.onMessage.addListener((m, sender, reply) => {
  if (!m || m.type !== 'register' || !sender.tab || !(sender.url || '').startsWith(APP)) return;
  (async () => {
    const id = sender.tab.id;
    await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [id], addRules: [rule(id)] });
    const t = await getTabs(); if (!t.includes(id)) { t.push(id); await setTabs(t); }
    reply({ ok: true });
  })();
  return true;
});

chrome.webNavigation.onCommitted.addListener(async d => {
  const t = await getTabs(); if (!t.includes(d.tabId)) return;
  if (d.frameId === 0) { if (!d.url.startsWith(APP)) unregister(d.tabId); return; } // tab left Samestate
  if (d.parentFrameId !== 0 || !/^https?:/.test(d.url)) return;                      // device frames only
  try { await chrome.scripting.executeScript({ target: { tabId: d.tabId, frameIds: [d.frameId] }, files: ['agent.js'], injectImmediately: true }); } catch (e) {}
});
chrome.tabs.onRemoved.addListener(unregister);
