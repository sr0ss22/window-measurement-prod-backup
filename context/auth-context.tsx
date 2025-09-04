"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { createClient } from '@/integrations/supabase/client';
import type { SupabaseClient, Session, User } from '@supabase/supabase-js';
import { useRouter, usePathname } from 'next/navigation';
import { LoadingSpinner } from '@/components/loading-spinner';

interface AuthContextType {
  supabase: SupabaseClient;
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const handleUserProfile = useCallback(async (user: User | null) => {
    if (!user) {
      return;
    }

    // Check if a profile exists
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found
      console.error("Error checking for profile:", error);
      return;
    }

    if (!profile) {
      // Profile doesn't exist, create it
      console.log("No profile found for user, creating one...");

      // First, create a company for the user.
      const companyName = `${user.user_metadata?.full_name || user.email}'s Company`;
      const { data: newCompany, error: companyError } = await supabase
        .from('companies')
        .insert({ name: companyName })
        .select('id')
        .single();

      if (companyError || !newCompany) {
        console.error("Error creating company for new user:", companyError);
      } else {
        // Now create the profile with the new company ID.
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            first_name: user.user_metadata?.first_name,
            last_name: user.user_metadata?.last_name,
            avatar_url: user.user_metadata?.avatar_url,
            company_id: newCompany.id,
          });

        if (profileError) {
          console.error("Error creating profile for new user:", profileError);
        } else {
          console.log("Profile and company created successfully.");
        }
      }
    }
  }, [supabase]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isLoading) {
        console.warn("Auth session check timed out. Proceeding as logged out.");
        setIsLoading(false);
      }
    }, 5000);

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      await handleUserProfile(currentUser);
      setIsLoading(false);
      clearTimeout(timer);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      await handleUserProfile(currentUser);
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, [supabase, isLoading, handleUserProfile]);

  useEffect(() => {
    if (!isLoading && !user && pathname !== '/login') {
      router.push('/login');
    }
  }, [isLoading, user, pathname, router]);

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const value = {
    supabase,
    session,
    user,
    isLoading,
    signOut,
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}