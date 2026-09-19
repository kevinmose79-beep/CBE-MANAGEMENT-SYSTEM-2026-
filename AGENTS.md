# CBE Management System — Architectural Principles & System Invariants

## 1. Supabase as the Single Source of Truth

Treat Supabase/PostgreSQL as the ONLY authoritative source of persistent application data.

### 1. Absolute Data Authority Rule
For every persistent entity in the CBE Management System:
«Supabase is the source of truth.»
LocalStorage, "memoryStorage", React state, component state, cached arrays, and derived frontend objects are NOT authoritative databases.
They may be used only as:
- temporary runtime state;
- performance caches;
- UI state;
- short-lived offline state where explicitly designed.
They must never be allowed to override, resurrect, or contradict the current Supabase database state.

### 2. Create Operations
When creating a persistent record:
1. Validate the input.
2. INSERT the record into Supabase.
3. Confirm the Supabase operation succeeded.
4. Only then update local cache/state.
5. If the Supabase INSERT fails, do not pretend the record was created.
6. Do not permanently store a locally-created record that does not exist in Supabase.

### 3. Update Operations
When editing a persistent record:
1. Use the existing Supabase primary-key UUID.
2. UPDATE the corresponding Supabase row.
3. Confirm the update succeeded.
4. Only then update local cache/state.
5. Never replace an existing record with a newly generated ID.
6. Preserve all foreign-key relationships unless the requested operation explicitly changes them.

### 4. Delete Operations
When deleting a persistent record:
1. Identify the exact Supabase entity and primary key.
2. Check all relevant dependencies before deletion.
3. Perform the DELETE against Supabase.
4. Confirm that Supabase successfully deleted the intended row.
5. Only after successful deletion remove the record from local cache/state.
6. Never perform a frontend-only deletion and assume the database has changed.
7. Never recreate a deleted record from stale localStorage during startup or refresh.

### 5. Synchronisation Rule
Every `syncFromSupabase()` or equivalent hydration process must behave as:
«Supabase → Application state»
Never:
«localStorage → Supabase»
and never:
«localStorage + Supabase → whichever happens to win»

### 6. Deleted Records Must Never Be Resurrected
This is a critical invariant. If a record no longer exists in Supabase, the application must not recreate it because of stale caches, local state, or fallback mechanisms. A refresh must produce current Supabase state.

### 7. Entity Identity Must Be Explicit
Never rely on ambiguous IDs. Where the system contains related entities (Class vs Stream, Academic Year vs Term, Learning Area vs Allocation, Examination vs Assessment, Teacher vs Allocation), use the correct Supabase primary key for the exact entity being modified.

---

## 2. Core CBE System Design & Engineering Principle

> “Coding makes the system smart; good design makes that intelligence understandable to humans.”

### Engineering Goal
Make the CBE system smart:
- automate repetitive educational and administrative processes;
- calculate and validate results accurately;
- detect missing, incomplete, or exceptional data;
- maintain consistent CBE rules;
- preserve data integrity and relationships;
- synchronise information reliably;
- enforce appropriate security and permissions;
- generate meaningful reports and analytics;
- remain maintainable and scalable.

### Design Goal
Make that intelligence understandable to humans:
- present the most important information first;
- distinguish data from status, metadata, warnings, and actions;
- use colour intentionally rather than decoratively;
- avoid unnecessary visual complexity;
- provide clear feedback when something cannot be done;
- make errors and exceptions understandable;
- use terminology that matches the CBE domain;
- behave consistently across the application;
- work clearly in both light and dark modes;
- support accessibility.

---

## 3. Evidence-First Rule — No Assumptions, No Invented Features

1. **Never Present an Assumption as a Fact**: Do not invent, infer, extrapolate, or assume that a feature exists merely because related code, database tables, or functions exist. If you cannot prove it, say: «“Not verified.”»
2. **Distinguish Code Evidence from UI Evidence**: Separate code evidence, runtime evidence, and visual evidence.
3. **Screenshot Verification Overrides Assumptions**: Trust actual user screenshots for what is visibly present.
4. **Audit Before Modifying**: Establish what exists, why it behaves that way, and what the smallest responsible component is.
5. **Surgical Implementation**: Modify only the smallest responsible component, preserve IDs, relationships, calculations, and data.

---

## 4. Dropdowns & Entity Selection Integrity Specification

### Core Requirements:

1. **Explicit Label Requirement**: Every dropdown must have a clear, visible `<label>`. The placeholder option must not be used as a substitute for the label.
2. **No Arbitrary Default Selection**: Start with an explicit placeholder (`Select class...`, `Select stream...`, `Select assessment...`) unless there is a verified, intentional business rule requiring a default.
3. **Existing Option Invariant**: The selected value must actually exist in the currently available options.
4. **No Array Position Fallbacks**: Never use array position as meaning. Never assume `options[0]` means the user's intended class, stream, subject, or assessment.
5. **Parent-Child Cascade & Invalidation Integrity**: If a parent selection changes (e.g. Class changed), any child selection that is no longer valid (e.g. Stream, Learning Area, Learner) must be immediately cleared and reset to placeholder.
6. **No Invalid Stale Values**: Invalid or unhydrated persisted values must not remain selected. Show the placeholder instead.
7. **No Invented Fallback Options**: If the required entity cannot be found, report it or clear selection rather than silently selecting another entity.
8. **No Unexpected Auto-Submits**: Do not auto-submit or unexpectedly jump pages merely because an option was selected in a filter.
9. **Readable & Mobile-Optimized**: Dropdown options should be clearly named, readable, title-cased, and have enough width to display options without clipping. Use `<optgroup>` for semantic hierarchy.
10. **Keyboard & Accessibility**: Use native `<select>` controls for robust keyboard navigation, screen-reader support, and native mobile pickers.
11. **Selection Type Discipline**: Do not use a dropdown when there are only a few choices if visible radio buttons or segmented tabs would be clearer.
12. **Multi-Selection Discipline**: Multi-selection must use checkboxes or multi-select chips, not a standard single dropdown.

### Entity Selection Integrity Rule:
> A selected value is valid only when it corresponds to an actual available entity in the current options. Never infer user intent from array position, stale state, IDs from another entity type, or `[0]`. When the selected value becomes invalid, clear it and display the appropriate placeholder.
