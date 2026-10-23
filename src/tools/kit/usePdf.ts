import { useCallback, useEffect, useRef, useState } from 'react';

import { PdfError } from '../../pdf/errors';
import { peekHandOff, takeHandOff } from '../../files/handoff';
import { uploadSnapshot, type UploadSnapshot } from '../../privacy/uploadMonitor';
import { loadEngine } from '../../pdf/lazy';

export interface LoadedPdf {
  file: File;
  bytes: Uint8Array;
  pages: number;
  /** Set when the PDF needed a password to open. */
  password?: string;
}

export type PdfState =
  | { status: 'empty' }
  | { status: 'loading'; file: File }
  | { status: 'locked'; file: File; bytes: Uint8Array; error?: string }
  | { status: 'ready'; pdf: LoadedPdf }
  | { status: 'error'; file: File; message: string };

const isPdfFile = (file: File) => file.type === 'application/pdf' || /\.pdf$/i.test(file.name);

/** Takes PDFs handed over by Smart Drop, if any, otherwise nothing. */
export function takePdfHandOff(): File[] {
  return peekHandOff().some(isPdfFile) ? takeHandOff().filter(isPdfFile) : [];
}

export const messageOf = (error: unknown) => (error instanceof PdfError ? error.message : 'Something went wrong while reading this file. Try it again, or try another file.');

/** One PDF for a tool: load, ask for a password if needed, and start the upload measurement. */
export function usePdf() {
  const [state, setState] = useState<PdfState>({ status: 'empty' });
  const [since, setSince] = useState<UploadSnapshot>(uploadSnapshot);
  const current = useRef(0);

  const load = useCallback(async (file: File, password?: string, known?: Uint8Array) => {
    const ticket = ++current.current;
    setSince(uploadSnapshot());
    setState({ status: 'loading', file });
    const bytes = known ?? new Uint8Array(await file.arrayBuffer());
    try {
      const doc = await (await loadEngine()).openPdf(bytes, password);
      if (ticket !== current.current) return;
      setState({ status: 'ready', pdf: { file, bytes, pages: doc.getPageCount(), password } });
    } catch (error) {
      if (ticket !== current.current) return;
      if (error instanceof PdfError && (error.code === 'password-required' || error.code === 'wrong-password')) {
        setState({ status: 'locked', file, bytes, error: error.code === 'wrong-password' ? error.message : undefined });
      } else {
        setState({ status: 'error', file, message: messageOf(error) });
      }
    }
  }, []);

  useEffect(() => {
    const [first] = takePdfHandOff();
    if (first) void load(first);
  }, [load]);

  const unlock = (password: string) => {
    if (state.status === 'locked') void load(state.file, password, state.bytes);
  };
  const reset = () => { current.current++; setState({ status: 'empty' }); };

  return { state, since, load, unlock, reset };
}
