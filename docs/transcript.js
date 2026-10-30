import { courseGrade, gradingScaleFor, studentSummary } from "./grades.js";
export function buildTranscript(courses) {
    const rows = new Map();
    for (const course of courses) {
        if (!course.completed)
            continue;
        const grade = courseGrade(course);
        if (!grade || grade.gradedCount !== grade.assignmentCount)
            continue;
        const row = {
            id: course.id, name: course.name, subject: course.subject, curriculum: course.curriculum ?? null,
            gradeLevel: course.gradeLevel, credits: course.credits, weighted: course.weighted,
            letter: grade.letter, percentage: grade.percentage,
            creditsEarned: course.gradeLevel >= 9 && course.gradeLevel <= 12 && grade.letter !== "F" ? course.credits : 0,
            gradingScale: gradingScaleFor(course),
        };
        const list = rows.get(course.academicYear) ?? [];
        list.push({ row, course });
        rows.set(course.academicYear, list);
    }
    const years = [...rows.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([academicYear, items]) => ({
        academicYear,
        rows: items.map((item) => item.row).sort((a, b) => a.name.localeCompare(b.name)),
        summary: studentSummary(items.map((item) => item.course)),
    }));
    const completed = [...rows.values()].flat().map((item) => item.course);
    return { years, cumulative: studentSummary(completed), courseCount: completed.length };
}
