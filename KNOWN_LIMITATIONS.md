# Known limitations

- Simple-CAD edits and exchanges structural analysis models, but does not include a numerical analysis solver. Result visualization requires an imported `simple-cad.structural-analysis/v1` result payload.
- IFC support targets the documented IFC4 structural/basic swept-solid subset. Unsupported B-reps, mapped geometry, and vendor-specific entities are skipped or approximated with explicit warnings.
- DXF-to-structural conversion is heuristic. Always review inferred units, layers, member types, sections, and warnings before using imported geometry for engineering work.
- DXF cannot preserve every Simple-CAD semantic field. Structural JSON is the loss-minimizing interchange format for supports, loads, releases, masses, diaphragms, and results.
- Offline use becomes reliable after the first successful online load has cached the generated application assets. Browser storage can still be cleared by the user or the browser.
- External-reference projects are recursively validated but intentionally remain read-only from the host project.
- JIS H-section presets provide geometry only. Section plausibility/cover checks are advisory warnings and do not replace project-specific code, fire, exposure, or strength verification.
- Very large models remain bounded by browser memory and GPU capacity. The 3D viewer is lazy-loaded and interaction paths are optimized, but it is not a replacement for desktop-scale BIM streaming.

- DXF version conversion re-exports supported imported structural geometry; it does not preserve arbitrary source entities or all drawing settings. Binary DXF and block INSERT expansion are unsupported. Curves/fills and bulged polylines are skipped with warnings during structural import.
