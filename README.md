# Homestead

A mobile-first homeschool grading app. Phases 1-6: local database, seeded demo families, profile switching, gradebook with GPA and credits, photo grading with mock or optional Anthropic AI suggestions, printable transcripts, read-only student work and feedback, and responsive UI polish. No real authentication; all demo families are accessible to anyone running the app. Use fictional data only.

## Public GitHub Pages demo

Visit https://calebwhitfi-code.github.io/crossroads-hackathon-oct-30/ for a **read-only demonstration with fixed fictional data**. Explore parent/student sample profiles, courses, assignments, feedback, gradebook calculations, rubric/review previews, grading-guide examples, and printable sample transcripts.

GitHub Pages serves only the static `docs/` directory. It does not run the Next.js server, save grades, accept uploads, or call AI. Profile choices last only while viewing the page and are not authentication. Sample rubric rules are illustrative, not confirmed publisher instructions. The full working app still requires the server-side setup below.

`npm run build:pages` compiles the full app's pure grade/transcript helpers for the static demo without reading `.env` or the database. `npm run test:pages` verifies navigation, project-path assets, read-only controls, sample-profile visibility, and responsive layouts. Rebuild and commit the generated `docs/grades.js` and `docs/transcript.js` whenever their source helpers change. Pages publishes from `main` / `docs`.

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

The SQLite database is `prisma/dev.db` and is ignored by Git. Keep `.env` private. Grader settings and the Anthropic API key are read only on the server and are never exposed to the browser.

## Optional AI grader

Create `.env` locally from `.env.example` if it does not already exist. Do not overwrite an existing `.env`, commit it, or share its contents. Keep the `DATABASE_URL` line, and set:

```dotenv
GRADER=mock
ANTHROPIC_API_KEY=
GRADER_MODEL=claude-sonnet-5-5
```

`GRADER` accepts `mock` or `ai`; blank or unset defaults to `mock`. `GRADER_MODEL` defaults to `claude-sonnet-5-5` when blank or unset. To enable real grading, put your Anthropic API key into `ANTHROPIC_API_KEY` **locally in `.env`**, set `GRADER=ai`, and restart the app. Never use browser-exposed environment variables for these settings.

**Mock needs no internet or API key. AI needs internet, an Anthropic account with API access to the selected model, and incurs API usage charges.** In AI mode, the photo, assignment instructions, and rubric are sent to Anthropic. Homestead does not store the photo, but Anthropic's own data-handling policies apply.

AI uses the official TypeScript SDK and Messages API with strict structured JSON output, a 30-second request timeout, and no automatic retries. Every rubric criterion must appear exactly once. Numeric points are clamped to each criterion's bounds; malformed output, refusals, truncation, network errors, and API errors produce a clearly labeled mock fallback, or a manual-grading message if mock cannot grade the image. Missing API keys also fall back to mock with a visible explanation. Suggestions save the actual provider and fallback explanation, so changing configuration later cannot relabel a previous mock result as AI.

Only JPEG, PNG, GIF, and WebP files up to 5 MB are accepted; HEIC/HEIF must be exported to JPEG or PNG first. Upright images are sent byte-for-byte unchanged. EXIF orientation is applied before sending; images needing rotation are encoded as lossless PNG without resizing or lossy recompression. If that rotated image exceeds 5 MB, AI is not called and the fallback/manual path is used. Unclear handwriting is flagged as low confidence in feedback rather than guessed. Rubrics with duplicate criterion names use mock fallback because the AI schema identifies criteria by name.

After updating an existing checkout:

```sh
npm ci
npm run db:generate
node --env-file=.env node_modules/prisma/build/index.js migrate deploy
npm run dev
```

Run the optional real-provider smoke test:

```sh
npm run test:grader
```

It generates a small fictional arithmetic image in memory, attempts AI grading regardless of `GRADER`, and prints only the validated result, actual provider, and any fallback notice. It saves no photo or database record and exits nonzero if AI did not answer. With a configured key, this makes one billable API request; a missing key prints a mock fallback instead. `npm test` uses mocked API responses and mock grading, including bad-key and invalid-JSON cases, and does not make billable Anthropic requests.

## Scope and design

Theme tokens live in `src/app/globals.css`: page, card, raised, border, ink, muted, accent, and accent-hover. The app uses dark mode only, responsive cards, keyboard focus states, and a mobile-first layout. No external fonts, icon packages, or UI kits are required.

The Prisma schema includes families, students, courses, assignments, reusable rubrics and criteria, submissions, and per-criterion scores. Each course has an optional saved curriculum label, displayed beneath its name (for example, Saxon Math or Notgrass History), editable in course setup. Parents can create rubric templates. Scores snapshot criterion descriptions and maxima so later rubric edits need not rewrite grading history. Submissions default to `pending_review`; suggested and approved grades are separate fields. Seeded grades represent historical parent-approved manual entries, not automated approvals.

Assignments have Test, Quiz, or Homework categories, weighted 50%, 20%, and 30% respectively. Each category averages its graded assignment percentages equally; empty categories are excluded and remaining weights are renormalized. Existing assignments migrate to Homework. Only the latest approved grade counts; pending and ungraded work never counts as zero.

## Photograph a curriculum grading guide

