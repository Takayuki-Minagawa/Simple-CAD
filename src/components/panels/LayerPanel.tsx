import { useEditorStore, LAYER_NAMES } from '@/app/store';
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
};

export function LayerPanel() {
  const { layerVisibility, toggleLayerVisibility, layerLocked, setLayerLocked } = useEditorStore();
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
    </div>
  );
}
