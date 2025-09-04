"use client";

import React, { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Mic, StopCircle, Loader2, AlertTriangle, X, CheckCircle, Plus, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FormField } from '@/types/form-config';
import type { WindowItem } from '@/types/window-item'; // Import WindowItem
import { useToast } from '@/components/ui/use-toast';

type Status = 'IDLE' | 'RECORDING' | 'PROCESSING' | 'SUCCESS' | 'ERROR';

interface VoiceCaptureDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onCaptureSuccess: (result: any) => void;
  targetFields: FormField[];
  windowItems: WindowItem[];
  mode: 'single' | 'multi';
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 3000;

export function VoiceCaptureDialog({
  isOpen,
  onOpenChange,
  onCaptureSuccess,
  targetFields,
  windowItems,
  mode,
}: VoiceCaptureDialogProps) {
  const [status, setStatus] = useState<Status>('IDLE');
  const [processingMessage, setProcessingMessage] = useState('Processing your voice note...');
  const [currentError, setCurrentError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [extractedResult, setExtractedResult] = useState<any | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        clearState();
        setExtractedResult(null);
        setTranscript(null);
      }, 300);
    }
  }, [isOpen]);

  const clearState = () => {
    setCurrentError(null);
    setStatus('IDLE');
    setProcessingMessage('Processing your voice note...');
    setRetryCount(0);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const startRecording = async () => {
    clearState();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const preferredMimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg',
      ];
      
      let supportedMimeType = '';
      for (const type of preferredMimeTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          supportedMimeType = type;
          break;
        }
      }

      if (!supportedMimeType) {
        throw new Error('Your browser does not support a compatible audio recording format required for AI transcription. Please try a different browser or device.');
      }
      
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: supportedMimeType });
      audioChunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (event) => audioChunksRef.current.push(event.data);
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: supportedMimeType });
        stream.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        processAudio(audioBlob);
      };
      mediaRecorderRef.current.start();
      setStatus('RECORDING');
    } catch (err: any) {
      console.error('Error starting recording:', err);
      setCurrentError(err.message || 'Could not start recording. Check microphone permissions.');
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
      setProcessingMessage('Transcribing voice note...');
    }
  };

  const processAudio = async (blob: Blob) => {
    try {
      const formData = new FormData();
      formData.append('audio', blob);
      formData.append('targetFields', JSON.stringify(targetFields));
      formData.append('windowItems', JSON.stringify(windowItems.map(w => ({ id: w.id, lineNumber: w.lineNumber }))));
      formData.append('mode', mode); // Pass the mode to the API

      const apiUrl = new URL('/api/process-voice-command', window.location.origin);
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

      setTranscript(data.transcript);
      setExtractedResult(data);
      setStatus('SUCCESS');
      setRetryCount(0);
      toast({
        title: "Voice Capture Successful",
        description: "Data extracted. Review and confirm.",
      });
    } catch (err: any) {
      setCurrentError(err.message || 'An error occurred.');
      setStatus('ERROR');
      setRetryCount(0);
      toast({
        title: "Voice Capture Failed",
        description: err.message || "An error occurred during voice processing.",
        variant: "destructive",
      });
    }
  };

  const handleConfirmAction = () => {
    if (extractedResult) {
      onCaptureSuccess(extractedResult);
    }
  };

  const renderContent = () => {
    switch (status) {
      case 'IDLE':
        return (
          <div className="flex flex-col items-center space-y-4">
            <Mic className="h-16 w-16 text-blue-600" />
            <p className="text-lg text-center">Click to start recording your command.</p>
            <p className="text-sm text-gray-500 text-center">
              {mode === 'multi'
                ? 'Try saying: "Line 1, Living Room, 36 by 60. Line 2, update width to 40."'
                : 'Try saying: "Add a new window in the living room, width 36 and a half, height 48 and a quarter."'
              }
            </p>
            <Button onClick={startRecording} className="bg-blue-600 hover:bg-blue-700">
              <Mic className="mr-2 h-5 w-5" /> Start Recording
            </Button>
          </div>
        );
      case 'RECORDING':
        return (
          <div className="flex flex-col items-center space-y-4">
            <div className="relative">
              <Mic className="h-16 w-16 text-red-500 animate-pulse" />
              <span className="absolute top-0 right-0 h-4 w-4 rounded-full bg-red-500 animate-ping" />
            </div>
            <p className="text-lg text-center">Recording... Speak clearly.</p>
            <Button onClick={stopRecording} variant="destructive">
              <StopCircle className="mr-2 h-5 w-5" /> Stop Recording
            </Button>
          </div>
        );
      case 'PROCESSING':
        return (
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="h-16 w-16 text-gray-500 animate-spin" />
            <p className="text-lg text-center">{processingMessage}</p>
            <p className="text-sm text-gray-500">Please wait, this may take a moment.</p>
          </div>
        );
      case 'SUCCESS':
        return (
          <div className="flex flex-col items-center space-y-4">
            <CheckCircle className="h-16 w-16 text-green-500" />
            <p className="text-lg font-semibold text-center">Command Processed Successfully!</p>
            {transcript && (
              <div className="w-full p-3 bg-gray-100 rounded-md text-sm text-gray-700 border">
                <p className="font-medium mb-1">Transcript:</p>
                <p className="italic">{transcript}</p>
              </div>
            )}
            {/* Multi-line result display */}
            {extractedResult?.type === 'multi-line' && Array.isArray(extractedResult.commands) && (
              <div className="w-full p-3 bg-blue-50 rounded-md text-sm text-blue-800 border border-blue-200 max-h-40 overflow-y-auto">
                <p className="font-medium mb-1">Extracted Commands:</p>
                <ul className="list-disc list-inside space-y-2">
                  {extractedResult.commands.map((cmd: any, index: number) => (
                    <li key={index}>
                      <span className="font-semibold">{cmd.type.replace('-', ' ')}</span>
                      {cmd.lineNumber && ` on Line ${cmd.lineNumber}`}
                      {cmd.sourceLineNumber && ` from Line ${cmd.sourceLineNumber}`}
                      <ul className="list-disc list-inside ml-4">
                        {Object.entries(cmd.data || cmd.updates || {}).map(([key, value]) => (
                          <li key={key}>{key}: {String(value)}</li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {/* Single-line result display */}
            {extractedResult?.type === 'new-line' && extractedResult.data && (
              <div className="w-full p-3 bg-blue-50 rounded-md text-sm text-blue-800 border border-blue-200">
                <p className="font-medium mb-1">Extracted Data for New Line:</p>
                <ul className="list-disc list-inside">
                  {Object.entries(extractedResult.data).map(([key, value]) => (
                    <li key={key}>
                      <span className="font-semibold">{targetFields.find(f => f.id === key)?.name || key}:</span> {String(value)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {extractedResult?.type === 'copy-and-modify' && extractedResult.command && (
              <div className="w-full p-3 bg-purple-50 rounded-md text-sm text-purple-800 border border-purple-200">
                <p className="font-medium mb-1">Copy Command Details:</p>
                <ul className="list-disc list-inside">
                  <li><span className="font-semibold">Source Line:</span> {extractedResult.command.sourceLineNumber === 'last' ? 'Last Line' : `Line ${extractedResult.command.sourceLineNumber}`}</li>
                  <li><span className="font-semibold">Updates:</span>
                    <ul className="list-disc list-inside ml-4">
                      {Object.entries(extractedResult.command.updates).map(([key, value]) => (
                        <li key={key}>
                          <span className="font-semibold">{targetFields.find(f => f.id === key)?.name || key}:</span> {String(value)}
                        </li>
                      ))}
                    </ul>
                  </li>
                </ul>
              </div>
            )}
            <div className="flex space-x-2">
              <Button variant="outline" onClick={clearState}>
                <X className="mr-2 h-4 w-4" /> Try Again
              </Button>
              <Button onClick={handleConfirmAction} className="bg-green-600 hover:bg-green-700">
                <Plus className="mr-2 h-4 w-4" />
                Confirm & Add
              </Button>
            </div>
          </div>
        );
      case 'ERROR':
        return (
          <div className="flex flex-col items-center space-y-4">
            <AlertTriangle className="h-16 w-16 text-red-500" />
            <p className="text-lg font-semibold text-center">Error Occurred</p>
            <p className="text-sm text-red-700 text-center">{currentError}</p>
            <Button onClick={clearState} variant="outline">
              <X className="mr-2 h-4 w-4" /> Try Again
            </Button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-2xl text-center">Voice Capture</DialogTitle>
          <DialogDescription className="text-center">
            {mode === 'multi'
              ? 'Speak multiple commands at once. For example: "Line 1, Living Room, 36 by 60. Line 2, update width to 40."'
              : 'Speak your command to add a new window or copy an existing one.'
            }
          </DialogDescription>
        </DialogHeader>
        <div className="py-6">
          {renderContent()}
        </div>
      </DialogContent>
    </Dialog>
  );
}