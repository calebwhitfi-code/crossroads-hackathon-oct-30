import Link from "next/link";
import { notFound } from "next/navigation";
import { AssignmentForm, DeleteForm } from "@/components/gradebook-forms";
import { db } from "@/lib/db";
import { visibleCourse } from "@/lib/gradebook";

export const metadata = { title: "Edit assignment" };

export default async function EditAssignmentPage({ params }: { params: Promise<{ assignmentId: string }> }) {
  const assignment = await db.assignment.findUnique({ where: { id: (await params).assignmentId } });
  if (!assignment) notFound();
  const { profile, course } = await visibleCourse(assignment.courseId);
  if (profile.role !== "parent" || course.completed) {
    return <div><h1 className="text-2xl font-semibold">{course.completed ? "Reopen this course to edit assignments." : "This assignment is read-only."}</h1><Link href={`/courses/${course.id}`} className="text-link mt-4">Back to course</Link></div>;
  }
  return (
    <div className="max-w-3xl space-y-6">
      <div><Link href={`/courses/${course.id}`} className="text-link">Back to course</Link><h1 className="mt-3 text-3xl font-semibold">Edit assignment.</h1><p className="mt-3 text-sm text-muted">{course.name}</p></div>
      <AssignmentForm initial={{ id: assignment.id, courseId: course.id, version: assignment.version, title: assignment.title, description: assignment.description, maxPoints: assignment.maxPoints, category: assignment.category, dueAt: assignment.dueAt?.toISOString().slice(0, 10) ?? "" }} />
      <DeleteForm kind="assignment" id={assignment.id} version={assignment.version} />
    </div>
  );
}
