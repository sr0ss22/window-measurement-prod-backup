"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Mic, StopCircle, Loader2, AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils'; // Import cn for conditional classes
import type { FormField } from '@/types/form-config';

type Status = 'IDLE' | 'RECORDING' | 'PROCESSING' | 'ERROR';

interface VoiceCommentProps {
  onUpdate: (fieldId: string, value: any) => void;
  fieldId: string;
  currentValue: string; // New prop for the current text
  aiSummarizationEnabled?: boolean;
  aiSummarizationRules?: string;
  aiTask?: 'summarize' | 'extract_measurements' | 'summarize_and_extract';
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 3000; // 3 seconds

export function VoiceComment({
  onUpdate,
  fieldId,
  currentValue, // New prop
  aiSummarizationEnabled,
  aiSummarizationRules,
  aiTask,
}: VoiceCommentProps) {
  const [status, setStatus] = useState<Status>('IDLE');
  const [processingMessage, setProcessingMessage] = useState('Processing your voice note...');
  const [currentError, setCurrentError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null); // Keep track of the media stream

  const startRecording = async () => {
    clearState(); // Clear any previous state or errors
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream; // Store the stream to stop it later

      const preferredMimeTypes = [
        'audio/webm;codecs=opus', // High quality, good for Chrome/Firefox
        'audio/webm', // Broader WebM support
        'audio/mp4', // Preferred for iOS
        'audio/ogg', // Fallback for older browsers
      ];
      
      let supportedMimeType = '';
      for (const type of preferredMimeTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          supportedMimeType = type;
          break;
        }
      }

      if (!supportedMimeType) {
        setCurrentError('Your browser does not support a compatible audio recording format required for AI transcription. Please try a different browser or device.');
        setStatus('ERROR');
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: supportedMimeType });
      audioChunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (event) => audioChunksRef.current.push(event.data);
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: supportedMimeType });
        stream.getTracks().forEach(track => track.stop()); // Stop the stream when recording stops
        streamRef.current = null; // Clear the stream reference
        processAudio(audioBlob);
      };
      mediaRecorderRef.current.start();
      setStatus('RECORDING');
    } catch (err) {
      console.error('Error starting recording:', err);
      setCurrentError('Could not start recording. Please check microphone permissions.');
      setStatus('ERROR');
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setStatus('PROCESSING');
      setProcessingMessage('Processing your voice note...');
    }
  };

  const processAudio = async (blob: Blob) => {
    try {
      const formData = new FormData();
      formData.append('audio', blob);
      
      // Create a mock FormField object for the API
      const mockField: FormField = {
        id: fieldId,
        name: 'Voice Note', // A generic name, as the API only needs the ID and type
        type: 'voiceNote',
      };
      formData.append('fields', JSON.stringify([mockField]));

      // Create the currentData object
      const currentData = { [fieldId]: currentValue };
      formData.append('currentData', JSON.stringify(currentData));

      if (aiSummarizationEnabled) {
        if (aiSummarizationRules) {
          formData.append('rules', aiSummarizationRules);
        }
        if (aiTask) {
          formData.append('aiTask', aiTask);
        }
      }

      const apiUrl = new URL('/api/voice-comment', window.location.origin);
      const response = await fetch(apiUrl.toString(), {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        if (data.error && data.error.includes('AI service is currently overloaded') && retryCount < MAX_RETRIES) {
          setRetryCount(prev => prev + 1);
          setProcessingMessage(`AI service overloaded. Retrying (${retryCount + 1}/${MAX_RETRIES})...`);
          setTimeout(() => processAudio(blob), RETRY_DELAY_MS);
          return;
        }
        if (data.error && data.error.includes('Transcription model not found or inaccessible')) {
          throw new Error('AI service error: Model not found or inaccessible. Please check your Hugging Face token and permissions.');
        }
        throw new Error(data.error || 'Failed to process voice note.');
      }

      // The API now returns an 'updates' object.
      // We expect it to contain our fieldId.
      if (data.updates && data.updates[fieldId] !== undefined) {
        onUpdate(fieldId, data.updates[fieldId]);
      }

      setStatus('IDLE');
      setRetryCount(0);
    } catch (err: any) {
      setCurrentError(err.message || 'An error occurred.');
      setStatus('ERROR');
      setRetryCount(0);
    }
  };

  const clearState = () => {
    setCurrentError(null);
    setStatus('IDLE');
    setRetryCount(0);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  return (
    <div className="absolute bottom-2 right-2 flex flex-col items-end space-y-1">
      {status === 'PROCESSING' && (
        <div className="flex items-center text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded-md shadow-sm">
          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          {processingMessage}
        </div>
      )}

      {status === 'ERROR' && (
        <div className="flex items-center text-xs text-red-700 bg-red-50 border border-red-200 px-2 py-1 rounded-md shadow-sm">
          <AlertTriangle className="mr-1 h-3 w-3" />
          <span>Error</span>
          <Button variant="ghost" size="icon" className="h-5 w-5 ml-1" onClick={clearState}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {status === 'IDLE' && (
        <Button
          id="voice-comment-button"
          variant="outline"
          size="icon"
          onClick={startRecording}
          className={cn(
            "h-8 w-8",
            currentError !== null ? "text-gray-400" : "border-blue-600 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
          )}
          disabled={currentError !== null}
          title="Record Voice Note"
        >
          <Mic className="h-4 w-4" />
        </Button>
      )}

      {status === 'RECORDING' && (
        <Button
          onClick={stopRecording}
          variant="destructive"
          size="icon"
          className="h-8 w-8 bg-red-500 hover:bg-red-600 relative"
          title="Stop Recording"
        >
          <StopCircle className="h-4 w-4" />
          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-white animate-pulse" />
        </Button>
      )}
    </div>
  );
}