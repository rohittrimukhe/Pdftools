import { useEffect, useRef, useState } from 'react';
import { Eraser } from 'lucide-react';
import { Button } from '../design/ui';

/** Crops a canvas to its ink, leaving a small margin, and returns PNG bytes with a clear background. */
async function trimToPng(canvas: HTMLCanvasElement): Promise<{ png: Uint8Array; ratio: number } | null> {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  let top = height, left = width, right = -1, bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3]! > 8) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  if (right < 0) return null;
  const pad = 8;
  left = Math.max(0, left - pad); top = Math.max(0, top - pad);
  right = Math.min(width - 1, right + pad); bottom = Math.min(height - 1, bottom + pad);
  const out = document.createElement('canvas');
  out.width = right - left + 1;
  out.height = bottom - top + 1;
  out.getContext('2d')!.drawImage(canvas, left, top, out.width, out.height, 0, 0, out.width, out.height);
  const blob = await new Promise<Blob | null>((r) => out.toBlob(r, 'image/png'));
  return blob ? { png: new Uint8Array(await blob.arrayBuffer()), ratio: out.width / out.height } : null;
}

export interface Signature { png: Uint8Array; ratio: number; url: string }

const INK = '#1b2a6b';

/** Draw with a finger, stylus or mouse. Strokes are smoothed and scale with the screen's pixel density. */
export function DrawPad({ onChange }: { onChange: (sig: Signature | null) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<[number, number] | null>(null);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const c = canvas.current!;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    c.width = c.clientWidth * dpr;
    c.height = c.clientHeight * dpr;
    const ctx = c.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.6;
  }, []);

  const point = (e: React.PointerEvent): [number, number] => {
    const r = canvas.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  const finish = async () => {
    drawing.current = false;
    last.current = null;
    const trimmed = await trimToPng(canvas.current!);
    onChange(trimmed ? { ...trimmed, url: URL.createObjectURL(new Blob([trimmed.png as BlobPart], { type: 'image/png' })) } : null);
  };
  const clear = () => {
    const c = canvas.current!;
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
    setEmpty(true);
    onChange(null);
  };

  return (
    <div className="sign-pad">
      <canvas
        ref={canvas}
        className="sign-pad__canvas"
        aria-label="Signature drawing area. Draw your signature with a finger, pen or mouse."
        role="img"
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); drawing.current = true; last.current = point(e); setEmpty(false); }}
        onPointerMove={(e) => {
          if (!drawing.current || !last.current) return;
          const ctx = canvas.current!.getContext('2d')!;
          const [x, y] = point(e);
          const [lx, ly] = last.current;
          ctx.beginPath();
          ctx.moveTo(lx, ly);
          ctx.quadraticCurveTo(lx, ly, (lx + x) / 2, (ly + y) / 2);
          ctx.lineTo(x, y);
          ctx.stroke();
          last.current = [x, y];
        }}
        onPointerUp={finish}
        onPointerCancel={finish}
      />
      {empty && <span className="sign-pad__hint" aria-hidden>Sign here</span>}
      <Button variant="text" icon={<Eraser aria-hidden size={18} />} onClick={clear} disabled={empty}>Clear</Button>
    </div>
  );
}

/** A typed name drawn in a handwriting-style font. */
export async function typedSignature(name: string): Promise<Signature | null> {
  const text = name.trim();
  if (!text) return null;
  const c = document.createElement('canvas');
  c.width = 1200;
  c.height = 300;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = INK;
  ctx.textBaseline = 'middle';
  let size = 150;
  do {
    ctx.font = `italic ${size}px "Segoe Script", "Brush Script MT", "Snell Roundhand", cursive`;
    size -= 6;
  } while (ctx.measureText(text).width > c.width - 40 && size > 30);
  ctx.fillText(text, 20, c.height / 2);
  const trimmed = await trimToPng(c);
  return trimmed ? { ...trimmed, url: URL.createObjectURL(new Blob([trimmed.png as BlobPart], { type: 'image/png' })) } : null;
}
