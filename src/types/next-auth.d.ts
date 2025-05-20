// types/next-auth.d.ts
import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id?: string;
      role?: string;
      username?: string;
      isEnvironmentUser?: boolean;
    } & DefaultSession['user'];
  }

  interface User {
    id: string;
    role: string;
    username: string;
    isEnvironmentUser?: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    role?: string;
    username?: string;
    isEnvironmentUser?: boolean;
  }
}