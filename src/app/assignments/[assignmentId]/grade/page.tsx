import Link from "next/link";
import { notFound } from "next/navigation";
import { PhotoGradeForm } from "@/components/grading-forms";
import { db } from "@/lib/db";
import { visibleCourse } from "@/lib/gradebook";

export const metadata = { title: "Grade a photo" };

export default async function GradePhotoPage({ params }: { params: Promise<{ assignmentId: string }> }) {
  const assignment = await db.assignment.findUnique({ where: { id: (await params).assignmentId } });
  if (!assignment) notFound();
  const { profile, course } = await visibleCourse(assignment.courseId);
  if (profile.role !== "parent" || course.completed) {
    return <div><h1 className="text-2xl font-semibold">{course.completed ? "Reopen this course to grade work." : "Photo grading is for parents."}</h1><Link href={`/courses/${course.id}`} className="text-link mt-4">Back to course</Link></div>;
  }
  const rubrics = await db.rubric.findMany({ where: { familyId: profile.family.id }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  return (
    <div className="max-w-3xl space-y-6">
      <div><Link href={`/courses/${course.id}`} className="text-link">Back to course</Link><h1 className="mt-3 text-3xl font-semibold">Grade a photo.</h1><p className="mt-3 text-sm text-muted">{assignment.title} / {assignment.maxPoints} possible points</p></div>
      {rubrics.length
        ? <PhotoGradeForm assignment={{ id: assignment.id, version: assignment.version, rubricId: assignment.rubricId }} rubrics={rubrics} />
        : <p className="rounded-xl border border-border bg-card p-6 text-sm leading-7 text-muted">Create a rubric first. <Link href="/rubrics" className="text-link">Open rubrics</Link></p>}
    </div>
  );
}
