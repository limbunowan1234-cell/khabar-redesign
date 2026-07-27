import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (credentials?.email && credentials?.password) {
          return {
            id: 'user-123',
            name: 'Test User',
            email: credentials.email
          };
        }
        return null;
      }
    })
  ],
  pages: {
    signIn: '/login'
  }
});

export { handler as GET, handler as POST };