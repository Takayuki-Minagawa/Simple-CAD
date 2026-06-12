import type { Locale } from '@/i18n';

export function getViewerLabels(locale: Locale) {
  return locale === 'ja'
    ? {
        section: '断面',
        display: '表示',
        allStories: '全階',
        currentStory: '現階',
        story: '階',
        zRange: 'Z範囲',
        members: '部材',
        columns: '柱',
        beams: '梁',
        walls: '壁',
        slabs: 'スラブ',
        mode: 'モード',
        axis: '軸',
        position: '位置',
        thickness: '厚み',
        engine: '形状',
        off: 'OFF',
        clip: '片側',
        slice: 'スライス',
        box: 'ボックス',
        native: '標準',
        opencascade: 'OpenCascade',
        runtimeMissing: '外部ランタイム未検出',
      }
    : {
        section: 'Section',
        display: 'Display',
        allStories: 'All',
        currentStory: 'Current',
        story: 'Story',
        zRange: 'Z Range',
        members: 'Members',
        columns: 'Columns',
        beams: 'Beams',
        walls: 'Walls',
        slabs: 'Slabs',
        mode: 'Mode',
        axis: 'Axis',
        position: 'Position',
        thickness: 'Thickness',
        engine: 'Geometry',
        off: 'OFF',
        clip: 'Clip',
        slice: 'Slice',
        box: 'Box',
        native: 'Native',
        opencascade: 'OpenCascade',
        runtimeMissing: 'Runtime not detected',
      };
}

export type ViewerLabels = ReturnType<typeof getViewerLabels>;
