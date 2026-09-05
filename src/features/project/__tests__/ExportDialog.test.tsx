import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import sampleProject from '@/samples/sample-project.json';
import type { ProjectData } from '@/domain/structural/types';
import { useProjectStore, useEditorStore } from '@/app/store';
import { ExportDialog } from '../ExportDialog';

const mocks = vi.hoisted(() => ({ saveFile: vi.fn(), exportDxfWithWarnings: vi.fn() }));
vi.mock('@/libs/fileSystem', () => ({
  ...mocks,
  isAbortError: () => false,
  downloadBlob: vi.fn(),
}));
vi.mock('@/domain/export/dxfExport', () => ({
  exportDxfWithWarnings: mocks.exportDxfWithWarnings,
}));
vi.mock('@/domain/validation', () => ({ validateProject: () => ({ ok: true, errors: [] }) }));

beforeEach(() => {
  vi.clearAllMocks();
  useProjectStore.setState({ data: structuredClone(sampleProject) as ProjectData });
  useEditorStore.setState({ activeStory: '1F' });
  mocks.exportDxfWithWarnings.mockReturnValue({ content: 'generated DXF', warnings: [] });
  mocks.saveFile.mockResolvedValue(null);
});

describe('DXF export controls', () => {
  it.each(['AC1015', 'AC1027', 'AC1032'])(
    'exports the selected story and %s version',
    async (version) => {
      const onClose = vi.fn();
      render(<ExportDialog onClose={onClose} />);
      fireEvent.change(screen.getByLabelText('形式'), { target: { value: 'dxf' } });
      const versionSelect = screen.getByLabelText('DXFバージョン');
      expect(versionSelect).toHaveValue('AC1032');
      expect(screen.getByRole('option', { name: 'AutoCAD 2000 (AC1015)' })).toBeInTheDocument();
      fireEvent.change(versionSelect, { target: { value: version } });
      fireEvent.change(screen.getByLabelText('出力する階'), { target: { value: '2F' } });
      fireEvent.click(screen.getByRole('button', { name: 'エクスポート' }));
      await waitFor(() =>
        expect(mocks.exportDxfWithWarnings).toHaveBeenCalledWith(expect.anything(), '2F', {
          version,
        }),
      );
      expect(mocks.saveFile).toHaveBeenCalledWith(
        'generated DXF',
        expect.stringMatching(/\.dxf$/),
        'application/dxf',
      );
      expect(onClose).toHaveBeenCalledOnce();
    },
  );
});
