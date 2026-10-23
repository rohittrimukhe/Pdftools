import { useCallback, useState } from 'react';
import { messageOf } from './usePdf';

export interface Output { blob: Blob; name: string; summary?: string }

/** Busy state, progress, a plain-language error, and the finished file for one tool run. */
export function useRunner() {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [output, setOutput] = useState<Output | null>(null);

  const run = useCallback(async (work: (report: (fraction: number) => void) => Promise<Output>) => {
    setBusy(true);
    setError(undefined);
    setOutput(null);
    setProgress(undefined);
    try {
      // Let the progress bar paint before heavy work starts on this thread.
      await new Promise((r) => setTimeout(r, 30));
      setOutput(await work((fraction) => setProgress(fraction)));
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }, []);

  const clear = useCallback(() => { setOutput(null); setError(undefined); }, []);
  return { busy, progress, error, output, run, clear };
}
