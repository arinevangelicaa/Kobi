import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { authConfig } from "@/lib/auth.config";
import { autentikasiKredensial } from "@/lib/services/login";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: (kredensial) => autentikasiKredensial(kredensial),
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) session.user.id = token.id as string;
      return session;
    },
  },
});
