"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/auth-context";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Bot, Wrench, Trash2, CheckCircle, Circle, Lock } from "lucide-react";
import { formatDate } from "@/utils/date-formatter";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/use-toast";
import { TemplateAiAgentDialog } from "@/components/form-builder/template-ai-agent-dialog";
import type { FormConfig, FormSection, FieldLayoutRow, FormField } from "@/types/form-config";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserNav } from "@/components/user-nav";
import { useMobile } from "@/hooks/use-mobile";
import { Capacitor } from '@capacitor/core'; // Import Capacitor

interface FormRecord {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  status: 'active' | 'inactive';
  config: FormConfig;
}

export default function FormsPage() {
  const { user, supabase, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const [forms, setForms] = useState<FormRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);
  const [formToDelete, setFormToDelete] = useState<FormRecord | null>(null);
  const [formToToggleLock, setFormToToggleLock] = useState<FormRecord | null>(null);
  const [passcode, setPasscode] = useState("");
  const [passcodeError, setPasscodeError] = useState<string | null>(null);

  const isMobile = useMobile();
  const isMobileApp = typeof window !== 'undefined' && Capacitor.isNativePlatform();

  useEffect(() => {
    if (isMobileApp) {
      router.replace('/projects'); // Redirect to projects page if on mobile
      return;
    }

    if (!isAuthLoading && !user) {
      router.push('/login');
    } else if (user) {
      fetchForms();
    }
  }, [user, isAuthLoading, router, isMobileApp]);

  if (isMobileApp) {
    return null; // Render nothing while redirecting on mobile
  }

  const fetchForms = async () => {
    if (!user) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from('forms')
      .select('id, name, description, created_at, status, config')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching forms:", error);
      toast({ title: "Error", description: "Could not fetch your forms.", variant: "destructive" });
    } else {
      setForms(data as FormRecord[]);
    }
    setIsLoading(false);
  };

  const handleCreateNewForm = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('forms')
      .insert({
        user_id: user.id,
        name: 'Untitled Form',
        description: 'A new blank form.',
        config: { sections: [] },
        status: 'inactive',
      })
      .select('id')
      .single();

    if (error) {
      console.error("Error creating new form:", error);
      toast({ title: "Error", description: "Could not create a new form.", variant: "destructive" });
    } else {
      router.push(`/form-builder/edit?formId=${data.id}`); // Updated link
    }
  };

  const handleAiTemplateGenerated = async (config: FormConfig) => {
    if (!user) return;
    const { data, error } = await supabase
      .from('forms')
      .insert({
        user_id: user.id,
        name: 'AI Generated Form',
        description: 'A new form created by the AI agent.',
        config: config,
        status: 'inactive',
      })
      .select('id')
      .single();
    
    if (error) {
      console.error("Error saving AI generated form:", error);
      toast({ title: "Error", description: "Could not save the AI generated form.", variant: "destructive" });
    } else {
      router.push(`/form-builder/edit?formId=${data.id}`); // Updated link
    }
  };

  const handlePublishForm = async (formId: string) => {
    if (!user) return;

    const { error: deactivateError } = await supabase
      .from('forms')
      .update({ status: 'inactive' })
      .eq('user_id', user.id)
      .neq('id', formId);

    if (deactivateError) {
      console.error("Error deactivating other forms:", deactivateError);
      toast({ title: "Error", description: "Could not deactivate other forms.", variant: "destructive" });
      return;
    }

    const { error: publishError } = await supabase
      .from('forms')
      .update({ status: 'active' })
      .eq('id', formId);

    if (publishError) {
      console.error("Error publishing form:", publishError);
      toast({ title: "Error", description: "Could not publish the form.", variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Form has been published successfully." });
      fetchForms();
    }
  };

  const handleDeleteForm = async () => {
    if (!formToDelete) return;
    const { error } = await supabase
      .from('forms')
      .delete()
      .eq('id', formToDelete.id);

    if (error) {
      console.error("Error deleting form:", error);
      toast({ title: "Error", description: "Could not delete the form.", variant: "destructive" });
    } else {
      toast({ title: "Success", description: `Form "${formToDelete.name}" has been deleted.` });
      fetchForms();
    }
    setFormToDelete(null);
  };

  const isFormLocked = (form: FormRecord): boolean => {
    if (!form.config || !form.config.sections || form.config.sections.length === 0) {
      return false;
    }
    return form.config.sections.every(section =>
      section.rows.every(row =>
        row.fields.every(field => field.isDefault === true)
      )
    );
  };

  const handleConfirmLockToggle = async () => {
    if (!formToToggleLock) return;
    if (passcode !== 'HDIS2025!') {
      setPasscodeError("Incorrect passcode.");
      return;
    }

    const isCurrentlyLocked = isFormLocked(formToToggleLock);
    const newConfig = JSON.parse(JSON.stringify(formToToggleLock.config));

    newConfig.sections.forEach((section: FormSection) => {
      section.rows.forEach((row: FieldLayoutRow) => {
        row.fields.forEach((field: FormField) => {
          field.isDefault = !isCurrentlyLocked;
        });
      });
    });

    const { error } = await supabase
      .from('forms')
      .update({ config: newConfig, updated_at: new Date().toISOString() })
      .eq('id', formToToggleLock.id);

    if (error) {
      toast({ title: "Error", description: `Could not ${isCurrentlyLocked ? 'unlock' : 'lock'} the form.`, variant: "destructive" });
    } else {
      toast({ title: "Success", description: `Form "${formToToggleLock.name}" has been ${isCurrentlyLocked ? 'unlocked' : 'locked'}.` });
      fetchForms();
    }
    
    setFormToToggleLock(null);
    setPasscode("");
    setPasscodeError(null);
  };

  if (isAuthLoading || isLoading) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-10 w-1/4" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-black">
      <main className="relative z-10">
        <div className="pt-[env(safe-area-inset-top)] h-[150px] md:h-[120px] flex items-center">
          <div className="container mx-auto px-4 text-white flex justify-between items-center">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">Form Management</h1>
            </div>
            <div className="flex space-x-2">
              <Button onClick={handleCreateNewForm} variant="outline" size={isMobile ? "icon" : "default"} className="bg-white text-black hover:bg-gray-200">
                <Plus className="h-4 w-4" /> {isMobile ? "" : "Create New Form"}
              </Button>
              <Button onClick={() => setIsAiDialogOpen(true)} size={isMobile ? "icon" : "default"}>
                <Bot className="h-4 w-4" /> {isMobile ? "" : "Create with AI"}
              </Button>
              <UserNav />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-t-[32px] shadow-lg border-t-4 border-[#F08200] min-h-[calc(100vh-150px-80px)] md:min-h-[calc(100vh-120px-80px)]">
          <div className="container mx-auto px-4 pt-6 pb-20">
            {!isMobile && <p className="text-lg text-gray-600 mb-6">Manage, edit, and set your active measurement form.</p>}
            {forms.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-lg border border-dashed">
                <h2 className="text-2xl font-semibold text-gray-700">No Forms Found</h2>
                <p className="text-gray-500 mt-2">Get started by creating your first form.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {forms.map((form) => {
                  const locked = isFormLocked(form);
                  return (
                    <Card key={form.id} className="flex flex-col">
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-xl">{form.name}</CardTitle>
                          <Badge variant={form.status === 'active' ? 'default' : 'secondary'} className={form.status === 'active' ? 'bg-green-500' : ''}>
                            {form.status === 'active' ? <CheckCircle className="mr-1 h-3 w-3" /> : <Circle className="mr-1 h-3 w-3" />}
                            {form.status}
                          </Badge>
                        </div>
                        <CardDescription>Created: {formatDate(form.created_at)}</CardDescription>
                      </CardHeader>
                      <CardContent className="flex-grow">
                        <p className="text-sm text-gray-600">{form.description || "No description provided."}</p>
                      </CardContent>
                      <CardFooter className="flex justify-between items-center">
                        <div className="flex gap-2">
                          <Button
                            variant={form.status === 'active' ? 'outline' : 'default'}
                            size="sm"
                            onClick={() => handlePublishForm(form.id)}
                            disabled={form.status === 'active' || form.config.sections.length === 0}
                            className={form.status === 'active' || form.config.sections.length === 0 ? 'text-gray-500' : 'bg-charcoal hover:bg-charcoal/90'}
                          >
                            {form.status === 'active' ? 'Published' : 'Publish'}
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => setFormToToggleLock(form)}>
                            <Lock className="mr-2 h-4 w-4" /> {locked ? 'Unlock' : 'Lock'}
                          </Button>
                        </div>
                        <div className="flex space-x-1">
                          <Link href={`/form-builder/edit?formId=${form.id}`}> {/* Updated link */}
                            <Button variant="ghost" size="icon" title="Edit Form">
                              <Wrench className="h-4 w-4" />
                            </Button>
                          </Link>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" title="Delete Form" onClick={() => setFormToDelete(form)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete the form "{formToDelete?.name}". This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel onClick={() => setFormToDelete(null)}>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDeleteForm} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      <TemplateAiAgentDialog
        isOpen={isAiDialogOpen}
        onOpenChange={setIsAiDialogOpen}
        onTemplateGenerated={handleAiTemplateGenerated}
      />
      <AlertDialog open={!!formToToggleLock} onOpenChange={(open) => {
        if (!open) {
          setFormToToggleLock(null);
          setPasscode("");
          setPasscodeError(null);
        }
      }}>
        <AlertDialogContent>
          {formToToggleLock && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>{isFormLocked(formToToggleLock) ? 'Unlock this form?' : 'Lock this form?'}</AlertDialogTitle>
                <AlertDialogDescription>
                  Unlocking and changing the form will change it globally.
                  <br />
                  Please enter the passcode to proceed.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="py-2">
                <Label htmlFor="passcode">Passcode</Label>
                <Input
                  id="passcode"
                  type="password"
                  value={passcode}
                  onChange={(e) => {
                    setPasscode(e.target.value);
                    setPasscodeError(null);
                  }}
                />
                {passcodeError && <p className="text-sm text-destructive mt-1">{passcodeError}</p>}
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmLockToggle}>Confirm</AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}