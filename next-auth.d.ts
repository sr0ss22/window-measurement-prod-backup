import NextAuth from "next-auth"

declare module "next-auth" {
  interface Session {
    accessToken?: string
    refreshToken?: string
    idToken?: string
    expiresAt?: number
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      userType?: string
      dealerId?: string
      installerId?: string
    }
  }

  interface User {
    id: string
    userType?: string
    dealerId?: string
    installerId?: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string
    refreshToken?: string
    idToken?: string
    expiresAt?: number
    userType?: string
    dealerId?: string
    installerId?: string
  }
}
