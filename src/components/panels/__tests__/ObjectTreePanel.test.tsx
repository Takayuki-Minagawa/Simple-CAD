import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectData } from '@/domain/structural/types';
import { useEditorStore, useProjectStore } from '@/app/store';
import { useI18n } from '@/i18n';
import { ObjectTreePanel } from '../ObjectTreePanel';

function project(): ProjectData {
  const memberBase = { sectionId: 'SEC-C600', materialId: 'MAT-RC', start: { x: 0, y: 0, z: 0 }, end: { x: 0, y: 0, z: 3000 } };
  return {
    schemaVersion: '1.0.0',
    project: { id: 'test', name: 'Tree test', unit: 'mm' },
    stories: [
      { id: '1F', name: '1F', elevation: 0, height: 3000 },
      { id: '2F', name: '2F', elevation: 3000, height: 3000 },
    ],
    materials: [{ id: 'MAT-RC', name: 'Concrete RC', type: 'concrete' }],
    sections: [{ id: 'SEC-C600', kind: 'rc_column_rect', width: 600, depth: 600 }],
    members: [
      { ...memberBase, id: 'C1', type: 'column', story: '1F', tags: ['Entry post'] },
      { ...memberBase, id: 'C2', type: 'column', story: '2F' },
      { ...memberBase, id: 'B1', type: 'beam', story: '1F' },
      { ...memberBase, id: 'W1', type: 'wall', story: '1F', height: 3000, thickness: 200 },
      { ...memberBase, id: 'W2', type: 'wall', story: '2F', height: 3000, thickness: 200 },
    ],
    annotations: [{ id: 'A1', type: 'text', story: '1F', x: 0, y: 0, text: 'Entrance' }],
    dimensions: [{ id: 'D1', story: '1F', start: { x: 0, y: 0 }, end: { x: 100, y: 0 }, offset: 50, text: 'Clear width' }],
    openings: [
      { id: 'O1', memberId: 'W1', type: 'door', position: { x: 0, y: 0, z: 0 }, width: 800, height: 2000 },
      { id: 'O2', memberId: 'W2', type: 'window', position: { x: 0, y: 0, z: 3000 }, width: 800, height: 1000 },
      { id: 'ORPHAN', memberId: 'missing', type: 'void', position: { x: 0, y: 0, z: 0 }, width: 800, height: 1000 },
    ],
    constructionLines: [
      { id: 'X1', type: 'xline', story: '1F', origin: { x: 0, y: 0 }, direction: { x: 1, y: 0 } },
      { id: 'X2', type: 'ray', story: '2F', origin: { x: 0, y: 0 }, direction: { x: 0, y: 1 } },
    ],
    grids: [], sheets: [], views: [],
  };
}

function search(value: string) {
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search objects' }), { target: { value } });
}

function filterType(value: string) {
  fireEvent.change(screen.getByRole('combobox', { name: 'Object type' }), { target: { value } });
}

