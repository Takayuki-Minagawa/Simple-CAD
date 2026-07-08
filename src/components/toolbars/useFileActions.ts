import { useEditorStore, useProjectStore } from '@/app/store';
import { useI18n } from '@/i18n';
import { openDxfFile, openIfcFile, openJsonFile, saveFile } from '@/libs/fileSystem';
import { importProjectJson } from '@/domain/import/jsonImport';
import {
  importDxf,
  getAutoSections,
  DXF_MATERIAL,
  DXF_MATERIAL_ID,
} from '@/domain/import/dxfImport';
import { exportProjectJson } from '@/domain/export/jsonExport';
import { importIfc } from '@/domain/integration/ifc';
import {
  importStructuralAnalysisJson,
  STRUCTURAL_ANALYSIS_SCHEMA,
} from '@/domain/integration/structuralAnalysisJson';
import sampleProject from '@/samples/sample-project.json';
import type { ProjectData } from '@/domain/structural/types';
import { showAlert, showConfirm } from '@/app/browserDialogs';

export function useFileActions() {
  const {
    data,
    isDirty,
    fileHandle,
    loadProject,
    setFileHandle,
    markClean,
    addAnnotations,
    addExternalRef,
    addMember,
    addMaterial,
    addSection,
    addDimension,
  } = useProjectStore();
  const { activeStory } = useEditorStore();
  const { t, locale } = useI18n();

  const handleImportXref = async () => {
    if (!data) return;
    try {
      const result = await openJsonFile();
      const imported = importProjectJson(result.content);
      if (!imported.ok) {
        showAlert(imported.errors.map((e) => e.message).join('\n'));
        return;
      }
      const existingRefIds = new Set(data.externalRefs?.map((existingRef) => existingRef.id));
      let nextRefIndex = (data.externalRefs?.length ?? 0) + 1;
      let refId = `xref-${String(nextRefIndex).padStart(3, '0')}`;
      while (existingRefIds.has(refId)) {
        nextRefIndex += 1;
        refId = `xref-${String(nextRefIndex).padStart(3, '0')}`;
      }
      const ref = {
        id: refId,
        name: imported.data.project.name || 'Xref',
        data: imported.data,
        offsetX: 0,
        offsetY: 0,
        visible: true,
      };
      addExternalRef(ref);
    } catch {
      // User cancelled
    }
  };

  const handleOpen = async () => {
    try {
      const result = await openJsonFile();
      let detectedSchema: string | null = null;
      try {
        const parsed = JSON.parse(result.content) as { schema?: unknown };
        detectedSchema = typeof parsed.schema === 'string' ? parsed.schema : null;
      } catch {
        // Let the dedicated importer surface the parse error.
      }

      const imported =
        detectedSchema === STRUCTURAL_ANALYSIS_SCHEMA
          ? importStructuralAnalysisJson(result.content)
          : importProjectJson(result.content);
      if (!imported.ok) {
        showAlert(imported.errors.map((e) => e.message).join('\n'));
        return;
      }
      loadProject(imported.data);
      if (result.handle) setFileHandle(result.handle);
    } catch {
      // User cancelled
    }
  };

  const handleSave = async () => {
    if (!data) return;
    const json = exportProjectJson(data);
    try {
      const handle = await saveFile(
        json,
        `${data.project.name}.json`,
        'application/json',
        fileHandle,
      );
      if (handle) setFileHandle(handle);
      markClean();
    } catch {
      // User cancelled
    }
  };

  const handleSample = () => {
    if (isDirty && !showConfirm(t.confirmLoadSample)) return;
    loadProject(sampleProject as unknown as ProjectData);
  };

  const handleImportDxf = async () => {
    if (!data) return;
    const storyId = activeStory ?? data.stories[0]?.id;
    if (!storyId) {
      showAlert(locale === 'ja' ? '取込先の階がありません。' : 'No target story is available.');
      return;
    }

    // Ask the user whether to convert geometry
    const convertGeometry = showConfirm(
      locale === 'ja'
        ? '形状変換ありで取り込みますか？\n\nOK: 形状変換あり（部材生成）\nキャンセル: 注記のみ取込'
        : 'Import with geometry conversion?\n\nOK: With geometry conversion (generate members)\nCancel: Annotations only',
    );

    try {
      const result = await openDxfFile();
      const imported = importDxf(result.content, storyId, { convertGeometry });
      addAnnotations(imported.annotations);

      if (convertGeometry) {
        // Add auto-generated material if not already present
        if (!data.materials.some((m) => m.id === DXF_MATERIAL_ID)) {
          addMaterial(DXF_MATERIAL);
        }

        // Add auto-generated sections if not already present
        const autoSections = getAutoSections(imported);
        for (const section of autoSections) {
          if (!data.sections.some((s) => s.id === section.id)) {
            addSection(section);
          }
        }

        // Add members
        for (const member of imported.members) {
          addMember(member);
        }

        // Add dimensions
        for (const dimension of imported.dimensions) {
          addDimension(dimension);
        }
      }

      const memberCounts = convertGeometry
        ? (() => {
            const walls = imported.members.filter((m) => m.type === 'wall').length;
            const columns = imported.members.filter((m) => m.type === 'column').length;
            const beams = imported.members.filter((m) => m.type === 'beam').length;
            const slabs = imported.members.filter((m) => m.type === 'slab').length;
            const dims = imported.dimensions.length;
            const parts: string[] = [];
            if (walls > 0) parts.push(locale === 'ja' ? `壁: ${walls}` : `Walls: ${walls}`);
            if (columns > 0) parts.push(locale === 'ja' ? `柱: ${columns}` : `Columns: ${columns}`);
            if (beams > 0) parts.push(locale === 'ja' ? `梁: ${beams}` : `Beams: ${beams}`);
            if (slabs > 0) parts.push(locale === 'ja' ? `スラブ: ${slabs}` : `Slabs: ${slabs}`);
            if (dims > 0) parts.push(locale === 'ja' ? `寸法: ${dims}` : `Dimensions: ${dims}`);
            return parts.length > 0 ? parts.join(', ') : '';
          })()
        : '';

      const summary =
        locale === 'ja'
          ? [
              `${imported.annotations.length} 件の注記を ${storyId} に追加しました。`,
              memberCounts ? `部材: ${memberCounts}` : '',
              `検出プリミティブ: ${imported.primitiveCount}`,
              imported.warnings.length > 0
                ? `警告:\n${imported.warnings.slice(0, 8).join('\n')}`
                : '',
            ]
              .filter(Boolean)
              .join('\n')
          : [
              `Imported ${imported.annotations.length} annotations into ${storyId}.`,
              memberCounts ? `Members: ${memberCounts}` : '',
              `Detected primitives: ${imported.primitiveCount}`,
              imported.warnings.length > 0
                ? `Warnings:\n${imported.warnings.slice(0, 8).join('\n')}`
                : '',
            ]
              .filter(Boolean)
              .join('\n');
      showAlert(summary);
    } catch {
      // User cancelled
    }
  };

  const handleImportIfc = async () => {
    try {
      const result = await openIfcFile();
      const imported = importIfc(result.content);
      if (!imported.ok) {
        showAlert(imported.errors.map((error) => error.message).join('\n'));
        return;
      }
      loadProject(imported.data);
    } catch {
      // User cancelled
    }
  };

  return {
    handleImportXref,
    handleOpen,
    handleSave,
    handleSample,
    handleImportDxf,
    handleImportIfc,
  };
}
