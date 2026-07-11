import { useState } from 'react';
import { useI18n } from '@/i18n';
import type { Translations } from '@/i18n';
import { Modal } from '@/components/common/Modal';

interface Props {
  onClose: () => void;
}

interface Section {
  titleKey: keyof Translations;
  contentKey: keyof Translations;
}

const SECTIONS: Section[] = [
  { titleKey: 'helpSectionOverview', contentKey: 'helpOverviewText' },
  { titleKey: 'helpSectionGettingStarted', contentKey: 'helpGettingStartedText' },
  { titleKey: 'helpSectionTools', contentKey: 'helpToolsText' },
  { titleKey: 'helpSectionShortcuts', contentKey: 'helpShortcutsText' },
  { titleKey: 'helpSectionExport', contentKey: 'helpExportText' },
  { titleKey: 'helpSectionJson', contentKey: 'helpJsonText' },
  { titleKey: 'helpSectionAi', contentKey: 'helpAiText' },
];

export function HelpDialog({ onClose }: Props) {
  const { t } = useI18n();
  const [activeIdx, setActiveIdx] = useState(0);

  return (
    <Modal
      title={t.helpTitle}
      onClose={onClose}
      width={680}
      maxHeight="82vh"
      bodyStyle={{ padding: 0, display: 'flex', minHeight: 420 }}
      footer={
        <button
          className="toolbar-btn"
          style={{ background: 'var(--border-color)', color: 'var(--text-primary)', minHeight: 28 }}
          onClick={onClose}
        >
          {t.helpClose}
        </button>
      }
    >
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Sidebar nav */}
        <nav
          aria-label={t.helpTitle}
          style={{
            width: 180,
            minWidth: 180,
            borderRight: '1px solid var(--border-color)',
            overflowY: 'auto',
            padding: '8px 0',
            background: 'var(--bg-secondary)',
          }}
        >
          {SECTIONS.map((sec, idx) => (
            <button
              key={sec.titleKey}
              type="button"
              onClick={() => setActiveIdx(idx)}
              aria-current={idx === activeIdx ? 'page' : undefined}
              style={{
                width: '100%',
                border: 0,
                textAlign: 'left',
                padding: '8px 16px',
                fontSize: 12,
                cursor: 'pointer',
                background: idx === activeIdx ? 'var(--bg-active)' : 'transparent',
                color: idx === activeIdx ? 'var(--accent)' : 'var(--text-primary)',
                fontWeight: idx === activeIdx ? 600 : 400,
                borderLeft: idx === activeIdx ? '3px solid var(--accent)' : '3px solid transparent',
              }}
            >
              {t[sec.titleKey]}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px 24px',
          }}
        >
          <h4
            style={{
              margin: '0 0 12px',
              fontSize: 15,
              color: 'var(--accent)',
            }}
          >
            {t[SECTIONS[activeIdx].titleKey]}
          </h4>
          <div
            style={{
              fontSize: 13,
              lineHeight: 1.8,
              whiteSpace: 'pre-wrap',
              color: 'var(--text-primary)',
            }}
          >
            {t[SECTIONS[activeIdx].contentKey]}
          </div>
        </div>
      </div>
    </Modal>
  );
}
