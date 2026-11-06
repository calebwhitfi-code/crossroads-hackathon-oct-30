import Link from "next/link";
import { StudentForm } from "@/components/student-forms";
import { getProfileContext } from "@/lib/profile";

export const metadata = { title: "Add student" };

export default async function NewStudentPage() {
  const profile = await getProfileContext();
  if (profile.role !== "parent") {
    return <div><h1 className="text-2xl font-semibold">Student setup is for parents.</h1><Link href="/" className="text-link mt-4">Back to overview</Link></div>;
  }
  const now = new Date();
  const year = now.getUTCMonth() >= 7 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return (
    <div className="max-w-3xl space-y-6">
      <div><Link href="/" className="text-link">Back to overview</Link><h1 className="mt-3 text-3xl font-semibold">Add a student.</h1><p className="mt-3 text-sm leading-6 text-muted">Students are available only inside the active family workspace.</p></div>
      <StudentForm initial={{ id: "", firstName: "", lastName: "", gradeLevel: 1, academicYear: `${year}-${year + 1}` }} />
    </div>
  );
}
