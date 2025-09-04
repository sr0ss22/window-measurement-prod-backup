"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, X, Bot, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FormConfig, FormField } from "@/types/form-config";
import { useAuth } from "@/context/auth-context";
import { toast } from "@/components/ui/use-toast";

interface Message {
  type: "user" | "ai" | "system";
  content: string;
  isError?: boolean;
}

interface AiFormUpdaterProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  currentFormConfig: FormConfig;
  allFieldsForConditions: FormField[];
  onFormConfigUpdate: (newConfig: FormConfig) => void;
  conversationHistory: Message[];
  onConversationHistoryChange: (messages: Message[]) => void;
}

export function AiFormUpdater({
  isOpen,
  onOpenChange,
  currentFormConfig,
  allFieldsForConditions,
  onFormConfigUpdate,
  conversationHistory,
  onConversationHistoryChange,
}: AiFormUpdaterProps) {
  const { supabase } = useAuth();
  const [inputPrompt, setInputPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && conversationHistory.length === 0) {
      onConversationHistoryChange([
        {
          type: "ai",
          content:
            "Hello! I'm your AI Form Assistant. Tell me how you'd like to update your form. For example: 'Add a new section for contact info with fields for email and phone number.' or 'Make the product field required.'",
        },
      ]);
    }
  }, [isOpen, conversationHistory.length, onConversationHistoryChange]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversationHistory]);

  const handleSendMessage = async () => {
    if (!inputPrompt.trim() || isLoading) return;

    const userMessage: Message = { type: "user", content: inputPrompt };
    const newHistoryWithUserMessage = [...conversationHistory, userMessage];
    onConversationHistoryChange(newHistoryWithUserMessage);
    setInputPrompt("");
    setIsLoading(true);

    try {
      const { data, error: functionError } = await supabase.functions.invoke(
        "ai-form-updater",
        {
          body: {
            prompt: inputPrompt,
            currentFormConfig: currentFormConfig,
            conversationHistory: newHistoryWithUserMessage,
          },
        }
      );

      if (functionError) {
        throw new Error(functionError.message);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      const aiResponse = data as {
        status: "success" | "clarification_needed" | "error";
        message: string;
        proposedConfig?: FormConfig;
      };

      if (aiResponse.status === "success" && aiResponse.proposedConfig) {
        onConversationHistoryChange([
          ...newHistoryWithUserMessage,
          { type: "ai", content: aiResponse.message },
          {
            type: "system",
            content: "Proposed changes are ready. Click 'Apply Changes' to update your form.",
          },
        ]);
        onFormConfigUpdate(aiResponse.proposedConfig);
        toast({
          title: "AI Suggestion Ready",
          description: "Review the proposed changes and click 'Apply Changes' to save.",
        });
      } else if (aiResponse.status === "clarification_needed") {
        onConversationHistoryChange([
          ...newHistoryWithUserMessage,
          { type: "ai", content: aiResponse.message },
        ]);
      } else {
        onConversationHistoryChange([
          ...newHistoryWithUserMessage,
          {
            type: "ai",
            content: aiResponse.message || "An unexpected AI error occurred.",
            isError: true,
          },
        ]);
        toast({
          title: "AI Error",
          description: aiResponse.message || "The AI could not process your request.",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      console.error("Error calling AI function:", err);
      const displayError = err.message || "An unknown error occurred.";
      onConversationHistoryChange([
        ...newHistoryWithUserMessage,
        {
          type: "ai",
          content: `An error occurred: ${displayError}`,
          isError: true,
        },
      ]);
      toast({
        title: "AI Request Failed",
        description: displayError,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="text-2xl">AI Form Assistant</SheetTitle>
          <SheetDescription>
            Describe the changes you want to make to your form. Your conversation will be saved.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 border rounded-md bg-gray-50">
          {conversationHistory.map((msg, index) => (
            <div
              key={index}
              className={cn(
                "flex",
                msg.type === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[80%] p-3 rounded-lg",
                  msg.type === "user"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-200 text-gray-800",
                  msg.isError && "bg-red-100 text-red-700 border border-red-300"
                )}
              >
                {msg.isError && <AlertCircle className="inline-block h-4 w-4 mr-1" />}
                {msg.content}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="flex items-center space-x-2 pt-4">
          <Textarea
            placeholder="Type your prompt here..."
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            rows={3}
            className="flex-1"
            disabled={isLoading}
          />
          <Button onClick={handleSendMessage} disabled={!inputPrompt.trim() || isLoading}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}