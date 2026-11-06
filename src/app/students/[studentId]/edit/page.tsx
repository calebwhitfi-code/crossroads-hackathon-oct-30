import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteStudentForm, StudentForm } from "@/components/student-forms";
import { db } from "@/lib/db";
import { getProfileContext } from "@/lib/profile";

export const metadata = { title: "Edit student" };

export default async function EditStudentPage({ params }: { params: Promise<{ studentId: string }> }) {
  const profile = await getProfileContext();
  if (profile.role !== "parent") {
    return <div><h1 className="text-2xl font-semibold">Student setup is for parents.</h1><Link href="/" className="text-link mt-4">Back to overview</Link></div>;
  }
  const student = await db.student.findFirst({
    where: { id: (await params).studentId, familyId: profile.family.id },
    include: { courses: { include: { assignments: { include: { submissions: { where: { status: "approved" }, take: 1 } } } } } },
  });
  if (!student) notFound();
  const schoolYearEnd = student.graduationYear - (12 - student.gradeLevel);
  const hasGradedWork = student.courses.some((course) => course.assignments.some((assignment) => assignment.submissions.length));
  const name = `${student.firstName} ${student.lastName}`;
  return (
    <div className="max-w-3xl space-y-6">
      <div><Link href="/" className="text-link">Back to overview</Link><h1 className="mt-3 text-3xl font-semibold">Edit {name}.</h1></div>
      <StudentForm initial={{ id: student.id, firstName: student.firstName, lastName: student.lastName, gradeLevel: student.gradeLevel, academicYear: `${schoolYearEnd - 1}-${schoolYearEnd}` }} />
      <DeleteStudentForm id={student.id} name={name} hasGradedWork={hasGradedWork} />
    </div>
  );
}
