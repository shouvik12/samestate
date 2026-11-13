(() => {
  'use strict';

  const wall = document.querySelector('#capture-area');
  const canvasView = document.querySelector('#canvas');
  const frames = document.querySelector('#frames');
  const sites = document.querySelector('#site-workspace');
  const screenshotButton = document.querySelector('#screenshot');
  const recordButton = document.querySelector('#record');
  const status = document.querySelector('#capture-status');
  const canCapture = !!(navigator.mediaDevices?.getDisplayMedia && globalThis.CropTarget?.fromElement);
  const videoType = canCapture && typeof MediaRecorder === 'function' &&
    ['video/webm;codecs=vp8', 'video/webm'].find(type => MediaRecorder.isTypeSupported(type));

  let busy = false;
  let recording = null;

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
    recordButton.textContent = recording ? 'Stop' : 'Record';
    const view = sites.hidden ? 'device wall' : 'site comparison';
    screenshotButton.title = 'Save the visible ' + view + ' as a PNG';
    recordButton.setAttribute('aria-label', recording ? 'Stop recording' : 'Record the visible ' + view);
    recordButton.title = recording ? 'Stop recording and download the video' : 'Record the visible ' + view + ' as a WebM';
    recordButton.classList.toggle('recording', !!recording);
  }

  function stopCapture(stream) {
    stream?.getTracks().forEach(track => track.stop());
  }

  async function captureWall(element = wall) {
    showStatus('Choose this Samestate tab in Chrome.');
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { displaySurface: 'browser', frameRate: { ideal: 30, max: 30 } },
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

  function download(blob, extension) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `samestate-${timestamp}.${extension}`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  async function saveFrame(frame, width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(frame, 0, 0);
    const png = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!png) throw new Error('Could not save the screenshot. Try again.');
    download(png, 'png');
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
    const existing = recording?.stream;
    const comparison = !sites.hidden;
    let stream;
    try {
      stream = existing || await captureWall(comparison ? wall : canvasView);
      await screenshot(stream, comparison);
      if (!recording?.stopping) showStatus(recording ? 'Screenshot download started. Recording…' : 'Screenshot download started.');
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

  recordButton.addEventListener('click', async () => {
    if (recording) {
      stopRecording();
      return;
    }
    busy = true;
    updateButtons();
    let stream;
    try {
      stream = await captureWall();
      const recorder = new MediaRecorder(stream, { mimeType: videoType, videoBitsPerSecond: 4_000_000 });
      const chunks = [];
      let failed = false;
      recorder.addEventListener('dataavailable', event => {
        if (event.data.size) chunks.push(event.data);
      });
      recorder.addEventListener('error', () => { failed = true; });
      recorder.addEventListener('stop', () => {
        stopCapture(stream);
        recording = null;
        updateButtons();
        if (failed || chunks.length === 0) {
          showStatus('No recording saved. Try again.');
          return;
        }
        download(new Blob(chunks, { type: recorder.mimeType }), 'webm');
        showStatus('Recording download started.');
      }, { once: true });
      recorder.start(1000);
      recording = { stream, recorder, stopping: false };
      showStatus('Recording the visible wall…');
    } catch (error) {
      stopCapture(stream);
      showStatus(captureError(error));
    } finally {
      busy = false;
      updateButtons();
    }
  });

  // Used by report.js to take one screenshot per finding.
  globalThis.wallCapture = {
    available: canCapture && typeof ImageCapture === 'function',
    start: element => captureWall(element),
    frame: grabFrame,
    stop: stopCapture,
    error: captureError,
    clearStatus: () => showStatus('')
  };

  if (!canCapture) showStatus('Wall capture requires desktop Chrome.');
  frames.addEventListener('wall-view-changed', updateButtons);
  updateButtons();
})();
