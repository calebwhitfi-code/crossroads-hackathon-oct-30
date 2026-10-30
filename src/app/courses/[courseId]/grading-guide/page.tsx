import Link from "next/link";
import { GradingGuideForms } from "@/components/grading-guide-forms";
import { visibleCourse } from "@/lib/gradebook";

export const metadata = { title: "Course grading guide" };

export default async function GradingGuidePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { profile, course } = await visibleCourse((await params).courseId);
  if (profile.role !== "parent" || course.completed) {
    return <div><h1 className="text-2xl font-semibold">{course.completed ? "Reopen this course to change its grading guide." : "Only a parent can change grading rules."}</h1><Link href={`/courses/${course.id}`} className="text-link mt-4">Back to course</Link></div>;
  }
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href={`/courses/${course.id}`} className="text-link">Back to course</Link>
        <h1 className="mt-3 text-3xl font-semibold">Import grading guide</h1>
        <p className="mt-3 break-words text-sm text-muted">{course.name}{course.curriculum ? ` / ${course.curriculum}` : ""}</p>
        <p className="mt-4 text-sm leading-7 text-muted">Photograph the curriculum&apos;s rubric and grading scale, then correct and approve the proposed rules. No Notgrass or other publisher-specific scale is assumed.</p>
      </div>
      <GradingGuideForms course={{ id: course.id, version: course.version, gradeAMin: course.gradeAMin, gradeBMin: course.gradeBMin, gradeCMin: course.gradeCMin, gradeDMin: course.gradeDMin }} />
    </div>
  );
}
