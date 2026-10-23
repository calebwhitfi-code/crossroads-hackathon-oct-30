import type { Prisma } from "@prisma/client";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getProfileContext } from "@/lib/profile";

export const courseInclude = {
  assignments: {
    orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    include: {
      submissions: {
        where: { status: "approved" },
        orderBy: [{ approvedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
        take: 1,
      },
    },
  },
} satisfies Prisma.CourseInclude;

export async function visibleCourse(id: string) {
  const profile = await getProfileContext();
  const course = await db.course.findFirst({
    where: {
      id,
      student: { familyId: profile.family.id, ...(profile.student ? { id: profile.student.id } : {}) },
    },
    include: { ...courseInclude, student: true },
  });
  if (!course) notFound();
  return { profile, course };
}

export async function visibleStudents() {
  const profile = await getProfileContext();
  const students = await db.student.findMany({
    where: { familyId: profile.family.id, ...(profile.student ? { id: profile.student.id } : {}) },
    orderBy: { firstName: "asc" },
    include: { courses: { orderBy: [{ academicYear: "desc" }, { name: "asc" }], include: courseInclude } },
  });
  return { profile, students };
}
