/**
 * An applicant-tracking-system style check, on this device. Two parts:
 * - Match: which important words from the job post the resume uses.
 * - Basics: what parsers and recruiters look for (contact details, sections,
 *   length, numbers in achievements, strong verbs).
 * Every point comes with the reason, so the score is never a mystery.
 */

export interface AtsCheck {
  id: string;
  label: string;
  passed: boolean;
  weight: number;
  /** What to do when it fails; what was found when it passes. */
  detail: string;
}

export interface AtsReport {
  /** 0–100. With a job post: 60% match, 40% basics. Without: basics only. */
  score: number;
  match: { score: number; found: string[]; missing: string[] } | null;
  basicsScore: number;
  checks: AtsCheck[];
  stats: { words: number; achievementLines: number; quantified: number; actionVerbs: number };
}

export interface AtsInput {
  resume: string;
  job?: string;
  /** Pages, when the resume came from a PDF. */
  pages?: number;
}

// Words that say nothing about the job itself.
const STOP = new Set(`a about above across after again against all also am an and any are as at be because been before being below between both but by can could did do does doing down during each etc few for from further had has have having he her here hers him his how i if in into is it its itself just me more most my no nor not now of off on once only or other our ours out over own same she should so some such than that the their theirs them then there these they this those through to too under until up very was we were what when where which while who whom why will with would you your yours
  ability able across activities additional apply applicant applicants based benefits best candidate candidates company competitive cross culture day days degree desired develop developing duties environment equal excellent including experience experienced field fast following full functional good great help hiring ideal including job join key knowledge least level looking make must new nice offer opportunity opportunities paced part per plus position preferred program provide qualifications related required requirement requirements responsibilities responsible role salary should skill skills strong success successful support team teams time understanding using want week well will work working world year years`.split(/\s+/));

// Common multi-word skills, matched as phrases so "machine learning" isn't two vague words.
const PHRASES = [
  'machine learning', 'deep learning', 'data analysis', 'data science', 'data engineering', 'data visualization', 'project management', 'product management',
  'customer service', 'customer success', 'stakeholder management', 'business analysis', 'financial analysis', 'financial modeling', 'digital marketing',
  'content marketing', 'social media', 'search engine optimization', 'supply chain', 'quality assurance', 'test automation', 'unit testing',
  'continuous integration', 'ci/cd', 'react native', 'node.js', 'next.js', 'vue.js', 'power bi', 'google analytics', 'microsoft excel', 'ms excel',
  'sql server', 'rest api', 'rest apis', 'graphql', 'system design', 'design systems', 'user research', 'ux design', 'ui design', 'agile', 'scrum',
  'natural language processing', 'computer vision', 'cloud computing', 'amazon web services', 'google cloud', 'microsoft azure', 'spring boot',
  'object oriented', 'problem solving', 'team leadership', 'people management', 'sales strategy', 'lead generation', 'accounts payable',
  'accounts receivable', 'general ledger', 'risk management', 'change management', 'public speaking', 'technical writing',
  'a/b testing', 'big data', 'patient care', 'vital signs', 'registered nurse', 'customer support', 'cold calling', 'inside sales', 'field sales', 'key account management', 'business intelligence', 'web development', 'mobile development', 'unit tests', 'version control',
];

// Single words that are skills or tools in their own right, even when a job post mentions them once.
const SKILL_WORDS = new Set(`accessibility accounting airflow analytics android angular ansible auditing autocad aws azure bigquery bootstrap budgeting
  c c++ c# canva catia communication compliance confluence copywriting crm css cypress dashboards databricks dbt devops django docker dotnet
  editing erp etl excel figma flask flutter forecasting gcp git github golang go graphql gst hadoop html illustrator ios java javascript jenkins jest jira
  junit kafka kotlin kubernetes laravel leadership linux llm looker marketing matlab microservices mongodb mysql negotiation nlp node.js numpy onboarding
  opencv pandas payroll photoshop php playwright postgresql powerpoint presentation pytest python pytorch r rails react recruitment redis redux reporting
  research revit ruby rust salesforce sap sas sass scala scikit-learn selenium seo sem snowflake solidworks spark spss sql statistics swift tableau tailwind
  tally taxation teaching tensorflow terraform testing typescript vue webpack wordpress`.split(/\s+/));

