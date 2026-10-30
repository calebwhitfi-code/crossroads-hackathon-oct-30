# Homestead

A mobile-first homeschool grading app. Phases 1-6: local database, seeded demo families, profile switching, gradebook with GPA and credits, photo grading with a mock provider, printable transcripts, read-only student work and feedback, and responsive UI polish. No real authentication; all demo families are accessible to anyone running the app. Use fictional data only.

## Local setup

Requires Node.js 24 LTS and npm.

```sh
cp .env.example .env
npm ci
npm run db:generate
npm run db:setup
npm run dev
```

Open http://localhost:3000. Select **Switch profile** to open the compact profile menu, then select a numbered parent or student profile. The menu closes when you select a profile, click outside, or press Escape. The selection persists in an HTTP-only cookie and returns you to Home. Student profiles show only that student's workspace, but the switcher is not an authorization mechanism. Both **Home** and the Homestead logo return to the home screen; **Courses** opens the course preview.

If Node was installed locally during setup, add it to your current terminal first:

```sh
export PATH="$HOME/.local/node-lts/bin:$PATH"
```

## Commands

```sh
npm test
npm run typecheck
npm start
```

`npm test` builds the production app, applies migrations to temporary databases, and checks seed integrity, grading, transcripts, student work, profile switching, and responsive layouts. Test files run sequentially so their headless browsers do not compete for resources. The temporary servers and databases are cleaned up afterward; your demo data is not changed. `npm run build` is also available separately.

`npm run db:setup` applies committed migrations and seeds 2 families, 3 students, 8 courses, 8 assignments, and 8 parent-approved manual grades. Stable seed IDs make reruns idempotent without deleting existing work or overwriting saved values. Missing curriculum labels on demo courses are filled on reruns. `npm run db:migrate -- --name description` creates future schema migrations. Prisma 7 uses its official `@prisma/adapter-better-sqlite3` adapter for the local database.

The SQLite database is `prisma/dev.db` and is ignored by Git. Keep `.env` private. `AI_API_KEY` is reserved for a future real grading provider, is never exposed through a `NEXT_PUBLIC_` variable, and is not used yet.

## Scope and design

Theme tokens live in `src/app/globals.css`: page, card, raised, border, ink, muted, accent, and accent-hover. The app uses dark mode only, responsive cards, keyboard focus states, and a mobile-first layout. No external fonts, icon packages, UI kits, or AI SDKs are required.

The Prisma schema includes families, students, courses, assignments, reusable rubrics and criteria, submissions, and per-criterion scores. Each course has an optional saved curriculum label, displayed beneath its name (for example, Saxon Math or Notgrass History), editable in course setup. Parents can create rubric templates. Scores snapshot criterion descriptions and maxima so later rubric edits need not rewrite grading history. Submissions default to `pending_review`; suggested and approved grades are separate fields. Seeded grades represent historical parent-approved manual entries, not automated approvals.

Assignments have Test, Quiz, or Homework categories, weighted 50%, 20%, and 30% respectively. Each category averages its graded assignment percentages equally; empty categories are excluded and remaining weights are renormalized. Existing assignments migrate to Homework. Only the latest approved grade counts; pending and ungraded work never counts as zero.

Phases 1-6 are complete for the local demo. Real authentication and a real AI provider remain separate future work; the calendar remains stretch-only. Future writes must validate points, rubric ownership, and approval state before saving; the schema alone does not enforce those application rules.

## Phase 3: photo grading

- **Rubrics** (`/rubrics`): parents create reusable rubric templates (up to 5 criteria, each with a description and max points). Rubrics belong to one family and cannot be used by another.
- **Grade a photo** (`/assignments/<id>/grade`, linked from each assignment on a course page): choose a rubric and take or upload a JPEG, PNG, or WebP photo (5 MB max, content checked, `accept="image/*" capture`). Choosing a photo starts grading automatically; the Grade photo button also allows explicit retries. The photo is converted to base64 on the server, graded, and discarded; it is not stored.
- **Provider boundary** (`src/lib/grading-provider.ts`): the only entry point is `gradeSubmission(imageBase64, rubric)`. Output is validated strictly (every criterion exactly once, score within 0 and its max, total equals the sum). Only a deterministic **mock** provider exists (no network, no key, not an AI assessment). `GRADING_PROVIDER` defaults to `mock`; any other value errors until a real provider is added that reads `AI_API_KEY` server-side.
- **Review** (`/reviews`): a suggestion is saved as `pending_review` with `suggestedGrade` and per-criterion scores that snapshot each criterion's name, description, and max. Suggestions never count toward grades. Only a parent profile can approve, optionally adjusting points and feedback; Approve & save grade explicitly approves the grade in one tap. The saved confirmation links to the gradebook. Students cannot approve, completed courses must be reopened first, and a submission can be approved only once. Pending suggestions can be discarded.

Seeded grades are unchanged. `tests/grading.test.mjs` covers the validator, mock provider, and approval rules; `tests/grading-flow.test.mjs` drives rubric creation, upload, and approval in headless Chrome.

## Phase 4: transcripts

- **Transcripts** (`/transcripts`, `/transcripts/<studentId>`): one printable transcript per student, grouped by school year. Only completed courses whose every assignment has an approved grade appear, each with final letter and percentage, credits earned, and a weighted flag. Year and cumulative unweighted/weighted GPA and credits reuse `src/lib/grades.ts`; the grouping lives in `src/lib/transcript.ts`. Middle-school courses are listed but excluded from GPA and credits.
- **Visibility**: parents see every student in the active family and get per-course Edit links (to complete or reopen a course). Student profiles see only their own read-only transcript; other students' pages show not-found. Transcripts are derived, so there is nothing separate to edit or migrate.
- **Printing**: **Print transcript** calls the browser print dialog. Print CSS hides navigation and buttons, switches to black on white, avoids splitting a year across pages, and adds a signature line.
- Tests: `tests/transcript.test.mjs` (grouping and GPA) and a headless-Chrome check in `tests/grading-flow.test.mjs` (rendering, visibility, print media).

## Phase 5: student work and feedback

**Student work** (`/work`) lists assignments grouped by student and course, including instructions, due dates, the latest parent-approved score, and its feedback. Assignments without an approved score remain visible without exposing pending suggestions or feedback. Empty courses and missing feedback have explicit messages.

Student profiles see only their own work; parent profiles can view their active family's work. The page is read-only for both roles, with links to existing course pages. Students also have a shortcut from Home. This phase does not add uploads, student editing, real authentication, or a real AI provider.

## Phase 6: polish

The shared navigation includes Student work, and the sidebar and footer no longer advertise completed features as upcoming. Student work handles long course names, instructions, and feedback without horizontal overflow. Automated checks cover 12 pages at phone (390 px), tablet (820 px), and laptop (1440 px) widths, plus student-profile visibility, empty states, keyboard focus, console errors, contrast, and a three-action photo-to-approved-grade flow. Physical-device camera and printing checks remain manual; see `QA_REPORT.md`.

## Demo deployment

Run locally for this SQLite-file demo. Vercel's serverless filesystem does not provide a persistent writable SQLite database. Do not deploy this configuration to Vercel expecting saved grades to persist. A storage change requires approval.

To open the local demo on a phone, connect both devices to the same trusted Wi-Fi and run `npm run dev -- --hostname 0.0.0.0`. Visit your computer's LAN IP on port 3000. Do not expose the unauthenticated demo to the public internet.
