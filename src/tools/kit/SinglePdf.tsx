import type { ReactNode } from 'react';
import type { Tool } from '../../features/tools/catalog';
import type { UploadSnapshot } from '../../privacy/uploadMonitor';
import { DropZone } from './DropZone';
import { FileHead, Loading, UnlockPrompt } from './parts';
import { ToolLayout } from './ToolLayout';
import { usePdf, type LoadedPdf } from './usePdf';

/**
 * The shared frame for tools that work on one PDF: choose it, unlock it if it
 * has a password, then show the tool's own options for the loaded file.
 */
export function SinglePdf({ tool, prompt, children }: {
  tool: Tool;
  prompt: string;
  children: (pdf: LoadedPdf, since: UploadSnapshot, reset: () => void) => ReactNode;
}) {
  const { state, since, load, unlock, reset } = usePdf();
  return (
    <ToolLayout tool={tool}>
      {state.status === 'empty' && <DropZone accept="application/pdf,.pdf" title={prompt} onFiles={([file]) => file && load(file)} />}
      {state.status === 'loading' && <Loading label="Reading your PDF" />}
      {state.status === 'locked' && <><FileHead file={state.file} onReset={reset} /><UnlockPrompt error={state.error} onUnlock={unlock} /></>}
      {state.status === 'error' && <><FileHead file={state.file} onReset={reset} /><p className="hp-note hp-note--danger">{state.message}</p></>}
      {state.status === 'ready' && (
        <>
          <FileHead file={state.pdf.file} detail={`${state.pdf.pages} page${state.pdf.pages === 1 ? '' : 's'}`} onReset={reset} />
          {children(state.pdf, since, reset)}
        </>
      )}
    </ToolLayout>
  );
}