// Strong ways to start an achievement line.
const ACTION_VERBS = new Set(`accelerated achieved added analysed analyzed architected automated boosted built championed coached collaborated completed created cut decreased defined delivered designed developed directed doubled drove earned eliminated enabled engineered established exceeded expanded generated grew guided handled headed identified implemented improved increased initiated introduced launched led maintained managed mentored migrated modernized negotiated optimised optimized organised organized oversaw owned partnered pioneered planned produced raised rebuilt redesigned reduced refactored resolved restructured revamped saved scaled secured shipped simplified solved spearheaded streamlined strengthened supervised taught tested trained transformed tripled upgraded won wrote`.split(/\s+/));

/** Lowercase, with the punctuation that's part of skill names kept (c++, c#, node.js, ci/cd). */
export function normalize(text: string): string {
  return text.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9+#./\s-]/g, ' ').replace(/(?<![a-z0-9])[./-]|[./-](?![a-z0-9+#])/g, ' ').replace(/\s+/g, ' ').trim();
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Is the term in the text, as a whole word, singular or plural? */
export function mentions(normalizedText: string, term: string): boolean {
  const t = escape(term);
  const variants = term.endsWith('s') && term.length > 3 ? `${t}|${escape(term.slice(0, -1))}` : `${t}|${t}s|${t}es`;
  return new RegExp(`(?<![a-z0-9+#])(?:${variants})(?![a-z0-9+#])`).test(normalizedText);
}

/** The words and phrases a job post cares about most, most important first. */
export function jobKeywords(job: string, limit = 25): string[] {
  const norm = normalize(job);
  const scores = new Map<string, number>();
  const bump = (term: string, by: number) => scores.set(term, (scores.get(term) ?? 0) + by);

  for (const phrase of PHRASES) if (mentions(norm, phrase)) bump(phrase, 4);
  const phraseWords = new Set([...scores.keys()].flatMap((p) => p.split(/[\s/]/)));

  // A capitalised word in the middle of a sentence is usually the name of a tool (Kubernetes, SAP, Pandas).
  const named = new Set<string>();
  for (const m of job.matchAll(/(?<=(?:[a-z0-9,;(/&]|\band|\bor)\s*)(?<![.:!?]\s*)([A-Z][A-Za-z0-9+#.]*[A-Za-z0-9+#]|[A-Z]{2,}[A-Za-z0-9]*)/g)) named.add(normalize(m[1]!));
  for (const m of job.matchAll(/(?<![\w.])[A-Za-z][\w.]*[+#][\w+#]*|\b\w+\.(?:js|net|io)\b/g)) named.add(normalize(m[0]));
  // Acronyms (BLS, GST, AWS) count wherever they appear, even first in a sentence.
  for (const m of job.matchAll(/\b[A-Z]{2,6}\b/g)) named.add(m[0].toLowerCase());

  for (const word of norm.split(' ')) {
    if (STOP.has(word) || /^\d/.test(word) || phraseWords.has(word) || (word.length < 2 && !SKILL_WORDS.has(word))) continue;
    bump(word, 1 + (named.has(word) ? 2 : 0) + (SKILL_WORDS.has(word) ? 3 : 0));
  }
  return [...scores.entries()]
    .filter(([, score]) => score >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([term]) => term);
}

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const PHONE = /(?:\+?\d[\d\s().-]{7,}\d)/;
const YEAR = /\b(19[6-9]\d|20[0-4]\d)\b/;

function hasHeading(text: string, names: string[]): boolean {
  return names.some((n) => new RegExp(`(^|\\n)\\s*${n}\\s*:?\\s*(\\n|$)`, 'i').test(text));
}

/** Lines that describe something done: a bullet, or a sentence of six words or more under a role. */
function achievementLines(text: string): string[] {
  return text.split(/\n/).map((l) => l.trim()).filter((l) => /^[•●▪◦*-]/.test(l) || l.split(/\s+/).length >= 6)
    .map((l) => l.replace(/^[•●▪◦*-]\s*/, ''))
    .filter((l) => !EMAIL.test(l) && l.split(/\s+/).length >= 4);
}

export function scoreResume({ resume, job, pages }: AtsInput): AtsReport {
  const norm = normalize(resume);
  const words = resume.split(/\s+/).filter(Boolean).length;
  const achievements = achievementLines(resume);
  const quantified = achievements.filter((l) => /\d|%|₹|\$|€|£/.test(l)).length;
  const verbs = achievements.filter((l) => ACTION_VERBS.has(l.split(/\s+/)[0]!.toLowerCase().replace(/[^a-z]/g, ''))).length;
  const share = (n: number) => (achievements.length ? n / achievements.length : 0);
  const pct = (n: number) => `${Math.round(share(n) * 100)}%`;

  const check = (id: string, label: string, weight: number, passed: boolean, fix: string, ok = 'Found.'): AtsCheck =>
    ({ id, label, weight, passed, detail: passed ? ok : fix });
  const longOrShort = words < 250 ? `${words} words is thin. Aim for 400–800: add results to each role.`
    : `${words} words${pages ? ` on ${pages} pages` : ''} is long. Keep it to 1–2 pages; cut older or less relevant detail.`;
  const noBullets = achievements.length === 0;

  const checks: AtsCheck[] = [
    check('email', 'Email address', 10, EMAIL.test(resume), 'Add an email address at the top, so recruiters can reach you.'),
    check('phone', 'Phone number', 8, PHONE.test(resume), 'Add a phone number with the country code, e.g. +91.'),
    check('experience', '“Experience” section', 12, hasHeading(resume, ['experience', 'work experience', 'professional experience', 'employment', 'employment history', 'work history', 'internships?']),
      'Use a heading ATS software recognises: “Experience” or “Work experience”.'),
    check('education', '“Education” section', 8, hasHeading(resume, ['education', 'academic background', 'qualifications', 'academics']), 'Add an “Education” heading with your degree and school.'),
    check('skills', '“Skills” section', 10, hasHeading(resume, ['skills', 'technical skills', 'key skills', 'core skills', 'skills & tools', 'core competencies']),
      'Add a “Skills” heading listing your tools and strengths: ATS software reads it first.'),
    check('length', 'Length', 10, words >= 250 && words <= 1000 && (pages === undefined || pages <= 2), longOrShort,
      `${words} words${pages ? ` on ${pages} page${pages > 1 ? 's' : ''}` : ''}: a good length.`),
    check('numbers', 'Results with numbers', 14, share(quantified) >= 0.3,
      noBullets ? 'Describe each role with bullet points of what you achieved.' : `Only ${pct(quantified)} of achievements include a number. Add results: %, ₹, time saved, people led.`,
      `${pct(quantified)} of achievements include a number. Great.`),
    check('verbs', 'Strong action verbs', 10, share(verbs) >= 0.4,
      noBullets ? 'Start each bullet with a verb such as Led, Built or Reduced.' : `Only ${pct(verbs)} of achievements start with a strong verb. Start with Led, Built, Reduced, Launched…`,
      `${pct(verbs)} of achievements start with a strong verb.`),
    check('dates', 'Dates for roles', 8, YEAR.test(resume), 'Add start and end dates (month and year) for each role and degree.'),
    check('pronouns', 'No “I” or “my”', 4, !/\b(i|my|me)\b/.test(norm.replace(/\bi\.e\b/g, '')), 'Resumes read better without “I” and “my”: start with the verb instead.', 'None found.'),
    check('linkedin', 'LinkedIn or portfolio link', 6, /linkedin\.com|github\.com|behance\.net|dribbble\.com|portfolio|https?:\/\//i.test(resume), 'Add your LinkedIn or portfolio link.'),
  ];

  const total = checks.reduce((n, c) => n + c.weight, 0);
  const basicsScore = Math.round((checks.reduce((n, c) => n + (c.passed ? c.weight : 0), 0) / total) * 100);

  let match: AtsReport['match'] = null;
  const terms = job?.trim() ? jobKeywords(job) : [];
  if (terms.length) {
    const found = terms.filter((t) => mentions(norm, t));
    const missing = terms.filter((t) => !found.includes(t));
    // Earlier terms matter more: weight 2 for the top third.
    const weightOf = (i: number) => (i < Math.ceil(terms.length / 3) ? 2 : 1);
    const got = terms.reduce((n, t, i) => n + (found.includes(t) ? weightOf(i) : 0), 0);
    const all = terms.reduce((n, _t, i) => n + weightOf(i), 0);
    match = { score: Math.round((got / all) * 100), found, missing };
  }
  const score = match ? Math.round(match.score * 0.6 + basicsScore * 0.4) : basicsScore;
  return { score, match, basicsScore, checks, stats: { words, achievementLines: achievements.length, quantified, actionVerbs: verbs } };
}

/** A one-word verdict for the score. */
export const verdict = (score: number) => (score >= 80 ? 'Strong' : score >= 60 ? 'Good' : score >= 40 ? 'Fair' : 'Needs work');
