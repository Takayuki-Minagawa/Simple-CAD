import { useEffect, useState } from 'react';
import { Modal } from '@/components/common/Modal';
import {
  listRecentProjects,
  removeRecentProject,
  type RecentProjectRecord,
} from '@/libs/persistence';
import { useI18n } from '@/i18n';

interface Props {
  onOpen: (project: RecentProjectRecord) => void;
  onClose: () => void;
}

export function RecentProjectsDialog({ onOpen, onClose }: Props) {
  const { locale } = useI18n();
  const [projects, setProjects] = useState<RecentProjectRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      setProjects(await listRecentProjects());
    } catch (loadError) {
      setError(String(loadError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const title = locale === 'ja' ? '最近のプロジェクト' : 'Recent projects';
  return (
    <Modal
      title={title}
      onClose={onClose}
      width={620}
      footer={
        <button className="toolbar-btn" onClick={onClose}>
          {locale === 'ja' ? '閉じる' : 'Close'}
        </button>
      }
    >
      {loading && <div role="status">{locale === 'ja' ? '読み込み中…' : 'Loading…'}</div>}
      {error && (
        <div role="alert" style={{ color: 'var(--error)' }}>
          {error}
        </div>
      )}
      {!loading && !error && projects.length === 0 && (
        <div style={{ color: 'var(--text-secondary)' }}>
          {locale === 'ja' ? '最近のプロジェクトはありません。' : 'No recent projects.'}
        </div>
      )}
      <div style={{ display: 'grid', gap: 8 }}>
        {projects.map((project) => (
          <div
            key={project.id}
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0,1fr) auto auto',
              alignItems: 'center',
              gap: 8,
              border: '1px solid var(--border-color)',
              borderRadius: 6,
              padding: 10,
            }}
          >
            <button
              className="toolbar-btn"
              style={{ textAlign: 'left', minWidth: 0 }}
              onClick={() => onOpen(project)}
            >
              <span style={{ display: 'block', fontWeight: 600 }}>{project.name}</span>
              <span style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 11 }}>
                {new Intl.DateTimeFormat(locale, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }).format(project.updatedAt)}
              </span>
            </button>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              {project.data.members.length} {locale === 'ja' ? '部材' : 'members'}
            </span>
            <button
              className="toolbar-btn"
              aria-label={`${project.name} ${locale === 'ja' ? 'を履歴から削除' : 'remove from recents'}`}
              onClick={async () => {
                try {
                  await removeRecentProject(project.id);
                  setProjects((items) => items.filter((item) => item.id !== project.id));
                } catch (removeError) {
                  setError(String(removeError));
                }
              }}
            >
              {locale === 'ja' ? '削除' : 'Remove'}
            </button>
          </div>
        ))}
      </div>
    </Modal>
  );
}
