import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { db } from '@/lib/db/client';
import { verifyCredentials } from '@/lib/auth/credentials';
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
      async authorize(credentials): Promise<{ id: string; email: string; name: string; role: string } | null> {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== 'string' || typeof password !== 'string') return null;
        return verifyCredentials(email, password);
      },
    }),
  ],
  callbacks: {
    async session({ session, user }): Promise<typeof session> {
      // Re-read from DB on every session access so role changes take immediate effect
      // and deactivated users are denied without waiting for session expiry.
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
