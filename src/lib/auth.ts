
import { NextAuthOptions } from "next-auth"
import type { Session } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"
import bcrypt from "bcryptjs"

import { prisma } from "@/lib/prisma";

export async function canAccessClient(clientId: string, session: Session) {
  if (session.user.role === "ADMIN") return true;
  if (session.user.role === "CLIENT") {
    return session.user.clientId === clientId;
  }
  const client = await prisma.client.findFirst({
    where: {
      id: clientId,
      assignedTo: {
        some: { id: session.user.id }
      }
    }
  });
  return !!client;
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "you@afms.com" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Invalid credentials")
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        })

        if (!user || !user.isActive) {
          throw new Error("Invalid credentials")
        }

        if (!user.password) {
          throw new Error("Invalid credentials")
        }

        try {
          const isPasswordValid = await bcrypt.compare(credentials.password, user.password)
          if (!isPasswordValid) {
            throw new Error("Invalid credentials")
          }
        } catch (error) {
          throw new Error("Invalid credentials")
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          clientId: user.clientId
        }
      }
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!
    }),
    CredentialsProvider({
      id: "google-native",
      name: "Google Native",
      credentials: {
        googleIdToken: { label: "Google ID Token", type: "text" }
      },
      async authorize(credentials) {
        if (!credentials?.googleIdToken) {
          throw new Error("Missing Google ID Token")
        }

        const { OAuth2Client } = await import('google-auth-library')
        // We initialize with the web client ID, but accept both Web and iOS client IDs as audience
        const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
        
        try {
          const ticket = await client.verifyIdToken({
            idToken: credentials.googleIdToken,
            audience: [
              process.env.GOOGLE_CLIENT_ID!,
              process.env.GOOGLE_IOS_CLIENT_ID || ""
            ].filter(Boolean)
          })
          const payload = ticket.getPayload()
          
          if (!payload) throw new Error("Invalid token payload")
          if (!payload.email_verified) throw new Error("Email not verified")
          if (!payload.email) throw new Error("Email not provided")

          const email = payload.email
          const name = payload.name || "Google User"

          let dbUser = await prisma.user.findUnique({
            where: { email }
          })

          if (dbUser) {
            if (dbUser.authProvider !== "GOOGLE") {
              throw new Error("OAuthAccountNotLinked")
            }
            if (dbUser.role !== "CLIENT") {
              if (!dbUser.isActive) {
                throw new Error("Account is pending approval")
              }
              return {
                id: dbUser.id,
                email: dbUser.email,
                name: dbUser.name,
                role: dbUser.role,
                clientId: dbUser.clientId
              }
            }
          }

          // Find an admin (fall back to manager) to assign this client to so it
          // always has an owner. Admins/managers see all clients regardless, but
          // the assignment keeps the client accountable to a staff member.
          const adminUser = await prisma.user.findFirst({
            where: { role: "ADMIN", isActive: true },
            select: { id: true }
          }) ?? await prisma.user.findFirst({
            where: { role: "MANAGER", isActive: true },
            select: { id: true }
          });

          const clientData = await prisma.client.upsert({
            where: { email },
            update: {},
            create: {
              name: name,
              email: email,
              type: "INDIVIDUAL",
              status: "ACTIVE",
              assignedTo: adminUser ? { connect: { id: adminUser.id } } : undefined,
            },
          });

          dbUser = await prisma.user.upsert({
            where: { email },
            update: { clientId: clientData.id },
            create: {
              email: email,
              name: name,
              authProvider: "GOOGLE",
              role: "CLIENT",
              clientId: clientData.id,
              isActive: true
            }
          });

          if (!dbUser.isActive) {
            throw new Error("Account is pending approval")
          }

          return {
            id: dbUser.id,
            email: dbUser.email,
            name: dbUser.name,
            role: dbUser.role,
            clientId: dbUser.clientId
          }
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : "Invalid Google token";
          console.error("Native Google auth error:", error)
          throw new Error(message)
        }
      }
    })
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google") {
        if (!user.email) return false;
        if (!(profile as { email_verified?: boolean } | null)?.email_verified) return false;
        
        let dbUser = await prisma.user.findUnique({
          where: { email: user.email }
        });

        if (dbUser) {
          // Block dangerous account linking
          if (dbUser.authProvider !== "GOOGLE") {
            return "/login?error=OAuthAccountNotLinked";
          }
          if (dbUser.role !== "CLIENT") {
            if (!dbUser.isActive) return "/pending-approval";
            user.id = dbUser.id;
            user.role = dbUser.role;
            user.clientId = dbUser.clientId;
            return true;
          }
        }
        
        // Find an admin (fall back to manager) to assign this client to so it
        // always has an owner. Admins/managers see all clients regardless, but
        // the assignment keeps the client accountable to a staff member.
        const adminUser = await prisma.user.findFirst({
          where: { role: "ADMIN", isActive: true },
          select: { id: true }
        }) ?? await prisma.user.findFirst({
          where: { role: "MANAGER", isActive: true },
          select: { id: true }
        });

        const clientData = await prisma.client.upsert({
          where: { email: user.email },
          update: {},
          create: {
            name: user.name || user.email,
            email: user.email,
            type: "INDIVIDUAL",
            status: "ACTIVE",
            assignedTo: adminUser ? { connect: { id: adminUser.id } } : undefined,
          },
        });

        dbUser = await prisma.user.upsert({
          where: { email: user.email },
          update: { clientId: clientData.id },
          create: {
            email: user.email,
            name: user.name || "Google User",
            authProvider: "GOOGLE",
            role: "CLIENT",
            clientId: clientData.id,
            isActive: true
          }
        });
        
        if (!dbUser.isActive) {
          return "/pending-approval";
        }
        
        user.id = dbUser.id;
        user.role = dbUser.role;
        user.clientId = dbUser.clientId;
        return true;
      }
      return true;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.role = user.role
        token.id = user.id
        token.clientId = user.clientId
        token.image = user.image
      }
      if (trigger === "update" && session) {
        token.name = session.name ?? token.name;
        token.image = session.image ?? token.image;
      }
      return token
    },
    async session({ session, token }) {
      // If there's no id in the token, the user is not authenticated.
      // Return the session as-is (empty) so NextAuth does NOT trigger its own
      // internal signIn redirect — the proxy.ts middleware handles auth redirects.
      if (!token?.id) {
        return session;
      }

      // Guarantee instant revocation at the enforcement layer (runs on every getServerSession)
      const dbUser = await prisma.user.findUnique({ 
        where: { id: token.id as string },
        select: { role: true, clientId: true, isActive: true, image: true }
      });

      if (!dbUser || !dbUser.isActive) {
        // Return session without populating user data so token.role is undefined.
        // The proxy.ts middleware will treat this as unauthenticated and redirect to /login.
        return session;
      }

      session.user.role = dbUser.role;
      session.user.id = token.id as string;
      session.user.image = dbUser.image;
      session.user.clientId = dbUser.clientId;
      
      return session;
    }
  },
  pages: {
    signIn: '/login',
  }
}
