import { useState, useRef, useCallback } from 'react';

export function useVoiceInput() {
  const [isRecording, setIsRecording] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm'
      });

      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        // Convert to base64 for WebSocket transmission
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64data = reader.result as string;
          const base64Audio = base64data.split(',')[1]; // Remove data:audio/webm;base64, prefix
          
          // Call the callback with base64 data
          if (onVoiceData) {
            onVoiceData(base64Audio);
          }
        };
        reader.readAsDataURL(audioBlob);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
      setIsSupported(false);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  // This will be set by the component using this hook
  let onVoiceData: ((data: string) => void) | undefined;

  const setOnVoiceData = useCallback((callback: (data: string) => void) => {
    onVoiceData = callback;
  }, []);

  return {
    isRecording,
    isSupported,
    toggleRecording,
    setOnVoiceData,
  };
}
