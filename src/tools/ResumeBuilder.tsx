import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, FileDown, FileUp, Gauge, Plus, Sparkles, Trash2 } from 'lucide-react';
import { Button, Chip, IconButton, Note, Sheet } from '../design/ui';
import { useToast } from '../design/toast';
import { ResultCard } from '../files/ResultCard';
import { pickFiles } from '../files/pick';
import { navigate } from '../app/router';
import { saveFile } from '../platform/save';
import { uploadSnapshot } from '../privacy/uploadMonitor';
import type { Tool } from '../features/tools/catalog';
import { emptyEntry, emptyResume, isBlank, normalizeResume, sampleResume, TEMPLATES, type Entry, type EntryList, type Resume } from '../resume/model';
import { deleteDraft, loadDraft, saveDraft } from '../resume/store';
import { loadRender } from '../pdf/lazy';
import { ToolLayout } from './kit/ToolLayout';
import { RunPanel } from './kit/parts';
import { pdfBlob } from './kit/output';
import { useRunner } from './kit/useRunner';
import './resume.css';

const loadResumePdf = () => import('../resume/pdf');

const LISTS: Record<EntryList, { heading: string; add: string; title: string; org: string; bullets: string; hint: string }> = {
  experience: { heading: 'Experience', add: 'Add a role', title: 'Job title', org: 'Company', bullets: 'What you achieved, one per line', hint: 'Start with a verb and add a number: “Cut costs by 20%”.' },
  projects: { heading: 'Projects', add: 'Add a project', title: 'Project name', org: 'Where (GitHub, client, college)', bullets: 'What it does and your part, one per line', hint: '' },
  education: { heading: 'Education', add: 'Add a degree', title: 'Degree or course', org: 'School, college or university', bullets: 'Grades or honours, one per line', hint: '' },
};

const isEmpty = (r: Resume) => !r.name.trim() && !r.summary.trim() && r.experience.every(isBlank) && !r.skills.trim();
const fileStem = (r: Resume) => (r.name.trim() ? `${r.name.trim()} resume` : 'resume');

