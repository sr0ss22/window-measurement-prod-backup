"use client";

import React, { useState, useEffect, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverAnchor } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { useAuth } from "@/context/auth-context";

interface MentionableUser {
  id: string;
  fullName: string;
  avatarUrl?: string;
}

interface CommentInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}

export function CommentInput({ value, onChange, onSubmit, isSubmitting }: CommentInputProps) {
  const { supabase } = useAuth();
  const [mentionableUsers, setMentionableUsers] = useState<MentionableUser[]>([]);
  const [isMentionPopoverOpen, setIsMentionPopoverOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      // Fetch real users from profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar_url');

      if (profilesError) {
        console.error("Error fetching profiles for mentions:", profilesError);
      }

      // Fetch mentionable people
      const { data: peopleData, error: peopleError } = await supabase
        .from('mentionable_people')
        .select('id, full_name, avatar_url');

      if (peopleError) {
        console.error("Error fetching mentionable people:", peopleError);
      }

      const profileUsers = (profilesData || []).map(p => ({
        id: p.id,
        fullName: `${p.first_name || ''} ${p.last_name || ''}`.trim(),
        avatarUrl: p.avatar_url,
      })).filter(u => u.fullName);

      const mentionablePeople = (peopleData || []).map(p => ({
        id: p.id,
        fullName: p.full_name,
        avatarUrl: p.avatar_url,
      }));

      // Combine and remove duplicates
      const allUsers = [...profileUsers, ...mentionablePeople];
      const uniqueUsers = Array.from(new Map(allUsers.map(item => [item.id, item])).values());

      setMentionableUsers(uniqueUsers);
    };

    fetchUsers();
  }, [supabase]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    onChange(text);

    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = text.substring(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      setMentionQuery(mentionMatch[1]);
      setIsMentionPopoverOpen(true);
    } else {
      setIsMentionPopoverOpen(false);
    }
  };

  const handleMentionSelect = (user: MentionableUser) => {
    const cursorPos = textareaRef.current?.selectionStart || 0;
    const textBeforeCursor = value.substring(0, cursorPos);
    const textAfterCursor = value.substring(cursorPos);

    const newTextBeforeCursor = textBeforeCursor.replace(/@(\w*)$/, `@${user.fullName} `);
    
    onChange(newTextBeforeCursor + textAfterCursor);
    setIsMentionPopoverOpen(false);

    setTimeout(() => {
      textareaRef.current?.focus();
      const newCursorPos = newTextBeforeCursor.length;
      textareaRef.current?.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const filteredUsers = mentionQuery
    ? mentionableUsers.filter(user => user.fullName.toLowerCase().includes(mentionQuery.toLowerCase()))
    : mentionableUsers;

  return (
    <Popover open={isMentionPopoverOpen} onOpenChange={setIsMentionPopoverOpen}>
      <PopoverAnchor asChild>
        <div className="relative">
          <Textarea
            ref={textareaRef}
            placeholder="Add a new comment... type @ to mention someone"
            value={value}
            onChange={handleInputChange}
            rows={3}
            className="flex-1 pr-12"
            disabled={isSubmitting}
          />
          <Button
            onClick={onSubmit}
            disabled={!value.trim() || isSubmitting}
            size="icon"
            className="absolute right-2 bottom-2 h-8 w-8"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </PopoverAnchor>
      <PopoverContent className="w-[250px] p-0" align="start">
        <Command>
          <CommandList>
            {filteredUsers.length === 0 ? (
              <CommandEmpty>No users found.</CommandEmpty>
            ) : (
              <CommandGroup>
                {filteredUsers.map(user => (
                  <CommandItem key={user.id} onSelect={() => handleMentionSelect(user)}>
                    {user.fullName}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}