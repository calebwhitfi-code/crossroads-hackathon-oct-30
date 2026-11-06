import {
  CATEGORY_LABELS,
  courseGrade,
  formatCredits,
  formatGpa,
  formatGradingScale,
  formatPercentage,
  latestApproved,
  letterGradeFor,
  studentSummary,
} from "./grades.js";
import { buildTranscript } from "./transcript.js";

const STORAGE_KEY = "homestead-pages-demo-v1";
const date = "2026-10-13T15:00:00.000Z";
const families = [
  { id: "parker", name: "Parker Family" },
  { id: "rivera", name: "Rivera Family" },
];

function seedState() {
  const students = [
    { id: "ava", family: "parker", firstName: "Ava", lastName: "Parker", gradeLevel: 10, schoolYear: "2026-2027" },
    { id: "noah", family: "parker", firstName: "Noah", lastName: "Parker", gradeLevel: 8, schoolYear: "2026-2027" },
    { id: "elena", family: "rivera", firstName: "Elena", lastName: "Rivera", gradeLevel: 11, schoolYear: "2026-2027" },
  ];
  const courses = [
    ["ava-english", "ava", "English II", "Language arts", 92, "Literary analysis", true, false],
    ["ava-algebra", "ava", "Algebra II", "Mathematics", 88, "Quadratic equations", true, true],
    ["ava-biology", "ava", "Biology", "Science", 91, "Cell structure", true, false],
    ["noah-math", "noah", "Pre-Algebra", "Mathematics", 86, "Ratios and proportions", false, false],
    ["noah-history", "noah", "U.S. History", "Social studies", 93, "The Constitutional Convention", false, false],
    ["elena-literature", "elena", "American Literature", "Language arts", 96, "Poetry close reading", true, true],
    ["elena-chemistry", "elena", "Chemistry", "Science", 89, "Balancing equations", false, false],
    ["elena-spanish", "elena", "Spanish III", "World languages", 92, "Past-tense narrative", true, false],
  ].map(([id, studentId, name, subject, points, title, completed, weighted]) => ({
    id,
    studentId,
    name,
    subject,
    completed,
    weighted,
    academicYear: "2026-2027",
    gradeLevel: students.find((student) => student.id === studentId).gradeLevel,
    credits: studentId === "noah" ? 0.5 : 1,
    ...(id === "ava-english" ? { gradeAMin: 93, gradeBMin: 85, gradeCMin: 75, gradeDMin: 65 } : {}),
    assignments: [{
      id: `${id}-work`,
      title,
      category: "homework",
      maxPoints: 100,
      description: "Explain your reasoning and review the assigned material.",
      submissions: [{
        id: `${id}-approved`,
        status: "approved",
        earnedPoints: points,
        approvedAt: date,
        createdAt: date,
        feedback: "Clear understanding. Keep explaining your reasoning and check the marked details.",
      }],
    }],
  }));
  courses.find((course) => course.id === "ava-algebra").assignments.push({
    id: "ava-sample-photo",
    title: "Sample photo review",
    category: "quiz",
    maxPoints: 10,
    description: "Use the bundled fictional worksheet photo and embedded rubric to try the browser-only review workflow.",
    samplePhoto: true,
    rubric: [
      { id: "accuracy", name: "Accuracy", description: "Answers reflect the assigned practice.", maxPoints: 6 },
      { id: "explanation", name: "Explanation", description: "Work is shown with clear reasoning.", maxPoints: 4 },
    ],
    submissions: [],
  });
  return reviveDates({ version: 1, students, courses });
}

function reviveDates(value) {
  if (Array.isArray(value)) return value.map(reviveDates);
  if (!value || typeof value !== "object") return value;
  for (const [key, child] of Object.entries(value)) {
    value[key] = (key === "createdAt" || key === "approvedAt") && child ? new Date(child) : reviveDates(child);
  }
  return value;
}

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (parsed?.version === 1 && Array.isArray(parsed.students) && Array.isArray(parsed.courses)) return reviveDates(parsed);
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
  return seedState();
}

