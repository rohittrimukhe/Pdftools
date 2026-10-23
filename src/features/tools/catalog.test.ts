import { describe, expect, it } from 'vitest';
import { QUICK_TOOL_IDS, TOOLS, findTool, searchTools } from './catalog';

describe('tool catalog', () => {
  it('has unique ids and every quick tool exists', () => {
    expect(new Set(TOOLS.map((t) => t.id)).size).toBe(TOOLS.length);
    for (const id of QUICK_TOOL_IDS) expect(findTool(id), id).toBeDefined();
  });

  it('finds tools by name, keyword and everyday words', () => {
    expect(searchTools('merge')[0]?.id).toBe('merge');
    expect(searchTools('combine')[0]?.id).toBe('merge');
    expect(searchTools('50kb')[0]?.id).toBe('exact-size');
    expect(searchTools('ssc photo')[0]?.id).toBe('exact-size');
    expect(searchTools('jpg').map((t) => t.id)).toContain('image-to-pdf');
    expect(searchTools('password').map((t) => t.id)).toEqual(expect.arrayContaining(['protect', 'unlock']));
  });

  it('ignores case, accents and extra spaces, and requires every word', () => {
    expect(searchTools('  COMPRÉSS  ')[0]?.id).toBe('compress');
    expect(searchTools('merge zebra')).toEqual([]);
    expect(searchTools('')).toHaveLength(TOOLS.length);
  });
});

import { TOOL_SCREENS } from '../../tools/registry';
import { isReady } from './catalog';

describe('shipped tools', () => {
  it('every tool marked ready has a screen, and every screen is in the catalog', () => {
    for (const tool of TOOLS.filter(isReady)) expect(TOOL_SCREENS[tool.id], tool.id).toBeDefined();
    for (const id of Object.keys(TOOL_SCREENS)) expect(findTool(id), id).toBeDefined();
  });
});
