import { useMemo, useState } from 'react';
import { useEditorStore, useProjectStore } from '@/app/store';
import { useI18n } from '@/i18n';
import { Modal } from '@/components/common/Modal';
import {
  computeEdgeEdit,
  type EdgeEditEnd,
  type EdgeEditErrorCode,
  type EdgeEditOperation,
  type EdgeEditRequest,
} from '@/domain/structural/editTrim';
import { isLinearMember } from '@/domain/structural/types';
import { isEntityLayerInteractive } from '@/domain/rendering/layerLock';
import { SelectField } from './TransformDialogFields';

interface Props {
  onClose: () => void;
}

const OPERATIONS: EdgeEditOperation[] = ['trim', 'extend', 'fillet'];
const ENDS: EdgeEditEnd[] = ['start', 'end'];

function formatPoint(p: { x: number; y: number; z: number }): string {
  const f = (v: number) => (Math.round(v * 100) / 100).toString();
  return `(${f(p.x)}, ${f(p.y)}, ${f(p.z)})`;
}

/**
 * ID-addressed trim / extend / fillet (R09). Everything is typed: target member,
 * which end moves, and the reference member. The result is previewed (new
 * endpoints and plan length) before "Apply" commits it as one undo step, so the
 * same request reproduces the same geometry regardless of zoom or overlap.
 */
