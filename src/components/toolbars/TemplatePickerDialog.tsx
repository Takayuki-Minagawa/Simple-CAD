import { useI18n } from '@/i18n';
import { drawingTemplates } from '@/domain/templates/drawingTemplates';

interface Props {
  onSelect: (templateKey: string | null) => void;
  onClose: () => void;
}

export function TemplatePickerDialog({ onSelect, onClose }: Props) {
  const { t, locale } = useI18n();

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--bg-modal-overlay)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-modal)',
          borderRadius: 8,
          padding: 24,
          minWidth: 340,
          maxWidth: 'min(500px, calc(100vw - 32px))',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          color: 'var(--text-primary)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 12px 0', fontSize: 16 }}>{t.templatePickerTitle}</h3>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 16px 0' }}>{t.templateSelectPrompt}</p>
        <div style={{ display: 'grid', gap: 8 }}>
          {drawingTemplates.map((tmpl) => (
            <button
              key={tmpl.key}
              className="toolbar-btn"
              style={{ textAlign: 'left', padding: '10px 14px', fontSize: 13 }}
              onClick={() => onSelect(tmpl.key)}
            >
              {locale === 'ja' ? tmpl.labelJa : tmpl.labelEn}
            </button>
          ))}
          <button
            className="toolbar-btn"
            style={{ textAlign: 'left', padding: '10px 14px', fontSize: 13 }}
            onClick={() => onSelect(null)}
          >
            {locale === 'ja' ? '空白プロジェクト' : 'Blank Project'}
          </button>
        </div>
      </div>
    </div>
  );
}
