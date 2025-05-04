import { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcrypt";
import prisma from "./prisma";
import { UserRole, EmployeeSubrole, ActivityAction } from "@/prisma/enums";
import { addActivityLog } from "./activity-logger";
import { detectDevice } from "./utils";

export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        try {
          if (!credentials?.email || !credentials?.password) {
            throw new Error("Invalid credentials");
          }

          const user = await prisma.user.findUnique({
            where: {
              email: credentials.email,
            },
          });

          if (!user || !user?.password) {
            throw new Error("User not found");
          }

          const isCorrectPassword = await compare(
            credentials.password,
            user.password
          );

          if (!isCorrectPassword) {
            throw new Error("Invalid password");
          }

          const userAgent = req?.headers?.["user-agent"] || "unknown";
          const deviceInfo = detectDevice(userAgent);

          // Log successful login
          await addActivityLog({
            userId: user.id,
            action: ActivityAction.LOGIN,
            details: {
              method: "credentials",
              device: deviceInfo.type,
              deviceDetails: deviceInfo
            },
            ipAddress: req?.headers?.["x-forwarded-for"]?.toString() || "unknown",
            userAgent: userAgent
          });

          // Safely prepare the user object 
          const safeUser = {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role as unknown as UserRole,
            subrole: user.subrole as unknown as EmployeeSubrole | null,
            companyId: user.companyId,
            coins: user.coins,
          };

          return safeUser;
        } catch (error) {
          console.error("Auth error:", error);
          // Convert any errors to string messages
          const message = error instanceof Error ? error.message : "Authentication failed";
          throw new Error(message);
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.subrole = user.subrole;
        token.companyId = user.companyId;
        token.coins = user.coins;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        session.user.subrole = token.subrole as EmployeeSubrole | null;
        session.user.companyId = token.companyId as string | null;
        session.user.coins = token.coins as number;
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
    error: "/?error=AuthError", 
    signOut: "/api/auth/logout"
  },
  debug: process.env.NODE_ENV === "development",
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
  secret: process.env.NEXTAUTH_SECRET,
}; 