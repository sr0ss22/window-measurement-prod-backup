"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAuth } from "@/context/unified-auth-context";
import { toast } from "@/components/ui/use-toast";
import type { ProjectComment } from "@/types/project";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { formatRelativeTime } from "@/utils/date-formatter";
import { CommentInput } from "./comment-input";
import { MessageCircle } from "lucide-react";

interface CommentsHistorySheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  projectId: string;
}

export function CommentsHistorySheet({ isOpen, onOpenChange, projectId }: CommentsHistorySheetProps) {
  const { user, supabase } = useAuth();
  const [comments, setComments] = useState<ProjectComment[]>([]);
  const [newCommentText, setNewCommentText] = useState("");
  const [isLoadingComments, setIsLoadingComments] = useState(true);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  const fetchComments = useCallback(async () => {
    if (!user || !projectId) return;

    setIsLoadingComments(true);

    const { data: commentsData, error: commentsError } = await supabase
      .from('project_comments')
      .select('id, comment_text, created_at, user_id')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (commentsError) {
      console.error("Error fetching comments:", commentsError);
      toast({ title: "Error", description: "Could not load comments.", variant: "destructive" });
      setComments([]);
      setIsLoadingComments(false);
      return;
    }

    if (commentsData.length === 0) {
      setComments([]);
      setIsLoadingComments(false);
      return;
    }

    const userIds = [...new Set(commentsData.map(c => c.user_id))];
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, avatar_url')
      .in('id', userIds);

    if (profilesError) {
      console.error("Error fetching profiles for comments:", profilesError);
    }

    const profilesMap = new Map(profilesData?.map(p => [p.id, p]));

    const formattedComments: ProjectComment[] = commentsData.map(c => {
      const profile = profilesMap.get(c.user_id);
      let userName = "Unknown User";
      let avatarUrl = undefined;
      let initials = "U"; // Default initials

      if (profile) {
        const firstName = profile.first_name || '';
        const lastName = profile.last_name || '';
        userName = `${firstName} ${lastName}`.trim();
        avatarUrl = profile.avatar_url;
        if (firstName && lastName) {
          initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
        } else if (firstName) {
          initials = firstName.charAt(0).toUpperCase();
        } else if (lastName) {
          initials = lastName.charAt(0).toUpperCase();
        }
      } else if (c.user_id === user?.id) { // Fallback for current user if profile not found in map (shouldn't happen if profiles are fetched correctly)
        const firstName = user.user_metadata?.first_name || '';
        const lastName = user.user_metadata?.last_name || '';
        userName = `${firstName} ${lastName}`.trim() || user.email || "You";
        avatarUrl = user.user_metadata?.avatar_url;
        if (firstName && lastName) {
          initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
        } else if (firstName) {
          initials = firstName.charAt(0).toUpperCase();
        } else if (lastName) {
          initials = lastName.charAt(0).toUpperCase();
        } else if (user.email) {
          initials = user.email.charAt(0).toUpperCase();
        }
      } else { // For other users whose profiles weren't found
        userName = "Unknown User";
        initials = "U";
      }
      
      return {
        ...c,
        user_name: userName || "Unknown User", // Ensure it's never empty
        avatar_url: avatarUrl,
        initials: initials, // Add initials to the comment object
      };
    });

    setComments(formattedComments);
    setIsLoadingComments(false);
  }, [user, projectId, supabase]);

  useEffect(() => {
    if (isOpen) {
      fetchComments();
    }
  }, [isOpen, fetchComments]);

  // Real-time subscription for new comments
  useEffect(() => {
    if (!user || !projectId || !supabase) return;

    const channel = supabase
      .channel(`project_comments:${projectId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'project_comments', filter: `project_id=eq.${projectId}` },
        async (payload) => {
          const newComment = payload.new as ProjectComment;
          
          // If the new comment is from the current user, it will be handled by the local state update
          // Otherwise, fetch profile for the new comment
          if (newComment.user_id !== user.id) {
            const { data: profileData, error: profileError } = await supabase
              .from('profiles')
              .select('id, first_name, last_name, avatar_url')
              .eq('id', newComment.user_id)
              .single();

            if (profileError) {
              console.error("Error fetching profile for real-time comment:", profileError);
            }

            const profile = profileData;
            const firstName = profile?.first_name || '';
            const lastName = profile?.last_name || '';
            const userName = `${firstName} ${lastName}`.trim();
            let initials = "U";
            if (firstName && lastName) {
              initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
            } else if (firstName) {
              initials = firstName.charAt(0).toUpperCase();
            } else if (lastName) {
              initials = lastName.charAt(0).toUpperCase();
            }

            const formattedComment: ProjectComment = {
              ...newComment,
              user_name: userName || "Unknown User",
              avatar_url: profile?.avatar_url,
              initials: initials,
            };

            setComments(prevComments => [formattedComment, ...prevComments]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, projectId, supabase]);

  const handleAddComment = async () => {
    if (!newCommentText.trim() || !user || !projectId) return;

    setIsSubmittingComment(true);
    const { error } = await supabase
      .from('project_comments')
      .insert({
        project_id: projectId,
        user_id: user.id,
        comment_text: newCommentText.trim(),
      });

    if (error) {
      console.error("Error adding comment:", error);
      toast({ title: "Error", description: "Could not add comment.", variant: "destructive" });
    } else {
      setNewCommentText("");
      toast({ title: "Success", description: "Comment added." });
      await fetchComments();
    }
    setIsSubmittingComment(false);
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="text-2xl flex items-center gap-2">
            <MessageCircle className="h-6 w-6" />
            Comments
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 flex flex-col mt-4 overflow-hidden">
          <div className="flex-1 overflow-y-auto pr-4 space-y-4">
            {isLoadingComments ? (
              <p className="text-gray-500">Loading comments...</p>
            ) : comments.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No comments yet.</p>
            ) : (
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-5 top-0 h-full w-px bg-gray-200 -z-10"></div>
                {comments.map((comment) => (
                  <div key={comment.id} className="flex items-start space-x-4 relative mb-6">
                    <Avatar className="h-10 w-10 z-10 border-2 border-white">
                      <AvatarImage src={comment.avatar_url} alt={comment.user_name || "User"} />
                      <AvatarFallback>{comment.initials || 'U'}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-baseline space-x-2">
                        <p className="text-sm font-semibold text-gray-900">{comment.user_name || "Unknown User"}</p>
                        <p className="text-xs text-gray-500">{formatRelativeTime(comment.created_at)}</p>
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{comment.comment_text}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="mt-4 pt-4 border-t">
            <CommentInput
              value={newCommentText}
              onChange={setNewCommentText}
              onSubmit={handleAddComment}
              isSubmitting={isSubmittingComment}
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}