"use client";

import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { LoadingSpinner } from '@/components/loading-spinner';

export default function LoginPage() {
  const { supabase, session, isLoading } = useAuth();
  const router = useRouter();
  const [redirectUrl, setRedirectUrl] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setRedirectUrl(`${window.location.origin}/projects`);
    }
  }, []);

  useEffect(() => {
    if (!isLoading && session) {
      router.push('/projects');
    }
  }, [session, isLoading, router]);

  // Show spinner if the auth state is loading, if a session exists (meaning we are redirecting),
  // or if the redirect URL isn't ready yet.
  if (isLoading || session || !redirectUrl) {
    return <LoadingSpinner />;
  }

  return (
    <div className="flex justify-center items-center min-h-screen bg-black p-4">
      <div className="w-full max-w-md p-8 space-y-6 bg-black">
        <div className="flex justify-center">
          <Image
            src="https://dntfkxqtnwijuskdpkhq.supabase.co/storage/v1/object/public/logos/Brite-Install-Logo.png"
            alt="Brite Install - Measure Wizard"
            width={200}
            height={200}
            priority
          />
        </div>
        <h1 className="text-2xl font-bold text-center text-white">Brite Install - Measure Wizard</h1>
        <Auth
          supabaseClient={supabase}
          appearance={{
            theme: ThemeSupa,
            variables: {
              default: {
                colors: {
                  brand: '#3b82f6', // Blue
                  brandAccent: '#2563eb',
                  brandButtonText: 'white',
                  defaultButtonBackground: '#1f2937',
                  defaultButtonBackgroundHover: '#374151',
                  defaultButtonBorder: '#374151',
                  defaultButtonText: 'white',
                  dividerBackground: '#374151',
                  inputBackground: '#1f2937',
                  inputBorder: '#374151',
                  inputBorderHover: '#4b5563',
                  inputBorderFocus: '#3b82f6',
                  inputText: 'white',
                  inputLabelText: '#9ca3af',
                  inputPlaceholder: '#6b7280',
                  messageText: '#9ca3af',
                  messageTextDanger: '#f87171',
                  anchorTextColor: '#9ca3af',
                  anchorTextColorHover: 'white',
                },
                space: {
                  spaceSmall: '4px',
                  spaceMedium: '8px',
                  spaceLarge: '16px',
                  labelBottomMargin: '8px',
                  anchorBottomMargin: '4px',
                  emailInputSpacing: '4px',
                  socialAuthSpacing: '4px',
                  buttonPadding: '10px 15px',
                  inputPadding: '10px 15px',
                },
                fontSizes: {
                  baseBodySize: '16px',
                  baseInputSize: '16px',
                  baseLabelSize: '16px',
                  baseButtonSize: '16px',
                },
                fonts: {
                  bodyFontFamily: `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"`,
                  buttonFontFamily: `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"`,
                  inputFontFamily: `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"`,
                  labelFontFamily: `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"`,
                },
                borderWidths: {
                  buttonBorderWidth: '1px',
                  inputBorderWidth: '1px',
                },
                radii: {
                  borderRadiusButton: '8px',
                  buttonBorderRadius: '8px',
                  inputBorderRadius: '8px',
                },
              },
            },
          }}
          providers={[]}
          theme="dark" // Use the dark theme as a base
          redirectTo={redirectUrl}
        />
      </div>
    </div>
  );
}