let state = loadState();
let activeProfile = "parent:parker";
let editingStudentId = null;
let deletingStudentId = null;
let flashMessage = "";

const main = document.querySelector("main");
const profile = document.querySelector("#profile");
const deleteDialog = document.querySelector("#delete-student-dialog");
const escape = (value) => String(value).replace(/[&<>"']/g, (character) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]
));
const fullName = (student) => `${student.firstName} ${student.lastName}`;
const courseList = (student) => state.courses.filter((course) => course.studentId === student.id);
const activeRole = () => activeProfile.split(":")[0];
const activeId = () => activeProfile.split(":")[1];
const isParent = () => activeRole() === "parent";
const visibleStudents = () => isParent()
  ? state.students.filter((student) => student.family === activeId())
  : state.students.filter((student) => student.id === activeId());
const visibleCourses = () => visibleStudents().flatMap(courseList);

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function renderProfiles() {
  const validStudents = new Set(state.students.map((student) => student.id));
  if (activeRole() === "student" && !validStudents.has(activeId())) activeProfile = "parent:parker";
  profile.innerHTML = families.map((family) => {
    const parent = `<option value="parent:${family.id}">${escape(family.name)} / Parent</option>`;
    const students = state.students
      .filter((student) => student.family === family.id)
      .map((student) => `<option value="student:${student.id}">${escape(fullName(student))} / Student</option>`)
      .join("");
    return parent + students;
  }).join("");
  profile.value = activeProfile;
}

const heading = (title, description) => (
  `<p class="eyebrow">Homestead / fictional browser-only workspace</p><h1>${title}</h1><p class="intro">${description}</p>`
);
const studentHeading = (student) => `<h2>${escape(fullName(student))}</h2>`;
const openCourse = (course) => `<a class="link" href="#course/${course.id}">Open course</a>`;
const emptyState = (message) => `<p class="notice">${escape(message)}</p>`;

function summary(student, transcript = false) {
  const totals = transcript ? buildTranscript(courseList(student)).cumulative : studentSummary(courseList(student));
  return `<div class="grid summary">
    <div class="card"><p class="meta">Unweighted GPA</p><p class="stat">${formatGpa(totals.unweightedGpa)}</p></div>
    <div class="card"><p class="meta">Weighted GPA</p><p class="stat">${formatGpa(totals.weightedGpa)}</p></div>
    <div class="card"><p class="meta">Earned high-school credits</p><p class="stat">${formatCredits(totals.earnedCredits)}</p><p class="meta">of ${formatCredits(totals.plannedCredits)} planned</p></div>
  </div>`;
}

function courseCard(course) {
  const grade = courseGrade(course);
  return `<article class="card"><p class="meta">${escape(course.subject)} / ${escape(course.academicYear)}</p>
    <h3>${escape(course.name)}</h3>
    <p class="grade">${grade ? `${grade.letter} / ${formatPercentage(grade.percentage)}` : "No grades yet"}</p>
    <p class="meta">${course.completed ? "Complete" : "In progress"} / ${course.credits} planned credits${course.weighted ? " / Weighted" : ""}</p>
    <p class="scale">${escape(formatGradingScale(course))}</p>${openCourse(course)}</article>`;
}

function pendingFor(assignment) {
  return assignment.submissions.find((submission) => submission.status === "pending_review") ?? null;
}

