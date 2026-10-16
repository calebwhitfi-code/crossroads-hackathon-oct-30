# Homestead

A mobile-first homeschool grading app. **Phase 1 only:** local database, seeded demo families, profile switching, responsive app shell, and read-only course previews. No real authentication; all demo families are accessible to anyone running the app. Use fictional data only.

## Local setup

Requires Node.js 24 LTS and npm.

```sh
cp .env.example .env
npm ci
npm run db:generate
npm run db:setup
npm run dev
```

Open http://localhost:3000. Choose a family parent or individual student in the demo profile selector, then select **Switch profile**. The selection persists in an HTTP-only cookie. Student profiles show only that student's workspace, but the switcher is not an authorization mechanism.

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

`npm test` builds the production app, applies migrations to a temporary database, and checks seed integrity, repeatability, approval defaults, rendered pages, and real profile-switch form submissions. The temporary server and database are cleaned up afterward; your demo data is not changed. `npm run build` is also available separately.

`npm run db:setup` applies committed migrations and seeds 2 families, 3 students, 8 courses, 8 assignments, and 8 parent-approved manual grades. Stable seed IDs make reruns idempotent without deleting or overwriting existing work. `npm run db:migrate -- --name description` creates future schema migrations. Prisma 7 uses its official `@prisma/adapter-better-sqlite3` adapter for the local database.

The SQLite database is `prisma/dev.db` and is ignored by Git. Keep `.env` private. `AI_API_KEY` is reserved for Phase 3, is never exposed through a `NEXT_PUBLIC_` variable, and is not used yet.

## Scope and design

Theme tokens live in `src/app/globals.css`: page, card, raised, border, ink, muted, accent, and accent-hover. The app uses dark mode only, responsive cards, keyboard focus states, and a mobile-first layout. No external fonts, icon packages, UI kits, or AI SDKs are required.

The Prisma schema includes families, students, courses, assignments, reusable rubrics and criteria, submissions, and per-criterion scores. Scores snapshot criterion descriptions and maxima so later rubric edits need not rewrite grading history. Submissions default to `pending_review`; suggested and approved grades are separate fields. Phase 1 creates no AI grades. Seeded grades represent historical parent-approved manual entries, not automated approvals.

Next: Phase 2 gradebook CRUD, manual entry, GPA and credits; Phase 3 the single `gradeSubmission(imageBase64, rubric)` provider boundary, rubric templates, photo capture, validated JSON and parent approval; Phase 4 transcripts; Phase 5 student work and feedback; Phase 6 polish. The calendar remains stretch-only. Future writes must validate points, rubric ownership, and approval state before saving; the schema alone does not enforce those application rules.

## Demo deployment

Run locally for this SQLite-file demo. Vercel's serverless filesystem does not provide a persistent writable SQLite database. Do not deploy this configuration to Vercel expecting saved grades to persist. A storage change requires approval.

To open the local demo on a phone, connect both devices to the same trusted Wi-Fi and run `npm run dev -- --hostname 0.0.0.0`. Visit your computer's LAN IP on port 3000. Do not expose the unauthenticated demo to the public internet.
