import { useEditorStore, useProjectStore, LAYER_NAMES } from '@/app/store';
import { useI18n } from '@/i18n';
import type { Translations } from '@/i18n';

const LAYER_LABEL_KEYS: Record<string, keyof Translations> = {
  grid: 'layerGrid',
  'member-column': 'layerColumn',
  'member-beam': 'layerBeam',
  'member-wall': 'layerWall',
  'member-slab': 'layerSlab',
  opening: 'layerOpening',
  dimension: 'layerDimension',
  annotation: 'layerAnnotation',
  construction: 'layerConstruction',
};

export function LayerPanel() {
  const { layerVisibility, toggleLayerVisibility, layerLocked, setLayerLocked } = useEditorStore();
  const data = useProjectStore((s) => s.data);
  const { toggleExternalRefVisibility, removeExternalRef } = useProjectStore();
  const { t } = useI18n();

  return (
    <div>
      <div className="panel-header">{t.panelLayers}</div>
      <div className="panel-content">
        {LAYER_NAMES.map((name) => (
          <div key={name} className="layer-row" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
              <input
                type="checkbox"
                checked={layerVisibility[name] !== false}
                onChange={() => toggleLayerVisibility(name)}
              />
              {t[LAYER_LABEL_KEYS[name]] || name}
            </label>
            <button
              title={layerLocked[name] ? 'Unlock' : 'Lock'}
              onClick={() => setLayerLocked(name, !layerLocked[name])}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '2px 4px',
                fontSize: '14px',
                opacity: layerLocked[name] ? 1 : 0.4,
              }}
            >
              {layerLocked[name] ? '\u{1F512}' : '\u{1F513}'}
            </button>
          </div>
        ))}
      </div>

      {/* External References */}
      {data?.externalRefs && data.externalRefs.length > 0 && (
        <>
          <div className="panel-header" style={{ marginTop: 8 }}>{t.xrefTitle}</div>
          <div className="panel-content">
            {data.externalRefs.map((ref) => (
              <div key={ref.id} className="layer-row" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                  <input
                    type="checkbox"
                    checked={ref.visible}
                    onChange={() => toggleExternalRefVisibility(ref.id)}
                  />
                  {ref.name}
                </label>
                <button
                  onClick={() => removeExternalRef(ref.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '2px 4px',
                    fontSize: '11px',
                    color: 'var(--text-secondary)',
                  }}
                  title={t.xrefRemove}
                >
                  x
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