function assignmentCard(course, assignment) {
  const approved = latestApproved(assignment.submissions);
  const pending = pendingFor(assignment);
  const photo = assignment.samplePhoto
    ? `<img class="sample-photo" src="./demo/sample-lesson.jpg" alt="Bundled fictional handwritten algebra worksheet used by the sample grading workflow">`
    : "";
  const rubric = assignment.rubric
    ? `<h5>Embedded rubric</h5><ul>${assignment.rubric.map((criterion) =>
      `<li><strong>${escape(criterion.name)} / ${criterion.maxPoints} points</strong> — ${escape(criterion.description)}</li>`
    ).join("")}</ul>`
    : "";
  const gradeAction = assignment.samplePhoto && isParent()
    ? `<button type="button" data-action="grade-photo" data-course-id="${course.id}" data-assignment-id="${assignment.id}">${pending ? "View pending review" : "Grade sample photo"}</button>`
    : "";
  return `<article class="card"><h4>${escape(assignment.title)}</h4>
    <p class="meta">${CATEGORY_LABELS[assignment.category]} / ${assignment.maxPoints} possible points / Sample due date: Oct 12, 2026</p>
    <p class="muted">${escape(assignment.description)}</p>${photo}${rubric}
    <p class="grade">${approved
      ? `Parent-approved score: ${letterGradeFor(approved.earnedPoints / assignment.maxPoints * 100, course)} / ${approved.earnedPoints} points`
      : "No approved score yet"}</p>
    ${pending ? '<p class="notice">Pending mock feedback is waiting for parent review and does not affect grades.</p>' : ""}
    ${approved?.feedback ? `<p class="meta">Parent feedback</p><p>${escape(approved.feedback)}</p>` : ""}
    ${gradeAction}</article>`;
}

const assignments = (course) => course.assignments.map((assignment) => assignmentCard(course, assignment)).join("");

function reviewCard(course, assignment, submission) {
  const total = submission.criteria.every((criterion) => Number.isFinite(criterion.earnedPoints))
    ? submission.criteria.reduce((sum, criterion) => sum + criterion.earnedPoints, 0)
    : null;
  return `<section class="card" data-review="${submission.id}">
    <p class="eyebrow">Deterministic mock grader / browser only</p>
    <h2>${escape(assignment.title)}</h2>
    <p class="meta">${escape(course.name)} / Bundled sample photo / No upload or network request</p>
    <img class="sample-photo" src="./demo/sample-lesson.jpg" alt="Bundled fictional handwritten algebra worksheet being reviewed">
    <p class="grade" data-review-total>Suggested total: ${total ?? "—"} / ${assignment.maxPoints} points</p>
    ${submission.criteria.map((criterion) => `<div class="row">
      <div><strong>${escape(criterion.name)}</strong><p class="muted">${escape(criterion.feedback)}</p></div>
      <label>${escape(criterion.name)} earned points
        <input class="criterion-input" type="number" min="0" max="${criterion.maxPoints}" step="1"
          value="${criterion.earnedPoints ?? ""}" data-action="criterion-points" data-submission-id="${submission.id}" data-criterion-id="${criterion.id}">
        <small>of ${criterion.maxPoints}</small>
      </label>
    </div>`).join("")}
    <p class="muted">${escape(submission.feedback)}</p>
    <p class="error" role="alert" data-review-error></p>
    <div class="button-row">
      <button type="button" data-action="approve-review" data-course-id="${course.id}" data-assignment-id="${assignment.id}" data-submission-id="${submission.id}">Approve</button>
      <button class="secondary" type="button" data-action="discard-review" data-course-id="${course.id}" data-assignment-id="${assignment.id}" data-submission-id="${submission.id}">Discard</button>
    </div>
  </section>`;
}

function studentForm() {
  const student = state.students.find((item) => item.id === editingStudentId);
  return `<section class="card"><h2>${student ? "Edit student" : "Add student"}</h2>
    <form id="student-form" novalidate>
      <div class="form-grid">
        <label>First name<input name="firstName" maxlength="60" value="${student ? escape(student.firstName) : ""}" aria-required="true"></label>
        <label>Last name<input name="lastName" maxlength="60" value="${student ? escape(student.lastName) : ""}" aria-required="true"></label>
        <label>Grade level<input name="gradeLevel" type="number" min="1" max="12" step="1" value="${student?.gradeLevel ?? ""}" aria-required="true"></label>
        <label>School year <small>YYYY-YYYY</small><input name="schoolYear" inputmode="numeric" placeholder="2026-2027" value="${student ? escape(student.schoolYear) : ""}" aria-required="true"></label>
      </div>
      <p class="error" id="student-form-error" role="alert"></p>
      <div class="button-row"><button type="submit">${student ? "Save student" : "Add student"}</button>
      ${student ? '<button class="secondary" type="button" data-action="cancel-edit">Cancel edit</button>' : ""}</div>
    </form>
  </section>`;
}

