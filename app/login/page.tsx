"use client";

import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { LoadingSpinner } from '@/components/loading-spinner';

export default function LoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (status === "authenticated" && session) {
      router.push("/projects");
    }
  }, [session, status, router]);

  const handleZitadelLogin = async () => {
    setIsLoading(true);
    try {
      await signIn("zitadel", { 
        callbackUrl: "/projects",
        redirect: false 
      });
    } catch (error) {
      console.error("Login error:", error);
      toast({
        title: "Login failed",
        description: "An error occurred during authentication. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (status === "loading") {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Image
              src="https://dntfkxqtnwijuskdpkhq.supabase.co/storage/v1/object/public/logos/Brite-Install-Logo.png"
              alt="Brite Install - Measure Wizard"
              width={120}
              height={120}
              priority
            />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">
            Brite Install - Measure Wizard
          </CardTitle>
          <p className="text-gray-600 mt-2">
            Sign in to access your work orders and measurements
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={handleZitadelLogin}
            disabled={isLoading}
            className="w-full"
            size="lg"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Signing in...
              </>
            ) : (
              'Sign in with Zitadel'
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}