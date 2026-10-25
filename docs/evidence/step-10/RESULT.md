# Step 10 — Resume builder and resume score

**Date:** 2026-10-25  **Result:** done; both tools are live in the app (Career section)

## What was built
- **Resume builder** (`/tools/resume-builder`)
  - Form: about you; experience, projects and education (add, move, remove); skills; certifications.
  - Three templates (Classic, Modern, Compact) and A4 or US Letter paper.
  - **Live preview** of the real PDF, redrawn a moment after typing stops.
  - **Create PDF** makes a text PDF: one column, standard fonts, no tables or images, metadata set. ATS software reads every word in order.
  - The draft is saved on this device as you type. **Save backup** / **Restore backup** move it to another device as a `.json` file; **Start over** deletes it.
  - Characters the standard fonts can't print are swapped where possible (₹ → Rs., ë kept, ő → o). Anything else is listed as a warning, never silently lost.
- **Resume score** (`/tools/resume-score`)
  - Checks the builder resume, an uploaded PDF, or pasted text, against an optional job post.
  - **Keyword match:** the job post's most important words and phrases (tools, skills, acronyms such as GST, BLS, AWS), split into found and missing.
  - **Basics:** email, phone, the Experience / Education / Skills headings, length, results with numbers, strong action verbs, dates, no "I/my", a LinkedIn or portfolio link.
  - Each check says why it passed or what to do. Score = 60% keyword match + 40% basics, or basics alone without a job post.
  - A scanned or image-only PDF is flagged: ATS software sees it as empty.
- Everything runs on the device; the score screen shows the "0 bytes uploaded" badge too.

## Checks
| Check | Result |
|---|---|
| Unit tests | 78 of 78 passed (15 new: model, PDF layout, keyword finding, scoring) |
| Browser tests | 146 of 146 passed, phone and desktop (12 new) |
| Resume PDF readable by software | All three templates read back in order with pdf.js: name, contact, EXPERIENCE before EDUCATION before SKILLS |
| Long resume | Flows onto page 2 with nothing cut off; long links wrap |
| Keywords outside tech | Accounts post finds general ledger, accounts payable, GST, Tally, Excel, MIS; nursing post finds ICU, patient care, vital signs, BLS, ACLS |
| Accessibility | Both screens pass the WCAG 2.1 AA scan when filled in |
| Lighthouse, Resume builder (mobile) | Performance **96**, Accessibility **100**, Best practices **100**, SEO **100** (LCP 2.6 s, TBT 10 ms) |
| Desktop app type check | Still passes with the new files |

Screenshots: `rb-*.png` (builder on phone and desktop), `rs-*.png` (score).

## Bugs found and fixed
1. **Keyword finder missed real skills and picked up junk.** On a data-analyst post it missed Pandas, dbt, statistics and A/B testing, and picked up "2+" and "Analyse" (a capital only because it began a sentence).
   - Fix: a vocabulary of common skills and tools; tool names are now spotted only in the middle of a sentence; acronyms count anywhere; anything starting with a digit is ignored.
   - Unit tests now cover data, accounts and nursing posts.
2. **The example could overwrite your work.** "Fill with an example" was always shown. It now appears only while the resume is empty.