function render() {
  renderProfiles();
  const selected = visibleStudents();
  const studentView = !isParent();
  const path = location.hash.slice(1) || "home";
  const view = path.startsWith("course/") ? "courses" : path;
  document.querySelectorAll("nav a").forEach((link) => {
    if (link.dataset.view === view) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  let html;
  if (path === "home") {
    html = heading(
      studentView && selected[0] ? `Your learning starts here, ${escape(selected[0].firstName)}.` : "A little less paperwork. A lot more learning.",
      "Explore courses, approved grades, parent feedback, and printable transcripts. Demo changes are stored only in this browser."
    );
    html += `<div class="stack">${selected.length
      ? selected.map((student) => `<section>${studentHeading(student)}${summary(student)}<a class="link" href="#work">View student work</a></section>`).join("")
      : emptyState("This family has no students yet. Use Students to add one.")}
      <section class="card"><h2>Try one connected grading workflow</h2><p>As the Parker parent, open Algebra II and grade the bundled sample photo. Review the deterministic criterion scores, adjust them, and approve or discard. Pending feedback never changes academic records.</p><p class="notice">Everything runs locally with fictional data. Nothing is uploaded or sent to a server.</p></section></div>`;
  } else if (path === "courses") {
    html = heading("A place for every subject.", "Sample courses include school years, credits, completion status, and course-specific grade scales.")
      + (selected.length
        ? `<div class="stack">${selected.map((student) => `<section>${studentHeading(student)}<div class="grid">${courseList(student).length ? courseList(student).map(courseCard).join("") : emptyState("No courses for this student.")}</div></section>`).join("")}</div>`
        : emptyState("No students or courses are available for this profile."));
  } else if (path.startsWith("course/")) {
    const course = visibleCourses().find((item) => item.id === path.slice(7));
    html = course
      ? heading(escape(course.name), `${escape(course.subject)} / ${escape(course.academicYear)} / ${course.completed ? "Complete" : "In progress"}`)
        + `<div class="stack"><section class="card"><h2>Course grading rules</h2><p>${escape(formatGradingScale(course))}</p><p class="meta">Illustrative app rules, not confirmed publisher instructions.</p><a class="link" href="#guide">See sample grading guide</a></section>${assignments(course)}</div>`
      : heading("Course not available.", 'Choose a visible course from <a href="#courses">Courses</a>.');
  } else if (path === "work") {
    html = heading("Student work", "Read assignment instructions, approved scores, and parent feedback. Pending suggestions do not count as grades.")
      + (selected.length
        ? `<div class="stack">${selected.map((student) => `<section class="stack">${studentHeading(student)}${courseList(student).length
          ? courseList(student).map((course) => `<section class="card"><h3>${escape(course.name)}</h3><div class="stack">${assignments(course)}</div></section>`).join("")
          : emptyState("No student work yet.")}</section>`).join("")}</div>`
        : emptyState("No students are available for this profile."));
  } else if (path === "gradebook") {
    html = heading("Your gradebook.", "Current approved high-school grades determine GPA. Earned credits require completed, fully graded passing courses.")
      + (selected.length
        ? `<div class="stack">${selected.map((student) => `<section class="stack">${studentHeading(student)}${summary(student)}<div class="card">${courseList(student).length
          ? courseList(student).map((course) => {
            const grade = courseGrade(course);
            return `<div class="row"><div><a href="#course/${course.id}">${escape(course.name)}</a><p class="meta">${escape(course.academicYear)} / ${course.completed ? "Complete" : "In progress"}</p><p class="scale">${escape(formatGradingScale(course))}</p></div><p class="grade">${grade ? `${grade.letter} / ${formatPercentage(grade.percentage)}` : "No grades yet"}</p></div>`;
          }).join("")
          : emptyState("No courses are in this gradebook.")}</div></section>`).join("")}
          <p class="notice">Tests 50%, Quizzes 20%, Homework 30%. Empty categories are excluded and remaining weights adjust proportionally. Only the latest approved grade counts; pending work is not zero.</p></div>`
        : emptyState("No students are available for this gradebook."));
  } else if (path === "reviews") {
    html = heading("Grades to review.", "Deterministic mock suggestions never enter the gradebook until a parent explicitly approves them.");
    if (studentView) {
      html += `<p class="notice">Only a parent can review and approve grades. Student profiles can see their approved work.</p>`;
    } else {
      const pending = visibleCourses().flatMap((course) => course.assignments.flatMap((assignment) =>
        assignment.submissions.filter((submission) => submission.status === "pending_review")
          .map((submission) => reviewCard(course, assignment, submission))
      ));
      html += pending.length ? `<div class="stack">${pending.join("")}</div>` : emptyState("No pending feedback. Open a sample-photo assignment to create a mock review.");
    }
  } else if (path === "students") {
    html = heading("Students in this family.", "Parents can add, edit, and delete fictional student profiles. Changes are isolated to the active family and saved in this browser.");
    if (studentView) {
      html += `<p class="notice">Student profiles can only view their own record. Switch to a parent profile to manage students.</p>`;
    } else {
      html += `${flashMessage ? `<p class="notice success">${escape(flashMessage)}</p>` : ""}${studentForm()}<section class="stack"><h2>Current students</h2>${selected.length
        ? selected.map((student) => `<article class="card"><h3>${escape(fullName(student))}</h3><p>${escape(String(student.gradeLevel))}th grade / ${escape(student.schoolYear)}</p><div class="button-row"><button type="button" data-action="edit-student" data-student-id="${student.id}">Edit</button><button class="danger" type="button" data-action="delete-student" data-student-id="${student.id}">Delete</button></div></article>`).join("")
        : emptyState("No students in this family. Add the first student above.")}</section>`;
    }
  } else if (path === "rubrics") {
    html = heading("Embedded sample rubric.", "The browser-only photo workflow uses fixed fictional criteria so it remains deterministic and makes no external request.")
      + `<section class="card"><h2>Sample algebra rubric</h2><div class="row"><div><h3>Accuracy / 6 points</h3><p class="muted">Answers reflect the assigned practice.</p></div></div><div class="row"><div><h3>Explanation / 4 points</h3><p class="muted">Work is shown with clear reasoning.</p></div></div></section>`;
  } else if (path === "guide") {
    const example = state.courses.find((course) => course.id === "ava-english");
    html = heading("Sample grading guide.", "This static demo includes a fixed grading scale. It does not upload, extract, or infer publisher rules.")
      + `<div class="stack"><p class="notice">Fictional browser-only preview. No page is uploaded or read, and no publisher rules are assumed.</p>
      <section class="card"><h2>Review the scale</h2><p class="scale">Sample scale: ${escape(formatGradingScale(example))}</p><p class="muted">Grade and transcript calculations use only parent-approved points.</p></section></div>`;
  } else if (path === "transcripts") {
    html = heading("Printable transcripts.", "Only completed, fully graded courses appear. This is a fictional sample record, not a certified transcript.")
      + `<button id="print-transcript" type="button">Print sample transcript</button>${selected.length
        ? `<div class="stack">${selected.map((student) => {
          const transcript = buildTranscript(courseList(student));
          return `<section class="card transcript"><h2>Sample transcript / ${escape(fullName(student))}</h2>${summary(student, true)}${transcript.years.map((year) => `<h3>${escape(year.academicYear)}</h3><div class="table-wrap"><table><thead><tr><th>Course</th><th>Final grade</th><th>Credits earned</th></tr></thead><tbody>${year.rows.map((row) => `<tr><td>${escape(row.name)}${row.weighted ? " (Weighted)" : ""}<p class="scale">${escape(formatGradingScale(row.gradingScale))}</p></td><td>${row.letter} / ${formatPercentage(row.percentage)}</td><td>${formatCredits(row.creditsEarned)}</td></tr>`).join("")}</tbody></table></div>`).join("") || '<p class="muted">No completed courses yet.</p>'}<p class="print-only">Fictional sample data / interactive browser demonstration. Not an official academic record.</p></section>`;
        }).join("")}</div>`
        : emptyState("No students are available for a transcript.")}`;
  } else {
    html = heading("Page not found.", 'Return to <a href="#home">Home</a> to explore the demonstration.');
  }
  main.innerHTML = html;
  document.querySelector("#print-transcript")?.addEventListener("click", () => window.print());
}

function findAssignment(courseId, assignmentId) {
  const course = state.courses.find((item) => item.id === courseId);
  const assignment = course?.assignments.find((item) => item.id === assignmentId);
  return { course, assignment };
}

function createPending(courseId, assignmentId) {
  const { assignment } = findAssignment(courseId, assignmentId);
  if (!assignment?.samplePhoto || !isParent()) return;
  if (!pendingFor(assignment)) {
    assignment.submissions.push({
      id: `ava-sample-photo-review-${assignment.submissions.length + 1}`,
      status: "pending_review",
      earnedPoints: null,
      approvedAt: null,
      createdAt: new Date("2026-10-14T15:00:00.000Z"),
      feedback: "Check the final calculation and keep each algebra step easy to follow.",
      criteria: [
        { id: "accuracy", name: "Accuracy", maxPoints: 6, earnedPoints: 5, feedback: "Most answers are correct; revisit the final calculation." },
        { id: "explanation", name: "Explanation", maxPoints: 4, earnedPoints: 3, feedback: "The main steps are visible; add one intermediate step." },
      ],
    });
    saveState();
  }
  location.hash = "reviews";
}

function removeSubmission(courseId, assignmentId, submissionId) {
  const { assignment } = findAssignment(courseId, assignmentId);
  if (!assignment) return;
  assignment.submissions = assignment.submissions.filter((submission) => submission.id !== submissionId);
  saveState();
  render();
}

function approveSubmission(courseId, assignmentId, submissionId) {
  const { assignment } = findAssignment(courseId, assignmentId);
  const submission = assignment?.submissions.find((item) => item.id === submissionId && item.status === "pending_review");
  const error = document.querySelector("[data-review-error]");
  if (!assignment || !submission) return;
  if (submission.criteria.some((criterion) => !Number.isFinite(criterion.earnedPoints)
    || criterion.earnedPoints < 0 || criterion.earnedPoints > criterion.maxPoints)) {
    if (error) error.textContent = "Enter valid earned points for every criterion.";
    return;
  }
  submission.earnedPoints = submission.criteria.reduce((sum, criterion) => sum + criterion.earnedPoints, 0);
  submission.status = "approved";
  submission.approvedAt = new Date("2026-10-15T15:00:00.000Z");
  saveState();
  flashMessage = "The sample grade was approved.";
  render();
}

function validateStudent(form) {
  const data = new FormData(form);
  const firstName = String(data.get("firstName") ?? "").trim();
  const lastName = String(data.get("lastName") ?? "").trim();
  const gradeLevel = Number(data.get("gradeLevel"));
  const schoolYear = String(data.get("schoolYear") ?? "").trim();
  if (!firstName || !lastName) return { error: "Enter both a first and last name." };
  if (!Number.isInteger(gradeLevel) || gradeLevel < 1 || gradeLevel > 12) return { error: "Grade level must be a whole number from 1 through 12." };
  const match = schoolYear.match(/^(\d{4})-(\d{4})$/);
  if (!match || Number(match[2]) !== Number(match[1]) + 1) return { error: "School year must use YYYY-YYYY with consecutive years, such as 2026-2027." };
  return { firstName, lastName, gradeLevel, schoolYear };
}

function deleteStudent(studentId) {
  const student = state.students.find((item) => item.id === studentId);
  if (!student || student.family !== activeId()) return;
  state.students = state.students.filter((item) => item.id !== studentId);
  state.courses = state.courses.filter((course) => course.studentId !== studentId);
  if (activeProfile === `student:${studentId}`) activeProfile = `parent:${student.family}`;
  editingStudentId = null;
  deletingStudentId = null;
  saveState();
  flashMessage = `${fullName(student)} was deleted.`;
  deleteDialog.close();
  render();
}

main.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const action = button.dataset.action;
  if (action === "grade-photo") createPending(button.dataset.courseId, button.dataset.assignmentId);
  if (action === "discard-review") removeSubmission(button.dataset.courseId, button.dataset.assignmentId, button.dataset.submissionId);
  if (action === "approve-review") approveSubmission(button.dataset.courseId, button.dataset.assignmentId, button.dataset.submissionId);
  if (action === "edit-student") {
    editingStudentId = button.dataset.studentId;
    flashMessage = "";
    render();
    document.querySelector("#student-form input")?.focus();
  }
  if (action === "cancel-edit") {
    editingStudentId = null;
    render();
  }
  if (action === "delete-student") {
    const student = state.students.find((item) => item.id === button.dataset.studentId && item.family === activeId());
    if (!student) return;
    const hasGradedWork = courseList(student).some((course) => course.assignments.some((assignment) => latestApproved(assignment.submissions)));
    if (!hasGradedWork) {
      deleteStudent(student.id);
      return;
    }
    deletingStudentId = student.id;
    document.querySelector("#delete-dialog-description").textContent =
      `${fullName(student)} has graded work. Deleting this student also removes their courses and academic records from this fictional demo.`;
    deleteDialog.showModal();
  }
});