describe('ObjectTreePanel', () => {
  beforeEach(() => {
    useI18n.getState().setLocale('en');
    useProjectStore.getState().loadProject(project());
    useEditorStore.setState({
      layerLocked: useEditorStore.getInitialState().layerLocked,
      layerVisibility: useEditorStore.getInitialState().layerVisibility,
    });
  });

  it('combines trimmed case-insensitive search and type filters, and clears both', () => {
    render(<ObjectTreePanel />);
    search('  concrete rc  ');
    filterType('column');
    expect(screen.getByRole('button', { name: 'C1' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'B1' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('1 / 7 objects · 1 selectable');
    fireEvent.click(screen.getByRole('button', { name: 'Select matches' }));
    expect(useEditorStore.getState().selectedIds).toEqual(['C1']);

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByRole('searchbox')).toHaveValue('');
    expect(screen.getByRole('combobox')).toHaveValue('all');
    expect(screen.getByRole('status')).toHaveTextContent('7 / 7 objects');
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeDisabled();
  });

  it.each([
    ['c1', 'C1'],
    ['sec-c600', 'C1'],
    ['rc_column_rect', 'C1'],
    ['mat-rc', 'C1'],
    ['entry post', 'C1'],
    ['entrance', 'A1: Entrance'],
    ['clear width', 'D1: Clear width'],
    ['w1', 'O1: door'],
    ['xline', 'X1'],
  ])('searches entity metadata: %s', (query, label) => {
    render(<ObjectTreePanel />);
    search(query);
    expect(screen.getByRole('button', { name: label })).toBeVisible();
  });

  it('scopes rows and opening hosts to the active story, including construction lines', () => {
    render(<ObjectTreePanel />);
    expect(screen.getByRole('button', { name: 'O1: door' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'O2: window' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ORPHAN/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'X1' })).toBeVisible();

    act(() => useEditorStore.getState().setActiveStory('2F'));
    expect(screen.getByRole('status')).toHaveTextContent('4 / 4 objects');
    expect(screen.getByRole('button', { name: 'O2: window' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'X2' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'X1' })).not.toBeInTheDocument();
    filterType('construction');
    fireEvent.click(screen.getByRole('button', { name: 'Select matches' }));
    expect(useEditorStore.getState().selectedIds).toEqual(['X2']);

    act(() => useEditorStore.getState().setActiveStory(null));
    expect(screen.getByRole('status')).toHaveTextContent('2 / 11 objects');
    expect(screen.getByRole('button', { name: 'X1' })).toBeVisible();
  });

  it('keeps locked and hidden rows visible but excludes them from every selection action', () => {
    useEditorStore.setState((state) => ({
      layerLocked: { ...state.layerLocked, 'member-beam': true, construction: true },
      layerVisibility: { ...state.layerVisibility, annotation: false },
    }));
    render(<ObjectTreePanel />);
    for (const name of ['B1', 'X1', 'A1: Entrance']) {
      const row = screen.getByRole('button', { name });
      expect(row).toBeDisabled();
      fireEvent.click(row, { shiftKey: true });
      expect(useEditorStore.getState().selectedIds).toEqual([]);
    }
    expect(screen.getByRole('status')).toHaveTextContent('7 / 7 objects · 4 selectable');
    fireEvent.click(screen.getByRole('button', { name: 'Select matches' }));
    expect(useEditorStore.getState().selectedIds).toEqual(['C1', 'W1', 'D1', 'O1']);
    filterType('annotation');
    expect(screen.getByRole('button', { name: 'Select matches' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('1 / 7 objects · 0 selectable');
  });

  it.each(['shiftKey', 'ctrlKey', 'metaKey'])('toggles mixed selections with %s and replaces them on ordinary clicks', (modifier) => {
    render(<ObjectTreePanel />);
    const column = screen.getByRole('button', { name: 'C1' });
    const annotation = screen.getByRole('button', { name: 'A1: Entrance' });
    fireEvent.click(column);
    expect(column).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(annotation, { [modifier]: true });
    expect(useEditorStore.getState().selectedIds).toEqual(['C1', 'A1']);
    expect(annotation).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(column, { [modifier]: true });
    expect(useEditorStore.getState().selectedIds).toEqual(['A1']);
    expect(column).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(column);
    expect(useEditorStore.getState().selectedIds).toEqual(['C1']);
  });

  it('preserves eligible selections outside the current filter when adding a row', () => {
    useEditorStore.setState((state) => ({
      selectedIds: ['C2', 'A1'],
      layerVisibility: { ...state.layerVisibility, annotation: false },
    }));
    render(<ObjectTreePanel />);
    filterType('column');
    fireEvent.click(screen.getByRole('button', { name: 'C1' }), { ctrlKey: true });
    expect(useEditorStore.getState().selectedIds).toEqual(['C2', 'C1']);
  });

  it('reports empty matches without clearing the current selection', () => {
    useEditorStore.getState().setSelectedIds(['C1']);
    render(<ObjectTreePanel />);
    search('missing');
    expect(screen.getByText('No matching objects')).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('0 / 7 objects');
    expect(screen.getByRole('button', { name: 'Select matches' })).toBeDisabled();
    expect(useEditorStore.getState().selectedIds).toEqual(['C1']);
  });

  it('uses Japanese labels for the filter controls and empty state', () => {
    useI18n.getState().setLocale('ja');
    render(<ObjectTreePanel />);
    expect(screen.getByRole('combobox', { name: 'オブジェクト種別' })).toBeVisible();
    expect(screen.getByRole('button', { name: '該当項目を選択' })).toBeVisible();
    fireEvent.change(screen.getByRole('searchbox', { name: 'オブジェクト検索' }), { target: { value: 'missing' } });
    expect(screen.getByText('該当するオブジェクトはありません')).toBeVisible();
  });

  it('isolates native Enter/Space activation from canvas key handlers without preventing defaults', () => {
    render(<ObjectTreePanel />);
    const canvasKeyHandler = vi.fn();
    window.addEventListener('keydown', canvasKeyHandler);
    try {
      const row = screen.getByRole('button', { name: 'C1' });
      expect(fireEvent.keyDown(row, { key: 'Enter' })).toBe(true);
      expect(fireEvent.keyDown(row, { key: ' ' })).toBe(true);
      expect(canvasKeyHandler).not.toHaveBeenCalled();
      fireEvent.keyDown(row, { key: 'Escape' });
      expect(canvasKeyHandler).toHaveBeenCalledOnce();
    } finally {
      window.removeEventListener('keydown', canvasKeyHandler);
    }
  });

  it('shows the no-project state safely', () => {
    useProjectStore.setState({ data: null });
    render(<ObjectTreePanel />);
    expect(screen.getByText('No project loaded')).toBeVisible();
  });
});
