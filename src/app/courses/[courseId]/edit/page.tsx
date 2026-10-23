import Link from "next/link";
import { CourseForm, DeleteForm } from "@/components/gradebook-forms";
import { visibleCourse } from "@/lib/gradebook";

export const metadata = { title: "Edit course" };

export default async function EditCoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { profile, course } = await visibleCourse((await params).courseId);
  if (profile.role !== "parent") return <div><h1 className="text-2xl font-semibold">This course is read-only.</h1><Link href={`/courses/${course.id}`} className="text-link mt-4">Back to course</Link></div>;
  return (
    <div className="max-w-3xl space-y-6">
      <div><Link href={`/courses/${course.id}`} className="text-link">Back to course</Link><h1 className="mt-3 text-3xl font-semibold">Edit {course.name}.</h1></div>
      <CourseForm initial={{ id: course.id, version: course.version, studentId: course.studentId, name: course.name, subject: course.subject, curriculum: course.curriculum, credits: course.credits, gradeLevel: course.gradeLevel, academicYear: course.academicYear, weighted: course.weighted, completed: course.completed }} students={profile.family.students} />
      <DeleteForm kind="course" id={course.id} version={course.version} />
    </div>
  );
}
