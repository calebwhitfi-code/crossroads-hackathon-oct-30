import Link from "next/link";
import { AssignmentForm } from "@/components/gradebook-forms";
import { visibleCourse } from "@/lib/gradebook";

export const metadata = { title: "New assignment" };

export default async function NewAssignmentPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { profile, course } = await visibleCourse((await params).courseId);
  if (profile.role !== "parent" || course.completed) {
    return <div><h1 className="text-2xl font-semibold">{course.completed ? "Reopen this course to add assignments." : "Assignment setup is for parents."}</h1><Link href={`/courses/${course.id}`} className="text-link mt-4">Back to course</Link></div>;
  }
  return (
    <div className="max-w-3xl space-y-6">
      <div><Link href={`/courses/${course.id}`} className="text-link">Back to course</Link><h1 className="mt-3 text-3xl font-semibold">Add an assignment.</h1><p className="mt-3 text-sm text-muted">{course.name} / {course.academicYear}</p></div>
      <AssignmentForm initial={{ id: "", courseId: course.id, version: 0, title: "", description: "", maxPoints: 100, category: "homework", dueAt: "" }} />
    </div>
  );
}
