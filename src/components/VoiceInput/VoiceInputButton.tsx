import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import { useToast } from '../../contexts/toast';
import { COMMAND_KEY } from '../../utils/platform';

interface VoiceInputButtonProps {
  onSolutionGenerated?: (solution: any) => void;
  showKeyboardShortcut?: boolean;
}

const VoiceInputButton: React.FC<VoiceInputButtonProps> = ({
  onSolutionGenerated,
  showKeyboardShortcut = true
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcription, setTranscription] = useState<string | null>(null);
  const { showToast } = useToast();

  // Refs for audio recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);

  // Start recording using Web Audio API
  const startRecording = async () => {
    try {
      setTranscription(null);

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      // Create a new MediaRecorder instance
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      // Clear previous audio chunks
      audioChunksRef.current = [];

      // Add event listeners
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // Start recording and request data every 1 second
      mediaRecorder.start(1000);
      setIsRecording(true);
      showToast('Recording Started', 'Speak your coding problem clearly', 'neutral');
    } catch (err) {
      console.error('Error starting recording:', err);
      showToast('Recording Error', 'Failed to access microphone', 'error');
    }
  };

  // Stop recording
  const stopRecording = async () => {
    if (mediaRecorderRef.current && isRecording) {
      try {
        // Stop the media recorder
        mediaRecorderRef.current.stop();

        // Stop all audio tracks
        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach(track => {
            track.stop();
          });
        }

        setIsRecording(false);

        // Automatically start transcription after stopping
        await transcribeAudio();
      } catch (err) {
        console.error('Error stopping recording:', err);
        showToast('Recording Error', 'Failed to stop recording', 'error');
      }
    }
  };

  // Transcribe audio and process it
  const transcribeAudio = async () => {
    if (audioChunksRef.current.length === 0) {
      showToast('Transcription Error', 'No recording available to transcribe', 'error');
      return;
    }

    try {
      setIsTranscribing(true);

      // Create a blob from the audio chunks
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

      // Convert blob to base64
      const reader = new FileReader();
      const readFilePromise = new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const base64data = reader.result as string;
          resolve(base64data);
        };
      });

      // Start reading the blob as a data URL (base64)
      reader.readAsDataURL(audioBlob);

      // Wait for the file to be read
      const base64Audio = await readFilePromise;

      // Send the base64 audio to the main process for transcription
      const result = await window.electronAPI.transcribeWebAudio(base64Audio);

      if (result.success && result.text) {
        setTranscription(result.text);
        showToast('Transcription Complete', 'Processing your coding problem...', 'success');

        // Automatically process the transcription
        await processTranscription(result.text);
      } else {
        // Special handling for API key errors
        if (result.error && result.error.includes('API key')) {
          showToast('API Key Required', 'Please add your OpenAI API key in Settings', 'error');
        } else {
          showToast('Transcription Failed', result.error || 'Failed to transcribe audio', 'error');
        }
      }
    } catch (err) {
      console.error('Error during transcription:', err);
      showToast('Transcription Error', 'Failed to transcribe audio', 'error');
    } finally {
      setIsTranscribing(false);
    }
  };

  // Process the transcription to generate a solution
  const processTranscription = async (text: string) => {
    if (!text) {
      showToast('Processing Error', 'No transcription available to process', 'error');
      return;
    }

    try {
      setIsProcessing(true);

      // Send the transcription to the main process for processing
      const result = await window.electronAPI.processAudioTranscription(text);

      if (result.success && result.data) {
        // Set the problem info in the app state
        window.electronAPI.setProblemInfo({
          problem_statement: text,
          constraints: "",
          example_input: "",
          example_output: ""
        });

        // Navigate to the solutions view
        window.electronAPI.setView("solutions");

        // Send the solution to the renderer
        window.electronAPI.sendEvent("SOLUTION_SUCCESS", result.data);

        // Call the callback with the solution data
        if (onSolutionGenerated) {
          onSolutionGenerated(result.data);
        }

        showToast('Solution Generated', 'Solution has been generated successfully', 'success');
      } else {
        showToast('Processing Failed', result.error || 'Failed to process transcription', 'error');
      }
    } catch (err) {
      console.error('Error during processing:', err);
      showToast('Processing Error', 'Failed to process transcription', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Toggle recording state
  const toggleRecording = async () => {
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  };

  // Listen for global shortcut
  useEffect(() => {
    const cleanup = window.electronAPI.onToggleVoiceRecording(() => {
      toggleRecording();
    });

    return cleanup;
  }, [isRecording, isTranscribing, isProcessing]);

  return (
    <div className="flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 hover:bg-white/10 transition-colors">
      {isTranscribing || isProcessing ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-[11px] leading-none truncate">
            {isTranscribing ? 'Transcribing...' : 'Processing...'}
          </span>
        </>
      ) : (
        <>
          <button
            onClick={toggleRecording}
            className={`flex items-center justify-center w-4 h-4 ${isRecording ? 'text-red-500' : 'text-white'}`}
          >
            {isRecording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
          <span className="text-[11px] leading-none truncate">
            {isRecording ? 'Stop Recording' : 'Voice Input'}
          </span>
          {showKeyboardShortcut && (
            <div className="flex gap-1">
              <button className="bg-white/10 rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">
                {COMMAND_KEY}
              </button>
              <button className="bg-white/10 rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">
                K
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default VoiceInputButton;