export function EdgeEditDialog({ onClose }: Props) {
  const data = useProjectStore((state) => state.data);
  const applyEdgeEdit = useProjectStore((state) => state.applyEdgeEdit);
  const selectedIds = useEditorStore((state) => state.selectedIds);
  const activeStory = useEditorStore((state) => state.activeStory);
  const layerLocked = useEditorStore((state) => state.layerLocked);
  const layerVisibility = useEditorStore((state) => state.layerVisibility);
  const setSelectedIds = useEditorStore((state) => state.setSelectedIds);
  const { t } = useI18n();

  const linearIds = useMemo(
    () =>
      (data?.members ?? [])
        .filter((m) => isLinearMember(m) && (!activeStory || m.story === activeStory))
        .map((m) => m.id),
    [data, activeStory],
  );
  const initialTarget = selectedIds.find((id) => linearIds.includes(id)) ?? '';

  const [operation, setOperation] = useState<EdgeEditOperation>('trim');
  const [memberId, setMemberId] = useState(initialTarget);
  const [end, setEnd] = useState<EdgeEditEnd>('end');
  const [referenceId, setReferenceId] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  const request: EdgeEditRequest = { operation, memberId: memberId.trim(), end, referenceId: referenceId.trim() };

  const errorText = (code: EdgeEditErrorCode): string => {
    switch (code) {
      case 'target':
        return t.edgeEditErrorTarget;
      case 'reference':
        return t.edgeEditErrorReference;
      case 'same':
        return t.edgeEditErrorSame;
      case 'not-wall':
        return t.edgeEditErrorNotWall;
      case 'no-intersection':
        return t.edgeEditErrorNoIntersection;
      case 'no-change':
        return t.edgeEditErrorNoChange;
      case 'invalid':
        return t.edgeEditErrorInvalid;
    }
  };

  const locked =
    data != null &&
    [request.memberId, request.referenceId].some(
      (id) => id && !isEntityLayerInteractive(data, id, layerLocked, layerVisibility),
    );
  const preview = data && request.memberId && request.referenceId ? computeEdgeEdit(data, request) : null;
  const previewError = locked ? t.edgeEditErrorLocked : preview && !preview.ok ? errorText(preview.error) : null;
  const canApply = Boolean(preview?.ok) && !locked;

  const handleApply = () => {
    if (!canApply) return;
    const result = applyEdgeEdit(request);
    if (result.ok) {
      setStatus(t.edgeEditApplied);
      setSelectedIds(result.changes.map((change) => change.id));
    } else {
      setStatus(errorText(result.error));
    }
  };

  const operationLabel: Record<EdgeEditOperation, string> = {
    trim: t.edgeEditTrim,
    extend: t.edgeEditExtend,
    fillet: t.edgeEditFillet,
  };
  const endLabel: Record<EdgeEditEnd, string> = { start: t.edgeEditEndStart, end: t.edgeEditEndEnd };

  return (
    <Modal
      title={t.edgeEditTitle}
      onClose={onClose}
      width={480}
      footer={
        <>
          <button className="toolbar-btn" onClick={onClose}>
            {t.exportCancel}
          </button>
          <button
            className="toolbar-btn"
            style={{ background: canApply ? 'var(--accent)' : undefined, color: canApply ? '#fff' : undefined }}
            onClick={handleApply}
            disabled={!canApply}
          >
            {t.edgeEditApply}
          </button>
        </>
      }
    >
      {!data ? (
        <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{t.edgeEditNoProject}</p>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          <SelectField
            label={t.edgeEditOperation}
            value={operation}
            options={OPERATIONS.map((value) => ({ value, label: operationLabel[value] }))}
            onChange={(value) => {
              setOperation(value as EdgeEditOperation);
              setStatus(null);
            }}
          />
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t.edgeEditTarget}</span>
            <input
              className="prop-input"
              style={{ maxWidth: '100%' }}
              list="edge-edit-member-ids"
              value={memberId}
              onChange={(e) => {
                setMemberId(e.target.value);
                setStatus(null);
              }}
            />
          </label>
          {operation !== 'fillet' && (
            <SelectField
              label={t.edgeEditEnd}
              value={end}
              options={ENDS.map((value) => ({ value, label: endLabel[value] }))}
              onChange={(value) => {
                setEnd(value as EdgeEditEnd);
                setStatus(null);
              }}
            />
          )}
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t.edgeEditReference}</span>
            <input
              className="prop-input"
              style={{ maxWidth: '100%' }}
              list="edge-edit-member-ids"
              value={referenceId}
              onChange={(e) => {
                setReferenceId(e.target.value);
                setStatus(null);
              }}
            />
          </label>
          <datalist id="edge-edit-member-ids">
            {linearIds.map((id) => (
              <option key={id} value={id} />
            ))}
          </datalist>

          <section aria-label={t.edgeEditPreview} style={{ fontSize: 12 }}>
            <div style={{ color: 'var(--text-secondary)', marginBottom: 4 }}>{t.edgeEditPreview}</div>
            {previewError && (
              <div role="alert" style={{ color: 'var(--error)' }}>
                {previewError}
              </div>
            )}
            {!previewError && preview?.ok && (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ color: 'var(--text-secondary)', textAlign: 'left' }}>
                    <th style={{ fontWeight: 500 }}>ID</th>
                    <th style={{ fontWeight: 500 }}>{t.edgeEditBefore}</th>
                    <th style={{ fontWeight: 500 }}>{t.edgeEditAfter}</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.changes.map((change) => (
                    <tr key={change.id} style={{ verticalAlign: 'top' }}>
                      <td style={{ paddingRight: 8 }}>{change.id}</td>
                      <td style={{ paddingRight: 8 }}>
                        <div>{t.edgeEditEndStart}: {formatPoint(change.before.start)}</div>
                        <div>{t.edgeEditEndEnd}: {formatPoint(change.before.end)}</div>
                        <div>{t.propLengthPlan}: {change.lengthBefore.toFixed(0)} mm</div>
                      </td>
                      <td>
                        <div>{t.edgeEditEndStart}: {formatPoint(change.after.start)}</div>
                        <div>{t.edgeEditEndEnd}: {formatPoint(change.after.end)}</div>
                        <div>{t.propLengthPlan}: {change.lengthAfter.toFixed(0)} mm</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {!previewError && !preview && (
              <div style={{ color: 'var(--text-secondary)' }}>—</div>
            )}
          </section>
          {status && (
            <div role="status" style={{ fontSize: 12, color: 'var(--success)' }}>
              {status}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
