import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import bcryptjs from 'bcryptjs';
import { db } from '@/lib/db/client';
import type { AppSession } from '@/types';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: 'database' },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await db.user.findUnique({
          where: { email: credentials.email as string },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            isActive: true,
            passwordHash: true,
          },
        });

        if (!user || !user.isActive || !user.passwordHash) return null;

        const isValid = await bcryptjs.compare(
          credentials.password as string,
          user.passwordHash,
        );
        if (!isValid) return null;

        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      const dbUser = await db.user.findUnique({
        where: { id: user.id },
        select: { id: true, role: true, isActive: true },
      });

      if (!dbUser?.isActive) {
        throw new Error('Account is disabled');
      }

      const appSession: AppSession = {
        user: {
          id: dbUser.id,
          email: session.user.email,
          name: session.user.name ?? '',
          role: dbUser.role,
        },
        expires: session.expires,
      };

      return appSession as typeof session;
    },
  },
});
