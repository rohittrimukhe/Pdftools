import { describe, expect, it } from 'vitest';
import { emptyResume, normalizeResume, resumeText, sampleResume, lines, skillList } from './model';
import { drawable, renderResume } from './pdf';
import { jobKeywords, mentions, normalize, scoreResume } from './ats';
import { readPdf } from '../pdf/testing';

describe('resume model', () => {
  it('splits bullets and skills the way people type them', () => {
    expect(lines('- Led a team\n• Cut costs\n\n  Shipped v2  ')).toEqual(['Led a team', 'Cut costs', 'Shipped v2']);
    expect(skillList('React, TypeScript\nSQL; Git')).toEqual(['React', 'TypeScript', 'SQL', 'Git']);
  });
  it('repairs anything imported into a valid resume', () => {
    const r = normalizeResume({ name: 'A', template: 'nope', paper: 'letter', experience: [{ title: 5, bullets: 'x' }], extra: true });
    expect(r.template).toBe('modern');
    expect(r.paper).toBe('letter');
    expect(r.experience[0]).toMatchObject({ title: '', bullets: 'x' });
    expect(r.experience[0]!.id).toBeTruthy();
    expect(normalizeResume(null)).toMatchObject({ version: 1, experience: [], skills: '' });
  });
  it('lists the text in reading order, skipping empty sections', () => {
    const text = resumeText({ ...emptyResume(), name: 'Asha', skills: 'React' });
    expect(text).toBe('Asha\nSkills\nReact');
  });
});

describe('resume PDF', () => {
  it('keeps what the font can draw and swaps the rest', () => {
    const supported = new Set([...'Rs. 5 Zoe-> abc'].map((c) => c.codePointAt(0)!));
    expect(drawable('₹5', supported)).toEqual({ text: 'Rs.5', dropped: [] });
    expect(drawable('Zoë', new Set([...supported, 'ë'.codePointAt(0)!]))).toEqual({ text: 'Zoë', dropped: [] });
    expect(drawable('Zoë', supported).text).toBe('Zoe');
    expect(drawable('a漢b', supported)).toEqual({ text: 'a?b', dropped: ['漢'] });
  });

  it.each(['classic', 'modern', 'compact'] as const)('the %s template is a one-page text PDF ATS software can read in order', async (template) => {
    const { bytes, pages, dropped } = await renderResume({ ...sampleResume(), template });
    expect(pages).toBe(1);
    expect(dropped).toEqual([]);
    const [page] = await readPdf(bytes);
    const text = page!.text;
    for (const part of ['Asha Verma', 'asha.verma@example.com', 'EXPERIENCE', 'Senior Frontend Engineer', 'Brightpath Labs', 'Mar 2022 – Present', 'Cut median page load time by 45%', 'EDUCATION', 'SKILLS', 'Playwright']) {
      expect(text).toContain(part);
    }
    expect(text.indexOf('EXPERIENCE')).toBeLessThan(text.indexOf('EDUCATION'));
    expect(text.indexOf('EDUCATION')).toBeLessThan(text.indexOf('SKILLS'));
  });

  it('flows onto a second page instead of cutting text off, on Letter paper too', async () => {
    const long = sampleResume();
    long.paper = 'letter';
    long.experience = Array.from({ length: 12 }, (_, i) => ({ ...long.experience[0]!, id: `x${i}`, title: `Role ${i + 1}` }));
    const { bytes, pages } = await renderResume(long);
    expect(pages).toBeGreaterThan(1);
    const all = (await readPdf(bytes)).map((p) => p.text).join(' ');
    expect(all).toContain('Role 1 ');
    expect(all).toContain('Role 12');
    expect(all).toContain('SKILLS');
  });

  it('breaks a very long link instead of running off the page', async () => {
    const r = { ...emptyResume(), name: 'A', links: `https://example.com/${'x'.repeat(200)}` };
    const [page] = await readPdf((await renderResume(r)).bytes);
    expect(page!.text.replace(/\s/g, '')).toContain('x'.repeat(200));
  });
});

const JOB = `We are hiring a Frontend Engineer to build our web app in React and TypeScript.
You will work with Node.js services, write tests with Playwright and Jest, and care about accessibility.
Experience with GraphQL, CI/CD and AWS is a plus. Strong communication skills required. React experience is a must.`;

describe('ATS score', () => {
  it('normalises text but keeps skill names whole', () => {
    expect(normalize('C++, C#, Node.js & CI/CD.')).toBe('c++ c# node.js ci/cd');
    expect(mentions(normalize('Built REST APIs'), 'rest api')).toBe(true);
    expect(mentions(normalize('Java developer'), 'javascript')).toBe(false);
    expect(mentions(normalize('Used Javascript'), 'java')).toBe(false);
  });

  it('finds the words a job post cares about and ignores filler', () => {
    const terms = jobKeywords(JOB);
    for (const t of ['react', 'typescript', 'node.js', 'playwright', 'graphql', 'ci/cd', 'aws']) expect(terms).toContain(t);
    for (const t of ['we', 'experience', 'strong', 'required', 'work', 'skills']) expect(terms).not.toContain(t);
    expect(terms[0]).toBe('react');
  });

  it('scores a matching resume high and names what is missing', () => {
    const report = scoreResume({ resume: resumeText(sampleResume()), job: JOB });
    expect(report.match!.found).toEqual(expect.arrayContaining(['react', 'typescript', 'playwright', 'node.js']));
    expect(report.match!.missing).toEqual(expect.arrayContaining(['graphql', 'aws']));
    expect(report.basicsScore).toBeGreaterThanOrEqual(90);
    expect(report.score).toBeGreaterThanOrEqual(60);
    expect(report.checks.find((c) => c.id === 'numbers')!.passed).toBe(true);
  });

  it('explains what a weak resume lacks', () => {
    const report = scoreResume({ resume: 'Rahul\nI worked on many things at my company\nI was responsible for the website and also did other tasks there' });
    expect(report.match).toBeNull();
    expect(report.score).toBeLessThan(40);
    const failed = report.checks.filter((c) => !c.passed).map((c) => c.id);
    expect(failed).toEqual(expect.arrayContaining(['email', 'phone', 'experience', 'skills', 'numbers', 'verbs', 'pronouns', 'length']));
    expect(report.checks.find((c) => c.id === 'numbers')!.detail).toMatch(/Only 0% of achievements include a number/);
  });

  it('flags a resume that runs past two pages', () => {
    const report = scoreResume({ resume: resumeText(sampleResume()), pages: 3 });
    expect(report.checks.find((c) => c.id === 'length')).toMatchObject({ passed: false });
  });
});

describe('job keywords outside tech', () => {
  it('works for accounts and nursing posts too', () => {
    expect(jobKeywords('Accounts Executive. Maintain the general ledger, handle accounts payable and GST filing in Tally. Prepare monthly MIS reports in Excel.'))
      .toEqual(expect.arrayContaining(['general ledger', 'accounts payable', 'gst', 'tally', 'excel', 'mis']));
    expect(jobKeywords('Registered Nurse needed for our ICU. Provide patient care and monitor vital signs. BLS and ACLS certification required.'))
      .toEqual(expect.arrayContaining(['registered nurse', 'icu', 'patient care', 'vital signs', 'bls', 'acls']));
  });
});
