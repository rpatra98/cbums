import { UserRole, EmployeeSubrole } from "@/prisma/enums";
import NextAuth from "next-auth";

declare module "next-auth" {
  /**
   * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: UserRole;
      subrole: EmployeeSubrole | null;
      companyId: string | null;
      coins: number;
      image?: string;
    };
  }

  interface User {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    subrole: EmployeeSubrole | null;
    companyId: string | null;
    coins: number;
  }
}

declare module "next-auth/jwt" {
  /** Returned by the `jwt` callback and `getToken`, when using JWT sessions */
  interface JWT {
    id: string;
    role: UserRole;
    subrole: EmployeeSubrole | null;
    companyId: string | null;
    coins: number;
    // Standard JWT claims
    iat?: number; // Issued at time
    exp?: number; // Expiration time
    jti?: string; // JWT ID
  }
} 