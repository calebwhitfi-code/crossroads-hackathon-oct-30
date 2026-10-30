import Link from "next/link";
import { PrintButton } from "@/components/print-button";
import { visibleStudents } from "@/lib/gradebook";
import { formatCredits, formatGpa, formatGradingScale, formatPercentage } from "@/lib/grades";
import { buildTranscript } from "@/lib/transcript";
import { notFound } from "next/navigation";

export const metadata = { title: "Transcript" };

export default async function TranscriptPage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  const { profile, students } = await visibleStudents();
  const student = students.find((item) => item.id === studentId);
  if (!student) notFound();
  const transcript = buildTranscript(student.courses);
  const isParent = profile.role === "parent";
  return (
    <div className="space-y-6">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link href="/transcripts" className="text-link">Back to transcripts</Link>
        <PrintButton />
      </div>
      <article className="transcript-sheet space-y-7 rounded-xl border border-border bg-card p-5 sm:p-8" aria-label={`Transcript for ${student.firstName} ${student.lastName}`}>
        <header className="border-b border-border pb-5">
          <p className="text-xs tracking-widest text-muted uppercase">Official homeschool transcript</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{student.firstName} {student.lastName}</h1>
          <p className="mt-2 text-sm leading-6 text-muted">{profile.family.name} / Current grade {student.gradeLevel} / Class of {student.graduationYear}</p>
        </header>
        <section aria-label="Cumulative summary" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Unweighted GPA", formatGpa(transcript.cumulative.unweightedGpa)],
            ["Weighted GPA", formatGpa(transcript.cumulative.weightedGpa)],
            ["Credits earned", formatCredits(transcript.cumulative.earnedCredits)],
            ["Completed courses", String(transcript.courseCount)],
          ].map(([label, number]) => (
            <div key={label} className="rounded-xl border border-border p-4"><p className="text-xs text-muted">{label}</p><p className="mt-2 text-2xl font-semibold text-accent">{number}</p></div>
          ))}
        </section>
        {transcript.years.map((year) => (
          <section key={year.academicYear} aria-label={`School year ${year.academicYear}`} className="transcript-year">
            <h2 className="text-lg font-semibold">{year.academicYear}</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[34rem] text-left text-sm">
                <thead className="text-xs text-muted"><tr><th className="py-2 pr-3 font-medium">Course</th><th className="py-2 pr-3 font-medium">Grade level</th><th className="py-2 pr-3 font-medium">Final grade</th><th className="py-2 pr-3 font-medium">Credits</th>{isParent && <th className="no-print py-2 font-medium"><span className="sr-only">Actions</span></th>}</tr></thead>
                <tbody>
                  {year.rows.map((row) => (
                    <tr key={row.id} className="border-t border-border align-top">
                      <td className="py-3 pr-3"><span className="font-medium break-words">{row.name}</span>{row.weighted && <span className="text-muted"> (Weighted)</span>}<span className="block text-xs text-muted">{row.subject}{row.curriculum ? ` / ${row.curriculum}` : ""}</span><span className="mt-1 block text-xs text-muted">Scale: {formatGradingScale(row.gradingScale)}</span></td>
                      <td className="py-3 pr-3">{row.gradeLevel}{row.gradeLevel < 9 ? " (not in GPA)" : ""}</td>
                      <td className="py-3 pr-3">{row.letter} / {formatPercentage(row.percentage)}</td>
                      <td className="py-3 pr-3">{formatCredits(row.creditsEarned)} of {formatCredits(row.credits)}</td>
                      {isParent && <td className="no-print py-3"><Link href={`/courses/${row.id}/edit`} className="text-link" aria-label={`Edit ${row.name}`}>Edit</Link></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs leading-6 text-muted">Year GPA {formatGpa(year.summary.unweightedGpa)} unweighted / {formatGpa(year.summary.weightedGpa)} weighted / {formatCredits(year.summary.earnedCredits)} credits earned</p>
          </section>
        ))}
        {!transcript.years.length && (
          <p className="rounded-xl border border-border p-5 text-sm leading-7 text-muted">No completed courses yet. A course appears here once every assignment has an approved grade and a parent marks it complete.{isParent ? " Complete courses from the course edit page." : ""}</p>
        )}
        <footer className="space-y-2 border-t border-border pt-5 text-xs leading-6 text-muted">
          <p>Each course&apos;s parent-approved grading scale is listed with that course. GPA on a 4.0 scale; weighted courses add 1.0 for passing grades. Only completed high-school (grades 9-12) courses count toward GPA and credits.</p>
          <p className="print-only">Parent / administrator signature: ______________________________ Date: ______________</p>
        </footer>
      </article>
    </div>
  );
}
