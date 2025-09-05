import NextAuth, { NextAuthOptions } from 'next-auth'
import ZitadelProvider from 'next-auth/providers/zitadel'

const authOptions: NextAuthOptions = {
  providers: [
    ZitadelProvider({
      issuer: process.env.NEXT_PUBLIC_ZITADEL_ISSUER,
      clientId: process.env.ZITADEL_CLIENT_ID!,
      clientSecret: process.env.ZITADEL_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: process.env.ZITADEL_SCOPE!,
        },
      },
      // Use custom redirect URI for measure app integration
      redirectUri: "http://localhost:3000/api/auth/callback/zitadel",
      async profile(profile: any) {
        try {
          const rawMetadata = profile['urn:zitadel:iam:user:metadata'] || {}

          // Parse metadata if it's a string
          let metadata = rawMetadata
          if (typeof rawMetadata === 'string') {
            try {
              metadata = JSON.parse(rawMetadata)
            } catch (e) {
              console.warn('Failed to parse user metadata:', e)
            }
          }

          return {
            id: profile.sub,
            email: profile.email,
            name: profile.name || profile.preferred_username,
            image: profile.picture,
            userType: metadata.userType || 'dealer',
            dealerId: metadata.dealerId,
            installerId: metadata.installerId,
          }
        } catch (error) {
          console.error('Error processing Zitadel profile:', error)
          return {
            id: profile.sub,
            email: profile.email,
            name: profile.name || profile.preferred_username,
            image: profile.picture,
            userType: 'dealer',
          }
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      // Persist the OAuth access_token and or the user id to the token right after signin
      if (account) {
        token.accessToken = account.access_token
        token.refreshToken = account.refresh_token
        token.idToken = account.id_token
        token.expiresAt = account.expires_at
      }
      
      if (profile) {
        token.userType = (profile as any).userType
        token.dealerId = (profile as any).dealerId
        token.installerId = (profile as any).installerId
      }
      
      return token
    },
    async session({ session, token }) {
      // Send properties to the client
      if (token) {
        session.accessToken = token.accessToken as string
        session.refreshToken = token.refreshToken as string
        session.idToken = token.idToken as string
        session.expiresAt = token.expiresAt as number
        session.user.userType = token.userType as string
        session.user.dealerId = token.dealerId as string
        session.user.installerId = token.installerId as string
      }
      
      return session
    },
    async redirect({ url, baseUrl }) {
      // If the URL is a callback URL, redirect to the specific provider callback
      if (url.includes('/api/auth/callback')) {
        return url
      }
      // For other redirects, use the default behavior
      if (url.startsWith("/")) return `${baseUrl}${url}`
      else if (new URL(url).origin === baseUrl) return url
      return baseUrl
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
}

export default NextAuth(authOptions)
export { authOptions }
