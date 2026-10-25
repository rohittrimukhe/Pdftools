import { useState } from 'react';
import { Check, PencilLine, TriangleAlert } from 'lucide-react';
import { Button, Chip, Note } from '../design/ui';
import { Link } from '../app/router';
import { UploadBadge } from '../privacy/UploadBadge';
import { uploadSnapshot } from '../privacy/uploadMonitor';
import type { Tool } from '../features/tools/catalog';
import { isBlank, resumeText } from '../resume/model';
import { loadDraft } from '../resume/store';
import { scoreResume, verdict, type AtsReport } from '../resume/ats';
import { pdfText } from '../resume/extract';
import { ToolLayout } from './kit/ToolLayout';
import { DropZone } from './kit/DropZone';
import { FileHead, RunPanel } from './kit/parts';
import { messageOf } from './kit/usePdf';
import './resume.css';

type Source = 'draft' | 'pdf' | 'text';

export default function ResumeScore({ tool }: { tool: Tool }) {
  const [draft] = useState(loadDraft);
  const hasDraft = Boolean(draft && (draft.name.trim() || draft.experience.some((e) => !isBlank(e))));
  const [source, setSource] = useState<Source>(hasDraft ? 'draft' : 'pdf');
  const [pdf, setPdf] = useState<{ file: File; text: string; pages: number } | null>(null);
  const [pdfError, setPdfError] = useState<string>();
  const [pasted, setPasted] = useState('');
  const [job, setJob] = useState('');
  const [report, setReport] = useState<AtsReport | null>(null);
  const [since] = useState(uploadSnapshot);
  const changed = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setReport(null); };

  const resume = source === 'draft' && draft ? { text: resumeText(draft) } : source === 'pdf' && pdf ? { text: pdf.text, pages: pdf.pages } : source === 'text' ? { text: pasted } : null;
  const unreadable = source === 'pdf' && pdf !== null && pdf.text.replace(/\s/g, '').length < 100;

  return (
    <ToolLayout tool={tool}>
      <div className="hp-card options">
        <div>
          <span className="options__label" id="rs-source">Your resume</span>
          <div className="options__chips" role="group" aria-labelledby="rs-source">
            {hasDraft && <Chip selected={source === 'draft'} onClick={() => changed(setSource)('draft')}>From Resume builder</Chip>}
            <Chip selected={source === 'pdf'} onClick={() => changed(setSource)('pdf')}>Upload a PDF</Chip>
            <Chip selected={source === 'text'} onClick={() => changed(setSource)('text')}>Paste text</Chip>
          </div>
        </div>
        {source === 'draft' && draft && (
          <p className="options__hint">Checking “{draft.name.trim() || 'your resume'}” from the <Link to="/tools/resume-builder">Resume builder</Link>.</p>
        )}
        {source === 'pdf' && (pdf ? (
          <FileHead file={pdf.file} detail={`${pdf.pages} page${pdf.pages > 1 ? 's' : ''}`} onReset={() => changed(setPdf)(null)} />
        ) : (
          <DropZone accept=".pdf,application/pdf" title="Choose your resume PDF" hint="Its text is read on this device, the way an ATS reads it."
            onFiles={async ([file]) => {
              setPdfError(undefined);
              try {
                const { text, pages } = await pdfText(new Uint8Array(await file!.arrayBuffer()));
                changed(setPdf)({ file: file!, text, pages });
              } catch (e) { setPdfError(messageOf(e)); }
            }} />
        ))}
        {pdfError && <Note tone="danger">{pdfError}</Note>}
        {unreadable && <Note tone="danger" icon={<TriangleAlert size={18} />}>This PDF has almost no text that software can read: it is probably a scan or an image. ATS software will see it as empty. Rebuild it with the <Link to="/tools/resume-builder">Resume builder</Link>.</Note>}
        {source === 'text' && (
          <div className="hp-field">
            <label htmlFor="rs-text">Resume text</label>
            <textarea id="rs-text" className="hp-input" rows={8} value={pasted} onChange={(e) => changed(setPasted)(e.target.value)} placeholder="Paste your whole resume here, headings included." />
          </div>
        )}
        <div className="hp-field">
          <label htmlFor="rs-job">Job post (optional)</label>
          <textarea id="rs-job" className="hp-input" rows={6} value={job} onChange={(e) => changed(setJob)(e.target.value)} placeholder="Paste the job description to see which of its keywords your resume uses." />
        </div>
      </div>

      {!report && (
        <RunPanel label="Check my resume" busyLabel="Checking" busy={false}
          disabled={!resume || resume.text.trim().length < 20 || unreadable}
          onRun={() => resume && setReport(scoreResume({ resume: resume.text, job, pages: 'pages' in resume ? resume.pages : undefined }))} />
      )}
      {report && <Report report={report} since={since} fromDraft={source === 'draft'} />}
    </ToolLayout>
  );
}

function Report({ report, since, fromDraft }: { report: AtsReport; since: ReturnType<typeof uploadSnapshot>; fromDraft: boolean }) {
  const failed = report.checks.filter((c) => !c.passed);
  return (
    <section className="hp-card options" aria-labelledby="rs-result" aria-live="polite">
      <div className="score-head">
        <div className="score-ring" style={{ ['--p' as string]: report.score }} aria-hidden>
          <div className="score-ring__inner"><span><span className="score-ring__num">{report.score}</span><br /><span className="score-ring__of">of 100</span></span></div>
        </div>
        <div className="score-head__text">
          <h2 id="rs-result" className="score-head__verdict">ATS score {report.score}: {verdict(report.score)}</h2>
          <p className="score-head__parts">{report.match ? `Keyword match ${report.match.score} · Basics ${report.basicsScore}` : 'Basics only. Add a job post to see the keyword match.'}</p>
          <UploadBadge since={since} />
        </div>
      </div>

      {report.match && (
        <>
          <h3 className="options__label">Job keywords in your resume ({report.match.found.length} of {report.match.found.length + report.match.missing.length})</h3>
          {report.match.found.length > 0 && <ul className="keywords keywords--found" aria-label="Keywords found">{report.match.found.map((k) => <li key={k}>{k}</li>)}</ul>}
          {report.match.missing.length > 0 && (
            <>
              <p className="options__hint">Missing. Add the ones that are true for you, in your skills or in an achievement:</p>
              <ul className="keywords keywords--missing" aria-label="Keywords missing">{report.match.missing.map((k) => <li key={k}>{k}</li>)}</ul>
            </>
          )}
        </>
      )}

      <h3 className="options__label">{failed.length ? `Basics: ${failed.length} to fix` : 'Basics: all good'}</h3>
      <ul className="checks">
        {[...failed, ...report.checks.filter((c) => c.passed)].map((c) => (
          <li key={c.id}>
            <span className={c.passed ? 'checks__icon checks__icon--ok' : 'checks__icon checks__icon--fix'}>
              {c.passed ? <Check aria-hidden size={16} /> : <TriangleAlert aria-hidden size={16} />}
            </span>
            <span>
              <span className="checks__label">{c.label}<span className="hp-sr-only">{c.passed ? ': passed' : ': to fix'}</span></span>
              <span className="checks__detail">{c.detail}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="options__hint">This score follows common ATS rules; each employer’s software differs. Use it to improve, not as a guarantee.</p>
      {fromDraft && <Link to="/tools/resume-builder" className="hp-btn hp-btn--tonal"><PencilLine aria-hidden size={18} /> Edit in Resume builder</Link>}
      {!fromDraft && <Button variant="tonal" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Change resume or job post</Button>}
    </section>
  );
}
