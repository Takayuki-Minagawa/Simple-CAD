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
  const { layerVisibility, toggleLayerVisibility } = useEditorStore();
  const { t } = useI18n();

  return (
    <div>
      <div className="panel-header">{t.panelLayers}</div>
      <div className="panel-content">
        {LAYER_NAMES.map((name) => (
          <label key={name} className="layer-row">
            <input
              type="checkbox"
              checked={layerVisibility[name] !== false}
              onChange={() => toggleLayerVisibility(name)}
            />
            {t[LAYER_LABEL_KEYS[name]] || name}
          </label>
        ))}
      </div>
    </div>
  );
}
