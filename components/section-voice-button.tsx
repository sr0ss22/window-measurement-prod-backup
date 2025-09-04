"use client";

import React, { useState, useRef } from 'react';
import { Mic, StopCircle, Loader2, AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { FormField } from '@/types/form-config';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from '@/lib/utils';

type Status = 'IDLE' | 'RECORDING' | 'PROCESSING' | 'ERROR';

interface SectionVoiceButtonProps {
  sectionFields: FormField[];
  currentData: Record<string, any>; // New prop
  onBulkUpdate: (updates: Record<string, any>) => void;
  label?: string;
  tooltip?: string;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 3000;

export function SectionVoiceButton({ sectionFields, currentData, onBulkUpdate, label, tooltip }: SectionVoiceButtonProps) {
  const [status, setStatus] = useState<Status>('IDLE');
  const [processingMessage, setProcessingMessage] = useState('Processing your voice note...');
  const [currentError, setCurrentError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = async () => {
    clearState();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      let preferredMimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        preferredMimeType = 'audio/webm;codecs=opus';
      }
      
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: preferredMimeType });
      audioChunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (event) => audioChunksRef.current.push(event.data);
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: preferredMimeType });
        stream.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        processAudio(audioBlob);
      };
      mediaRecorderRef.current.start();
      setStatus('RECORDING');
    } catch (err) {
      console.error('Error starting recording:', err);
      setCurrentError('Could not start recording. Check microphone permissions.');
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
      setProcessingMessage('Extracting data from voice note...');
    }
  };

  const processAudio = async (blob: Blob) => {
    try {
      const formData = new FormData();
      formData.append('audio', blob);
      formData.append('fields', JSON.stringify(sectionFields));
      formData.append('currentData', JSON.stringify(currentData));

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
        throw new Error(data.error || 'Failed to process voice note.');
      }

      if (data.updates) {
        onBulkUpdate(data.updates);
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

  const buttonAction = status === 'RECORDING' ? stopRecording : startRecording;
  const buttonTitle = status === 'RECORDING' ? 'Stop Recording' : 'Start Voice Input for this Section';

  const button = (
    <Button
      type="button"
      variant={status === 'RECORDING' ? 'destructive' : 'outline'}
      size="sm"
      onClick={buttonAction}
      className={cn(
        "h-6 px-1.5 text-xs", // Even smaller height and padding
        !label && "w-6", // Make it square if no label
        status !== 'RECORDING' && "border-blue-600 text-blue-600 hover:bg-blue-50 hover:text-blue-700",
        status === 'PROCESSING' && "opacity-50 cursor-not-allowed",
        status === 'ERROR' && "border-red-500 text-red-500 hover:bg-red-50 hover:text-red-600",
      )}
      title={!tooltip ? buttonTitle : undefined}
      disabled={status === 'PROCESSING' || status === 'ERROR'}
    >
      {status === 'RECORDING' ? <StopCircle className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
      {label && <span className="ml-1">{label}</span>}
      {status === 'RECORDING' && <span className="absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-white animate-pulse" />}
    </Button>
  );

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col items-end">
        {tooltip ? (
          <Tooltip>
            <TooltipTrigger asChild>{button}</TooltipTrigger>
            <TooltipContent>
              <p>{tooltip}</p>
            </TooltipContent>
          </Tooltip>
        ) : (
          button
        )}

        <div className="h-4 mt-1">
          {status === 'PROCESSING' && (
            <div className="flex items-center text-xs text-gray-600">
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              {processingMessage}
            </div>
          )}

          {status === 'ERROR' && (
            <div className="flex items-center text-xs text-red-700">
              <AlertTriangle className="mr-1 h-3 w-3" />
              <span>Error</span>
              <Button variant="ghost" size="icon" className="h-5 w-5 ml-1" onClick={clearState}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}