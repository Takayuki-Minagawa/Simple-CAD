import type { EditorTool } from '@/app/store';
import { useI18n } from '@/i18n';
import { getDrawingGuideText } from './toolGuide';

interface Props {
  activeTool: EditorTool;
  pointCount: number;
}

export function DrawingGuide({ activeTool, pointCount }: Props) {
  const { t } = useI18n();
  const text = getDrawingGuideText(activeTool, pointCount, t);

  if (!text) return null;

  return (
    <div className="drawing-guide" role="status" aria-live="polite">
      {text}
    </div>
  );
}
