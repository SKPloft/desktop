# i18n Progress Tracker

**Last updated: 2026-06-04**  
**Total sessions: 8**  
**Extracted keys: 364 → 670 (+306, +84%)**

## Overall Extraction Progress

| Checkpoint | Frontend Keys | Delta |
|-----------|---------------|-------|
| Starting | 364 | — |
| Session 1 | 466 | +102 |
| Session 2 | 496 | +30 |
| Session 3 | 520 | +24 |
| Session 4 | 545 | +25 |
| Session 5 | 557 | +12 |
| Session 6 | 631 | +74 |
| Session 7 | 665 | +34 |
| Session 8 | 670 | +5 |
| **Total** | **670** | **+306** |

## Files Wrapped (60 total)

### Routes (6 files)
- [x] `src/routes/runbooks/CollaborationManager.tsx`
- [x] `src/routes/runbooks/RunbookControls.tsx`
- [x] `src/routes/history/History.tsx` — no visible strings
- [x] `src/routes/root/WorkspaceWatcher.tsx` — returns null
- [x] `src/routes/root/deep.ts` — pure logic
- [x] `src/routes/root/menu.ts` — comments only

### LLM Tools (2 files)
- [x] `src-llmtools/components/SessionDetail.tsx` — full i18n
- [x] `src-llmtools/components/SessionList.tsx` — full i18n

### Block Specs (8 files — all insert functions)
- [x] `src/lib/blocks/http/spec.tsx`
- [x] `src/lib/blocks/terminal/spec.tsx`
- [x] `src/lib/blocks/kubernetes/spec.tsx`
- [x] `src/lib/blocks/localdirectory/spec.tsx`
- [x] `src/lib/blocks/codeberg-preview/spec.tsx` — no insert function
- [x] `src/lib/blocks/github-preview/spec.tsx` — no insert function
- [x] `src/lib/blocks/gitlab-preview/spec.tsx` — no insert function
- [x] `src/components/runbooks/editor/blocks/Postgres/Postgres.tsx` — insertPostgres
- [x] `src/components/runbooks/editor/blocks/Clickhouse/Clickhouse.tsx` — insertClickhouse

### HTTP Block System (5 files)
- [x] `src/lib/blocks/http/component.tsx`
- [x] `src/lib/blocks/http/components/VerbDropdown.tsx`
- [x] `src/lib/blocks/http/components/RequestHeaders.tsx`
- [x] `src/lib/blocks/http/components/HttpResponse.tsx`
- [x] `src/lib/blocks/http/spec.tsx`

### Kubernetes Block (1 file)
- [x] `src/lib/blocks/kubernetes/component.tsx` — full i18n

### Common Blocks (6 files)
- [x] `src/lib/blocks/common/ErrorCard.tsx`
- [x] `src/lib/blocks/common/SQLResults.tsx`
- [x] `src/lib/blocks/common/Dependency/Dependency.tsx` — full modal i18n
- [x] `src/lib/blocks/common/CodeEditor/CodeEditor.tsx`
- [x] `src/lib/blocks/common/SQL.tsx` — shared SQL component, all dropdowns/placeholders
- [x] `src/lib/blocks/common/Block.tsx` — dynamic tooltip, deferred
- [x] `src/lib/blocks/common/PlayButton.tsx` — aria labels + tooltip

### Editor Blocks (14 files)
- [x] `src/components/runbooks/editor/blocks/Env/index.tsx`
- [x] `src/components/runbooks/editor/blocks/Directory/index.tsx`
- [x] `src/components/runbooks/editor/blocks/Var/index.tsx`
- [x] `src/components/runbooks/editor/blocks/VarDisplay/index.tsx`
- [x] `src/components/runbooks/editor/blocks/LocalVar/index.tsx`
- [x] `src/components/runbooks/editor/blocks/Pause/index.tsx`
- [x] `src/components/runbooks/editor/blocks/Host/HostSelect.tsx`
- [x] `src/components/runbooks/editor/blocks/MarkdownRender/index.tsx`
- [x] `src/components/runbooks/editor/blocks/Editor/Editor.tsx`
- [x] `src/components/runbooks/editor/blocks/Dropdown/Dropdown.tsx` — full i18n, modal tabs, placeholders
- [x] `src/components/runbooks/editor/blocks/SubRunbook/SubRunbook.tsx` — full i18n, status labels, settings modal
- [x] `src/components/runbooks/editor/blocks/ssh/SshConnect.tsx` — full i18n, settings modal, radio groups
- [x] `src/components/runbooks/editor/blocks/Script/Script.tsx` — tooltips, shell warning, output variable
- [x] `src/components/runbooks/editor/blocks/TableOfContents/index.tsx` — headings list, empty state

