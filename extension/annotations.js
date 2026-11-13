'use strict';

const annotationDialog = document.querySelector('#annotation-note-dialog');
const annotationText = document.querySelector('#annotation-note-text');
let saveAnnotationNote;
annotationDialog.addEventListener('close', () => {
  if (annotationDialog.returnValue === 'save') saveAnnotationNote?.(annotationText.value.trim());
  saveAnnotationNote = null;
});

function editAnnotationNote(text, save) {
  saveAnnotationNote = save;
  annotationDialog.returnValue = '';
  annotationText.value = text;
  annotationDialog.showModal();
  annotationText.focus();
}

function annotationPaths(mark, width, height) {
  const points = mark.points.map(({ x, y }) => ({ x: x * width, y: y * height }));
  if (mark.tool !== 'arrow') return [points];
  const [start, tip] = points;
  const angle = Math.atan2(tip.y - start.y, tip.x - start.x);
  const length = Math.min(14, Math.hypot(tip.x - start.x, tip.y - start.y) * 0.45);
  const wing = offset => ({ x: tip.x - length * Math.cos(angle + offset), y: tip.y - length * Math.sin(angle + offset) });
  return [points, [wing(-0.55), tip, wing(0.55)]];
}

function nearAnnotationSegment(point, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const fraction = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(point.x - a.x - fraction * dx, point.y - a.y - fraction * dy) <= 10;
}

