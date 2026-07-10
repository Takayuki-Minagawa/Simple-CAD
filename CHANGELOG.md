# Changelog

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

### Security

- Hardened SVG generation and rebuilt preview SVG through a strict element/attribute allowlist.
- Updated dependencies and removed all currently reported npm audit findings.

See [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md) for intentional interoperability and solver boundaries.