main.addEventListener("input", (event) => {
  const input = event.target.closest('input[data-action="criterion-points"]');
  if (!input) return;
  const submission = state.courses.flatMap((course) => course.assignments)
    .flatMap((assignment) => assignment.submissions)
    .find((item) => item.id === input.dataset.submissionId);
  const criterion = submission?.criteria?.find((item) => item.id === input.dataset.criterionId);
  if (!criterion) return;
  criterion.earnedPoints = input.value === "" ? null : Number(input.value);
  saveState();
  const total = submission.criteria.every((item) => Number.isFinite(item.earnedPoints))
    ? submission.criteria.reduce((sum, item) => sum + item.earnedPoints, 0)
    : null;
  const totalElement = input.closest("[data-review]")?.querySelector("[data-review-total]");
  if (totalElement) totalElement.textContent = `Suggested total: ${total ?? "—"} / 10 points`;
});

main.addEventListener("submit", (event) => {
  if (event.target.id !== "student-form") return;
  event.preventDefault();
  const result = validateStudent(event.target);
  const error = document.querySelector("#student-form-error");
  if (result.error) {
    error.textContent = result.error;
    return;
  }
  if (editingStudentId) {
    const student = state.students.find((item) => item.id === editingStudentId && item.family === activeId());
    if (!student) return;
    Object.assign(student, result);
    state.courses.filter((course) => course.studentId === student.id).forEach((course) => {
      course.gradeLevel = result.gradeLevel;
    });
    flashMessage = `${fullName(student)} was updated.`;
  } else {
    const id = `student-${Date.now()}`;
    state.students.push({ id, family: activeId(), ...result });
    flashMessage = `${result.firstName} ${result.lastName} was added.`;
  }
  editingStudentId = null;
  saveState();
  render();
});

window.addEventListener("hashchange", () => {
  flashMessage = "";
  editingStudentId = null;
  render();
  main.focus();
});
profile.addEventListener("change", () => {
  activeProfile = profile.value;
  flashMessage = "";
  editingStudentId = null;
  render();
  main.focus();
});
document.querySelector("#reset-demo").addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  state = seedState();
  activeProfile = "parent:parker";
  editingStudentId = null;
  flashMessage = "The exact fictional seed data was restored.";
  location.hash = "home";
  render();
});
document.querySelector("#cancel-delete").addEventListener("click", () => {
  deletingStudentId = null;
  deleteDialog.close();
});
document.querySelector("#confirm-delete").addEventListener("click", () => {
  if (deletingStudentId) deleteStudent(deletingStudentId);
});
deleteDialog.addEventListener("cancel", () => {
  deletingStudentId = null;
});

render();