From an open course, choose **Import grading guide**. Upload one or two photos of its rubric and grading-scale pages (JPEG, PNG, GIF, or WebP, up to 5 MB each). With AI enabled, Homestead extracts an editable draft. Nothing is saved or applied until a parent checks the rules, selects which parts to use, and confirms **Approve & apply rules**. Photos are discarded after extraction.

The rubric becomes a reusable template and the course's default photo-grading rubric; parents can still select another rubric before grading an assignment. The scale sets that course's minimum percentages for A, B, C, and D; F is below D. Existing courses retain the default 90/80/70/60 cutoffs unless a parent changes them. Changing a scale recalculates letters, GPA, earned credits, and transcripts from existing approved points; it does not approve any new scores or rewrite historical rubric-score snapshots. Completed courses must be reopened first.

No Notgrass or other publisher's scale is built in or assumed. Missing or unreadable rules are flagged rather than invented. Mock cannot extract publisher rules: when AI is unavailable or extraction fails, enter the rules manually on the same page. This importer supports up to five rubric criteria and A/B/C/D/F percentage cutoffs, not plus/minus grading, raw-point deduction formulas, or category-weight changes. Check those details against the actual curriculum before saving.

Phases 1-6 are complete for the local demo. Real authentication remains separate future work; the calendar remains stretch-only. Future writes must validate points, rubric ownership, and approval state before saving; the schema alone does not enforce those application rules.

## Phase 3: photo grading

- **Rubrics** (`/rubrics`): parents create reusable rubric templates (up to 5 criteria, each with a description and max points). Rubrics belong to one family and cannot be used by another.
- **Grade a photo** (`/assignments/<id>/grade`, linked from each assignment on a course page): choose a rubric and take or upload a JPEG, PNG, GIF, or WebP photo (5 MB max, content checked). Choosing a photo starts grading automatically; the Grade photo button also allows explicit retries. The active provider is shown before upload, and the actual provider and any fallback explanation appear in reviews. The photo is converted to base64 on the server, graded, and discarded; it is not stored.
- **Provider boundary** (`src/lib/grading-provider.ts`): `gradeSubmission(imageBase64, rubric, instructions)` selects mock or AI and validates output before any suggestion is saved. The deterministic mock is the default and is not an AI assessment. AI uses `src/lib/ai-grading-provider.ts`; settings and fallback behavior are described above.
- **Review** (`/reviews`): a suggestion is saved as `pending_review` with `suggestedGrade` and per-criterion scores that snapshot each criterion's name, description, and max. Suggestions never count toward grades. Only a parent profile can approve, optionally adjusting points and feedback; Approve & save grade explicitly approves the grade in one tap. The saved confirmation links to the gradebook. Students cannot approve, completed courses must be reopened first, and a submission can be approved only once. Pending suggestions can be discarded.

Seeded grades are unchanged. `tests/grading.test.mjs` covers the validator, mock provider, and approval rules; `tests/ai-grading.test.mjs` covers AI request structure, validation, fallbacks, and image orientation without network calls. `tests/grading-flow.test.mjs` drives rubric creation, upload, provider labels, pending fallback behavior, and approval in headless Chrome.

## Phase 4: transcripts

- **Transcripts** (`/transcripts`, `/transcripts/<studentId>`): one printable transcript per student, grouped by school year. Only completed courses whose every assignment has an approved grade appear, each with final letter and percentage, credits earned, and a weighted flag. Year and cumulative unweighted/weighted GPA and credits reuse `src/lib/grades.ts`; the grouping lives in `src/lib/transcript.ts`. Middle-school courses are listed but excluded from GPA and credits.
- **Visibility**: parents see every student in the active family and get per-course Edit links (to complete or reopen a course). Student profiles see only their own read-only transcript; other students' pages show not-found. Transcripts are derived, so there is nothing separate to edit or migrate.
- **Printing**: **Print transcript** calls the browser print dialog. Print CSS hides navigation and buttons, switches to black on white, avoids splitting a year across pages, and adds a signature line.
- Tests: `tests/transcript.test.mjs` (grouping and GPA) and a headless-Chrome check in `tests/grading-flow.test.mjs` (rendering, visibility, print media).

## Phase 5: student work and feedback

**Student work** (`/work`) lists assignments grouped by student and course, including instructions, due dates, the latest parent-approved score, and its feedback. Assignments without an approved score remain visible without exposing pending suggestions or feedback. Empty courses and missing feedback have explicit messages.

Student profiles see only their own work; parent profiles can view their active family's work. The page is read-only for both roles, with links to existing course pages. Students also have a shortcut from Home. This page does not add student uploads, student editing, or real authentication.

## Phase 6: polish

The shared navigation includes Student work, and the sidebar and footer no longer advertise completed features as upcoming. Student work handles long course names, instructions, and feedback without horizontal overflow. Automated checks cover 12 pages at phone (390 px), tablet (820 px), and laptop (1440 px) widths, plus student-profile visibility, empty states, keyboard focus, console errors, contrast, and a three-action photo-to-approved-grade flow. Physical-device camera and printing checks remain manual; see `QA_REPORT.md`.

## Demo deployment

Run locally for this SQLite-file demo. Vercel's serverless filesystem does not provide a persistent writable SQLite database. Do not deploy this configuration to Vercel expecting saved grades to persist. A storage change requires approval.

To open the local demo on a phone, connect both devices to the same trusted Wi-Fi and run `npm run dev -- --hostname 0.0.0.0`. Visit your computer's LAN IP on port 3000. Do not expose the unauthenticated demo to the public internet.
