# Changelog

## Unreleased

- Preserve AutoCAD 2000 (AC1015) output and add selectable AutoCAD 2015–2017 compatible (AC1027) and 2018+ (AC1032, default) DXF output in the UI and CLI.
- Add DXF export story selection and import source-version reporting; decode legacy Japanese code pages and preserve Unicode, multiline text, long MTEXT, and text rotation.
- Generate complete DXF tables, entity handles/subclasses and real dimension blocks; store round-trip metadata in registered, chunked XDATA while continuing to read legacy comments.
- Reject binary/truncated DXF, warn on unsupported curved polylines/nonfinite coordinates, and fix classic POLYLINE dummy-point handling and DIMENSION style-name parsing.


## Unreleased

### Added

- IndexedDB autosave recovery, recent projects, persisted editor preferences, and installable PWA support.
- Import previews with warnings, cancellable Web Worker parsing, and single-command DXF import undo.
- Structural supports, nodal/member/area loads, load combinations, masses, diaphragms, member releases, rigid zones, and local axes.
- 3D analysis-result deformation overlays, utilization colors, legends, and result probing.
- Real H-section and hollow-pipe 3D geometry, stable member local-axis orientation, and 2D opening creation/editing.
- Discriminated concrete/steel/wood material properties, wood allowable stresses, material presets, and a selectable JIS H-section geometry library.
- Story/sheet deletion and reordering, connected-joint editing, bulk property edits, and an exposed fillet workflow.
- Playwright smoke/accessibility checks, coverage gates, dependency audits, bundle budgets, and Dependabot configuration.

### Changed

- Made project changes transactional and StrictMode-safe; save points now remain correct across undo/redo.
- Strengthened ID remapping and reference cascades for story duplication, deletion, grids, loads, dimensions, groups, openings, and analysis data.
- Unified coordinate precision and invalid/degenerate geometry rejection across create, transform, import, and export flows.
- Improved DXF unit/layer handling and IFC units, placements, openings, steel profiles, warnings, and round-trip fidelity.
- Lazy-loaded heavy views/exporters and reduced broad store subscriptions and pointer-move rendering work.
- Added export preflight validation and accessible modal/focus/keyboard behavior.
- Added recursive external-reference validation plus section plausibility, column/story-level, and slab-boundary support checks.
- Serialized explicit saves and guarded asynchronous open/import completion so stale work cannot overwrite a newer document or file handle.

### Fixed

- Preserved explicit optional-field clears, prevented no-op history entries, and made member/grid/import edits validate and commit atomically.
- Kept supports, nodal loads, and masses attached to moved joints while safely cleaning newly orphaned analysis points on deletion.
- Preserved legacy material files, face-aligned analysis eccentricity, metadata-free IFC wall openings, IFC section identity, and strict DXF/STEP round trips.
- Isolated autosaves across duplicated tabs with recoverable session ownership, corrected stacked-modal keyboard handling, and hardened PWA update precaching.

### Security

- Hardened SVG generation and rebuilt preview SVG through a strict element/attribute allowlist.
- Updated dependencies and removed all currently reported npm audit findings.

See [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md) for intentional interoperability and solver boundaries.
