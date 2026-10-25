import { useState } from 'react';
import { FileUp } from 'lucide-react';
import { Button } from '../../design/ui';
import { pickFiles } from '../../files/pick';

/**
 * The tool's own drop target. It claims drops on itself, so the app-wide Smart
 * Drop doesn't take them.
 */
export function DropZone({ accept, multiple = false, title, hint, onFiles }: {
  accept: string;
  multiple?: boolean;
  title: string;
  hint?: string;
  onFiles: (files: File[]) => void;
}) {
  const [over, setOver] = useState(false);
  return (
    <div
      className={over ? 'drop drop--over' : 'drop'}
      onDragOver={(event) => { event.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        const files = Array.from(event.dataTransfer.files);
        if (files.length) onFiles(multiple ? files : files.slice(0, 1));
      }}
    >
      <span className="drop__icon"><FileUp aria-hidden size={30} /></span>
      <p className="drop__title">{title}</p>
      {hint && <p className="drop__hint">{hint}</p>}
      <Button size="lg" onClick={async () => { const files = await pickFiles({ accept, multiple }); if (files.length) onFiles(files); }}>
        {multiple ? 'Choose files' : 'Choose file'}
      </Button>
      <p className="drop__hint">Stays on your device. Nothing is uploaded.</p>
    </div>
  );
}
