import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ImagePlus, X } from 'lucide-react';
import { Button, IconButton } from '../../design/ui';
import { pickFiles } from '../../files/pick';
import { peekHandOff, takeHandOff } from '../../files/handoff';
import { formatBytes } from '../../lib/format';
import { IMAGE_ACCEPT } from '../../images/codec';
import { DropZone } from './DropZone';

export interface ImageItem { id: number; file: File }
let nextId = 1;
const isImage = (f: File) => f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|svg|hei[cf])$/i.test(f.name);

/** Picked images: takes Smart Drop images on arrival, and lets the list grow, shrink and reorder. */
export function useImageList() {
  const [items, setItems] = useState<ImageItem[]>([]);
  const add = (files: File[]) => setItems((list) => [...list, ...files.filter(isImage).map((file) => ({ id: nextId++, file }))]);
  useEffect(() => { if (peekHandOff().some(isImage)) add(takeHandOff()); }, []);
  const remove = (id: number) => setItems((list) => list.filter((i) => i.id !== id));
  const move = (index: number, by: number) => setItems((list) => {
    const next = [...list];
    const [item] = next.splice(index, 1);
    if (item) next.splice(index + by, 0, item);
    return next;
  });
  return { items, add, remove, move, clear: () => setItems([]) };
}

function Preview({ file }: { file: File }) {
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return <img className="image-list__thumb" src={url} alt="" loading="lazy" />;
}

export function ImageList({ list, ordered = false, title, onChange }: {
  list: ReturnType<typeof useImageList>;
  ordered?: boolean;
  title: string;
  onChange?: () => void;
}) {
  const { items, add, remove, move } = list;
  const change = <A extends unknown[]>(fn: (...args: A) => void) => (...args: A) => { fn(...args); onChange?.(); };
  if (items.length === 0) return <DropZone accept={IMAGE_ACCEPT} multiple title={title} hint="JPG, PNG, WebP, GIF, BMP, SVG or HEIC" onFiles={change(add)} />;
  return (
    <>
      <ol className="hp-group image-list" aria-label={ordered ? 'Images, in page order' : 'Images'}>
        {items.map((item, index) => (
          <li key={item.id} className="file-head">
            <Preview file={item.file} />
            <span className="file-head__body">
              <span className="file-head__name">{ordered ? `${index + 1}. ` : ''}{item.file.name}</span>
              <span className="file-head__meta">{formatBytes(item.file.size)}</span>
            </span>
            {ordered && <IconButton label={`Move ${item.file.name} up`} disabled={index === 0} onClick={change(() => move(index, -1))}><ArrowUp aria-hidden size={20} /></IconButton>}
            {ordered && <IconButton label={`Move ${item.file.name} down`} disabled={index === items.length - 1} onClick={change(() => move(index, 1))}><ArrowDown aria-hidden size={20} /></IconButton>}
            <IconButton label={`Remove ${item.file.name}`} onClick={change(() => remove(item.id))}><X aria-hidden size={20} /></IconButton>
          </li>
        ))}
      </ol>
      <Button variant="tonal" icon={<ImagePlus aria-hidden size={18} />} onClick={async () => change(add)(await pickFiles({ accept: IMAGE_ACCEPT }))}>Add more images</Button>
    </>
  );
}
