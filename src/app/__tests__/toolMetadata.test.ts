import { describe, expect, it } from 'vitest';
import { en } from '@/i18n/en';
import { ja } from '@/i18n/ja';
import { getToolForShortcutKey, getToolLabel, getToolStatusLabel, TOOL_SHORTCUTS, TOOL_SHORTCUTS_BY_KEY } from '../toolMetadata';

describe('tool metadata', () => {
  it('localizes active tool labels', () => {
    expect(getToolLabel('column', en)).toBe('Column');
    expect(getToolLabel('column', ja)).toBe('柱');
    expect(getToolLabel('xline', ja)).toBe('補助線');
  });

  it('adds shortcut hints only for shortcut-backed tools', () => {
    expect(TOOL_SHORTCUTS_BY_KEY.b).toBe('beam');
    expect(getToolForShortcutKey('B')).toBe('beam');
    expect(getToolForShortcutKey('toString')).toBeUndefined();
    expect(TOOL_SHORTCUTS.beam).toBe('B');
    expect(getToolStatusLabel('beam', en)).toBe('Beam (B)');
    expect(getToolStatusLabel('trim', en)).toBe('Trim');
  });
});
