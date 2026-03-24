import { useEditorStore, LAYER_NAMES } from '@/app/store';

const LAYER_LABELS: Record<string, string> = {
  grid: 'Grid',
  'member-column': 'Column',
  'member-beam': 'Beam',
  'member-wall': 'Wall',
  'member-slab': 'Slab',
  opening: 'Opening',
  dimension: 'Dimension',
  annotation: 'Annotation',
};

export function LayerPanel() {
  const { layerVisibility, toggleLayerVisibility } = useEditorStore();

  return (
    <div>
      <div className="panel-header">Layers</div>
      <div className="panel-content">
        {LAYER_NAMES.map((name) => (
          <label key={name} className="layer-row">
            <input
              type="checkbox"
              checked={layerVisibility[name] !== false}
              onChange={() => toggleLayerVisibility(name)}
            />
            {LAYER_LABELS[name] || name}
          </label>
        ))}
      </div>
    </div>
  );
}
