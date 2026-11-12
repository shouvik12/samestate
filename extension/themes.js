'use strict';

const themeToken = /^--(?:background|foreground|(?:card|popover|primary|secondary|muted|accent|destructive|sidebar(?:-primary|-accent)?)(?:-foreground)?|border|input|ring|sidebar-(?:background|border|ring)|chart-\d+)$/;
const hslChannels = /^[-+]?\d*\.?\d+(?:deg|rad|turn|grad)?\s+\d*\.?\d+%\s+\d*\.?\d+%(?:\s*\/\s*\d*\.?\d+%?)?$/i;
const colorFunctions = new Set(['rgb', 'rgba', 'hsl', 'hsla', 'hwb', 'lab', 'lch', 'oklab', 'oklch', 'color', 'color-mix', 'light-dark', 'calc', 'min', 'max', 'clamp']);
const lightThemeSelectors = new Set([':root', 'html', ':root:not(.dark)']);
const darkThemeSelectors = new Set(['.dark', ':root.dark', 'html.dark', '[data-theme="dark"]', ':root[data-theme="dark"]', 'html[data-theme="dark"]']);
const darkThemeRule = ':root.dark, .dark, [data-theme="dark"]';
const tweakcnRegistry = 'https://tweakcn.com/r/';
const tweakcnThemeName = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const tweakcnThemeCache = new Map();

// Editor presets from tweakcn's utils/theme-presets.ts. The registry index omits some of these.
const tweakcnPresets = new Map([
  ['modern-minimal', 'Modern Minimal'],
  ['violet-bloom', 'Violet Bloom'],
  ['t3-chat', 'T3 Chat'],
  ['twitter', 'Twitter'],
  ['mocha-mousse', 'Mocha Mousse'],
  ['bubblegum', 'Bubblegum'],
  ['amethyst-haze', 'Amethyst Haze'],
  ['notebook', 'Notebook'],
  ['doom-64', 'Doom 64'],
  ['catppuccin', 'Catppuccin'],
  ['graphite', 'Graphite'],
  ['perpetuity', 'Perpetuity'],
  ['kodama-grove', 'Kodama Grove'],
  ['cosmic-night', 'Cosmic Night'],
  ['tangerine', 'Tangerine'],
  ['quantum-rose', 'Quantum Rose'],
  ['nature', 'Nature'],
  ['bold-tech', 'Bold Tech'],
  ['elegant-luxury', 'Elegant Luxury'],
  ['amber-minimal', 'Amber Minimal'],
  ['supabase', 'Supabase'],
  ['neo-brutalism', 'Neo Brutalism'],
  ['solar-dusk', 'Solar Dusk'],
  ['claymorphism', 'Claymorphism'],
  ['cyberpunk', 'Cyberpunk'],
  ['pastel-dreams', 'Pastel Dreams'],
  ['clean-slate', 'Clean Slate'],
  ['caffeine', 'Caffeine'],
  ['ocean-breeze', 'Ocean Breeze'],
  ['retro-arcade', 'Retro Arcade'],
  ['midnight-bloom', 'Midnight Bloom'],
  ['candyland', 'Candyland'],
  ['northern-lights', 'Northern Lights'],
  ['vintage-paper', 'Vintage Paper'],
  ['sunset-horizon', 'Sunset Horizon'],
  ['starry-night', 'Starry Night'],
  ['claude', 'Claude'],
  ['vercel', 'Vercel'],
  ['darkmatter', 'Darkmatter'],
  ['mono', 'Mono'],
  ['soft-pop', 'Soft Pop'],
  ['sage-garden', 'Sage Garden']
]);

