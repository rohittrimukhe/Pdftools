import { useState } from 'react';
import { Note } from '../design/ui';
import { ResultCard } from '../files/ResultCard';
import { protectPdf } from '../pdf/engine';
import type { Tool } from '../features/tools/catalog';
import type { UploadSnapshot } from '../privacy/uploadMonitor';
import { SinglePdf } from './kit/SinglePdf';
import { PasswordField, RunPanel } from './kit/parts';
import { outputName, pdfBlob } from './kit/output';
import { useRunner } from './kit/useRunner';
import type { LoadedPdf } from './kit/usePdf';

export default function Protect({ tool }: { tool: Tool }) {
  return <SinglePdf tool={tool} prompt="Choose a PDF to protect">{(pdf, since) => <Options key={pdf.file.name + pdf.file.size} pdf={pdf} since={since} tool={tool} />}</SinglePdf>;
}

/** Plain advice, not a score: length matters most. */
export function passwordAdvice(password: string): string | undefined {
  if (password.length === 0) return undefined;
  if (password.length < 8) return 'Use at least 8 characters. Longer is stronger.';
  if (/^(.)\1+$/.test(password) || /^(1234|password|qwerty)/i.test(password)) return 'This password is easy to guess.';
  return undefined;
}

function Options({ pdf, since, tool }: { pdf: LoadedPdf; since: UploadSnapshot; tool: Tool }) {
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const runner = useRunner();
  const mismatch = again.length > 0 && again !== password;
  const advice = passwordAdvice(password);

  return (
    <>
      <div className="hp-card options">
        <PasswordField id="pw-new" label="New password" value={password} onChange={(v) => { setPassword(v); runner.clear(); }} autoComplete="new-password" />
        <PasswordField id="pw-again" label="Type it again" value={again} onChange={(v) => { setAgain(v); runner.clear(); }} autoComplete="new-password" />
        {advice && <Note tone="warn">{advice}</Note>}
        {mismatch && <Note tone="danger">The two passwords don’t match.</Note>}
        <Note>Keep this password safe. If it’s lost, nobody can open the PDF, including Happy PDF.</Note>
      </div>
      {!runner.output && (
        <RunPanel label="Protect PDF" busyLabel="Protecting" busy={runner.busy} error={runner.error} disabled={password.length === 0 || password !== again}
          onRun={() => runner.run(async () => {
            const bytes = await protectPdf(pdf.bytes, password, pdf.password);
            return { blob: pdfBlob(bytes), name: outputName(pdf.file.name, 'protected'), summary: 'Locked with AES-256. The password is needed to open it.' };
          })} />
      )}
      {runner.output && <ResultCard {...runner.output} tool={tool.id} since={since} />}
    </>
  );
}
