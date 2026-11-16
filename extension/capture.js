(() => {
  'use strict';

  const wall = document.querySelector('#capture-area');
  const canvasView = document.querySelector('#canvas');
  const frames = document.querySelector('#frames');
  const sites = document.querySelector('#site-workspace');
  const screenshotButton = document.querySelector('#screenshot');
  const recordButton = document.querySelector('#record');
  const status = document.querySelector('#capture-status');
  const autoButton = document.querySelector('#auto-shots');
  const shotRateInput = document.querySelector('#shot-rate');
  const shotUnitInput = document.querySelector('#shot-unit');
  const shotHint = document.querySelector('#shot-hint');
  const recordRateInput = document.querySelector('#record-rate');
  const folderButton = document.querySelector('#capture-folder');
  const folderLabel = document.querySelector('#capture-folder-name');
  const folderClear = document.querySelector('#capture-folder-clear');
  const canCapture = !!(navigator.mediaDevices?.getDisplayMedia && globalThis.CropTarget?.fromElement);
  const videoType = canCapture && typeof MediaRecorder === 'function' &&
    ['video/webm;codecs=vp8', 'video/webm'].find(type => MediaRecorder.isTypeSupported(type));

  let busy = false;
  let recording = null;
  let auto = null; // auto screenshots in progress
  let partBytes = 10 * 1024 * 1024; // a recording starts a new file at about this size

  // Rates are remembered per browser. Screenshots: 0.1–10 per second. Recording: 1–60 frames per second.
  const clamp = (value, lo, hi, fallback) => Number.isFinite(value) ? Math.min(hi, Math.max(lo, value)) : fallback;
  // Screenshots are set either as a rate (0.1–10 per second) or as a gap (0.1–3600 seconds apart).
  const SHOT_UNITS = { 'per-second': { min: 0.1, max: 10, fallback: 1 }, apart: { min: 0.1, max: 3600, fallback: 5 } };
  const shotUnit = () => SHOT_UNITS[shotUnitInput.value] ? shotUnitInput.value : 'per-second';
  const shotValue = () => { const u = SHOT_UNITS[shotUnit()]; return clamp(parseFloat(shotRateInput.value), u.min, u.max, u.fallback); };
  const shotInterval = () => shotUnit() === 'apart' ? shotValue() * 1000 : 1000 / shotValue();
  // The pace in words, the same whichever unit was chosen: "1 screenshot every 5 seconds", "2 screenshots every second".
  const fmt = n => String(+n.toFixed(2));
  // Only whole screenshots: a whole number per second reads as a count ("3 screenshots every second"), anything else
  // as the gap between them ("1.1 per second" is "1 screenshot every 0.91 seconds").
  function shotPace() {
    const seconds = shotInterval() / 1000, perSecond = 1 / seconds, count = Math.round(perSecond);
    if (Math.abs(seconds - 1) < 0.005) return '1 screenshot every second';
    if (perSecond > 1 && Math.abs(perSecond - count) < 0.01) return `${count} screenshots every second`;
    return `1 screenshot every ${fmt(seconds)} seconds`;
  }
  const showPace = () => { shotHint.textContent = 'Takes ' + shotPace(); };
  function fitShotInput() {
    const u = SHOT_UNITS[shotUnit()];
    shotRateInput.min = u.min; shotRateInput.max = u.max; shotRateInput.step = shotUnit() === 'apart' ? 'any' : '0.1';
    shotRateInput.title = shotUnit() === 'apart' ? 'Seconds between screenshots (0.1 to 3600)' : 'Screenshots each second (0.1 to 10)';
    showPace();
  }
  const recordRate = () => Math.round(clamp(parseFloat(recordRateInput.value), 1, 60, 30));
  const remember = (key, input) => {
    try { const saved = localStorage.getItem(key); if (saved) input.value = saved; } catch {}
    input.addEventListener('change', () => { try { localStorage.setItem(key, input.value); } catch {} });
  };
  remember('samestate.shotUnit', shotUnitInput);
  remember('samestate.shotRate', shotRateInput);
  fitShotInput();
  for (const type of ['input', 'change']) shotRateInput.addEventListener(type, showPace);
  // Switching unit keeps the same pace: 2 per second becomes 0.5 seconds apart, 5 seconds apart becomes 0.2 per second.
  let previousUnit = shotUnit();
  shotUnitInput.addEventListener('change', () => {
    const before = SHOT_UNITS[previousUnit], value = clamp(parseFloat(shotRateInput.value), before.min, before.max, before.fallback);
    previousUnit = shotUnit();
    const u = SHOT_UNITS[previousUnit];
    shotRateInput.value = String(+clamp(1 / value, u.min, u.max, u.fallback).toFixed(2));
    fitShotInput();
    try { localStorage.setItem('samestate.shotRate', shotRateInput.value); } catch {}
  });
  remember('samestate.recordRate', recordRateInput);

  // Save folder: a folder handle kept in IndexedDB, so Chrome can reuse it after a reload (it asks again for permission).
  const canPickFolder = typeof showDirectoryPicker === 'function';
  let folder = null, folderAllowed = false;
  function folderStore(mode, value) {
    return new Promise((resolve, reject) => {
      const open = indexedDB.open('samestate-capture', 1);
      open.onupgradeneeded = () => open.result.createObjectStore('settings');
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const store = open.result.transaction('settings', mode === 'get' ? 'readonly' : 'readwrite').objectStore('settings');
        const request = mode === 'get' ? store.get('folder') : mode === 'put' ? store.put(value, 'folder') : store.delete('folder');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      };
    });
  }
  function showFolder() {
    folderLabel.textContent = folder ? folder.name : 'Downloads';
    folderLabel.title = folder ? 'Screenshots and recordings are saved in this folder' : 'Screenshots and recordings start downloads';
    folderClear.hidden = !folder;
    folderButton.textContent = folder ? 'Change folder' : 'Save to folder…';
  }
  async function useFolder(handle) {
    folder = handle || null;
    folderAllowed = !!folder && await folder.queryPermission?.({ mode: 'readwrite' }) === 'granted';
    try { await folderStore(folder ? 'put' : 'delete', folder); } catch {}
    showFolder();
  }
  // Called at the start of a capture (a click), when Chrome can show its permission prompt.
  async function folderReady() {
    if (!folder || folderAllowed) return;
    try { folderAllowed = (await folder.requestPermission({ mode: 'readwrite' })) === 'granted'; } catch { folderAllowed = false; }
  }
  const destination = () => folder && folderAllowed ? 'in ' + folder.name : 'to Downloads';

  function showStatus(message) {
    status.textContent = message;
    status.hidden = !message;
  }

  function updateButtons() {
    const hasDevices = sites.hidden
      ? !!frames.querySelector('.dev:not([hidden])')
      : !!sites.querySelector('.site-frames:not([hidden]) .dev:not([hidden]), .site-single:not([hidden]) iframe[src]');
    const canScreenshot = sites.hidden ? canCapture && typeof ImageCapture === 'function' : !!videoType;
    screenshotButton.disabled = !canScreenshot || !hasDevices || busy || !!recording?.stopping;
    recordButton.disabled = recording ? recording.stopping : !videoType || !hasDevices || busy;
    // Auto screenshots read frames straight from the wall capture, which the comparison view does not support.
    const canAuto = sites.hidden && canCapture && typeof ImageCapture === 'function';
    autoButton.disabled = auto ? auto.stopping : !canAuto || !hasDevices || busy || !!recording?.stopping;
    autoButton.textContent = auto ? 'Stop screenshots' : 'Auto screenshots';
    autoButton.classList.toggle('recording', !!auto);
    autoButton.title = auto ? 'Stop taking screenshots' : canAuto || !canCapture ? 'Save a screenshot of the device wall again and again, at the pace below' : 'Auto screenshots work on the device wall, not in Compare sites';
    folderButton.hidden = !canPickFolder;
    recordButton.textContent = recording ? 'Stop' : 'Record';
    const view = sites.hidden ? 'device wall' : 'site comparison';
    screenshotButton.title = 'Save the visible ' + view + ' as a PNG';
    recordButton.setAttribute('aria-label', recording ? 'Stop recording' : 'Record the visible ' + view);
    recordButton.title = recording ? 'Stop recording and save the last part' : 'Record the visible ' + view + ' as WebM files of up to 10 MB each';
    recordButton.classList.toggle('recording', !!recording);
  }

  function stopCapture(stream) {
    stream?.getTracks().forEach(track => track.stop());
  }

  async function captureWall(element = wall, fps = 30) {
    showStatus('Choose this Samestate tab in Chrome.');
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { displaySurface: 'browser', frameRate: { ideal: fps, max: fps } },
      audio: false,
      preferCurrentTab: true,
      selfBrowserSurface: 'include',
      surfaceSwitching: 'exclude',
      monitorTypeSurfaces: 'exclude'
    });

    let timeout;
    try {
      const [track] = stream.getVideoTracks();
      if (track?.getSettings().displaySurface !== 'browser' || !track.cropTo) throw new Error();
      showStatus('Preparing wall capture…');
      // Chrome only accepts this crop target when the source is the current tab.
      const target = await CropTarget.fromElement(element);
      await Promise.race([
        track.cropTo(target),
        new Promise((_, reject) => {
          timeout = setTimeout(() => reject(new DOMException('', 'TimeoutError')), 8000);
        })
      ]);
      return stream;
    } catch (error) {
      stopCapture(stream);
      if (error.name === 'TimeoutError') throw new Error('Chrome could not capture the wall. Keep this tab visible and try again.');
      throw new Error('Choose the current Samestate tab to capture the wall.');
    } finally {
      clearTimeout(timeout);
    }
  }

  const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');
  const pad = (n, size) => String(n).padStart(size, '0');

  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  // Writes into the chosen folder; without one (or if Chrome refuses), the file is downloaded instead.
  async function save(blob, name) {
    if (folder && folderAllowed) {
      try {
        const writable = await (await folder.getFileHandle(name, { create: true })).createWritable();
        await writable.write(blob);
        await writable.close();
        return;
      } catch {
        folderAllowed = false;
        showStatus(`Could not write to ${folder.name}. Saving to Downloads instead.`);
      }
    }
    download(blob, name);
  }

  async function saveFrame(frame, width, height, name = `samestate-${stamp()}.png`) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(frame, 0, 0);
    const png = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!png) throw new Error('Could not save the screenshot. Try again.');
    await save(png, name);
  }

  const frameFailure = () => new Error('Chrome could not capture a frame. Keep this tab visible and try again.');

  // One frame of a device-wall capture, as an ImageBitmap the caller closes.
  async function grabFrame(stream) {
    const [track] = stream.getVideoTracks();
    if (track?.readyState !== 'live') throw frameFailure();
    let timeout, expired = false;
    return Promise.race([
      new ImageCapture(track).grabFrame().then(frame => { if (expired) frame.close(); return frame; }),
      new Promise((_, reject) => { timeout = setTimeout(() => { expired = true; reject(frameFailure()); }, 6000); })
    ]).finally(() => clearTimeout(timeout));
  }

  async function screenshot(stream, comparison) {
    const failure = frameFailure;
    if (!comparison) {
      const image = await grabFrame(stream);
      try { await saveFrame(image, image.width, image.height); } finally { image.close(); }
      return;
    }
    // A short recording supplies a decoded frame even when the cropped tab stream does not play inline.
    const clip = await new Promise((resolve, reject) => {
      const recorder = new MediaRecorder(stream, { mimeType: videoType, videoBitsPerSecond: 4_000_000 });
      const chunks = [];
      recorder.addEventListener('dataavailable', event => {
        if (event.data.size) chunks.push(event.data);
      });
      recorder.start(1000);
      const timeout = setTimeout(() => { if (recorder.state !== 'inactive') recorder.stop(); }, 1600);
      recorder.addEventListener('stop', () => {
        clearTimeout(timeout);
        if (chunks.length) resolve(new Blob(chunks, { type: recorder.mimeType }));
        else reject(failure());
      }, { once: true });
      recorder.addEventListener('error', () => { clearTimeout(timeout); reject(failure()); }, { once: true });
    });
    const video = document.createElement('video');
    const url = URL.createObjectURL(clip);
    let timeout;
    try {
      await new Promise((resolve, reject) => {
        video.onloadeddata = () => {
          video.onloadeddata = null;
          // Chrome can emit a blank frame before the crop reaches the compositor.
          video.currentTime = 0.5;
        };
        video.onseeked = resolve;
        video.onerror = () => reject(failure());
        timeout = setTimeout(() => reject(failure()), 5000);
        video.src = url;
      });
      if (!video.videoWidth || !video.videoHeight) throw failure();
      await saveFrame(video, video.videoWidth, video.videoHeight);
    } finally {
      clearTimeout(timeout);
      URL.revokeObjectURL(url);
    }
  }

  function captureError(error) {
    if (error.name === 'NotAllowedError' || error.name === 'AbortError') return 'Capture canceled.';
    return error.name === 'Error' && error.message ? error.message : 'Capture failed. Try sharing the current tab again.';
  }

  screenshotButton.addEventListener('click', async () => {
    busy = true;
    updateButtons();
    await folderReady();
    const existing = recording?.stream || auto?.stream;
    const comparison = !sites.hidden;
    let stream;
    try {
      stream = existing || await captureWall(comparison ? wall : canvasView);
      await screenshot(stream, comparison);
      if (!recording?.stopping) showStatus(`Screenshot saved ${destination()}.` + (recording ? ' Recording…' : ''));
    } catch (error) {
      if (!recording?.stopping) showStatus(captureError(error));
    } finally {
      if (!existing) stopCapture(stream);
      busy = false;
      updateButtons();
    }
  });

  function stopRecording() {
    recording.stopping = true;
    showStatus('Saving recording…');
    updateButtons();
    if (recording.recorder.state !== 'inactive') recording.recorder.stop();
  }

  // One file of a recording. Near the size limit it stops and the next part starts on the same capture, so no
  // file grows past about 10 MB; a long recording becomes part-01, part-02 and so on.
  function recordPart(rec) {
    const recorder = new MediaRecorder(rec.stream, { mimeType: videoType, videoBitsPerSecond: rec.bitrate });
    const chunks = [];
    let bytes = 0, failed = false;
    recorder.addEventListener('dataavailable', event => {
      if (!event.data.size) return;
      chunks.push(event.data);
      bytes += event.data.size;
      const nextChunk = bytes / chunks.length;
      if (bytes + nextChunk > partBytes && recorder.state === 'recording' && !rec.stopping) recorder.stop();
    });
    recorder.addEventListener('error', () => { failed = true; });
    recorder.addEventListener('stop', async () => {
      const live = rec.stream.getVideoTracks()[0]?.readyState === 'live';
      const more = !rec.stopping && !failed && live;
      if (more) recordPart(rec); // the next part starts before this one is written, so the gap is as short as possible
      if (!failed && chunks.length) {
        const part = ++rec.parts;
        rec.saving++;
        try { await save(new Blob(chunks, { type: recorder.mimeType }), `samestate-${rec.session}-part-${pad(part, 2)}.webm`); }
        finally { rec.saving--; }
        if (more) showStatus(`Recording at ${rec.fps} fps… ${rec.parts} ${rec.parts === 1 ? 'part' : 'parts'} saved ${destination()}.`);
      }
      if (more) return;
      while (rec.saving) await new Promise(done => setTimeout(done, 50));
      stopCapture(rec.stream);
      recording = null;
      updateButtons();
      showStatus(rec.parts ? `Recording saved ${destination()}: ${rec.parts} ${rec.parts === 1 ? 'file' : 'files'}.` : 'No recording saved. Try again.');
    }, { once: true });
    recorder.start(500);
    rec.recorder = recorder;
  }

  recordButton.addEventListener('click', async () => {
    if (recording) {
      stopRecording();
      return;
    }
    busy = true;
    updateButtons();
    let stream;
    try {
      await folderReady();
      const fps = recordRate();
      stream = await captureWall(undefined, fps);
      // 4 Mbit/s at 30 fps, less at lower rates, so a lower frame rate also makes smaller files.
      const bitrate = Math.max(400_000, Math.round(4_000_000 * Math.min(fps, 30) / 30));
      recording = { stream, recorder: null, stopping: false, session: stamp(), parts: 0, saving: 0, fps, bitrate };
      stream.getVideoTracks()[0]?.addEventListener('ended', () => { if (recording && !recording.stopping) stopRecording(); });
      recordPart(recording);
      showStatus(`Recording at ${fps} fps…`);
    } catch (error) {
      stopCapture(stream);
      recording = null;
      showStatus(captureError(error));
    } finally {
      busy = false;
      updateButtons();
    }
  });

  // Auto screenshots: one PNG of the device wall at the chosen rate until stopped, numbered in one series.
  autoButton.addEventListener('click', async () => {
    if (auto) {
      auto.stopping = true;
      updateButtons();
      return;
    }
    busy = true;
    updateButtons();
    const existing = recording?.stream;
    let run;
    try {
      await folderReady();
      const stream = existing || await captureWall(canvasView);
      run = auto = { stream, own: !existing, count: 0, stopping: false, session: stamp() };
    } catch (error) {
      showStatus(captureError(error));
      return;
    } finally {
      busy = false;
      updateButtons();
    }
    showStatus(`Taking ${shotPace()}…`);
    let failure = null;
    try {
      while (!run.stopping) {
        const started = performance.now();
        const image = await grabFrame(run.stream);
        try { await saveFrame(image, image.width, image.height, `samestate-${run.session}-shot-${pad(run.count + 1, 4)}.png`); }
        finally { image.close(); }
        run.count++;
        if (!run.stopping) showStatus(`Auto screenshots: ${run.count} saved ${destination()} (${shotPace()}).`);
        // The rate is read each time, so changing it applies at once; a slow save delays the next shot rather than piling up.
        const left = shotInterval() - (performance.now() - started);
        if (left > 0) await new Promise(done => setTimeout(done, left));
      }
    } catch (error) {
      failure = error;
    } finally {
      if (run.own) stopCapture(run.stream);
      auto = null;
      updateButtons();
      showStatus(failure && !run.count ? captureError(failure) : `Auto screenshots stopped: ${run.count} saved ${destination()}.`);
    }
  });

  folderButton.addEventListener('click', async () => {
    try { await useFolder(await showDirectoryPicker({ id: 'samestate-capture', mode: 'readwrite' })); showStatus(`Captures will be saved in ${folder.name}.`); }
    catch (error) { if (error.name !== 'AbortError') showStatus('Chrome did not allow that folder. Choose another one.'); }
  });
  folderClear.addEventListener('click', async () => { await useFolder(null); showStatus('Captures will start downloads.'); });

  // Used by report.js to take one screenshot per finding.
  globalThis.wallCapture = {
    available: canCapture && typeof ImageCapture === 'function',
    start: element => captureWall(element),
    frame: grabFrame,
    stop: stopCapture,
    error: captureError,
    clearStatus: () => showStatus(''),
    useFolder, // tests pass a folder of their own (navigator.storage.getDirectory())
    get partBytes() { return partBytes; },
    set partBytes(bytes) { partBytes = bytes; } // tests use a smaller part size
  };

  if (!canCapture) showStatus('Wall capture requires desktop Chrome.');
  if (canPickFolder) folderStore('get').then(async handle => {
    if (!handle || folder) return;
    folder = handle;
    folderAllowed = await handle.queryPermission?.({ mode: 'readwrite' }) === 'granted';
    showFolder();
  }).catch(() => {});
  showFolder();
  frames.addEventListener('wall-view-changed', updateButtons);
  updateButtons();
})();
