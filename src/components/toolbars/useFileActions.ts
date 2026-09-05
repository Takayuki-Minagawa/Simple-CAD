import { describeDxfVersion } from '@/domain/dxf/format';
import { useRef, useState } from 'react';
import { useEditorStore, useProjectStore } from '@/app/store';
import type { ProjectImportSummary } from '@/app/store';
import { useI18n } from '@/i18n';
import { isAbortError, openDxfFile, openIfcFile, openJsonFile, saveFile } from '@/libs/fileSystem';
import {
  runImportWorker,
  type ImportWorkerPayload,
  type ImportWorkerResult,
} from '@/libs/importWorkerClient';
import sampleProject from '@/samples/sample-project.json';
import { instantiateProject } from '@/domain/projectIdentity';
import type { ProjectData } from '@/domain/structural/types';
import { showAlert, showConfirm, showPrompt } from '@/app/browserDialogs';
import { saveWorkspace } from '@/libs/persistence';

export function useFileActions() {
  const data = useProjectStore((state) => state.data);
  const loadProject = useProjectStore((state) => state.loadProject);
  const addExternalRef = useProjectStore((state) => state.addExternalRef);
  const importEntities = useProjectStore((state) => state.importEntities);
  const activeStory = useEditorStore((state) => state.activeStory);
  const { t, locale } = useI18n();
  const [importBusy, setImportBusy] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [saveBusy, setSaveBusy] = useState(false);
  const importControllerRef = useRef<AbortController | null>(null);
  const saveInFlightRef = useRef(false);

  const runImport = async (payload: ImportWorkerPayload): Promise<ImportWorkerResult> => {
    importControllerRef.current?.abort();
    const controller = new AbortController();
    importControllerRef.current = controller;
    setImportBusy(true);
    setImportProgress(0);
    try {
      return await runImportWorker(payload, {
        signal: controller.signal,
        onProgress: setImportProgress,
      });
    } finally {
      if (importControllerRef.current === controller) {
        importControllerRef.current = null;
        setImportBusy(false);
        setImportProgress(0);
      }
    }
  };

  const cancelImport = () => importControllerRef.current?.abort();

  const reportFailure = (label: string, error: unknown) => {
    if (isAbortError(error)) return;
    showAlert(`${label}: ${String(error)}`);
  };

  const confirmProjectPreview = (project: ProjectData, warnings: string[] = []): boolean => {
    const lines =
      locale === 'ja'
        ? [
            `プロジェクト: ${project.project.name}`,
            `階: ${project.stories.length}`,
            `部材: ${project.members.length}`,
            `断面: ${project.sections.length}`,
            warnings.length ? `警告: ${warnings.length}\n${warnings.slice(0, 6).join('\n')}` : '',
            '',
            'この内容を読み込みますか？',
          ]
        : [
            `Project: ${project.project.name}`,
            `Stories: ${project.stories.length}`,
            `Members: ${project.members.length}`,
            `Sections: ${project.sections.length}`,
            warnings.length
              ? `Warnings: ${warnings.length}\n${warnings.slice(0, 6).join('\n')}`
              : '',
            '',
            'Import this project?',
          ];
    return showConfirm(lines.filter(Boolean).join('\n'));
  };

  const handleImportXref = async () => {
    if (!data || importBusy) return;
    const targetGeneration = useProjectStore.getState().documentGeneration;
    try {
      const file = await openJsonFile();
      const parsed = await runImport({ kind: 'json', content: file.content });
      if (parsed.kind !== 'json') return;
      const imported = parsed.result;
      if (!imported.ok) {
        showAlert(imported.errors.map((error) => error.message).join('\n'));
        return;
      }
      if (!confirmProjectPreview(imported.data, imported.warnings)) return;

      const currentProject = useProjectStore.getState();
      if (currentProject.documentGeneration !== targetGeneration) {
        showAlert(
          locale === 'ja'
            ? '取込中にプロジェクトが切り替わったため、外部参照の追加を中止しました。'
            : 'The project changed during import; the external reference was not added.',
        );
        return;
      }
      const currentData = currentProject.data;
      if (!currentData) return;
      const existingRefIds = new Set(
        currentData.externalRefs?.map((existingRef) => existingRef.id),
      );
      let nextRefIndex = (currentData.externalRefs?.length ?? 0) + 1;
      let refId = `xref-${String(nextRefIndex).padStart(3, '0')}`;
      while (existingRefIds.has(refId)) {
        nextRefIndex += 1;
        refId = `xref-${String(nextRefIndex).padStart(3, '0')}`;
      }
      addExternalRef({
        id: refId,
        name: imported.data.project.name || 'Xref',
        data: imported.data,
        offsetX: 0,
        offsetY: 0,
        visible: true,
      });
    } catch (error) {
      reportFailure(locale === 'ja' ? '外部参照の取込に失敗しました' : 'Xref import failed', error);
    }
  };

  const handleOpen = async () => {
    if (importBusy) return;
    const targetGeneration = useProjectStore.getState().documentGeneration;
    try {
      const file = await openJsonFile();
      const parsed = await runImport({ kind: 'json', content: file.content });
      if (parsed.kind !== 'json') return;
      const imported = parsed.result;
      if (!imported.ok) {
        showAlert(imported.errors.map((error) => error.message).join('\n'));
        return;
      }
      if (!confirmProjectPreview(imported.data, imported.warnings)) return;
      if (useProjectStore.getState().documentGeneration !== targetGeneration) {
        showAlert(
          locale === 'ja'
            ? '取込中にプロジェクトが切り替わったため、読み込みを中止しました。'
            : 'The project changed during import; loading was cancelled.',
        );
        return;
      }
      if (useProjectStore.getState().isDirty && !showConfirm(t.confirmUnsaved)) return;
      loadProject(imported.data);
      if (file.handle && parsed.sourceKind === 'project') {
        useProjectStore.getState().setFileHandle(file.handle);
      }
      await saveWorkspace(imported.data, false).catch(() => undefined);
    } catch (error) {
      reportFailure(locale === 'ja' ? 'ファイルを開けませんでした' : 'Could not open file', error);
    }
  };

  const handleSave = async () => {
    if (saveInFlightRef.current) return;
    const start = useProjectStore.getState();
    if (!start.data) return;
    saveInFlightRef.current = true;
    setSaveBusy(true);
    const snapshot = start.data;
    const startRevision = start.currentRevision;
    const startGeneration = start.documentGeneration;
    try {
      const { validateProject } = await import('@/domain/validation');
      const validation = validateProject(snapshot);
      const errors = validation.errors.filter((issue) => issue.level === 'error');
      if (errors.length > 0) {
        showAlert(
          `${locale === 'ja' ? '保存を中止しました。先にデータエラーを修正してください。' : 'Save stopped. Fix validation errors first.'}\n\n${errors
            .slice(0, 12)
            .map((issue) => issue.message)
            .join('\n')}`,
        );
        return;
      }
      const { exportProjectJson } = await import('@/domain/export/jsonExport');
      const handle = await saveFile(
        exportProjectJson(snapshot),
        `${snapshot.project.name}.json`,
        'application/json',
        start.fileHandle,
      );
      const current = useProjectStore.getState();
      const sameDocument = current.documentGeneration === startGeneration;
      if (handle && sameDocument) current.setFileHandle(handle);
      const savedCurrentRevision = sameDocument && current.currentRevision === startRevision;
      if (savedCurrentRevision) {
        current.markClean();
        await saveWorkspace(snapshot, false).catch(() => undefined);
      } else {
        if (current.data) await saveWorkspace(current.data, current.isDirty).catch(() => undefined);
        showAlert(
          locale === 'ja'
            ? '保存開始後の変更はファイルに含まれていません。現在のプロジェクトは未保存のままです。'
            : 'Changes made after saving started are not in the file. The current project remains unsaved.',
        );
      }
    } catch (error) {
      reportFailure(locale === 'ja' ? '保存に失敗しました' : 'Save failed', error);
    } finally {
      saveInFlightRef.current = false;
      setSaveBusy(false);
    }
  };

  const handleSample = async () => {
    if (useProjectStore.getState().isDirty && !showConfirm(t.confirmLoadSample)) return;
    const sample = instantiateProject(sampleProject as unknown as ProjectData);
    loadProject(sample);
    await saveWorkspace(sample, false).catch(() => undefined);
  };

  const handleImportDxf = async () => {
    if (!data || importBusy) return;
    const targetGeneration = useProjectStore.getState().documentGeneration;
    const storyId = activeStory ?? data.stories[0]?.id;
    if (!storyId) {
      showAlert(locale === 'ja' ? '取込先の階がありません。' : 'No target story is available.');
      return;
    }

    try {
      const file = await openDxfFile();
      const convertGeometry = showConfirm(
        locale === 'ja'
          ? '形状を構造部材へ変換しますか？\nOK: 部材生成 / キャンセル: 注記のみ'
          : 'Convert geometry to structural members?\nOK: Generate members / Cancel: annotations only',
      );
      const unitChoice = showPrompt(
        locale === 'ja'
          ? 'DXFの単位を入力してください: auto / mm / cm / m / in'
          : 'DXF source unit: auto / mm / cm / m / in',
        'auto',
      );
      if (unitChoice === null) return;
      const normalizedUnit = unitChoice.trim().toLowerCase();
      const scaleByUnit: Record<string, number | undefined> = {
        auto: undefined,
        mm: 1,
        cm: 10,
        m: 1000,
        in: 25.4,
      };
      if (!(normalizedUnit in scaleByUnit)) {
        showAlert(
          locale === 'ja'
            ? '単位は auto/mm/cm/m/in から選択してください。'
            : 'Choose auto/mm/cm/m/in.',
        );
        return;
      }
      const unitScale = scaleByUnit[normalizedUnit];
      const parsed = await runImport({
        kind: 'dxf',
        content: file.content,
        storyId,
        options: { convertGeometry, ...(unitScale ? { unitScale } : {}) },
      });
      if (parsed.kind !== 'dxf') return;
      const imported = parsed.result;
      if (imported.error) {
        showAlert(imported.error);
        return;
      }
      const counts = {
        column: imported.members.filter((member) => member.type === 'column').length,
        beam: imported.members.filter((member) => member.type === 'beam').length,
        wall: imported.members.filter((member) => member.type === 'wall').length,
        slab: imported.members.filter((member) => member.type === 'slab').length,
      };
      const preview =
        locale === 'ja'
          ? [
              `DXF取込プレビュー（単位: ${normalizedUnit}）`,
              `読込形式: ${describeDxfVersion(imported.sourceVersion)}`,
              `プリミティブ: ${imported.primitiveCount}`,
              `注記: ${imported.annotations.length} / 寸法: ${imported.dimensions.length}`,
              `通り芯: ${imported.grids.length} / 補助線: ${imported.constructionLines.length}`,
              `柱: ${counts.column} / 梁: ${counts.beam} / 壁: ${counts.wall} / スラブ: ${counts.slab}`,
              imported.warnings.length ? `警告:\n${imported.warnings.slice(0, 8).join('\n')}` : '',
              convertGeometry ? '形状変換は推定です。取込後に部材種・寸法を確認してください。' : '',
              '',
              'この内容を追加しますか？',
            ]
          : [
              `DXF import preview (unit: ${normalizedUnit})`,
              `Source format: ${describeDxfVersion(imported.sourceVersion)}`,
              `Primitives: ${imported.primitiveCount}`,
              `Annotations: ${imported.annotations.length} / Dimensions: ${imported.dimensions.length}`,
              `Grids: ${imported.grids.length} / Construction lines: ${imported.constructionLines.length}`,
              `Columns: ${counts.column} / Beams: ${counts.beam} / Walls: ${counts.wall} / Slabs: ${counts.slab}`,
              imported.warnings.length
                ? `Warnings:\n${imported.warnings.slice(0, 8).join('\n')}`
                : '',
              convertGeometry
                ? 'Geometry conversion is heuristic; review member types and dimensions after import.'
                : '',
              '',
              'Add this content?',
            ];
      if (!showConfirm(preview.filter(Boolean).join('\n'))) return;

      // Resolve every lazy dependency before the final target-generation
      // check. No await may occur between that check and the transactional
      // store mutation, otherwise a newly opened document could receive this
      // older DXF batch.
      const dxfMaterial = convertGeometry
        ? (await import('@/domain/import/dxfImport')).DXF_MATERIAL
        : null;
      const currentProject = useProjectStore.getState();
      if (
        currentProject.documentGeneration !== targetGeneration ||
        !currentProject.data?.stories.some((story) => story.id === storyId)
      ) {
        showAlert(
          locale === 'ja'
            ? '取込中に対象プロジェクトまたは階が変更されたため、DXFの追加を中止しました。'
            : 'The target project or story changed during import; the DXF was not added.',
        );
        return;
      }

      const batch = { annotations: imported.annotations };
      let importSummary: ProjectImportSummary;
      if (convertGeometry && dxfMaterial) {
        importSummary = importEntities({
          ...batch,
          materials: [dxfMaterial],
          sections: imported.autoSections,
          members: imported.members,
          dimensions: imported.dimensions,
          grids: imported.grids,
          constructionLines: imported.constructionLines,
        });
      } else {
        importSummary = importEntities(batch);
      }
      const addedTotal = Object.values(importSummary.added).reduce((sum, count) => sum + count, 0);
      const skippedTotal = Object.values(importSummary.skipped).reduce(
        (sum, count) => sum + count,
        0,
      );
      const remappedTotal = Object.keys(importSummary.remappedIds).length;
      showAlert(
        (locale === 'ja'
          ? `DXF取込結果: 追加 ${addedTotal} / スキップ ${skippedTotal} / ID再採番 ${remappedTotal}`
          : `DXF import result: added ${addedTotal} / skipped ${skippedTotal} / IDs remapped ${remappedTotal}`) +
          (importSummary.warnings.length > 0
            ? `\n\n${importSummary.warnings.slice(0, 12).join('\n')}`
            : ''),
      );
    } catch (error) {
      reportFailure(locale === 'ja' ? 'DXF取込に失敗しました' : 'DXF import failed', error);
    }
  };

  const handleImportIfc = async () => {
    if (importBusy) return;
    const targetGeneration = useProjectStore.getState().documentGeneration;
    try {
      const file = await openIfcFile();
      const parsed = await runImport({ kind: 'ifc', content: file.content });
      if (parsed.kind !== 'ifc') return;
      const imported = parsed.result;
      if (!imported.ok) {
        showAlert(imported.errors.map((error) => error.message).join('\n'));
        return;
      }
      if (!confirmProjectPreview(imported.data, imported.warnings)) return;
      if (useProjectStore.getState().documentGeneration !== targetGeneration) {
        showAlert(
          locale === 'ja'
            ? '取込中にプロジェクトが切り替わったため、IFC読み込みを中止しました。'
            : 'The project changed during import; IFC loading was cancelled.',
        );
        return;
      }
      if (useProjectStore.getState().isDirty && !showConfirm(t.confirmUnsaved)) return;
      loadProject(imported.data);
      await saveWorkspace(imported.data, false).catch(() => undefined);
    } catch (error) {
      reportFailure(locale === 'ja' ? 'IFC取込に失敗しました' : 'IFC import failed', error);
    }
  };

  return {
    handleImportXref,
    handleOpen,
    handleSave,
    handleSample,
    handleImportDxf,
    handleImportIfc,
    importBusy,
    importProgress,
    saveBusy,
    cancelImport,
  };
}
