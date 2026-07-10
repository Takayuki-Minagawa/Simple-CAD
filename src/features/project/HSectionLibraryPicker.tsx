import { useState } from 'react';
import { useI18n } from '@/i18n';
import {
  JIS_H_SECTION_LIBRARY,
  type HSectionLibraryEntry,
} from '@/domain/structural/sectionLibrary';

interface HSectionLibraryPickerProps {
  onAdd: (entry: HSectionLibraryEntry, kind: 's_column_h' | 's_beam_h') => void;
}

export function HSectionLibraryPicker({ onAdd }: HSectionLibraryPickerProps) {
  const { locale } = useI18n();
  const [entryId, setEntryId] = useState(JIS_H_SECTION_LIBRARY[0]?.id ?? '');
  const [kind, setKind] = useState<'s_column_h' | 's_beam_h'>('s_beam_h');
  const entry = JIS_H_SECTION_LIBRARY.find((candidate) => candidate.id === entryId);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(220px, 1fr) 140px auto',
        gap: 8,
        alignItems: 'end',
        padding: 10,
        border: '1px dashed var(--border-color)',
        borderRadius: 8,
      }}
    >
      <label style={{ display: 'grid', gap: 4 }}>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
          {locale === 'ja' ? 'JIS H形鋼ライブラリ' : 'JIS H-section library'}
        </span>
        <select
          className="prop-select"
          value={entryId}
          onChange={(event) => setEntryId(event.target.value)}
        >
          {JIS_H_SECTION_LIBRARY.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.designation}
            </option>
          ))}
        </select>
      </label>
      <label style={{ display: 'grid', gap: 4 }}>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
          {locale === 'ja' ? '用途' : 'Usage'}
        </span>
        <select
          className="prop-select"
          value={kind}
          onChange={(event) => setKind(event.target.value as typeof kind)}
        >
          <option value="s_beam_h">{locale === 'ja' ? '梁' : 'Beam'}</option>
          <option value="s_column_h">{locale === 'ja' ? '柱' : 'Column'}</option>
        </select>
      </label>
      <button className="toolbar-btn" disabled={!entry} onClick={() => entry && onAdd(entry, kind)}>
        {locale === 'ja' ? 'ライブラリから追加' : 'Add from library'}
      </button>
    </div>
  );
}
