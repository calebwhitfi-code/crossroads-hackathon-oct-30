# Changelog

## Final hackathon push

### 1. Interactive static photo grading

- Added a bundled fictional lesson photo and rubric to the GitHub Pages demo.
- Added browser-only deterministic mock grading with criterion feedback, adjustment, approval, and discard controls.
- Approved results update assignments, the gradebook, GPA, and transcript; pending results do not.
- Demo changes persist in `localStorage`, with a Reset demo control that restores seed data.

### 2. Student management

- Added parent-only add, edit, and delete student workflows to the full app and static demo.
- Student records are family-scoped, new profiles appear in the switcher, and student views remain restricted to their own records.
- Deleting a student with graded work requires an explicit confirmation dialog.
- Added validation, family-isolation, empty-state, visibility, and deletion coverage.

### 3. Verification

- Added upload-validator coverage for supported types, the 5 MB limit, and clear HEIC/HEIF guidance.
- Added `docs/VERIFICATION.md` for real-phone mock/live grading and transcript-print checks.
- Expanded static end-to-end coverage for grading, persistence, reset, and student management.

### 4. Documentation and submission

- Reworked the README opening with the live demo, three-command local setup, screenshots, and current feature scope.
- Removed stale Phase 3 copy and retained explicit authentication, calendar, and production-persistence limitations.
- Verified the production app and GitHub Pages build through the repository test suite.
