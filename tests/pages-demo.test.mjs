import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { once } from "node:events";
import { startBrowser, waitFor } from "./browser.mjs";

let server;
let browser;
let baseUrl;
const prefix = "/crossroads-hackathon-oct-30/";
const files = {
  "": ["index.html", "text/html"],
  "demo.css": ["demo.css", "text/css"],
  "demo.js": ["demo.js", "text/javascript"],
  "grades.js": ["grades.js", "text/javascript"],
  "transcript.js": ["transcript.js", "text/javascript"],
  "demo/sample-lesson.jpg": ["demo/sample-lesson.jpg", "image/jpeg"],
};

before(async () => {
  server = createServer(async (request, response) => {
    const file = request.url.startsWith(prefix) ? files[request.url.slice(prefix.length)] : null;
    if (!file) { response.writeHead(404).end(); return; }
    response.writeHead(200, { "content-type": file[1] });
    response.end(await readFile(new URL(`../docs/${file[0]}`, import.meta.url)));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${server.address().port}${prefix}`;
  browser = await startBrowser();
  await browser.command("Runtime.enable");
  await browser.command("Log.enable");
  await browser.command("Network.enable");
  await browser.navigate(baseUrl);
}, { timeout: 60_000 });

after(async () => {
  await browser?.close();
  if (server) { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
});

async function resetDemo() {
  await browser.evaluate("document.querySelector('#reset-demo').click()");
  await waitFor(() => browser.evaluate("document.querySelector('h1')?.innerText.includes('paperwork')"));
}

async function route(hash, heading) {
  await browser.evaluate(`location.hash = ${JSON.stringify(hash)}`);
  await waitFor(() => browser.evaluate(`document.querySelector('h1')?.innerText === ${JSON.stringify(heading)}`));
  return browser.evaluate("document.querySelector('main').innerText");
}

async function selectProfile(value) {
  await browser.evaluate(`{
    const select = document.querySelector('#profile');
    select.value = ${JSON.stringify(value)};
    select.dispatchEvent(new Event('change'));
  }`);
  await waitFor(() => browser.evaluate(`document.querySelector('#profile').value === ${JSON.stringify(value)}`));
}

async function click(selector) {
  await browser.evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
}

test("sample photo feedback stays pending, then approval changes GPA and transcript and persists", async () => {
  await resetDemo();
  const scaledCourse = await route("course/ava-english", "English II");
  assert.match(scaledCourse, /Parent-approved score: B \/ 92 points/);
  assert.match(scaledCourse, /A >= 93% \/ B >= 85%/);
  const baselineGradebook = await route("gradebook", "Your gradebook.");
  assert.match(baselineGradebook, /3\.333/);
  assert.match(baselineGradebook, /3\.667/);
  assert.match(baselineGradebook, /Algebra II[\s\S]*B \/ 88\.0%/);
  const baselineTranscript = await route("transcripts", "Printable transcripts.");
  assert.match(baselineTranscript, /English II/);
  assert.match(baselineTranscript, /Biology/);
  assert.match(baselineTranscript, /3\.50/);
  assert.doesNotMatch(baselineTranscript, /Algebra II|Sample photo review/);

  await route("course/ava-algebra", "Algebra II");
  await click('[data-action="grade-photo"]');
  await waitFor(() => browser.evaluate("document.querySelector('h1')?.innerText === 'Grades to review.'"));
  const review = await browser.evaluate("document.querySelector('main').innerText");
  assert.match(review, /Accuracy[\s\S]*of 6/);
  assert.match(review, /Explanation[\s\S]*of 4/);
  assert.deepEqual(
    await browser.evaluate("[...document.querySelectorAll('[data-action=\"criterion-points\"]')].map(input => input.value)"),
    ["5", "3"]
  );
  assert.match(review, /Suggested total: 8 \/ 10/);

  const pendingGradebook = await route("gradebook", "Your gradebook.");
  assert.match(pendingGradebook, /3\.333/);
  assert.match(pendingGradebook, /Algebra II[\s\S]*B \/ 88\.0%/);
  assert.doesNotMatch(await route("transcripts", "Printable transcripts."), /Algebra II/);

  await route("reviews", "Grades to review.");
  await browser.evaluate(`{
    const inputs = [...document.querySelectorAll('[data-action="criterion-points"]')];
    inputs[0].value = '6'; inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
    inputs[1].value = '4'; inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
  }`);
  assert.match(await browser.evaluate("document.querySelector('[data-review-total]').innerText"), /10 \/ 10/);
  await click('[data-action="approve-review"]');
  await waitFor(() => browser.evaluate("document.querySelector('main').innerText.includes('No pending feedback')"));

  const approvedCourse = await route("course/ava-algebra", "Algebra II");
  assert.match(approvedCourse, /Parent-approved score: A \/ 10 points/);
  const approvedGradebook = await route("gradebook", "Your gradebook.");
  assert.match(approvedGradebook, /3\.667/);
  assert.match(approvedGradebook, /4\.00/);
  assert.match(approvedGradebook, /Algebra II[\s\S]*A \/ 92\.8%/);
  assert.match(await route("transcripts", "Printable transcripts."), /Algebra II[\s\S]*A \/ 92\.8%/);

  await browser.evaluate("location.reload()");
  await waitFor(() => browser.evaluate("document.querySelector('h1')?.innerText === 'Printable transcripts.'"));
  assert.match(await browser.evaluate("document.querySelector('main').innerText"), /Algebra II[\s\S]*A \/ 92\.8%/);

  await route("course/ava-algebra", "Algebra II");
  await click('[data-action="grade-photo"]');
  await waitFor(() => browser.evaluate("document.querySelector('[data-action=\"discard-review\"]') !== null"));
  await click('[data-action="discard-review"]');
  await waitFor(() => browser.evaluate("document.querySelector('main').innerText.includes('No pending feedback')"));
  assert.match(await route("course/ava-algebra", "Algebra II"), /Parent-approved score: A \/ 10 points/);
  assert.match(await route("transcripts", "Printable transcripts."), /Algebra II[\s\S]*A \/ 92\.8%/);

  await click("#reset-demo");
  await waitFor(() => browser.evaluate("document.querySelector('h1')?.innerText.includes('paperwork')"));
  assert.equal(await browser.evaluate("localStorage.getItem('homestead-pages-demo-v1')"), null);
  assert.doesNotMatch(await route("transcripts", "Printable transcripts."), /Algebra II/);
  assert.equal(await browser.evaluate("document.querySelectorAll('#profile option').length"), 5);
});

test("discard removes mock feedback without changing approved grade behavior", async () => {
  await resetDemo();
  await route("course/ava-algebra", "Algebra II");
  await click('[data-action="grade-photo"]');
  await waitFor(() => browser.evaluate("document.querySelector('[data-action=\"discard-review\"]') !== null"));
  await click('[data-action="discard-review"]');
  await waitFor(() => browser.evaluate("document.querySelector('main').innerText.includes('No pending feedback')"));
  const course = await route("course/ava-algebra", "Algebra II");
  assert.match(course, /No approved score yet/);
  assert.doesNotMatch(course, /Pending mock feedback/);
  const gradebook = await route("gradebook", "Your gradebook.");
  assert.match(gradebook, /Algebra II[\s\S]*B \/ 88\.0%/);
  assert.doesNotMatch(await route("transcripts", "Printable transcripts."), /Algebra II/);
});

test("parents can manage family students with validation, isolation, persistence, empty states, and graded-work confirmation", async () => {
  await resetDemo();
  await route("students", "Students in this family.");
  await browser.evaluate("document.querySelector('#student-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))");
  assert.match(await browser.evaluate("document.querySelector('#student-form-error').innerText"), /first and last name/);

  await browser.evaluate(`{
    const form = document.querySelector('#student-form');
    form.elements.firstName.value = 'Zoe';
    form.elements.lastName.value = 'Parker';
    form.elements.gradeLevel.value = '7';
    form.elements.schoolYear.value = '2026-2028';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  }`);
  assert.match(await browser.evaluate("document.querySelector('#student-form-error').innerText"), /consecutive years/);
  await browser.evaluate(`{
    const form = document.querySelector('#student-form');
    form.elements.schoolYear.value = '2026-2027';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  }`);
  await waitFor(() => browser.evaluate("document.querySelector('main').innerText.includes('Zoe Parker was added')"));
  assert.ok(await browser.evaluate("[...document.querySelectorAll('#profile option')].some(option => option.textContent.includes('Zoe Parker'))"));

  await browser.evaluate("location.reload()");
  await waitFor(() => browser.evaluate("document.querySelector('main').innerText.includes('Zoe Parker')"));
  const zoeValue = await browser.evaluate("[...document.querySelectorAll('#profile option')].find(option => option.textContent.includes('Zoe Parker')).value");
  await selectProfile(zoeValue);
  const studentHome = await route("home", "Your learning starts here, Zoe.");
  assert.match(studentHome, /Zoe Parker/);
  assert.doesNotMatch(studentHome, /Ava Parker|Noah Parker|Elena Rivera/);
  assert.match(await route("students", "Students in this family."), /Student profiles can only view their own record/);
  assert.equal(await browser.evaluate("document.querySelector('#student-form')"), null);

  await selectProfile("parent:rivera");
  const riveraStudents = await route("students", "Students in this family.");
  assert.match(riveraStudents, /Elena Rivera/);
  assert.doesNotMatch(riveraStudents, /Zoe Parker|Ava Parker|Noah Parker/);

  await selectProfile("parent:parker");
  await route("students", "Students in this family.");
  const zoeId = zoeValue.slice("student:".length);
  await click(`[data-action="edit-student"][data-student-id="${zoeId}"]`);
  await browser.evaluate(`{
    const form = document.querySelector('#student-form');
    form.elements.firstName.value = 'Zoey';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  }`);
  await waitFor(() => browser.evaluate("document.querySelector('main').innerText.includes('Zoey Parker was updated')"));
  assert.ok(await browser.evaluate("[...document.querySelectorAll('#profile option')].some(option => option.textContent.includes('Zoey Parker'))"));
  await click(`[data-action="delete-student"][data-student-id="${zoeId}"]`);
  await waitFor(() => browser.evaluate("document.querySelector('main').innerText.includes('Zoey Parker was deleted')"));
  assert.equal(await browser.evaluate("document.querySelector('#delete-student-dialog').open"), false);

  await selectProfile("parent:rivera");
  await route("students", "Students in this family.");
  await click('[data-action="delete-student"][data-student-id="elena"]');
  assert.equal(await browser.evaluate("document.querySelector('#delete-student-dialog').open"), true);
  assert.match(await browser.evaluate("document.querySelector('#delete-dialog-description').innerText"), /graded work/);
  await click("#cancel-delete");
  assert.equal(await browser.evaluate("document.querySelector('#delete-student-dialog').open"), false);
  assert.match(await browser.evaluate("document.querySelector('main').innerText"), /Elena Rivera/);
  await click('[data-action="delete-student"][data-student-id="elena"]');
  await click("#confirm-delete");
  await waitFor(() => browser.evaluate("document.querySelector('main').innerText.includes('No students in this family')"));
  assert.ok(await browser.evaluate("document.querySelector('main').innerText.includes('No students in this family')"));
  assert.equal(await browser.evaluate("[...document.querySelectorAll('#profile option')].some(option => option.value === 'student:elena')"), false);
});

test("all routes load without console errors, external requests, non-GET requests, or responsive overflow", async () => {
  await resetDemo();
  const assetResponse = await fetch(`${baseUrl}demo/sample-lesson.jpg`);
  assert.equal(assetResponse.status, 200);
  assert.equal(assetResponse.headers.get("content-type"), "image/jpeg");
  assert.ok((await assetResponse.arrayBuffer()).byteLength > 100_000);
  const eventStart = browser.events.length;
  for (const [view, title] of [
    ["home", "A little less paperwork. A lot more learning."],
    ["courses", "A place for every subject."],
    ["course/ava-algebra", "Algebra II"],
    ["work", "Student work"],
    ["gradebook", "Your gradebook."],
    ["reviews", "Grades to review."],
    ["students", "Students in this family."],
    ["rubrics", "Embedded sample rubric."],
    ["guide", "Sample grading guide."],
    ["transcripts", "Printable transcripts."],
  ]) {
    await route(view, title);
    assert.doesNotMatch(await browser.evaluate("document.querySelector('main').innerText"), /Loading the interactive/);
  }
  for (const width of [390, 820, 1440]) {
    await browser.command("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 });
    for (const [view, title] of [["home", "A little less paperwork. A lot more learning."], ["course/ava-algebra", "Algebra II"], ["students", "Students in this family."], ["transcripts", "Printable transcripts."]]) {
      await route(view, title);
      assert.ok(await browser.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), `${view} overflows at ${width}px`);
    }
  }
  await browser.command("Emulation.clearDeviceMetricsOverride");
  const events = browser.events.slice(eventStart);
  assert.equal(events.filter((event) =>
    event.method === "Runtime.exceptionThrown"
    || (event.method === "Log.entryAdded" && event.params.entry.level === "error")
  ).length, 0);
  for (const event of events.filter((item) => item.method === "Network.requestWillBeSent")) {
    const request = event.params.request;
    if (!request.url.startsWith("http")) continue;
    assert.equal(request.method, "GET");
    assert.ok(request.url.startsWith(baseUrl), `Unexpected external request: ${request.url}`);
  }
});
