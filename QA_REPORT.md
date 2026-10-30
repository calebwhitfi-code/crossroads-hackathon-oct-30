# Homestead QA report

Current verification: production build, all 72 automated tests, and `npm run typecheck` pass. Run with `npm test`; test files run sequentially to avoid competing headless browsers. Coverage includes foundation, grading, transcripts, student work, and the QA suites. Screenshots go to the gitignored `qa-artifacts/`.

Optional Anthropic AI grading is covered with mocked API responses: request structure, score clamping, exact criterion matching, bad-key/invalid-JSON/refusal/truncation/network/timeout fallback, EXIF orientation, and persistent provider labels. Missing-key fallback also passes through the real upload/review UI without approving a grade or storing a photo. No live, billable AI request has been verified; run `npm run test:grader` after configuring your key locally.

| # | Check | Expected | Actual | Status |
|---|-------|----------|--------|--------|
| 1 | Spec data: credits earned | 4.0 | 4.0 on dashboard, gradebook, transcript, print view | PASS |
| 2 | Spec data: credit-weighted GPA | 2.875 | 2.875 computed and displayed; up to 3 decimal places | PASS |
| 3 | Spec data: letters A/B/C/A/D | as spec | match | PASS |
| 4 | Spec data: course percentages | 93.5 / 85.5 / 77.6 / 100 / 61.1 | Match with Tests 50%, Quizzes 20%, Homework 30%; empty-category weights renormalize | FIXED |
| 5 | Dashboard "Graded courses" count | number | showed `[object Object],...` | FIXED |
| 6 | Boundaries 89.9 B, 90 A, 59.9 F, 0, 100 | correct | correct | PASS |
| 7 | Add/edit/delete grade updates %, letter, GPA | immediate | immediate | PASS |
| 8 | Course with no grades | "No grades yet", no NaN/0% | showed "Not graded" | FIXED |
| 9 | Failed course: 0 credits, counts in GPA, rule shown in UI | note present | note missing | FIXED |
| 10 | Cross-student / cross-family grade isolation | hidden | hidden; stale parent tab rejected | PASS |
| 11 | Delete course/student confirmation, no orphans | confirm + cascade | confirm for courses; no student-delete UI exists; DB cascade leaves no orphans | PASS |
| 12 | Blank / tiny / unreadable photo | "retake" message | retake message, nothing saved | PASS |
| 13 | Blurry / not-a-worksheet photo | clear uncertainty or retake message | mock only detects blank/tiny/unreadable; optional AI is instructed not to guess and to report low confidence; live photo verification pending | MANUAL |
| 14 | Rotated, crooked, dim photos | graded, no crash | graded | PASS |
| 15 | 10MB+ image | friendly limit message | client + server friendly message (limit 12 MB body, 5 MB image) | FIXED |
| 16 | Per-criterion points + one-line reason | every result | enforced by validator | PASS |
| 17 | Parent override updates gradebook + GPA | yes | yes | PASS |
| 18 | Provider offline / rate limit / timeout / invalid JSON | clear error, nothing saved | clear error, nothing saved (no handling before) | FIXED |
| 19 | Same input graded 5x | within ~1 pt | mock is identical (deterministic); live AI consistency is unverified | PASS |
| 20 | Strict structured output + no-guess prompt | in boundary | `GRADING_REQUEST` schema, local validation/clamping, and image-instruction defenses | FIXED |
| 21 | Photo double-submit | one suggestion | compare-and-swap on assignment version | FIXED |
| 22 | Negative, >100, letters, empty submits | rejected with message | rejected; negative-number message was misleading, reworded | FIXED |
| 23 | 500-char, emoji, `<script>` names | plain text | plain text | PASS |
| 24 | Double-click create course/grade | no duplicates | one record | PASS |
| 25 | Refresh / back / reopen keeps data | intact | intact (server-side data) | PASS |
| 26 | Secrets in tree and full git history | none | none | PASS |
| 27 | `.env` / `*.db` ignored, never committed | yes | yes | PASS |
| 28 | Photos not publicly reachable | none stored/served | no `public/`, no API routes, photos not persisted | PASS |
| 29 | Authentication | login | App has no login: any visitor can switch to any parent profile. Parent-only rules guard against student UI, not against a real attacker | FAIL (by design, needs your decision) |
| 30 | Layout at 390 / 820 / 1440 px | no overflow | none (12 pages); student work also handles long unbroken titles, instructions, and feedback | PASS |
| 31 | Console errors | none | `/favicon.ico` 404 on every page | FIXED (added `src/app/icon.svg`) |
| 32 | Text contrast (ink, muted, accent on page/card/raised) | >= 4.5:1 | all pass | PASS |
| 33 | Taps photo -> result -> saved | <= 3 | 3 app actions (open grader, choose photo to start grading, Approve & save); native camera/file-picker interactions vary | FIXED |
| 34 | Loading state while grading | shown | "Grading your photo..." status | PASS |
| 35 | Typos / doubled words | none | none | PASS |
| 36 | Stale copy ("Phase 2", etc.) | current | outdated | FIXED |

Totals: PASS 22, FIXED 12, FAIL 1, MANUAL 1.

Student work additionally passes checks for latest-approved feedback only, hidden pending suggestions, sibling/family visibility, read-only controls for both roles, zero scores, empty states, Home/navigation links, and visible keyboard focus. Fixed a long-course-name overflow and a photo-flow test that attempted to edit the review form before it finished rendering.

## Still failing / decisions for you
- Row 29: no login. Profile selection is a demo convenience, not authentication. Use fictional data only and do not expose the demo publicly.
- The optional AI provider is implemented; live AI grading and the real-phone checks below remain unverified.

## Manual real-phone checklist
- [ ] Camera capture opens from the photo input (iOS Safari, Android Chrome).
- [ ] Photo taken sideways / upside down (EXIF) is accepted.
- [ ] Crooked, dim, glare, and shadowed worksheet photos.
- [ ] Blurry photo and a non-worksheet photo (e.g. a pet) get a retake message (needs real AI).
- [ ] Large HEIC/12MP photo: friendly message or successful upload.
- [ ] Real AI provider: scores in range, one-line reasons, same photo 5x within ~1 pt.
- [ ] Airplane mode mid-grade shows an error and saves nothing.
- [ ] Print preview of the transcript on a real device.