export default function ResumeBuilder({ tool }: { tool: Tool }) {
  const [resume, setResume] = useState<Resume>(() => loadDraft() ?? emptyResume());
  const [since] = useState(uploadSnapshot);
  const [confirmClear, setConfirmClear] = useState(false);
  const runner = useRunner();
  const toast = useToast();

  // Keep the draft on this device as the person types.
  useEffect(() => {
    const t = window.setTimeout(() => saveDraft(resume), 400);
    return () => window.clearTimeout(t);
  }, [resume]);

  const update = (patch: Partial<Resume>) => { setResume((r) => ({ ...r, ...patch })); runner.clear(); };
  const field = (key: 'name' | 'headline' | 'email' | 'phone' | 'location' | 'links' | 'summary' | 'skills' | 'certifications') =>
    ({ value: resume[key], onChange: (e: { target: { value: string } }) => update({ [key]: e.target.value }) });

  return (
    <ToolLayout tool={tool}>
      <Note>Your resume is saved on this device as you type. Nothing is uploaded.</Note>
      <div className="resume-start">
        {isEmpty(resume) && <Button variant="tonal" icon={<Sparkles aria-hidden size={18} />} onClick={() => update(sampleResume())}>Fill with an example</Button>}
        <Button variant="text" icon={<FileUp aria-hidden size={18} />} onClick={async () => {
          const [file] = await pickFiles({ accept: '.json,application/json', multiple: false });
          if (!file) return;
          try { update(normalizeResume(JSON.parse(await file.text()))); toast('Resume restored from backup'); } catch { toast('That file isn’t a Happy PDF resume backup.'); }
        }}>Restore backup</Button>
      </div>

      <Card title="Look">
        <div>
          <span className="options__label" id="rb-template">Template</span>
          <div className="options__chips" role="group" aria-labelledby="rb-template">
            {TEMPLATES.map((t) => <Chip key={t.id} selected={resume.template === t.id} onClick={() => update({ template: t.id })}>{t.name}</Chip>)}
          </div>
          <p className="options__hint">{TEMPLATES.find((t) => t.id === resume.template)!.blurb} All templates are single-column text that ATS software reads.</p>
        </div>
        <div>
          <span className="options__label" id="rb-paper">Paper</span>
          <div className="options__chips" role="group" aria-labelledby="rb-paper">
            <Chip selected={resume.paper === 'a4'} onClick={() => update({ paper: 'a4' })}>A4</Chip>
            <Chip selected={resume.paper === 'letter'} onClick={() => update({ paper: 'letter' })}>US Letter</Chip>
          </div>
        </div>
      </Card>

      <Card title="About you">
        <div className="resume-grid">
          <Field id="rb-name" label="Full name"><input id="rb-name" className="hp-input" autoComplete="name" {...field('name')} /></Field>
          <Field id="rb-headline" label="Headline"><input id="rb-headline" className="hp-input" placeholder="e.g. Frontend Engineer" {...field('headline')} /></Field>
          <Field id="rb-email" label="Email"><input id="rb-email" className="hp-input" type="email" autoComplete="email" {...field('email')} /></Field>
          <Field id="rb-phone" label="Phone"><input id="rb-phone" className="hp-input" type="tel" autoComplete="tel" {...field('phone')} /></Field>
          <Field id="rb-location" label="City, country"><input id="rb-location" className="hp-input" {...field('location')} /></Field>
        </div>
        <Field id="rb-links" label="Links, one per line (LinkedIn, portfolio)"><textarea id="rb-links" className="hp-input" rows={2} {...field('links')} /></Field>
        <Field id="rb-summary" label="Summary" hint="Two or three lines: who you are, your strongest result, what you want next.">
          <textarea id="rb-summary" className="hp-input" rows={4} {...field('summary')} />
        </Field>
      </Card>

      {(Object.keys(LISTS) as EntryList[]).map((list) => (
        <EntryEditor key={list} list={list} entries={resume[list]} onChange={(entries) => update({ [list]: entries })} />
      ))}

      <Card title="Skills and certificates">
        <Field id="rb-skills" label="Skills, separated by commas" hint="Use the exact words from job posts: “Power BI”, not “BI tools”.">
          <textarea id="rb-skills" className="hp-input" rows={3} {...field('skills')} />
        </Field>
        <Field id="rb-certs" label="Certifications, one per line"><textarea id="rb-certs" className="hp-input" rows={2} {...field('certifications')} /></Field>
      </Card>

      <Preview resume={resume} />

      {!runner.output && (
        <RunPanel label="Create PDF" busyLabel="Creating your resume" busy={runner.busy} error={runner.error} disabled={!resume.name.trim()}
          onRun={() => runner.run(async () => {
            const { renderResume } = await loadResumePdf();
            const { bytes, pages } = await renderResume(resume);
            return { blob: pdfBlob(bytes), name: `${fileStem(resume)}.pdf`, summary: `${pages} page${pages > 1 ? 's' : ''}, ${TEMPLATES.find((t) => t.id === resume.template)!.name} template. Text-based, so ATS software can read it.` };
          })}>
          {!resume.name.trim() && <p className="run__status">Add your name to create the PDF.</p>}
        </RunPanel>
      )}
      {runner.output && <ResultCard {...runner.output} tool={tool.id} since={since} />}

      <div className="resume-start">
        <Button variant="tonal" icon={<Gauge aria-hidden size={18} />} onClick={() => { saveDraft(resume); navigate('/tools/resume-score'); }}>Check ATS score</Button>
        <Button variant="text" icon={<FileDown aria-hidden size={18} />} onClick={async () => {
          await saveFile(new Blob([JSON.stringify(resume, null, 1)], { type: 'application/json' }), `${fileStem(resume)} backup.json`);
          toast('Backup saved. Use “Restore backup” to continue on another device.');
        }}>Save backup</Button>
        <Button variant="text" icon={<Trash2 aria-hidden size={18} />} onClick={() => setConfirmClear(true)}>Start over</Button>
      </div>

      <Sheet open={confirmClear} onClose={() => setConfirmClear(false)} title="Start over?"
        actions={<>
          <Button variant="text" onClick={() => setConfirmClear(false)}>Keep it</Button>
          <Button variant="danger" onClick={() => { deleteDraft(); update(emptyResume()); setConfirmClear(false); toast('Draft deleted from this device'); }}>Delete draft</Button>
        </>}>
        <p>This deletes the resume saved on this device. Save a backup first if you may need it.</p>
      </Sheet>
    </ToolLayout>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  const id = `rb-${title.toLowerCase().replace(/\W+/g, '-')}`;
  return (
    <section className="hp-card options" aria-labelledby={id}>
      <h2 id={id} className="resume-card__title">{title}</h2>
      {children}
    </section>
  );
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="hp-field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && <p className="options__hint">{hint}</p>}
    </div>
  );
}

