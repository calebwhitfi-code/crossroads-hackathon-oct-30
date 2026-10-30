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
}, { timeout: 60_000 });

after(async () => {
  await browser?.close();
  if (server) { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
});

test("Pages demo loads under the repository path, navigates every view, and exposes no write controls", async () => {
  await browser.navigate(baseUrl);
  for (const view of ["home", "courses", "work", "gradebook", "reviews", "rubrics", "guide", "transcripts"]) {
    await browser.evaluate(`location.hash = ${JSON.stringify(view)}`);
    await waitFor(() => browser.evaluate(`document.querySelector('nav [aria-current="page"]')?.dataset.view === ${JSON.stringify(view)}`));
    assert.match(await browser.evaluate("document.body.innerText"), /Read-only GitHub Pages demo/);
    assert.equal(await browser.evaluate("document.querySelectorAll('main form, main input, main textarea, main button:not([disabled]):not(#print-transcript)').length"), 0);
    assert.doesNotMatch(await browser.evaluate("document.querySelector('main').innerText"), /Loading the read-only/);
  }
  assert.equal(browser.events.filter((event) =>
    event.method === "Runtime.exceptionThrown"
    || (event.method === "Log.entryAdded" && event.params.entry.level === "error")
  ).length, 0);
  for (const event of browser.events.filter((event) => event.method === "Network.requestWillBeSent")) {
    const request = event.params.request;
    if (!request.url.startsWith("http")) continue;
    assert.equal(request.method, "GET");
    assert.ok(request.url.startsWith(baseUrl), `Unexpected external request: ${request.url}`);
  }
});

test("Pages gradebook applies course-specific scales, excludes pending scores, and limits transcripts to completed work", async () => {
  await browser.evaluate("location.hash = 'course/ava-english'");
  await waitFor(() => browser.evaluate("document.querySelector('h1')?.innerText === 'English II'"));
  assert.match(await browser.evaluate("document.querySelector('main').innerText"), /Parent-approved score: B \/ 92 points/);
  await browser.evaluate("location.hash = 'gradebook'");
  await waitFor(() => browser.evaluate("document.querySelector('h1')?.innerText === 'Your gradebook.'"));
  const gradebook = await browser.evaluate("document.querySelector('main').innerText");
  assert.match(gradebook, /3\.333/);
  assert.match(gradebook, /3\.667/);
  assert.match(gradebook, /B \/ 88\.0%/);
  await browser.evaluate("location.hash = 'transcripts'");
  await waitFor(() => browser.evaluate("document.querySelector('h1')?.innerText === 'Printable transcripts.'"));
  const transcript = await browser.evaluate("document.querySelector('main').innerText");
  assert.match(transcript, /English II/);
  assert.match(transcript, /Biology/);
  assert.match(transcript, /3\.50/);
  assert.doesNotMatch(transcript, /Algebra II|Practice review/);
});

test("Pages student profiles show only their sample records, with no overflow on phone, tablet, or desktop", async () => {
  await browser.evaluate("document.querySelector('#profile').value = 'student:ava'; document.querySelector('#profile').dispatchEvent(new Event('change')); location.hash = 'work'");
  await waitFor(() => browser.evaluate("document.querySelector('main').innerText.includes('Student work')"));
  const text = await browser.evaluate("document.querySelector('main').innerText");
  assert.match(text, /Ava Parker/);
  assert.doesNotMatch(text, /Noah Parker|Elena Rivera/);
  for (const width of [390, 820, 1440]) {
    await browser.command("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 });
    for (const view of ["home", "courses", "work", "gradebook", "guide", "transcripts"]) {
      await browser.evaluate(`location.hash = ${JSON.stringify(view)}`);
      await waitFor(() => browser.evaluate(`document.querySelector('nav [aria-current="page"]')?.dataset.view === ${JSON.stringify(view)}`));
      assert.ok(await browser.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), `${view} overflows at ${width}px`);
    }
  }
  await browser.command("Emulation.clearDeviceMetricsOverride");
});
