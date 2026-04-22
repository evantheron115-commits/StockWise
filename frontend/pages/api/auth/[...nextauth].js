import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import AppleProvider  from 'next-auth/providers/apple';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default NextAuth({
  providers: [
    CredentialsProvider({
      name: 'Email',
      credentials: {
        email:    { label: 'Email',    type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        try {
          const res  = await fetch(`${API}/api/auth/login`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
              email:    credentials.email,
              password: credentials.password,
            }),
          });
          const data = await res.json();
          if (res.ok && data.user) return data.user;
          throw new Error(data.error || 'Invalid credentials');
        } catch (err) {
          throw new Error(err.message || 'Login failed');
        }
      },
    }),

    // Google OAuth — only enabled when GOOGLE_CLIENT_ID is configured
    ...(process.env.GOOGLE_CLIENT_ID ? [
      GoogleProvider({
        clientId:     process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      }),
    ] : []),

    // Apple Sign-In — MANDATORY when any other 3rd-party login exists (App Store rule)
    // Setup: create a Services ID in Apple Developer → enable Sign in with Apple →
    // generate a private key → set APPLE_ID, APPLE_TEAM_ID, APPLE_PRIVATE_KEY_ID,
    // APPLE_PRIVATE_KEY (contents of .p8 file) in Vercel env vars.
    ...(process.env.APPLE_ID ? [
      AppleProvider({
        clientId:     process.env.APPLE_ID,
        clientSecret: {
          appleId:    process.env.APPLE_ID,
          teamId:     process.env.APPLE_TEAM_ID,
          privateKey: process.env.APPLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
          keyId:      process.env.APPLE_PRIVATE_KEY_ID,
        },
      }),
    ] : []),
  ],

  session: { strategy: 'jwt' },

  pages: {
    signIn:  '/auth/login',
    error:   '/auth/login',
  },

  callbacks: {
    async signIn({ user, account }) {
      // Persist OAuth users to DB
      if (account?.provider && account.provider !== 'credentials') {
        try {
          const res = await fetch(`${API}/api/auth/oauth`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
              email:    user.email,
              name:     user.name,
              avatar:   user.image,
              provider: account.provider,
            }),
          });
          const data = await res.json();
          if (data.user) user.id = data.user.id;
        } catch {
          // Non-fatal — session still works via JWT
        }
      }
      return true;
    },

    jwt({ token, user }) {
      if (user) {
        token.id     = user.id;
        token.name   = user.name;
        token.email  = user.email;
        token.avatar = user.avatar || user.image;
      }
      return token;
    },

    session({ session, token }) {
      session.user.id     = token.id;
      session.user.avatar = token.avatar;
      return session;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
});