function EntryEditor({ list, entries, onChange }: { list: EntryList; entries: Entry[]; onChange: (entries: Entry[]) => void }) {
  const copy = LISTS[list];
  const set = (i: number, patch: Partial<Entry>) => onChange(entries.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  const move = (i: number, by: number) => {
    const next = [...entries];
    const [item] = next.splice(i, 1);
    next.splice(i + by, 0, item!);
    onChange(next);
  };
  return (
    <Card title={copy.heading}>
      {entries.length === 0 && <p className="options__hint">Nothing here yet. Leave it empty to skip this section.</p>}
      <ol className="resume-entries">
        {entries.map((e, i) => {
          const id = (k: string) => `rb-${list}-${e.id}-${k}`;
          const label = e.title.trim() || `${copy.heading} ${i + 1}`;
          return (
            <li key={e.id} className="resume-entry">
              <div className="resume-grid">
                <Field id={id('title')} label={copy.title}><input id={id('title')} className="hp-input" value={e.title} onChange={(ev) => set(i, { title: ev.target.value })} /></Field>
                <Field id={id('org')} label={copy.org}><input id={id('org')} className="hp-input" value={e.org} onChange={(ev) => set(i, { org: ev.target.value })} /></Field>
                <Field id={id('location')} label="Location"><input id={id('location')} className="hp-input" value={e.location} onChange={(ev) => set(i, { location: ev.target.value })} /></Field>
                <div className="resume-dates">
                  <Field id={id('start')} label="Start"><input id={id('start')} className="hp-input" placeholder="Jan 2022" value={e.start} onChange={(ev) => set(i, { start: ev.target.value })} /></Field>
                  <Field id={id('end')} label="End"><input id={id('end')} className="hp-input" placeholder="Present" value={e.end} onChange={(ev) => set(i, { end: ev.target.value })} /></Field>
                </div>
              </div>
              <Field id={id('bullets')} label={copy.bullets} hint={copy.hint || undefined}>
                <textarea id={id('bullets')} className="hp-input" rows={list === 'experience' ? 4 : 2} value={e.bullets} onChange={(ev) => set(i, { bullets: ev.target.value })} />
              </Field>
              <div className="resume-entry__tools">
                <IconButton label={`Move ${label} up`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp aria-hidden size={20} /></IconButton>
                <IconButton label={`Move ${label} down`} disabled={i === entries.length - 1} onClick={() => move(i, 1)}><ArrowDown aria-hidden size={20} /></IconButton>
                <IconButton label={`Remove ${label}`} onClick={() => onChange(entries.filter((_, j) => j !== i))}><Trash2 aria-hidden size={20} /></IconButton>
              </div>
            </li>
          );
        })}
      </ol>
      <Button variant="tonal" icon={<Plus aria-hidden size={18} />} onClick={() => onChange([...entries, emptyEntry()])}>{copy.add}</Button>
    </Card>
  );
}

/** The real PDF, redrawn a moment after typing stops. */
function Preview({ resume }: { resume: Resume }) {
  const [pages, setPages] = useState<string[]>([]);
  const [dropped, setDropped] = useState<string[]>([]);
  const urls = useRef<string[]>([]);
  const key = useMemo(() => JSON.stringify(resume), [resume]);

  // Redraw when the content changes (key), not on every new object with the same content.
  useEffect(() => {
    let cancelled = false;
    const t = window.setTimeout(async () => {
      const [{ renderResume }, { openForView, thumbnails }] = await Promise.all([loadResumePdf(), loadRender()]);
      const result = await renderResume(resume);
      const doc = await openForView(result.bytes);
      const next = await thumbnails(doc, 560);
      void doc.loadingTask.destroy();
      if (cancelled) { next.forEach((u) => URL.revokeObjectURL(u)); return; }
      urls.current.forEach((u) => URL.revokeObjectURL(u));
      urls.current = next;
      setPages(next);
      setDropped(result.dropped);
    }, 600);
    return () => { cancelled = true; window.clearTimeout(t); };
  }, [key]);
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  return (
    <section className="hp-card options" aria-labelledby="rb-preview">
      <h2 id="rb-preview" className="resume-card__title">Preview</h2>
      {dropped.length > 0 && <Note tone="warn">These characters can’t be printed with standard resume fonts and show as “?”: {dropped.join(' ')}</Note>}
      {pages.length > 1 && <p className="options__hint">{pages.length} pages. One page is best with under 10 years of experience.</p>}
      <div className="resume-preview" aria-live="polite">
        {pages.length === 0 ? <div className="resume-preview__empty">Preparing preview…</div>
          : pages.map((src, i) => <img key={src} src={src} alt={`Page ${i + 1} of your resume`} />)}
      </div>
    </section>
  );
}
