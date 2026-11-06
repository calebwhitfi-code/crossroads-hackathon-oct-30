# Final verification checklist

Automated checks run without a real phone or a billable Anthropic request. Manual-only rows remain explicitly unverified rather than being reported as passes.

| Area | Check | Status | Evidence / next action |
|---|---|---|---|
| Upload validation | JPEG, PNG, GIF, and WebP signatures are accepted | PASS | Automated coverage in `tests/grading.test.mjs` and existing photo-flow tests |
| Upload validation | Files over 5 MB show a clear limit message | PASS | Unit and browser coverage |
| Upload validation | HEIC/HEIF shows export-to-JPEG-or-PNG guidance | PASS | Unit coverage in `tests/grading.test.mjs` |
| Mock grading | Generated fixture can upload, grade, review, and approve | PASS | Existing full-app browser grading flow |
| Static asset | Original fictional JPEG renders in the browser-only sample workflow | PASS | `tests/pages-demo.test.mjs` verifies the deployed nested asset |
| Static demo | Pending result does not affect GPA or transcript | PASS | `tests/pages-demo.test.mjs` |
| Static demo | Approval persists across reload; Reset restores seed data | PASS | `tests/pages-demo.test.mjs` |
| Real phone / mock | Take a new photo, upload it, receive mock feedback, approve it | NOT RUN | Requires iOS Safari or Android Chrome on the same trusted network |
| Real phone / live AI | Take a new photo and receive an Anthropic result | NOT RUN | Requires a physical phone, internet access, and a configured billable API key |
| Real phone / orientation | Sideways or upside-down EXIF photo is corrected | NOT RUN | Orientation code and mocked coverage pass; confirm with a physical-device photo |
| Real phone / difficult images | Crooked, dim, glare, shadow, blurry, and non-worksheet photos respond appropriately | NOT RUN | Requires real camera samples and live AI for the no-guess behavior |
| Connectivity | Airplane mode during live grading shows an error and saves nothing | NOT RUN | Requires a physical device and live provider session |
| Transcript printing | Browser print preview is readable and navigation is hidden | NOT RUN | Print CSS is automated; confirm paper/PDF output on the submission device |

## Manual run notes

1. Start the full app with `npm run dev -- --hostname 0.0.0.0` and open the computer's LAN address from a phone on the same trusted Wi-Fi.
2. Run the mock rows with `GRADER=mock`.
3. Run the live row only after setting `GRADER=ai` and a private `ANTHROPIC_API_KEY` in `.env`; it incurs API charges.
4. Record the device/browser, date, and PASS or FAIL in this file. Never add photos containing real student information.
