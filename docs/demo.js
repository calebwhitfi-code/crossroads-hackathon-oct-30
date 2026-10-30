import { CATEGORY_LABELS, courseGrade, formatCredits, formatGpa, formatGradingScale, formatPercentage, latestApproved, letterGradeFor, studentSummary } from "./grades.js";
import { buildTranscript } from "./transcript.js";

const students = [
  { id: "ava", family: "parker", firstName: "Ava", lastName: "Parker", gradeLevel: 10 },
  { id: "noah", family: "parker", firstName: "Noah", lastName: "Parker", gradeLevel: 8 },
  { id: "elena", family: "rivera", firstName: "Elena", lastName: "Rivera", gradeLevel: 11 },
];
const date = new Date("2026-10-13T15:00:00Z");
const courses = [
  ["ava-english", "ava", "English II", "Language arts", 92, "Literary analysis", true, false],
  ["ava-algebra", "ava", "Algebra II", "Mathematics", 88, "Quadratic equations", false, true],
  ["ava-biology", "ava", "Biology", "Science", 91, "Cell structure", true, false],
  ["noah-math", "noah", "Pre-Algebra", "Mathematics", 86, "Ratios and proportions", false, false],
  ["noah-history", "noah", "U.S. History", "Social studies", 93, "The Constitutional Convention", false, false],
  ["elena-literature", "elena", "American Literature", "Language arts", 96, "Poetry close reading", true, true],
  ["elena-chemistry", "elena", "Chemistry", "Science", 89, "Balancing equations", false, false],
  ["elena-spanish", "elena", "Spanish III", "World languages", 92, "Past-tense narrative", true, false],
].map(([id, studentId, name, subject, points, title, completed, weighted]) => ({
  id, studentId, name, subject, completed, weighted, academicYear: "2026-2027",
  gradeLevel: students.find((student) => student.id === studentId).gradeLevel,
  credits: studentId === "noah" ? 0.5 : 1,
  ...(id === "ava-english" ? { gradeAMin: 93, gradeBMin: 85, gradeCMin: 75, gradeDMin: 65 } : {}),
  assignments: [{
    id: `${id}-work`, title, category: "homework", maxPoints: 100,
    description: "Explain your reasoning and review the assigned material.",
    submissions: [{
      id: `${id}-approved`, status: "approved", earnedPoints: points, approvedAt: date, createdAt: date,
      feedback: "Clear understanding. Keep explaining your reasoning and check the marked details.",
    }],
  }],
}));
courses.find((course) => course.id === "ava-algebra").assignments.push({
  id: "ava-pending", title: "Practice review", category: "quiz", maxPoints: 10,
  description: "A simulated photo-grading suggestion is waiting for parent review.",
  submissions: [{ id: "pending", status: "pending_review", earnedPoints: null, approvedAt: null, createdAt: date }],
});

const main = document.querySelector("main");
const profile = document.querySelector("#profile");
const escape = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
const courseList = (student) => courses.filter((course) => course.studentId === student.id);
const fullName = (student) => `${student.firstName} ${student.lastName}`;
const openCourse = (course) => `<a class="link" href="#course/${course.id}">Open course</a>`;
const heading = (title, description) => `<p class="eyebrow">Homestead / fictional sample workspace</p><h1>${title}</h1><p class="intro">${description}</p>`;
const disabled = (label) => `<button disabled title="Available only in the full server app">${label} / full app only</button>`;
const studentHeading = (student) => `<h2>${fullName(student)}</h2>`;
const summary = (student, transcript = false) => {
  const totals = transcript ? buildTranscript(courseList(student)).cumulative : studentSummary(courseList(student));
  return `<div class="grid summary">
    <div class="card"><p class="meta">Unweighted GPA</p><p class="stat">${formatGpa(totals.unweightedGpa)}</p></div>
    <div class="card"><p class="meta">Weighted GPA</p><p class="stat">${formatGpa(totals.weightedGpa)}</p></div>
    <div class="card"><p class="meta">Earned high-school credits</p><p class="stat">${formatCredits(totals.earnedCredits)}</p><p class="meta">of ${formatCredits(totals.plannedCredits)} planned</p></div>
  </div>`;
};
const courseCard = (course) => {
  const grade = courseGrade(course);
  return `<article class="card"><p class="meta">${course.subject} / ${course.academicYear}</p><h3>${course.name}</h3>
    <p class="grade">${grade ? `${grade.letter} / ${formatPercentage(grade.percentage)}` : "No grades yet"}</p>
    <p class="meta">${course.completed ? "Complete" : "In progress"} / ${course.credits} planned credits${course.weighted ? " / Weighted" : ""}</p>
    <p class="scale">${escape(formatGradingScale(course))}</p>${openCourse(course)}</article>`;
};
const assignments = (course) => course.assignments.map((assignment) => {
  const approved = latestApproved(assignment.submissions);
  const submission = assignment.submissions.find((item) => item.id === approved?.id);
  return `<article class="card"><h4>${assignment.title}</h4>
    <p class="meta">${CATEGORY_LABELS[assignment.category]} / ${assignment.maxPoints} possible points / Sample due date: Oct 12, 2026</p>
    <p class="muted">${assignment.description}</p>
    <p class="grade">${approved ? `Parent-approved score: ${letterGradeFor(approved.earnedPoints / assignment.maxPoints * 100, course)} / ${approved.earnedPoints} points` : "No approved score yet"}</p>
    ${submission ? `<p class="meta">Parent feedback</p><p>${submission.feedback}</p>` : ""}</article>`;
}).join("");

