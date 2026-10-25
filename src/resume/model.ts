/**
 * A resume as the builder edits it. Plain strings throughout so every field is a
 * simple text box; bullets are one per line. Saved only on this device.
 */
export type TemplateId = 'classic' | 'modern' | 'compact';
export type Paper = 'a4' | 'letter';

export interface Entry {
  id: string;
  /** Job title, project name or degree. */
  title: string;
  /** Company, client or school. */
  org: string;
  location: string;
  start: string;
  end: string;
  /** One bullet per line. */
  bullets: string;
}

export interface Resume {
  version: 1;
  template: TemplateId;
  /** A4 for most of the world, Letter for the US and Canada. */
  paper: Paper;
  name: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  /** LinkedIn, portfolio, GitHub: one per line. */
  links: string;
  summary: string;
  experience: Entry[];
  projects: Entry[];
  education: Entry[];
  /** Comma or line separated. */
  skills: string;
  /** One per line. */
  certifications: string;
}

export type EntryList = 'experience' | 'projects' | 'education';

export const TEMPLATES: ReadonlyArray<{ id: TemplateId; name: string; blurb: string }> = [
  { id: 'classic', name: 'Classic', blurb: 'Serif, centred name. Law, finance, government.' },
  { id: 'modern', name: 'Modern', blurb: 'Sans serif with a colour rule. Most jobs.' },
  { id: 'compact', name: 'Compact', blurb: 'Smaller type to fit more on one page.' },
];

let counter = 0;
export const newId = () => `e${Date.now().toString(36)}${(counter++).toString(36)}`;

export const emptyEntry = (): Entry => ({ id: newId(), title: '', org: '', location: '', start: '', end: '', bullets: '' });

export const emptyResume = (): Resume => ({
  version: 1, template: 'modern', paper: 'a4', name: '', headline: '', email: '', phone: '', location: '', links: '', summary: '',
  experience: [emptyEntry()], projects: [], education: [emptyEntry()], skills: '', certifications: '',
});

export const lines = (text: string) => text.split(/\r?\n/).map((l) => l.replace(/^\s*[-•*–·]\s*/, '').trim()).filter(Boolean);
export const skillList = (text: string) => text.split(/[,\n;]/).map((s) => s.trim()).filter(Boolean);

const str = (v: unknown, max = 4000) => (typeof v === 'string' ? v.slice(0, max) : '');

function entryFrom(v: unknown): Entry {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  return { id: str(o.id, 40) || newId(), title: str(o.title, 200), org: str(o.org, 200), location: str(o.location, 200), start: str(o.start, 40), end: str(o.end, 40), bullets: str(o.bullets) };
}

/** Accepts anything (an old draft, an imported file) and returns a valid resume. */
export function normalizeResume(value: unknown): Resume {
  const o = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const list = (v: unknown) => (Array.isArray(v) ? v.slice(0, 30).map(entryFrom) : []);
  const template = TEMPLATES.some((t) => t.id === o.template) ? (o.template as TemplateId) : 'modern';
  return {
    version: 1, template, paper: o.paper === 'letter' ? 'letter' : 'a4',
    name: str(o.name, 120), headline: str(o.headline, 200), email: str(o.email, 200), phone: str(o.phone, 60),
    location: str(o.location, 200), links: str(o.links, 1000), summary: str(o.summary),
    experience: list(o.experience), projects: list(o.projects), education: list(o.education),
    skills: str(o.skills), certifications: str(o.certifications),
  };
}

export const isBlank = (entry: Entry) => !entry.title.trim() && !entry.org.trim() && !entry.bullets.trim();

/** "Jan 2022 – Present", "2019 – 2023", "2021", or "". */
export function dateRange(start: string, end: string): string {
  const s = start.trim();
  const e = end.trim();
  if (s && e) return `${s} – ${e}`;
  return s || e;
}

/** All the text of a resume in reading order, for the score and for tests. */
export function resumeText(r: Resume): string {
  const entries = (list: Entry[]) => list.filter((e) => !isBlank(e)).map((e) => [e.title, e.org, e.location, dateRange(e.start, e.end), ...lines(e.bullets)].join('\n'));
  return [
    r.name, r.headline, r.email, r.phone, r.location, ...lines(r.links),
    r.summary ? `Summary\n${r.summary}` : '',
    r.experience.some((e) => !isBlank(e)) ? `Experience\n${entries(r.experience).join('\n')}` : '',
    r.projects.some((e) => !isBlank(e)) ? `Projects\n${entries(r.projects).join('\n')}` : '',
    r.education.some((e) => !isBlank(e)) ? `Education\n${entries(r.education).join('\n')}` : '',
    r.skills.trim() ? `Skills\n${skillList(r.skills).join(', ')}` : '',
    r.certifications.trim() ? `Certifications\n${lines(r.certifications).join('\n')}` : '',
  ].filter(Boolean).join('\n');
}

/** A filled-in example, so the preview and the score have something to show. */
export function sampleResume(): Resume {
  return {
    ...emptyResume(),
    name: 'Asha Verma',
    headline: 'Frontend Engineer',
    email: 'asha.verma@example.com',
    phone: '+91 98765 43210',
    location: 'Pune, India',
    links: 'linkedin.com/in/ashaverma\ngithub.com/ashaverma',
    summary: 'Frontend engineer with 5 years of experience building fast, accessible web apps in React and TypeScript. Led a design system used by 40 engineers and cut page load time by 45%.',
    experience: [
      { id: newId(), title: 'Senior Frontend Engineer', org: 'Brightpath Labs', location: 'Pune', start: 'Mar 2022', end: 'Present', bullets: 'Led the React design system used by 40 engineers across 6 product teams\nCut median page load time by 45% by splitting bundles and lazy loading routes\nMentored 4 junior engineers; 2 promoted within a year' },
      { id: newId(), title: 'Frontend Engineer', org: 'Kitebox', location: 'Bengaluru', start: 'Jul 2019', end: 'Feb 2022', bullets: 'Built the checkout flow in React and TypeScript, raising conversion by 12%\nWrote end-to-end tests with Playwright, reducing production bugs by 30%' },
    ],
    projects: [
      { id: newId(), title: 'Open-source date picker', org: 'GitHub', location: '', start: '2021', end: '', bullets: 'Accessible date picker with 1,200 stars and 15 contributors' },
    ],
    education: [
      { id: newId(), title: 'B.Tech, Computer Engineering', org: 'Pune University', location: 'Pune', start: '2015', end: '2019', bullets: 'CGPA 8.6 / 10' },
    ],
    skills: 'React, TypeScript, JavaScript, HTML, CSS, Node.js, Playwright, Accessibility (WCAG), Performance, Git',
    certifications: 'Google UX Design Certificate (2023)',
  };
}
