import React, { useState, useRef } from 'react';
import { Mic, Square, FileText, Code, Loader2 } from 'lucide-react';

interface WebAudioRecorderProps {
  onTranscriptionComplete?: (text: string) => void;
  onSolutionGenerated?: (solution: any) => void;
}

const WebAudioRecorder: React.FC<WebAudioRecorderProps> = ({ onTranscriptionComplete, onSolutionGenerated }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcription, setTranscription] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Refs for audio recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);

  // Start recording using Web Audio API
  const startRecording = async () => {
    try {
      setError(null);
      setTranscription(null);

      console.log('Requesting microphone access...');

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      console.log('Microphone access granted, creating MediaRecorder...');

      // Create a new MediaRecorder instance
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      // Clear previous audio chunks
      audioChunksRef.current = [];

      // Add event listeners
      mediaRecorder.ondataavailable = (event) => {
        console.log('Data available event fired, data size:', event.data.size);
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          console.log('Audio chunk added, total chunks:', audioChunksRef.current.length);
        }
      };

      // Add more event listeners for debugging
      mediaRecorder.onstart = () => {
        console.log('MediaRecorder started');
      };

      mediaRecorder.onstop = () => {
        console.log('MediaRecorder stopped, total chunks:', audioChunksRef.current.length);
        // Force the component to update by setting a state
        setIsRecording(false);
      };

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        setError('Recording error occurred');
      };

      // Start recording and request data every 1 second
      mediaRecorder.start(1000);
      setIsRecording(true);

      console.log('Recording started using Web Audio API');
    } catch (err) {
      console.error('Error starting recording:', err);
      setError('Failed to start recording. Please make sure your microphone is connected and you have granted permission to use it.');
    }
  };

  // Stop recording
  const stopRecording = () => {
    console.log('Stopping recording...');
    if (mediaRecorderRef.current && isRecording) {
      try {
        // Stop the media recorder
        mediaRecorderRef.current.stop();
        console.log('MediaRecorder stopped');

        // Stop all audio tracks
        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach(track => {
            track.stop();
            console.log('Audio track stopped');
          });
        }

        // Force update UI
        setIsRecording(false);
        console.log('Recording stopped, chunks collected:', audioChunksRef.current.length);

        // If we have audio chunks, enable transcription
        if (audioChunksRef.current.length > 0) {
          console.log('Audio chunks available for transcription');
        } else {
          console.warn('No audio chunks collected during recording');
          // Create a dummy chunk to allow transcription for testing
          audioChunksRef.current.push(new Blob(['dummy audio data'], { type: 'audio/webm' }));
          console.log('Added dummy audio chunk for testing');
        }
      } catch (err) {
        console.error('Error stopping recording:', err);
        setError('Error stopping recording');
      }
    } else {
      console.warn('Stop recording called but not recording or no MediaRecorder');
    }
  };

  // Process the transcription to generate a solution
  const processTranscription = async () => {
    if (!transcription) {
      setError('No transcription available to process');
      return;
    }

    try {
      setIsProcessing(true);
      setError(null);

      console.log('Processing transcription:', transcription);

      // Send the transcription to the main process for processing
      const result = await window.electronAPI.processAudioTranscription(transcription);

      if (result.success && result.data) {
        console.log('Solution generated:', result.data);

        // Call the callback with the solution data
        if (onSolutionGenerated) {
          onSolutionGenerated(result.data);
        }
      } else {
        console.error('Processing failed:', result.error);
        setError(result.error || 'Failed to process transcription');
      }
    } catch (err) {
      console.error('Error during processing:', err);
      setError('Failed to process transcription: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsProcessing(false);
    }
  };

  // Real transcription using OpenAI's Whisper API
  const transcribeAudio = async () => {
    console.log('Transcribe button clicked, audio chunks:', audioChunksRef.current.length);

    if (audioChunksRef.current.length === 0) {
      setError('No recording available to transcribe');
      return;
    }

    try {
      // Create a blob from the audio chunks
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      console.log('Audio recorded successfully:', {
        size: audioBlob.size + ' bytes',
        type: audioBlob.type,
        chunks: audioChunksRef.current.length
      });

      // Convert the blob to a base64 string to send to the main process
      const reader = new FileReader();

      // Set up a promise to wait for the FileReader to complete
      const readFilePromise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          // The result is a base64 string
          const base64Audio = reader.result as string;
          resolve(base64Audio);
        };

        reader.onerror = () => {
          reject(new Error('Failed to read audio file'));
        };
      });

      // Start reading the blob as a data URL (base64)
      reader.readAsDataURL(audioBlob);

      // Wait for the file to be read
      setIsTranscribing(true);
      setError(null);

      const base64Audio = await readFilePromise;
      console.log('Audio converted to base64, length:', base64Audio.length);

      // Send the base64 audio to the main process for transcription
      console.log('Sending audio to main process for transcription...');
      const result = await window.electronAPI.transcribeWebAudio(base64Audio);

      if (result.success && result.text) {
        console.log('Transcription result:', result.text);
        setTranscription(result.text);

        if (onTranscriptionComplete) {
          onTranscriptionComplete(result.text);
        }
      } else {
        console.error('Transcription failed:', result.error);

        // Special handling for API key errors
        if (result.error && result.error.includes('API key')) {
          setError(
            'OpenAI API key not configured. Please add your API key in Settings > API Keys to use voice transcription.'
          );
        } else {
          setError(result.error || 'Failed to transcribe audio');
        }
      }
    } catch (err) {
      console.error('Error during transcription:', err);

      // Check for API key related errors
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (errorMessage.includes('API key')) {
        setError(
          'OpenAI API key not configured. Please add your API key in Settings > API Keys to use voice transcription.'
        );
      } else {
        setError('Failed to transcribe audio: ' + errorMessage);
      }
    } finally {
      setIsTranscribing(false);
    }
  };

  return (
    <div className="bg-black/60 backdrop-blur-md rounded-lg p-4 text-white">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">Voice Input</h3>
          <span className="text-xs text-green-400">(OpenAI Whisper API)</span>
          <span className="text-xs text-yellow-400">(Requires API Key)</span>
          {isRecording && (
            <div className="flex items-center">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse mr-1"></div>
              <span className="text-xs text-red-400">Recording...</span>
            </div>
          )}
          {isProcessing && (
            <div className="flex items-center">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse mr-1"></div>
              <span className="text-xs text-blue-400">Processing...</span>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          {!isRecording ? (
            <button
              onClick={startRecording}
              className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md text-sm transition-colors"
            >
              <Mic className="w-4 h-4" />
              Start Recording
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-md text-sm transition-colors"
            >
              <Square className="w-4 h-4" />
              Stop Recording
            </button>
          )}

          <button
            onClick={transcribeAudio}
            disabled={isRecording || isTranscribing}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm transition-colors ${
              isRecording || isTranscribing
                ? 'bg-gray-600 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {isTranscribing ? (
              <>
                <div className="w-4 h-4 border-2 border-white/20 border-t-white/80 rounded-full animate-spin"></div>
                Transcribing...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4" />
                Transcribe
              </>
            )}
          </button>

          {transcription && (
            <button
              onClick={processTranscription}
              disabled={isProcessing || !transcription}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm transition-colors ${
                isProcessing || !transcription
                  ? 'bg-gray-600 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Code className="w-4 h-4" />
                  Generate Solution
                </>
              )}
            </button>
          )}
        </div>

        {error && (
          <div className="text-red-400 text-sm bg-red-900/20 p-2 rounded-md">
            Error: {error}
          </div>
        )}

        {transcription && (
          <div className="mt-2">
            <h4 className="text-sm font-medium text-gray-300 mb-1">Transcription:</h4>
            <div className="bg-gray-800/50 p-3 rounded-md text-sm text-gray-200 max-h-32 overflow-y-auto">
              {transcription}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WebAudioRecorder;
