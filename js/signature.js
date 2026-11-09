// Signatures are kept as pen strokes rather than pictures, so they stay sharp
// in the PDF at any size. A stroke is a flat list: [x, y, width, x, y, width, ...]
export const INK = '#1E2C9B';

const MAX_WIDTH = 3.8;
const MIN_WIDTH = 1.5;
const MIN_INK_LENGTH = 60; // Stops a stray tap from counting as a signature.

// Keeps the pen line as thick as a real ballpoint when a signature is shrunk to fit.
let thicken = 1;

const mid = (ax, ay, bx, by) => [(ax + bx) / 2, (ay + by) / 2];

function dot(ctx, x, y, w) {
  ctx.beginPath();
  ctx.arc(x, y, (w * thicken) / 2, 0, Math.PI * 2);
  ctx.fill();
}

// Draws the curve that ends at point index i of the stroke.
function paintCurve(ctx, s, i) {
  const a = i - 6;
  const b = i - 3;
  const [sx, sy] = mid(s[a], s[a + 1], s[b], s[b + 1]);
  const [ex, ey] = mid(s[b], s[b + 1], s[i], s[i + 1]);
  ctx.lineWidth = ((s[a + 2] + s[b + 2] + s[i + 2]) / 3) * thicken;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.quadraticCurveTo(s[b], s[b + 1], ex, ey);
  ctx.stroke();
}

function paintStart(ctx, s) {
  dot(ctx, s[0], s[1], s[2]);
  if (s.length >= 6) {
    const [ex, ey] = mid(s[0], s[1], s[3], s[4]);
    ctx.lineWidth = ((s[2] + s[5]) / 2) * thicken;
    ctx.beginPath();
    ctx.moveTo(s[0], s[1]);
    ctx.lineTo(ex, ey);
    ctx.stroke();
  }
}

function paintEnd(ctx, s) {
  if (s.length < 6) return;
  const n = s.length;
  const [sx, sy] = mid(s[n - 6], s[n - 5], s[n - 3], s[n - 2]);
  ctx.lineWidth = s[n - 1] * thicken;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(s[n - 3], s[n - 2]);
  ctx.stroke();
}

function setPen(ctx, color) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

function paintStrokes(ctx, strokes) {
  for (const s of strokes) {
    paintStart(ctx, s);
    for (let i = 6; i < s.length; i += 3) paintCurve(ctx, s, i);
    paintEnd(ctx, s);
  }
}

function bounds(strokes) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const s of strokes) {
    for (let i = 0; i < s.length; i += 3) {
      const r = s[i + 2] / 2;
      x0 = Math.min(x0, s[i] - r);
      y0 = Math.min(y0, s[i + 1] - r);
      x1 = Math.max(x1, s[i] + r);
      y1 = Math.max(y1, s[i + 1] + r);
    }
  }
  return { x0, y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
}

function fit(strokes, box, maxScale) {
  const b = bounds(strokes);
  const scale = Math.min(box.w / b.w, box.h / b.h, maxScale);
  return {
    b,
    scale,
    x: box.x + (box.w - b.w * scale) / 2,
    y: box.y + (box.h - b.h * scale) / 2,
  };
}

// Draws a finished signature, centred inside a box on a receipt.
export function drawSignature(ctx, signature, box, color = INK) {
  if (!signature || !signature.strokes.length) return;
  const { b, scale, x, y } = fit(signature.strokes, box, 2.4);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.translate(-b.x0, -b.y0);
  setPen(ctx, color);
  thicken = Math.max(1, 1 / scale);
  paintStrokes(ctx, signature.strokes);
  thicken = 1;
  ctx.restore();
}

export class SignaturePad {
  constructor(canvas, onChange) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onChange = onChange;
    this.strokes = [];
    this.current = null;
    this.last = null;
    this.handlers = {
      down: (e) => this.start(e),
      move: (e) => this.move(e),
      up: (e) => this.end(e),
      // Stops iOS from scrolling, zooming or showing the magnifier while signing.
      block: (e) => e.preventDefault(),
      resize: () => this.resize(),
    };
    canvas.addEventListener('pointerdown', this.handlers.down);
    canvas.addEventListener('pointermove', this.handlers.move);
    canvas.addEventListener('pointerup', this.handlers.up);
    canvas.addEventListener('pointercancel', this.handlers.up);
    canvas.addEventListener('touchstart', this.handlers.block, { passive: false });
    canvas.addEventListener('touchmove', this.handlers.block, { passive: false });
    window.addEventListener('resize', this.handlers.resize);
    this.resize();
  }

  destroy() {
    window.removeEventListener('resize', this.handlers.resize);
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === this.width && rect.height === this.height) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 3);
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = Math.round(rect.width * ratio);
    this.canvas.height = Math.round(rect.height * ratio);
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.redraw();
  }

  redraw() {
    this.ctx.clearRect(0, 0, this.width, this.height);
    setPen(this.ctx, INK);
    paintStrokes(this.ctx, this.strokes);
  }

  point(e) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, t: e.timeStamp };
  }

  start(e) {
    if (this.current) return;
    e.preventDefault();
    this.canvas.setPointerCapture(e.pointerId);
    const p = this.point(e);
    const w = (MAX_WIDTH + MIN_WIDTH) / 2;
    this.current = [round(p.x), round(p.y), round(w)];
    this.strokes.push(this.current);
    this.last = { ...p, w };
    setPen(this.ctx, INK);
    dot(this.ctx, p.x, p.y, w);
    this.onChange();
  }

  move(e) {
    if (!this.current) return;
    e.preventDefault();
    const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
    for (const each of events.length ? events : [e]) this.add(this.point(each));
  }

  add(p) {
    const dx = p.x - this.last.x;
    const dy = p.y - this.last.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 1) return;
    // Faster movement draws a thinner line, the way a real pen does.
    const speed = distance / Math.max(p.t - this.last.t, 1);
    const target = Math.max(MIN_WIDTH, MAX_WIDTH - speed * 1.15);
    const w = this.last.w * 0.72 + target * 0.28;
    const s = this.current;
    s.push(round(p.x), round(p.y), round(w));
    this.last = { ...p, w };
    if (s.length === 6) paintStart(this.ctx, s);
    else paintCurve(this.ctx, s, s.length - 3);
    this.onChange();
  }

  end() {
    if (!this.current) return;
    paintEnd(this.ctx, this.current);
    this.current = null;
    this.onChange();
  }

  clear() {
    this.strokes = [];
    this.current = null;
    this.redraw();
    this.onChange();
  }

  // Shows a saved signature, scaled to fit this pad.
  load(signature) {
    const box = { x: 24, y: 24, w: this.width - 48, h: this.height - 48 };
    const { b, scale, x, y } = fit(signature.strokes, box, 1.6);
    this.strokes = signature.strokes.map((s) => {
      const out = [];
      for (let i = 0; i < s.length; i += 3) {
        out.push(round((s[i] - b.x0) * scale + x), round((s[i + 1] - b.y0) * scale + y), round(s[i + 2] * scale));
      }
      return out;
    });
    this.redraw();
    this.onChange();
  }

  inkLength() {
    let total = 0;
    for (const s of this.strokes) {
      for (let i = 3; i < s.length; i += 3) total += Math.hypot(s[i] - s[i - 3], s[i + 1] - s[i - 2]);
    }
    return total;
  }

  get isEmpty() {
    return this.strokes.length === 0;
  }

  get isValid() {
    return this.inkLength() >= MIN_INK_LENGTH;
  }

  toData() {
    return { strokes: this.strokes, at: new Date().toISOString() };
  }
}

const round = (n) => Math.round(n * 10) / 10;