function visibleStudents() {
  const [role, id] = profile.value.split(":");
  return role === "student" ? students.filter((student) => student.id === id) : students.filter((student) => student.family === id);
}

function render() {
  const selected = visibleStudents();
  const studentView = profile.value.startsWith("student:");
  const path = location.hash.slice(1) || "home";
  const view = path.startsWith("course/") ? "courses" : path;
  document.querySelectorAll("nav a").forEach((link) => {
    if (link.dataset.view === view) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  let html;
  if (path === "home") {
    html = heading(studentView ? `Your learning starts here, ${selected[0].firstName}.` : "A little less paperwork. A lot more learning.",
      "Explore courses, approved grades, parent feedback, and printable transcripts. This demonstration uses fixed fictional records.");
    html += `<div class="stack">${selected.map((student) => `<section>${studentHeading(student)}${summary(student)}<a class="link" href="#work">View student work</a></section>`).join("")}
      <section class="card"><h2>One connected grading workflow</h2><p>In the full app: create an assignment, grade manually or request an AI suggestion, review as the parent, then follow progress in the gradebook and transcript.</p><p class="notice">This static site does not perform those writes or make AI requests.</p></section></div>`;
  } else if (path === "courses") {
    html = heading("A place for every subject.", "Sample courses include school years, credits, completion status, and course-specific grade scales.")
      + `<div class="stack">${selected.map((student) => `<section>${studentHeading(student)}<div class="grid">${courseList(student).map(courseCard).join("")}</div></section>`).join("")}</div>`;
  } else if (path.startsWith("course/")) {
    const course = courses.find((item) => item.id === path.slice(7) && selected.some((student) => student.id === item.studentId));
    html = course ? heading(course.name, `${course.subject} / ${course.academicYear} / ${course.completed ? "Complete" : "In progress"}`)
      + `<div class="stack"><section class="card"><h2>Course grading rules</h2><p>${escape(formatGradingScale(course))}</p><p class="meta">Illustrative app rules, not confirmed publisher instructions.</p><a class="link" href="#guide">See sample grading guide</a></section>${assignments(course)}<div>${disabled("Add assignment")} ${disabled("Grade a photo")}</div></div>`
      : heading("Course not available.", 'Choose a visible course from <a href="#courses">Courses</a>.');
  } else if (path === "work") {
    html = heading("Student work", "Read assignment instructions, approved scores, and parent feedback. Pending suggestions do not count as grades.")
      + `<div class="stack">${selected.map((student) => `<section class="stack">${studentHeading(student)}${courseList(student).map((course) => `<section class="card"><h3>${course.name}</h3><div class="stack">${assignments(course)}</div></section>`).join("")}</section>`).join("")}</div>`;
  } else if (path === "gradebook") {
    html = heading("Your gradebook.", "Current approved high-school grades determine GPA. Earned credits require completed, passing courses; middle-school work is excluded.")
      + `<div class="stack">${selected.map((student) => `<section class="stack">${studentHeading(student)}${summary(student)}<div class="card">${courseList(student).map((course) => {
        const grade = courseGrade(course);
        return `<div class="row"><div><a href="#course/${course.id}">${course.name}</a><p class="meta">${course.academicYear} / ${course.completed ? "Complete" : "In progress"}</p><p class="scale">${escape(formatGradingScale(course))}</p></div><p class="grade">${grade.letter} / ${formatPercentage(grade.percentage)}</p></div>`;
      }).join("")}</div></section>`).join("")}
      <p class="notice">Tests 50%, Quizzes 20%, Homework 30%. Empty categories are excluded and remaining weights adjust proportionally. Only the latest approved grade counts; pending work is not zero.</p></div>`;
  } else if (path === "reviews") {
    html = heading("Grades to review.", "Suggestions never enter the gradebook until a parent explicitly approves them.");
    html += studentView ? `<p class="notice">Only a parent can review and approve grades in the full app.</p>` : `<section class="card"><p class="eyebrow">Mock grader / simulated results</p><h2>Practice review</h2><p class="meta">Illustrative review screen; not an actual AI assessment.</p><p class="grade">Suggested: 8 / 10 points</p><div class="row"><span>Accuracy</span><span>5 / 6</span></div><div class="row"><span>Work shown</span><span>3 / 4</span></div><p class="muted">Sample feedback: check the final calculation and explain each step.</p>${disabled("Approve and save")} ${disabled("Discard suggestion")}</section>`;
  } else if (path === "rubrics") {
    html = heading("Reusable rubrics.", "The full app lets parents create criteria with descriptions and maximum points, then use them for photo grading.")
      + `<section class="card"><h2>Sample short-answer rubric</h2><div class="row"><div><h3>Accuracy / 6 points</h3><p class="muted">Answers reflect the assigned reading.</p></div></div><div class="row"><div><h3>Explanation / 4 points</h3><p class="muted">Support answers with clear reasoning.</p></div></div>${disabled("Create rubric")}</section>`;
  } else if (path === "guide") {
    const example = courses.find((course) => course.id === "ava-english");
    html = heading("Photograph a curriculum grading guide.", "In the full app, upload rubric and scale pages, correct the extracted draft, and approve which rules apply to the selected course.")
      + `<div class="stack"><p class="notice">Illustrative preview only. No page was uploaded or read here. No Notgrass or other publisher's rules are assumed.</p>
      <section class="card"><h2>1. Upload the guide</h2><p>One or two rubric/scale photos, up to 5 MB each. Real extraction requires the server app, internet, and its private AI key.</p>${disabled("Read grading guide")}</section>
      <section class="card"><h2>2. Review and approve</h2><p>Parents can correct rubric criteria and A/B/C/D percentage cutoffs before saving. Unreadable or unsupported rules are flagged rather than invented.</p><p class="scale">Sample scale: ${escape(formatGradingScale(example))}</p><p class="muted">Changing a saved scale recalculates letters, GPA, credits, and transcripts from approved points. It does not approve any new grades.</p>${disabled("Approve and apply rules")}</section></div>`;
  } else if (path === "transcripts") {
    html = heading("Printable transcripts.", "Only completed, fully graded courses appear. This is a sample record, not a certified transcript.")
      + `<button id="print-transcript">Print sample transcript</button><div class="stack">${selected.map((student) => {
        const transcript = buildTranscript(courseList(student));
        return `<section class="card transcript"><h2>Sample transcript / ${fullName(student)}</h2>${summary(student, true)}${transcript.years.map((year) => `<h3>${year.academicYear}</h3><div class="table-wrap"><table><thead><tr><th>Course</th><th>Final grade</th><th>Credits earned</th></tr></thead><tbody>${year.rows.map((row) => `<tr><td>${row.name}${row.weighted ? " (Weighted)" : ""}<p class="scale">${escape(formatGradingScale(row.gradingScale))}</p></td><td>${row.letter} / ${formatPercentage(row.percentage)}</td><td>${formatCredits(row.creditsEarned)}</td></tr>`).join("")}</tbody></table></div>`).join("") || '<p class="muted">No completed courses yet.</p>'}<p class="print-only">Fictional sample data / read-only demonstration. Not an official academic record.</p></section>`;
      }).join("")}</div>`;
  } else {
    html = heading("Page not found.", 'Return to <a href="#home">Home</a> to explore the demonstration.');
  }
  main.innerHTML = html;
  document.querySelector("#print-transcript")?.addEventListener("click", () => window.print());
}

window.addEventListener("hashchange", () => { render(); main.focus(); });
profile.addEventListener("change", () => { render(); main.focus(); });
render();
