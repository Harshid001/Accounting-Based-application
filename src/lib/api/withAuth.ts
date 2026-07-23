import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { ROLES } from "@/lib/permissions";
import { logger } from "@/lib/logger";
import { Prisma } from "@prisma/client";
import { ValidationError, isValidationError } from "./validators";

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  clientId: string | null;
}

export interface AuthContext {
  user: AuthenticatedUser;
  prisma: typeof import("@/lib/prisma").prisma;
}

type RouteHandler<T = unknown> = (
  req: NextRequest,
  context: AuthContext
) => Promise<NextResponse<T>>;

interface AuthOptions {
  allowedRoles?: string[];
  requireClientAccess?: boolean;
  clientIdParam?: string;
}

function getClientIdFromRequest(req: NextRequest, paramName: string): string | null {
  const url = new URL(req.url);
  return url.searchParams.get(paramName);
}

export function withAuth(
  handler: RouteHandler,
  options: AuthOptions = {}
): (req: NextRequest) => Promise<NextResponse> {
  return async (req: NextRequest) => {
    const requestId = crypto.randomUUID();
    const log = logger.child({ requestId, path: req.nextUrl.pathname });
    const start = Date.now();

    try {
      const session = await getServerSession(authOptions);

      if (!session?.user?.id) {
        log.warn("Unauthorized: no session");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const user: AuthenticatedUser = {
        id: session.user.id,
        email: session.user.email ?? "",
        name: session.user.name ?? null,
        role: session.user.role,
        clientId: (session.user as { clientId?: string }).clientId ?? null,
      };

      if (options.allowedRoles && !options.allowedRoles.includes(user.role)) {
        log.warn({ role: user.role, allowed: options.allowedRoles }, "Forbidden: role not allowed");
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      if (options.requireClientAccess && options.clientIdParam) {
        const clientId = getClientIdFromRequest(req, options.clientIdParam);
        if (!clientId) {
          return NextResponse.json({ error: "Missing clientId parameter" }, { status: 400 });
        }
        if (user.role !== ROLES.ADMIN && user.clientId !== clientId) {
          log.warn({ userId: user.id, clientId }, "Forbidden: client access denied");
          return NextResponse.json({ error: "Forbidden: Not authorized for this client" }, { status: 403 });
        }
      }

      const { prisma } = await import("@/lib/prisma");

      const response = await handler(req, { user, prisma });

      const duration = Date.now() - start;
      if (duration > 500) {
        log.warn({ durationMs: duration }, "slow request");
      } else {
        log.debug({ durationMs: duration }, "request completed");
      }

      return response;
    } catch (error) {
      const duration = Date.now() - start;
      log.error({ err: error, durationMs: duration }, "request failed");

      if (isValidationError(error)) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
          return NextResponse.json({ error: "Unique constraint violation" }, { status: 409 });
        }
        if (error.code === "P2025") {
          return NextResponse.json({ error: "Record not found" }, { status: 404 });
        }
      }

      if (error instanceof SyntaxError) {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
      }

      return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
  };
}

export function createAuthHandler(
  handlers: Partial<Record<"GET" | "POST" | "PATCH" | "PUT" | "DELETE", RouteHandler>>,
  options: AuthOptions = {}
) {
  const wrapped: Record<string, (req: NextRequest) => Promise<NextResponse>> = {};
  for (const [method, handler] of Object.entries(handlers)) {
    wrapped[method] = withAuth(handler, options);
  }
  return wrapped;
}

export function validateBody<T>(body: unknown, schema: { parse: (data: unknown) => T }): T {
  return schema.parse(body);
}