"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Bot, Send, Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/unified-auth-context";
import type { WindowItem } from "@/types/window-item";
import { formatMeasurement } from "@/utils/measurements";
import { Skeleton } from "@/components/ui/skeleton";

interface Message {
  sender: 'user' | 'ai';
  text: string;
}

export default function ProductHelperContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId");
  const windowId = searchParams.get("windowId");

  const { supabase, user } = useAuth();
  const [windowItem, setWindowItem] = useState<Partial<WindowItem> | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false); // For sending messages
  const [isFetchingData, setIsFetchingData] = useState(true); // For initial data load
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch window data
  useEffect(() => {
    if (!user || !windowId) {
      setIsFetchingData(false);
      setMessages([{ sender: 'ai', text: "Could not identify the window. Please go back and try again." }]);
      return;
    }

    const fetchWindowData = async () => {
      setIsFetchingData(true);
      const { data, error } = await supabase
        .from('window_measurements')
        .select('line_number, data')
        .eq('id', windowId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching window data for product helper:", error);
        setMessages([{ sender: 'ai', text: "Sorry, I couldn't load the details for this window." }]);
      } else if (data) {
        const itemData = data.data || {};
        setWindowItem({
          lineNumber: data.line_number,
          location: itemData.location || 'N/A',
          product: itemData.product || 'N/A',
          controlType: itemData.controlType || 'N/A',
          width: itemData.width || 0,
          height: itemData.height || 0,
        });
      } else {
        setMessages([{ sender: 'ai', text: "Sorry, I couldn't find the details for this window. It might have been deleted." }]);
      }
      setIsFetchingData(false);
    };

    fetchWindowData();
  }, [user, windowId, supabase]);

  // Set initial message once window data is loaded
  useEffect(() => {
    if (isFetchingData) {
      setMessages([{ sender: 'ai', text: "Loading window details..." }]);
    } else if (windowItem) {
      const { lineNumber, location, product, controlType, width, height } = windowItem;
      const summary = `${location} - ${product}-${controlType}- ${formatMeasurement(width)}x${formatMeasurement(height)}`;
      const initialMessage = `Hello! I'm your product helper. How can I help you with line #${lineNumber}:\n${summary}?`;
      setMessages([{ sender: 'ai', text: initialMessage }]);
    }
  }, [windowItem, isFetchingData]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !windowItem) return;

    const userMessage: Message = { sender: 'user', text: inputValue };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/product-helper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: inputValue, windowItem }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'An unknown error occurred.');
      }

      setMessages(prev => [...prev, { sender: 'ai', text: data.reply }]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Sorry, something went wrong.";
      setMessages(prev => [...prev, { sender: 'ai', text: errorMessage }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    if (projectId) {
      router.push(`/?projectId=${projectId}`);
    } else {
      router.back();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white text-black">
      <header className="flex items-center p-4 border-b sticky top-0 bg-white z-10">
        <Button variant="ghost" size="icon" onClick={handleBack}>
          <ArrowLeft className="h-6 w-6" />
        </Button>
        <h1 className="text-xl font-bold ml-4">Product Helper</h1>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={cn(
              "flex items-start gap-3",
              message.sender === 'user' ? "justify-end" : "justify-start"
            )}
          >
            {message.sender === 'ai' && (
              <Avatar>
                <AvatarFallback><Bot /></AvatarFallback>
              </Avatar>
            )}
            <div
              className={cn(
                "p-3 rounded-lg max-w-xs md:max-w-md whitespace-pre-wrap",
                message.sender === 'user'
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground"
              )}
            >
              {isFetchingData && message.sender === 'ai' ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-[250px]" />
                  <Skeleton className="h-4 w-[200px]" />
                </div>
              ) : (
                <p>{message.text}</p>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </main>

      <footer className="p-4 border-t sticky bottom-0 bg-white z-10">
        <div className="flex items-center gap-2">
          <Textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="Ask about products, compatibility, or installation..."
            className="flex-1"
            disabled={isLoading || isFetchingData}
          />
          <Button onClick={handleSendMessage} disabled={isLoading || isFetchingData || !inputValue.trim()}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </footer>
    </div>
  );
}