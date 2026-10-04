import { useMemo, useState } from 'react';
import { useProjectStore, useEditorStore } from '@/app/store';
import { useI18n } from '@/i18n';
import { useShallow } from 'zustand/react/shallow';
import { buildObjectTreeRows, OBJECT_TYPES, type ObjectType } from './objectTreeRows';

export function ObjectTreePanel() {
  const data = useProjectStore((s) => s.data);
  const { selectedIds, setSelectedIds, activeStory, layerLocked, layerVisibility } = useEditorStore(
    useShallow((state) => ({
      selectedIds: state.selectedIds,
      setSelectedIds: state.setSelectedIds,
      activeStory: state.activeStory,
      layerLocked: state.layerLocked,
      layerVisibility: state.layerVisibility,
    })),
  );
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<ObjectType | 'all'>('all');
  const rows = useMemo(() => data ? buildObjectTreeRows(data) : [], [data]);
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const eligibleIds = useMemo(() => new Set(rows
    .filter((row) => !layerLocked[row.layer] && layerVisibility[row.layer] !== false)
    .map((row) => row.id)), [rows, layerLocked, layerVisibility]);
  const scopedRows = rows.filter((row) => !activeStory || row.story === activeStory);
  const search = query.trim().toLocaleLowerCase();
  const matches = scopedRows.filter((row) =>
    (typeFilter === 'all' || row.type === typeFilter) && row.searchText.includes(search));
  const selectableMatches = matches.filter((row) => eligibleIds.has(row.id));
  const typeLabels: Record<ObjectType, string> = {
    column: t.layerColumn,
    beam: t.layerBeam,
    wall: t.layerWall,
    slab: t.layerSlab,
    annotation: t.layerAnnotation,
    dimension: t.layerDimension,
    opening: t.layerOpening,
    construction: t.layerConstruction,
  };

  if (!data) return <div className="panel-content">{t.noProject}</div>;

  function selectRow(id: string, additive: boolean) {
    if (!eligibleIds.has(id)) return;
    if (!additive) {
      setSelectedIds([id]);
      return;
    }
    const next = selectedIds.filter((selectedId) => eligibleIds.has(selectedId) && selectedId !== id);
    setSelectedIds(selected.has(id) ? next : [...next, id]);
  }

  return (
    <div onKeyDown={(event) => {
      // Native control activation must not also complete an in-progress canvas drawing.
      if (event.key === 'Enter' || event.key === ' ') event.stopPropagation();
    }}>
      <div className="panel-header">{t.panelObjects}</div>
      <div className="panel-content">
        <div className="tree-filters">
          <input
            type="search"
            aria-label={t.objectSearch}
            placeholder={t.objectSearchPlaceholder}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <select
            aria-label={t.objectTypeFilter}
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value as ObjectType | 'all')}
          >
            <option value="all">{t.objectAllTypes}</option>
            {OBJECT_TYPES.map((type) => <option key={type} value={type}>{typeLabels[type]}</option>)}
          </select>
          <div className="tree-filter-actions">
            <button
              type="button"
              disabled={selectableMatches.length === 0}
              onClick={() => setSelectedIds(selectableMatches.map((row) => row.id))}
            >
              {t.objectSelectMatches}
            </button>
            <button
              type="button"
              disabled={!query && typeFilter === 'all'}
              onClick={() => { setQuery(''); setTypeFilter('all'); }}
            >
              {t.objectClearFilters}
            </button>
          </div>
          <div className="tree-result-count" role="status">
            {t.objectResults.replace('{count}', String(matches.length)).replace('{total}', String(scopedRows.length))}
            {' · '}{t.objectSelectable.replace('{count}', String(selectableMatches.length))}
          </div>
        </div>
        {matches.length === 0 && <div className="tree-empty">{t.objectNoMatches}</div>}
        {OBJECT_TYPES.map((type) => {
          const group = matches.filter((row) => row.type === type);
          if (group.length === 0) return null;
          return (
            <div key={type}>
              <div className="tree-group-label">{typeLabels[type]} ({group.length})</div>
              {group.map((row) => (
                <button
                  type="button"
                  key={row.id}
                  className={`tree-node ${selected.has(row.id) ? 'selected' : ''}`}
                  aria-pressed={selected.has(row.id)}
                  disabled={!eligibleIds.has(row.id)}
                  title={`${row.label}\n${eligibleIds.has(row.id) ? t.objectSelectionHint : t.objectUnavailable}`}
                  onClick={(event) => selectRow(row.id, event.shiftKey || event.ctrlKey || event.metaKey)}
                >
                  {row.label}
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
