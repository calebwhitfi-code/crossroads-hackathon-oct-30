import type { PrismaClient } from "@prisma/client";
import { createPrismaClient } from "../../prisma/client.mjs";

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
