/**
 * Application-wide constants.
 */

import { prisma } from "./prisma";

/** Stable email used to identify the system actor User row. */
const SYSTEM_USER_EMAIL = "system@afms.internal";

/** In-memory cache so we only hit the DB once per process lifetime. */
let _systemActorId: string | null = null;

/**
 * Returns the user ID of the system actor.
 *
 * Lazily ensures a real User row exists in the database so that
 * AuditLog.userId can be FK'd later without orphaned strings.
 * The row is `isActive: false` / role ADMIN so it can never log in.
 */
export async function getSystemActorId(): Promise<string> {
  if (_systemActorId) return _systemActorId;

  const user = await prisma.user.upsert({
    where: { email: SYSTEM_USER_EMAIL },
    update: {},
    create: {
      email: SYSTEM_USER_EMAIL,
      name: "System",
      role: "ADMIN",
      isActive: false, // Cannot log in
      authProvider: "CREDENTIALS",
    },
    select: { id: true },
  });

  _systemActorId = user.id;
  return _systemActorId;
}