### Database Blocks (3 files)
- [x] `src/components/runbooks/editor/blocks/MySQL/MySQL.tsx`
- [x] `src/components/runbooks/editor/blocks/Postgres/Postgres.tsx`
- [x] `src/components/runbooks/editor/blocks/Clickhouse/Clickhouse.tsx`

### Terminal (1 file)
- [x] `src/lib/blocks/terminal/component.tsx`

### Prometheus (1 file)
- [x] `src/components/runbooks/editor/blocks/Prometheus/Prometheus.tsx` — partial

### History (2 files)
- [x] `src/components/HistorySearch.tsx`
- [x] `src/components/history/HistoryRow.tsx`

### Local Directory (1 file)
- [x] `src/lib/blocks/localdirectory/component.tsx`

### Stage 6 — UI Popups & Dialogs (5 files)
- [x] `src/components/runbooks/editor/ui/SavedBlockPopup.tsx` — delete dialog, search, selector
- [x] `src/components/runbooks/editor/ui/AIPopupBase.tsx` — quick suggestions, error fallback
- [x] `src/components/runbooks/editor/ui/RunbookLinkPopup.tsx` — search, selector help
- [x] `src/components/runbooks/editor/ui/AIFocusOverlay.tsx` — describe, send, run, accept, edit, dismiss
- [x] `src/components/runbooks/List/ConvertWorkspaceDialog.tsx` — full workspace conversion dialog + FolderPicker

### Stage 6 — Library Files (2 files)
- [x] `src/lib/blocks/terminal/useTerminalEvents.ts` — error toast
- [x] `src/lib/workspace_setup.ts` — welcome workspace dialog

### Skipped (no user-visible strings)
- [x] `src/components/runbooks/List/TreeView/InlineInput.tsx` — pure input component
- [x] `src/lib/blocks/terminal/components/terminal.tsx` — pure terminal renderer
- [x] `src/lib/workspaces/commands.ts` — pure Tauri invoke wrappers

---

## Remaining Work (prioritized)

### Low Priority — Few or no user-visible strings
- [ ] `src/components/TopCommands/TopCommands.tsx`
- [ ] `src/components/runbooks/List/TreeView/RunbookTreeRow.tsx`
- [ ] `src/components/history/HistoryInspect.tsx`
- [ ] `src/api/` files (mostly error messages)
- [ ] Settings sub-panels (main Settings.tsx already wrapped)
- [ ] Various shadcn/ui wrapper components
- [ ] Preview block components (LoadingState, CodePreview, RepoPreview — mostly skeleton/empty)

### Backend (Rust)
- [ ] 69 `.rs` files — currently 25 keys extracted
- [ ] Use `.translate()` method and `tr()`, `tr_ui()`, `translate_ui()` helpers

---

## Key Patterns

### React Components
```tsx
import { useTranslation } from "@/lib/i18n";

function MyComponent() {
  const { t } = useTranslation();
  return <Button>{t("common.save")}</Button>;
}
```

### Non-React Modules (spec insert functions)
```tsx
import { t } from "@/lib/i18n";

export const insertFoo = (editor: any) => ({
  title: t("editor.blocks.foo.title"),
  group: t("editor.blocks.group.execute"),
});
```

### Extraction Commands
```bash
cd /media/skp1238/LargeApps/A_Knowledge_learn/desktop/i18n
bun run i18n:extract          # Both frontend + backend
bun run i18n:extract:frontend # Frontend only
bun run i18n:check            # Check for missing/stale keys
bun run i18n:merge            # Auto-append missing keys
```

### File classification
- **rs-bindings/** (66 files): Auto-generated — skip entirely
- **test files**: Skip
- **Only wrap files with user-visible strings** — pure logic/data files don't need i18n
