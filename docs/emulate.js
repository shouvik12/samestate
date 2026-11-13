/* Device identity for a Samestate preview. Runs in the page's own world before its scripts, and only inside a
   Samestate preview frame whose name carries a device: the page's JavaScript then sees that device's user-agent,
   platform, touch support, pixel ratio, screen size and hover/pointer answers. Stylesheets and the server still see
   the computer running Samestate. */
(() => {
  'use strict';
  const PREFIX = 'samestate-device:';
  if (window.__samestateDevice || window.top === window || !window.name.startsWith(PREFIX)) return;
  const parent = location.ancestorOrigins?.[0] || '';
  // The extension's device wall, or the web build's, which serves the sample site from its own origin.
  if (!parent.startsWith('chrome-extension://') && parent !== location.origin) return;
  let device;
  try { device = JSON.parse(window.name.slice(PREFIX.length)); } catch { return; }
  if (typeof device?.ua !== 'string' || !Number.isFinite(device.dpr) || !Number.isFinite(device.w) || !Number.isFinite(device.h)) return;
  window.__samestateDevice = true;

  const define = (target, name, value) => {
    try { Object.defineProperty(target, name, { get: () => value, configurable: true }); } catch {}
  };
  define(navigator, 'userAgent', device.ua);
  define(navigator, 'appVersion', device.ua.replace(/^Mozilla\//, ''));
  define(navigator, 'platform', device.platform);
  define(navigator, 'vendor', device.vendor);
  define(navigator, 'maxTouchPoints', 5);

  // Safari has no userAgentData; Chrome on Android reports itself as mobile.
  if (device.ios) define(navigator, 'userAgentData', undefined);
  else if (navigator.userAgentData) {
    const brands = navigator.userAgentData.brands;
    const values = { brands, mobile: device.mobile, platform: 'Android', platformVersion: '10.0.0', model: device.mobile ? 'K' : '', architecture: '', bitness: '', fullVersionList: brands, uaFullVersion: device.chrome + '.0.0.0' };
    define(navigator, 'userAgentData', {
      brands, mobile: device.mobile, platform: 'Android',
      getHighEntropyValues: hints => Promise.resolve(Object.fromEntries(['brands', 'mobile', 'platform', ...(Array.isArray(hints) ? hints : [])].filter(hint => hint in values).map(hint => [hint, values[hint]]))),
      toJSON: () => ({ brands, mobile: device.mobile, platform: 'Android' })
    });
  }

  if (!('ontouchstart' in window)) {
    try { Object.defineProperty(window, 'ontouchstart', { value: null, writable: true, configurable: true }); } catch {}
  }
  define(window, 'devicePixelRatio', device.dpr);
  for (const [name, value] of [['width', device.w], ['height', device.h], ['availWidth', device.w], ['availHeight', device.h]]) define(screen, name, value);

  // matchMedia answers hover and pointer as a touch screen does, and resolution with the device's pixel ratio.
  // Each such test is swapped for an always-true or always-false one before the real matchMedia sees the query.
  const ALWAYS = '(min-width: 0px)', NEVER = '(max-width: -1px)';
  const touchAnswer = (feature, value) => {
    if (!value) return feature.endsWith('hover') ? NEVER : ALWAYS;
    if (feature.endsWith('hover')) return value === 'none' ? ALWAYS : NEVER;
    return value === 'coarse' ? ALWAYS : NEVER;
  };
  const ratioOf = (amount, unit) => unit === 'dpi' ? amount / 96 : unit === 'dpcm' ? amount * 2.54 / 96 : amount;
  const rewrite = query => String(query)
    .replace(/\(\s*((?:any-)?(?:hover|pointer))\s*(?::\s*([a-z]+)\s*)?\)/gi, (_, feature, value) => touchAnswer(feature.toLowerCase(), value?.toLowerCase()))
    .replace(/\(\s*(min-|max-)?(?:-webkit-)?(?:(?:min-|max-)?device-pixel-ratio|resolution)\s*:\s*([\d.]+)\s*(dppx|x|dpi|dpcm)?\s*\)/gi, (match, bound, amount, unit) => {
      const wanted = ratioOf(Number(amount), (unit || 'x').toLowerCase());
      const prefix = (/\(\s*-webkit-(min|max)-/i.exec(match) || [])[1]?.toLowerCase();
      const side = bound?.toLowerCase().slice(0, 3) || prefix;
      const ok = side === 'min' ? device.dpr >= wanted : side === 'max' ? device.dpr <= wanted : device.dpr === wanted;
      return ok ? ALWAYS : NEVER;
    });
  const realMatchMedia = window.matchMedia;
  if (typeof realMatchMedia === 'function') {
    window.matchMedia = function matchMedia(query) {
      const list = realMatchMedia.call(window, rewrite(query));
      define(list, 'media', String(query));
      return list;
    };
  }
})();
