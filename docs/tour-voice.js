/* Finished natural AI narration. Playback uses bundled MP3s, without a speech service or recording UI. */
(() => {
  'use strict';
  const button = $('#tour-mute'), label = button.querySelector('span');
  const audio = document.createElement('audio');
  audio.id = 'tour-audio'; audio.hidden = true; audio.preload = 'none';
  document.body.append(audio);
  let muted = false, held = false, blocked = false, failed = false, current = null, sequence = 0;
  try { muted = localStorage.getItem('samestate.tourMuted') === 'true'; } catch {}

  function render() {
    label.textContent = muted ? 'Unmute' : blocked ? 'Enable voice' : failed ? 'Retry voice' : 'Mute';
    const action = muted ? 'Unmute demo narration' : blocked ? 'Enable demo narration' : failed ? 'Retry this step’s narration' : 'Mute demo narration';
    button.title = button.ariaLabel = action;
    button.setAttribute('aria-pressed', String(muted));
    button.classList.toggle('is-muted', muted);
    $('#tour-voice-status').textContent = muted ? 'Demo narration muted.' : blocked ? 'Click Enable voice to hear the demo.' : failed ? 'Narration could not play. Retry voice or continue reading the explanation.' : 'Demo narration on.';
  }

  function stop() {
    sequence++;
    audio.onended = audio.onerror = null;
    audio.pause(); audio.removeAttribute('src'); audio.load();
    current = null; blocked = failed = false;
    render();
  }

  function play() {
    if (!current || muted || held) return;
    window.samestateFeatureHelp?.stopVoice(false);
    const token = sequence;
    blocked = failed = false;
    if (current.finished) { audio.currentTime = 0; current.finished = false; }
    current.lastAt = Date.now(); current.lastTime = audio.currentTime; current.pending = true;
    audio.preload = 'auto';
    try {
      Promise.resolve(audio.play()).then(() => {
        if (sequence !== token || !current) return;
        current.pending = false; render();
      }).catch(error => {
        if (sequence !== token || !current) return;
        current.pending = false;
        if (error.name === 'AbortError' && (held || muted)) return;
        blocked = error.name === 'NotAllowedError'; failed = !blocked;
        if (blocked) armUnlock();
        render();
      });
    } catch { current.pending = false; failed = true; render(); }
    render();
  }

  // Narration is on by default, but browsers only allow sound after the visitor clicks or presses a key, and the web
  // demo starts by itself. The first click or key press anywhere starts the current clip. The Mute button handles
  // its own click, so pressing it then means "turn the voice on", not "mute".
  let unlockArmed = false, unlockedAt = 0;
  const UNLOCK = ['pointerdown', 'keydown', 'touchend'];
  function unlock(event) {
    if (!event.isTrusted || event.target?.closest?.('#tour-mute')) return;
    if (event.type === 'keydown' && ['Shift', 'Control', 'Alt', 'Meta', 'Escape', 'CapsLock', 'Fn'].includes(event.key)) return; // browsers don't count these as permission to play
    UNLOCK.forEach(type => removeEventListener(type, unlock, true)); unlockArmed = false;
    unlockedAt = Date.now();
    if (blocked && current && !muted) { blocked = false; play(); }
  }
  function armUnlock() {
    if (unlockArmed) return;
    unlockArmed = true;
    UNLOCK.forEach(type => addEventListener(type, unlock, true));
  }

  function start(step) {
    stop(); held = tourPaused;
    const clip = window.samestateDemoNarration?.clips.find(item => item.title === step.title);
    if (!clip) { failed = true; render(); return; }
    const file = IS_EXT && clip.extensionFile ? clip.extensionFile : clip.file;
    const source = new URL(`demo/narration/${file}?v=${window.samestateDemoNarration.build}`, document.baseURI).href;
    current = { title: step.title, source, finished: false, pending: false, lastAt: Date.now(), lastTime: 0 };
    audio.src = source;
    const token = sequence;
    audio.onended = () => { if (sequence === token && current && audio.ended) { current.finished = true; current.pending = false; } };
    audio.onerror = () => { if (sequence === token && current && audio.error) { failed = true; current.pending = false; render(); } };
    play();
  }

  function pause(paused) {
    held = paused;
    if (paused) audio.pause();
    else if (current && !current.finished && !blocked && !failed && !muted) play();
  }

  button.onclick = () => {
    if (blocked || failed) {
      muted = false;
      if (failed && current) { audio.src = current.source; audio.load(); current.finished = false; }
      blocked = failed = false;
      play();
    }
    else {
      muted = !muted;
      if (muted) audio.pause(); else play();
    }
    try { localStorage.setItem('samestate.tourMuted', String(muted)); } catch {}
    render();
  };

  window.samestateTourVoice = {
    start, stop, pause,
    get waiting() {
      if (!current || muted || held || blocked || failed || current.finished) return false;
      if (audio.currentTime > current.lastTime) { current.lastAt = Date.now(); current.lastTime = audio.currentTime; }
      // A failed or stalled audio request must not strand the walkthrough.
      if (Date.now() - current.lastAt > 12000) { failed = true; render(); return false; }
      return true;
    },
    get() { return { muted, blocked, failed, held, unlockedAt, title: current?.title || null, finished: current?.finished ?? true, pending: current?.pending || false, currentTime: audio.currentTime, duration: Number.isFinite(audio.duration) ? audio.duration : null, paused: audio.paused }; }
  };
  addEventListener('pagehide', stop);
  render();
})();