function mountPreviewAnnotations(iframe, triggerHost, toolbarHost, onToggle) {
  const surface = document.createElement('div');
  surface.className = 'preview-surface';
  const layer = document.createElement('div');
  layer.className = 'preview-annotations';
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  layer.append(canvas);
  iframe.replaceWith(surface);
  surface.append(iframe, layer);

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'annotation-toggle';
  toggle.textContent = '✎';
  toggle.title = 'Annotate this preview';
  toggle.setAttribute('aria-label', toggle.title);
  toggle.setAttribute('aria-expanded', 'false');
  triggerHost.insertBefore(toggle, triggerHost.querySelector('[data-a=close]'));
  const toolbar = document.createElement('div');
  toolbar.className = 'annotation-tools';
  toolbar.hidden = true;
  toolbar.setAttribute('role', 'group');
  toolbar.setAttribute('aria-label', 'Annotation tools');
  for (const [tool, label] of [['draw', 'Draw'], ['line', 'Line'], ['arrow', 'Arrow'], ['note', 'Note'], ['erase', 'Erase']]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pill';
    button.dataset.tool = tool;
    button.textContent = label;
    button.setAttribute('aria-pressed', 'false');
    toolbar.append(button);
  }
  toolbarHost.append(toolbar);

  const marks = [];
  let tool = '';
  let gesture = null;

  function redraw() {
    if (!marks.length && !gesture?.mark) {
      if (canvas.width) canvas.width = canvas.height = 0;
      return;
    }
    const rect = layer.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const ratio = Math.min(devicePixelRatio || 1, 4096 / Math.max(rect.width, rect.height));
    const width = Math.max(1, Math.round(rect.width * ratio));
    const height = Math.max(1, Math.round(rect.height * ratio));
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.lineCap = ctx.lineJoin = 'round';
    ctx.lineWidth = 3;
    ctx.strokeStyle = ctx.fillStyle = '#ffbf57';
    layer.style.setProperty('--note-scale', String(layer.clientWidth / rect.width));
    layer.style.setProperty('--note-width', Math.min(176, rect.width * 0.49) + 'px');
    for (const mark of gesture?.mark ? [...marks, gesture.mark] : marks) {
      if (mark.node) continue;
      for (const path of annotationPaths(mark, rect.width, rect.height)) {
        const first = path[0];
        ctx.beginPath();
        ctx.moveTo(first.x, first.y);
        for (const point of path.slice(1)) ctx.lineTo(point.x, point.y);
        ctx.stroke();
        if (path.every(point => point.x === first.x && point.y === first.y)) {
          ctx.beginPath();
          ctx.arc(first.x, first.y, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  function setTool(value) {
    const changed = !!tool !== !!value;
    tool = value;
    toolbar.hidden = !tool;
    toggle.setAttribute('aria-expanded', String(!!tool));
    layer.dataset.tool = tool;
    for (const button of toolbar.children) button.setAttribute('aria-pressed', String(button.dataset.tool === tool));
    for (const mark of marks) if (mark.node) mark.node.tabIndex = tool === 'note' ? 0 : -1;
    if (changed) onToggle?.();
  }

  function pointAt(event, rect) {
    const clamp = n => Math.max(0, Math.min(1, n));
    return { x: clamp((event.clientX - rect.left) / rect.width), y: clamp((event.clientY - rect.top) / rect.height) };
  }

  function eraseAt(event) {
    const rect = layer.getBoundingClientRect();
    const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    const index = marks.findLastIndex(mark => {
      if (mark.node) {
        const box = mark.node.getBoundingClientRect();
        return event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
      }
      return annotationPaths(mark, rect.width, rect.height).some(path => path.some((p, i) => nearAnnotationSegment(point, path[i - 1] || p, p)));
    });
    if (index === -1) return;
    marks.splice(index, 1)[0].node?.remove();
    redraw();
  }

  function addNote(point) {
    editAnnotationNote('', text => placeNote(point, text));
  }

  function placeNote(point, text) {
    if (!text || !surface.isConnected) return;
    const node = document.createElement('button');
    node.type = 'button';
    node.className = 'preview-note';
    node.textContent = text;
    node.tabIndex = tool === 'note' ? 0 : -1;
    node.style.left = point.x * 100 + '%';
    node.style.top = point.y * 100 + '%';
    node.classList.toggle('from-right', point.x > 0.5);
    node.classList.toggle('from-bottom', point.y > 0.5);
    node.addEventListener('click', () => {
      if (tool === 'note') editAnnotationNote(node.textContent, value => { if (value) node.textContent = value; });
    });
    marks.push({ node, point });
    layer.append(node);
    redraw();
  }

  toggle.addEventListener('click', () => setTool(tool ? '' : 'draw'));
  toolbar.addEventListener('click', event => {
    const button = event.target.closest('[data-tool]');
    if (button) setTool(button.dataset.tool);
  });
  layer.addEventListener('pointerdown', event => {
    if (!tool || gesture || event.button !== 0) return;
    if (tool === 'note') {
      if (!event.target.closest('.preview-note')) addNote(pointAt(event, layer.getBoundingClientRect()));
      return;
    }
    event.preventDefault();
    layer.setPointerCapture(event.pointerId);
    if (tool === 'erase') {
      gesture = { id: event.pointerId };
      eraseAt(event);
    } else {
      const point = pointAt(event, layer.getBoundingClientRect());
      gesture = { id: event.pointerId, mark: { tool, points: [point, point] } };
      redraw();
    }
  });
  function move(event) {
    if (gesture?.id !== event.pointerId) return;
    if (!gesture.mark) { eraseAt(event); return; }
    const { points, tool: drawingTool } = gesture.mark;
    const point = pointAt(event, layer.getBoundingClientRect());
    if (drawingTool === 'draw') points.push(point);
    else points[1] = point;
    redraw();
  }
  layer.addEventListener('pointermove', move);
  layer.addEventListener('pointerup', event => {
    if (gesture?.id !== event.pointerId) return;
    move(event);
    if (gesture.mark) marks.push(gesture.mark);
    gesture = null;
  });
  layer.addEventListener('lostpointercapture', () => { gesture = null; redraw(); });
  canvas.width = canvas.height = 0;
  return {
    surface, redraw, setTool,
    // Used by the guided demo. Points are fractions of the preview's width and height.
    draw(markTool, points) { // returns the mark so its points can be moved while it is drawn
      const mark = { tool: markTool, points };
      marks.push(mark);
      redraw();
      return mark;
    },
    note: placeNote,
    // Saved workspaces keep marks as plain data: strokes as points, notes as text at a point.
    snapshot() {
      return marks.map(mark => mark.node
        ? { note: mark.node.textContent, x: mark.point.x, y: mark.point.y }
        : { tool: mark.tool, points: mark.points.map(({ x, y }) => ({ x, y })) });
    },
    restore(saved) {
      const fraction = n => Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
      for (const mark of Array.isArray(saved) ? saved.slice(0, 200) : []) {
        if (typeof mark?.note === 'string') placeNote({ x: fraction(mark.x), y: fraction(mark.y) }, mark.note.slice(0, 280));
        else if (['draw', 'line', 'arrow'].includes(mark?.tool) && Array.isArray(mark.points) && mark.points.length) {
          marks.push({ tool: mark.tool, points: mark.points.slice(0, 2000).map(p => ({ x: fraction(p?.x), y: fraction(p?.y) })) });
        }
      }
      redraw();
    },
    clear() {
      for (const mark of marks) mark.node?.remove();
      marks.length = 0;
      gesture = null;
      canvas.width = canvas.height = 0;
      setTool('');
    }
  };
}
