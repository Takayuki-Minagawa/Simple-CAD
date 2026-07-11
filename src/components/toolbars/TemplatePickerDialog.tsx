import { useI18n } from '@/i18n';
import { drawingTemplates } from '@/domain/templates/drawingTemplates';
import { Modal } from '@/components/common/Modal';

interface Props {
  onSelect: (templateKey: string | null) => void;
  onClose: () => void;
}

export function TemplatePickerDialog({ onSelect, onClose }: Props) {
  const { t, locale } = useI18n();

  return (
    <Modal title={t.templatePickerTitle} onClose={onClose} width={500}>
      <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 16px 0' }}>
        {t.templateSelectPrompt}
      </p>
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
    </Modal>
  );
}
