(() => {
  'use strict';

  const wall = document.querySelector('#canvas');
  const frames = document.querySelector('#frames');
  const screenshotButton = document.querySelector('#screenshot');
  const recordButton = document.querySelector('#record');
  const status = document.querySelector('#capture-status');
  const canCapture = !!(navigator.mediaDevices?.getDisplayMedia && globalThis.CropTarget?.fromElement);
  const canScreenshot = canCapture && typeof ImageCapture === 'function';
  const videoType = canCapture && typeof MediaRecorder === 'function' &&
    ['video/webm;codecs=vp8', 'video/webm'].find(type => MediaRecorder.isTypeSupported(type));

  let busy = false;
  let recording = null;

  function showStatus(message) {
    status.textContent = message;
    status.hidden = !message;
  }

  function updateButtons() {
    const hasDevices = !!frames.querySelector('.dev:not([hidden])');
    screenshotButton.disabled = !canScreenshot || !hasDevices || busy || !!recording?.stopping;
    recordButton.disabled = recording ? recording.stopping : !videoType || !hasDevices || busy;
    recordButton.textContent = recording ? 'Stop' : 'Record';
    recordButton.setAttribute('aria-label', recording ? 'Stop recording' : 'Record the visible device wall');
    recordButton.title = recording ? 'Stop recording and download the video' : 'Record the visible device wall as a WebM';
    recordButton.classList.toggle('recording', !!recording);
  }

  function stopCapture(stream) {
    stream?.getTracks().forEach(track => track.stop());
  }

  async function captureWall() {
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
      const target = await CropTarget.fromElement(wall);
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

  async function screenshot(stream) {
    const [track] = stream.getVideoTracks();
    const image = await new ImageCapture(track).grabFrame();
    try {
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      canvas.getContext('2d').drawImage(image, 0, 0);
      const png = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!png) throw new Error('Could not save the screenshot. Try again.');
      download(png, 'png');
    } finally {
      image.close();
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
    let stream;
    try {
      stream = existing || await captureWall();
      await screenshot(stream);
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

  if (!canCapture) showStatus('Wall capture requires desktop Chrome.');
  frames.addEventListener('wall-view-changed', updateButtons);
  updateButtons();
})();
