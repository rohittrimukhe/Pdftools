/**
 * A small XML reader for Office files (and mammoth's HTML), the same in the
 * browser and in tests. Names keep their prefixes ("w:t", "a:r").
 */
export interface XmlNode { name: string; attrs: Record<string, string>; children: XmlNode[]; text: string }

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
export const decodeEntities = (s: string) => s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) =>
  e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENTITIES[e] ?? m);

const VOID = new Set(['img', 'br', 'hr', 'meta', 'link', 'input', 'col']);

export function parseXml(source: string): XmlNode {
  const root: XmlNode = { name: '#root', attrs: {}, children: [], text: '' };
  const stack: XmlNode[] = [root];
  const re = /<!\[CDATA\[([\s\S]*?)\]\]>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|<\/([^\s>]+)\s*>|<([^\s/>]+)((?:\s+[^\s=/>]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>|([^<]+)/gi;
  for (const m of source.matchAll(re)) {
    const top = stack[stack.length - 1]!;
    if (m[1] !== undefined) { top.children.push({ name: '#text', attrs: {}, children: [], text: m[1] }); continue; }
    if (m[2] !== undefined) {
      const name = m[2];
      for (let i = stack.length - 1; i > 0; i--) if (stack[i]!.name === name) { stack.length = i; break; }
      continue;
    }
    if (m[3] !== undefined) {
      const attrs: Record<string, string> = {};
      for (const a of (m[4] ?? '').matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) attrs[a[1]!] = decodeEntities(a[2] ?? a[3] ?? a[4] ?? '');
      const node: XmlNode = { name: m[3], attrs, children: [], text: '' };
      top.children.push(node);
      if (!m[5] && !VOID.has(m[3].toLowerCase())) stack.push(node);
      continue;
    }
    if (m[6] !== undefined && m[6].trim() !== '' || (m[6] && top.name !== '#root')) top.children.push({ name: '#text', attrs: {}, children: [], text: decodeEntities(m[6]!) });
  }
  return root;
}

/** Direct children with this name. */
export const kids = (n: XmlNode | undefined, name: string) => (n ? n.children.filter((c) => c.name === name) : []);
export const kid = (n: XmlNode | undefined, name: string) => n?.children.find((c) => c.name === name);
/** All descendants with this name, in document order. */
export function all(n: XmlNode | undefined, name: string, out: XmlNode[] = []): XmlNode[] {
  if (!n) return out;
  for (const c of n.children) { if (c.name === name) out.push(c); all(c, name, out); }
  return out;
}
/** First descendant with this name. */
export const find = (n: XmlNode | undefined, name: string): XmlNode | undefined => {
  if (!n) return undefined;
  for (const c of n.children) { if (c.name === name) return c; const f = find(c, name); if (f) return f; }
  return undefined;
};
/** All text inside, in order. */
export const textOf = (n: XmlNode | undefined): string => (!n ? '' : n.name === '#text' ? n.text : n.children.map(textOf).join(''));
