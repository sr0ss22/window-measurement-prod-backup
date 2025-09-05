import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { WindowProvider } from "@/context/window-context"
import { Toaster } from "@/components/ui/toaster"
import { FormConfigProvider } from "@/context/form-config-context"
import Script from "next/script"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { Providers } from "@/components/providers"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Window Measurement App",
  description: "Field installer app for window measurements",
  generator: 'v0.dev',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="min-h-screen">
      <body className="min-h-screen overflow-x-hidden">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <Providers>
            <WindowProvider>
              <FormConfigProvider>
                <SidebarProvider>
                  <SidebarInset>
                    {children}
                  </SidebarInset>
                  <AppSidebar />
                </SidebarProvider>
              </FormConfigProvider>
            </WindowProvider>
            <Toaster />
          </Providers>
        </ThemeProvider>
        <Script src="https://docs.opencv.org/4.x/opencv.js" strategy="afterInteractive" />
      </body>
    </html>
  )
}