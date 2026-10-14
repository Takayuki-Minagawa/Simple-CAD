import { useCallback, useEffect, useState } from 'react';
import { useProjectStore, useEditorStore } from '@/app/store';
import { useI18n } from '@/i18n';
import { validateProject } from '@/domain/validation';
import type { ValidationError } from '@/domain/validation';
import { isEntityLayerInteractive } from '@/domain/rendering/layerLock';

interface RunInfo {
  revision: number;
  at: Date;
}

/** Entity ID an issue points at: explicit `entityId`, else an ID-style `/members/<id>` path. */
function issueEntityId(error: ValidationError): string | null {
  if (error.entityId) return error.entityId;
  const match = error.path?.match(/^\/(?:members|annotations|dimensions|openings)\/([^/]+)/);
  if (!match || /^\d+$/.test(match[1])) return null;
  return match[1];
}

/** Strip the technical `Schema: ` prefix for the primary line; the raw text stays in details. */
function primaryText(error: ValidationError): string {
  return error.message.replace(/^Schema:\s*/, '');
}

/**
 * Validation panel. Shows actionable issues (`ID › field: reason`), tracks whether
 * the result is stale relative to the current document revision (R04), can
 * re-run automatically, and lets the user jump from an issue to the entity and
 * property field it refers to (R03).
 */
export function ValidationPanel() {
  const data = useProjectStore((s) => s.data);
  const currentRevision = useProjectStore((s) => s.currentRevision);
  const setSelectedIds = useEditorStore((s) => s.setSelectedIds);
  const { t, locale } = useI18n();
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [lastRun, setLastRun] = useState<RunInfo | null>(null);
  const [autoRun, setAutoRun] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  const runValidation = useCallback(() => {
    const project = useProjectStore.getState();
    if (!project.data) return;
    const result = validateProject(project.data);
    setErrors(result.errors);
    setLastRun({ revision: project.currentRevision, at: new Date() });
  }, []);

  // Auto re-validate shortly after any change (debounced so typing stays responsive).
  useEffect(() => {
    if (!autoRun || !data) return;
    const timeout = window.setTimeout(runValidation, 300);
    return () => window.clearTimeout(timeout);
  }, [autoRun, data, currentRevision, runValidation]);

  const stale = lastRun != null && lastRun.revision !== currentRevision;
  const errorCount = errors.filter((e) => e.level === 'error').length;
  const warningCount = errors.length - errorCount;

  const focusIssue = (error: ValidationError) => {
    const entityId = issueEntityId(error);
    if (!entityId || !data) return;
    const editor = useEditorStore.getState();
    if (!isEntityLayerInteractive(data, entityId, editor.layerLocked, editor.layerVisibility)) return;
    setSelectedIds([entityId]);
    if (error.field) {
      // The property panel renders on the next frame; focus the field once it exists.
      const field = error.field;
      window.requestAnimationFrame(() => {
        const input = document.querySelector<HTMLElement>(`[data-prop-field="${field}"]`);
        input?.focus();
        input?.scrollIntoView?.({ block: 'nearest' });
      });
    }
  };

  const timeText = lastRun
    ? new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(lastRun.at)
    : null;

  return (
    <div className="panel-section">
      <div className="panel-header">
        {t.panelValidation}
        <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
          <label style={{ display: 'inline-flex', gap: 3, alignItems: 'center', textTransform: 'none', fontWeight: 400 }}>
            <input
              type="checkbox"
              checked={autoRun}
              onChange={(e) => setAutoRun(e.target.checked)}
              disabled={!data}
            />
            {t.validationAuto}
          </label>
          <button
            className="toolbar-btn"
            style={{ fontSize: 10, padding: '2px 6px', minHeight: 20 }}
            onClick={runValidation}
            disabled={!data}
          >
            {t.validationRun}
          </button>
        </span>
      </div>
      <div className="panel-content">
        {!lastRun && <div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{t.validationPrompt}</div>}
        {lastRun && (
          <div
            role="status"
            data-status="validation-freshness"
            style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 8px', fontSize: 11, marginBottom: 6 }}
          >
            <span
              style={{
                padding: '0 6px',
                borderRadius: 3,
                fontWeight: 600,
                background: stale ? 'var(--warning)' : 'var(--success)',
                color: '#fff',
              }}
            >
              {stale ? t.validationStale : t.validationUpToDate}
            </span>
            <span style={{ color: 'var(--text-secondary)' }}>
              {t.validationLastRun}: {timeText} · {t.validationRevision} {lastRun.revision}
              {stale ? ` → ${currentRevision}` : ''}
            </span>
          </div>
        )}
        {lastRun && errors.length === 0 && (
          <div style={{ color: 'var(--success)', fontSize: 11 }}>{t.validationPass}</div>
        )}
        {lastRun && errors.length > 0 && (
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
            {t.validationErrorCount.replace('{count}', String(errors.length))}
            {` (error ${errorCount} / warning ${warningCount})`}
          </div>
        )}
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {errors.map((err, i) => {
            const entityId = issueEntityId(err);
            return (
              <li key={i}>
                <button
                  type="button"
                  className={`validation-item ${err.level}`}
                  data-entity-id={entityId ?? undefined}
                  data-field={err.field}
                  onClick={() => focusIssue(err)}
                  style={{
                    display: 'block',
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    textAlign: 'left',
                    font: 'inherit',
                    cursor: entityId ? 'pointer' : 'default',
                  }}
                >
                  [{err.level}] {primaryText(err)}
                </button>
                {showRaw && err.detail && (
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', paddingLeft: 12 }}>
                    {err.detail}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {errors.some((err) => err.detail) && (
          <button
            type="button"
            className="toolbar-btn"
            style={{ fontSize: 10, padding: '2px 6px', minHeight: 20, marginTop: 4 }}
            onClick={() => setShowRaw((v) => !v)}
            aria-pressed={showRaw}
          >
            {showRaw ? t.validationHideRaw : t.validationShowRaw}
          </button>
        )}
      </div>
    </div>
  );
}
