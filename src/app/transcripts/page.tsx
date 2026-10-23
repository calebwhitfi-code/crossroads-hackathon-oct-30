import Link from "next/link";
import { visibleStudents } from "@/lib/gradebook";

export const metadata = { title: "Transcripts" };

export default async function TranscriptsPage() {
  const { students } = await visibleStudents();
  return (
    <div className="space-y-7">
      <div><p className="mb-3 text-xs font-semibold tracking-[0.2em] text-accent uppercase">Records</p><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Transcripts.</h1><p className="mt-4 max-w-2xl text-sm leading-7 text-muted">Completed courses with approved final grades, credits, and GPA, grouped by school year and ready to print.</p></div>
      <div className="grid gap-4 sm:grid-cols-2">
        {students.map((student) => (
          <article key={student.id} className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-lg font-semibold">{student.firstName} {student.lastName}</h2>
            <p className="mt-1 text-xs text-muted">Grade {student.gradeLevel} / Class of {student.graduationYear}</p>
            <Link href={`/transcripts/${student.id}`} className="text-link mt-3" aria-label={`Open transcript for ${student.firstName}`}>Open transcript</Link>
          </article>
        ))}
      </div>
    </div>
  );
}
