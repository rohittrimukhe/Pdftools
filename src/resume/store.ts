import { normalizeResume, type Resume } from './model';

/**
 * The resume being written, kept in this browser's storage so it survives a
 * reload. It never leaves the device; "Delete draft" removes it.
 */
const KEY = 'hp.resume.draft';

export function loadDraft(): Resume | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? normalizeResume(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function saveDraft(resume: Resume) {
  try { localStorage.setItem(KEY, JSON.stringify(resume)); } catch { /* storage full or blocked: the draft lives for this visit only */ }
}

export function deleteDraft() {
  try { localStorage.removeItem(KEY); } catch { /* nothing to delete */ }
}
