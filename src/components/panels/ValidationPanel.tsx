import { useState, useCallback } from 'react';
import { useProjectStore, useEditorStore } from '@/app/store';
import { useI18n } from '@/i18n';
import { validateProject } from '@/domain/validation';
import type { ValidationError } from '@/domain/validation';
import { isEntityLayerInteractive } from '@/domain/rendering/layerLock';

export function ValidationPanel() {
  const data = useProjectStore((s) => s.data);
  const setSelectedIds = useEditorStore((s) => s.setSelectedIds);
  const { t } = useI18n();
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [lastRun, setLastRun] = useState(false);

  const handleValidate = useCallback(() => {
    if (!data) return;
    const result = validateProject(data);
    setErrors(result.errors);
    setLastRun(true);
  }, [data]);

  return (
    <div className="panel-section">
      <div className="panel-header">
        {t.panelValidation}
        <button className="toolbar-btn" style={{ fontSize: 10, padding: '2px 6px', minHeight: 20 }} onClick={handleValidate} disabled={!data}>
          {t.validationRun}
        </button>
      </div>
      <div className="panel-content">
        {!lastRun && <div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{t.validationPrompt}</div>}
        {lastRun && errors.length === 0 && <div style={{ color: 'var(--success)', fontSize: 11 }}>{t.validationPass}</div>}
        {errors.map((err, i) => (
          <div
            key={i}
            className={`validation-item ${err.level}`}
            onClick={() => {
              const memberId = err.path?.match(/\/members\/([^/]+)/)?.[1];
              if (!memberId || !data) return;
              const editor = useEditorStore.getState();
              if (
                isEntityLayerInteractive(
                  data,
                  memberId,
                  editor.layerLocked,
                  editor.layerVisibility,
                )
              ) setSelectedIds([memberId]);
            }}
          >
            [{err.level}] {err.message}
          </div>
        ))}
      </div>
    </div>
  );
}
