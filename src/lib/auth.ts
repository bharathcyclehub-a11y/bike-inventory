import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Access Code",
      credentials: {
        accessCode: { label: "Access Code", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.accessCode) return null;

        const code = credentials.accessCode.trim().toUpperCase();

        const user = await prisma.user.findUnique({
          where: { accessCode: code },
        });

        if (!user || !user.isActive) {
          // Run bcrypt against dummy hash to prevent timing attacks
          await bcrypt.compare(code, "$2b$10$dummyhashvaluetopreventtimingattacks");
          return null;
        }

        // Verify password (accessCode is also used as password for simple login)
        const isValid = await bcrypt.compare(code, user.password);
        if (!isValid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as unknown as { role: string }).role;
        token.userId = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { role?: string }).role = token.role as string;
        (session.user as { userId?: string }).userId = token.userId as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