async function fetchTweakcn(path) {
  const response = await fetch(tweakcnRegistry + path, {
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    redirect: 'error',
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error('tweakcn returned HTTP ' + response.status);
  return response.json();
}

async function refreshTweakcnPresets() {
  const { items } = await fetchTweakcn('registry.json');
  if (!Array.isArray(items)) return;
  for (const item of items) {
    if (item?.type !== 'registry:style' && item?.type !== 'registry:theme') continue;
    if (typeof item.name !== 'string' || !tweakcnThemeName.test(item.name) || typeof item.title !== 'string' || !item.title.trim()) continue;
    tweakcnPresets.set(item.name, item.title.trim());
  }
}

function loadTweakcnTheme(name) {
  if (!tweakcnPresets.has(name)) throw new Error('Choose a tweakcn theme.');
  if (!tweakcnThemeCache.has(name)) {
    const request = fetchTweakcn('themes/' + name + '.json').then(data => {
      if (data.name !== name || !data.cssVars) throw new Error('Theme palette is missing.');
      const { theme, light, dark } = data.cssVars;
      const tokens = {
        light: readRegistryTokens(light, theme?.radius),
        dark: readRegistryTokens(dark, theme?.radius)
      };
      if (!tokens.light.size && !tokens.dark.size) throw new Error('Theme palette is empty.');
      return tokens;
    }).catch(error => {
      tweakcnThemeCache.delete(name);
      throw error;
    });
    tweakcnThemeCache.set(name, request);
  }
  return tweakcnThemeCache.get(name);
}

function readRegistryTokens(styles, radius) {
  const tokens = new Map();
  for (const [key, value] of Object.entries({ radius, ...styles })) {
    if (typeof value !== 'string') continue;
    const name = '--' + key;
    const token = value.trim();
    if (validThemeValue(name, token)) tokens.set(name, token);
  }
  return tokens;
}

function validThemeValue(name, value) {
  if (name === '--radius') return /^(?:0|\d*\.?\d+(?:px|rem|em))$/i.test(value);
  if (!themeToken.test(name) || !/^[\w\s#.%+,()/\-]+$/.test(value)) return false;
  if (hslChannels.test(value)) return CSS.supports('color', 'hsl(' + value + ')');
  return [...value.matchAll(/([\w-]+)\(/g)].every(match => colorFunctions.has(match[1].toLowerCase())) && CSS.supports('color', value);
}

function readThemeTokens(css) {
  const sheet = new CSSStyleSheet();
  // Parse without attaching the sheet to a page. Only recognized literal tokens are copied out.
  sheet.replaceSync(css);
  const light = new Map(), dark = new Map();
  function collect(rules) {
    for (const rule of rules) {
      if (rule.cssRules && rule.cssText.startsWith('@layer ')) { collect(rule.cssRules); continue; }
      if (!(rule instanceof CSSStyleRule)) continue;
      const selectors = rule.selectorText.split(',').map(selector => selector.trim());
      const stores = [];
      if (selectors.some(selector => lightThemeSelectors.has(selector))) stores.push(light);
      if (selectors.some(selector => darkThemeSelectors.has(selector))) stores.push(dark);
      if (!stores.length) continue;
      for (const name of Array.from(rule.style)) {
        const value = rule.style.getPropertyValue(name).trim();
        if (validThemeValue(name, value)) for (const store of stores) store.set(name, value);
      }
    }
  }
  collect(sheet.cssRules);
  return { light, dark };
}

const basicThemeRules = [
  ['--background', 'html, body', 'background-color'],
  ['--foreground', 'html, body', 'color'],
  ['--primary', 'button, [role="button"], input[type="submit"], input[type="button"]', 'background-color'],
  ['--primary', 'a[href]', 'color'],
  ['--primary-foreground', 'button, [role="button"], input[type="submit"], input[type="button"]', 'color'],
  ['--input', 'input, select, textarea', 'border-color'],
  ['--radius', 'button, input, select, textarea', 'border-radius']
];

function buildPreviewTheme(source, palette, basicColors) {
  const { light, dark } = readThemeTokens(source);
  if (!light.size && !dark.size) throw new Error('Paste tweakcn CSS with color tokens in a :root or .dark block.');
  return renderPreviewTheme({ light, dark }, palette, basicColors);
}

function renderPreviewTheme({ light, dark }, palette, basicColors) {
  const both = new Map([...light, ...dark]);
  const makeRule = (selector, tokens) => {
    let declarations = '';
    for (const [name, value] of tokens) {
      declarations += name + ':' + value + '!important;';
      if (basicColors) declarations += '--samestate-theme' + name.slice(1) + ':' + (hslChannels.test(value) ? 'hsl(' + value + ')' : value) + '!important;';
    }
    return declarations ? selector + '{' + declarations + '}' : '';
  };
  let css;
  if (palette === 'dark') css = makeRule(':root, ' + darkThemeRule, both);
  else if (palette === 'light') css = makeRule(':root, ' + darkThemeRule, light.size ? light : dark);
  else css = makeRule(':root', light) + makeRule(darkThemeRule, dark);
  if (basicColors) {
    const fallback = palette === 'light' && light.size ? light : both;
    for (const [name, selector, property] of basicThemeRules) {
      if (!fallback.has(name)) continue;
      const dark = ':is(.dark, [data-theme="dark"])';
      const scope = palette === 'site' && !light.has(name)
        ? `${dark}:is(${selector}), ${dark} :is(${selector})`
        : selector;
      css += scope + '{' + property + ':var(--samestate-theme' + name.slice(1) + ')!important;}';
    }
  }
  return css;
}
