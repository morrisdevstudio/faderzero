import { describe, it, expect, beforeEach } from 'vitest';
import {
  getWorkspaceColorOption,
  setWorkspaceBadgeColor,
  WORKSPACE_COLOR_OPTIONS,
} from './workspaceColors';

describe('workspaceColors service', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns default fallback color option when no workspaceId is provided', () => {
    const color = getWorkspaceColorOption(null);
    expect(color).toBeDefined();
    expect(color.id).toBe(WORKSPACE_COLOR_OPTIONS[0]?.id);
  });

  it('saves and retrieves badge color per workspace in localStorage', () => {
    const workspaceId = 'ws-test-123';
    const targetColor = WORKSPACE_COLOR_OPTIONS[2];
    expect(targetColor).toBeDefined();

    if (targetColor) {
      setWorkspaceBadgeColor(workspaceId, targetColor.id);
      const retrievedColor = getWorkspaceColorOption(workspaceId);
      expect(retrievedColor.id).toBe(targetColor.id);
      expect(retrievedColor.hex).toBe(targetColor.hex);
    }
  });

  it('returns consistent deterministic hash fallback when no color is explicitly set', () => {
    const color1 = getWorkspaceColorOption('ws-alpha');
    const color2 = getWorkspaceColorOption('ws-alpha');
    expect(color1.id).toBe(color2.id);
  });

  it('allows customizing badge color for personal workspace', () => {
    const personalId = 'ws-personal';
    const initialColor = getWorkspaceColorOption(personalId, 'personal');
    expect(initialColor.id).toBe(WORKSPACE_COLOR_OPTIONS[0]?.id);

    const customColor = WORKSPACE_COLOR_OPTIONS[4];
    expect(customColor).toBeDefined();
    if (customColor) {
      setWorkspaceBadgeColor(personalId, customColor.id);
      const updatedColor = getWorkspaceColorOption(personalId, 'personal');
      expect(updatedColor.id).toBe(customColor.id);
    }
  });
});
