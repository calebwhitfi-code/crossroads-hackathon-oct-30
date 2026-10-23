import Link from "next/link";
import { CourseForm } from "@/components/gradebook-forms";
import { getProfileContext } from "@/lib/profile";

export const metadata = { title: "New course" };

export default async function NewCoursePage({ searchParams }: { searchParams: Promise<{ student?: string }> }) {
  const profile = await getProfileContext();
  if (profile.role !== "parent") {
    return <div><h1 className="text-2xl font-semibold">Course setup is for parents.</h1><p className="mt-3 text-sm text-muted">Switch to a parent profile to add a course.</p><Link href="/courses" className="text-link mt-4">Back to courses</Link></div>;
  }
  const requested = (await searchParams).student;
  const student = profile.family.students.find((item) => item.id === requested) ?? profile.family.students[0];
  if (!student) return <p className="text-sm text-muted">This family needs a student before adding courses.</p>;
  const now = new Date();
  const year = now.getUTCMonth() >= 7 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return (
    <div className="max-w-3xl space-y-6">
      <div><Link href="/courses" className="text-link">Back to courses</Link><h1 className="mt-3 text-3xl font-semibold">Add a course.</h1><p className="mt-3 text-sm leading-6 text-muted">Keep the subject, curriculum, school year, and credits together.</p></div>
      <CourseForm initial={{ id: "", version: 0, studentId: student.id, name: "", subject: "", curriculum: null, credits: 1, gradeLevel: student.gradeLevel, academicYear: `${year}-${year + 1}`, weighted: false, completed: false }} students={profile.family.students} />
    </div>
  );
}
