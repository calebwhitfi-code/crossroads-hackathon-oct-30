import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { pageTools, startApp } from "./harness.mjs";

let app;
let tools;

before(async () => {
  app = await startApp({ browser: true, prefix: "homestead-students-" });
  tools = pageTools(app.browser, app.baseUrl);
}, { timeout: 60_000 });

after(() => app?.stop());

test("parent can add and edit a family-scoped student with validation", async () => {
  await tools.go("/students/new");
  await tools.submit("student", { novalidate: true });
  await tools.bodyHas("First name is required");

  await tools.setValue('input[name="firstName"]', "Casey");
  await tools.setValue('input[name="lastName"]', "Example");
  await tools.setValue('input[name="gradeLevel"]', "10");
  await tools.setValue('input[name="academicYear"]', "2026-2027");
  await tools.submit("student");
  await tools.bodyHas("Student saved");

  const student = await app.db.student.findFirstOrThrow({ where: { familyId: "family-parker", firstName: "Casey" } });
  assert.equal(student.graduationYear, 2029);
  assert.match(await tools.body(), /Casey Example/);

  await tools.go(`/students/${student.id}/edit`);
  await tools.setValue('input[name="firstName"]', "Cameron");
  await tools.submit("student");
  await tools.bodyHas("Student saved");
  assert.equal((await app.db.student.findUniqueOrThrow({ where: { id: student.id } })).firstName, "Cameron");
});

test("new student profile sees only its own records and another family cannot edit it", async () => {
  const student = await app.db.student.findFirstOrThrow({ where: { familyId: "family-parker", firstName: "Cameron" } });
  await tools.profile(`student:${student.id}`);
  await tools.go("/");
  await tools.bodyHas("Cameron Example");
  const visible = await app.browser.evaluate("document.querySelector('main').innerText");
  assert.match(visible, /Cameron Example/);
  assert.doesNotMatch(visible, /Ava Parker|Noah Parker|Elena Rivera/);

  await tools.profile("parent:family-rivera");
  await tools.go(`/students/${student.id}/edit`);
  await tools.bodyHas("That page isn't part");
  assert.equal((await app.db.student.findUniqueOrThrow({ where: { id: student.id } })).familyId, "family-parker");
  await tools.profile("parent:family-parker");
});

test("deleting a student with grades requires the confirmation dialog", async () => {
  await tools.go("/students/student-ava/edit");
  assert.equal(await app.browser.evaluate("document.querySelector('dialog').open"), false);
  await app.browser.evaluate("document.querySelector('button[type=button].button-secondary').click()");
  assert.equal(await app.browser.evaluate("document.querySelector('dialog').open"), true);
  assert.match(await tools.body(), /has graded work/i);
  assert.ok(await app.db.student.findUnique({ where: { id: "student-ava" } }));

  await app.browser.evaluate("document.querySelector('dialog button.button-primary').click()");
  assert.equal(await app.browser.evaluate("document.querySelector('dialog').open"), false);
  assert.ok(await app.db.student.findUnique({ where: { id: "student-ava" } }));

  await app.browser.evaluate("document.querySelector('button[type=button].button-secondary').click()");
  await tools.submit("delete-student");
  await tools.bodyHas("Student and associated records deleted");
  assert.equal(await app.db.student.findUnique({ where: { id: "student-ava" } }), null);
});

test("a family with no students gets an explicit empty state", async () => {
  await app.db.family.create({ data: { id: "family-empty", name: "Empty Family" } });
  await tools.profile("parent:family-empty");
  await tools.go("/");
  await tools.bodyHas("No students yet");
  assert.match(await app.browser.evaluate("document.querySelector('main').innerText"), /No students yet/);
});
