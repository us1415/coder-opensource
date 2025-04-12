import React, { useState } from 'react';
import { Mic, FileText } from 'lucide-react';

interface AudioRecorderProps {
  onTranscriptionComplete?: (text: string) => void;
}

const AudioRecorder: React.FC<AudioRecorderProps> = ({ onTranscriptionComplete }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcription, setTranscription] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Simplified recording function - no actual recording, just simulates the process
  const handleRecordClick = () => {
    if (isRecording) {
      // Stop recording
      setIsRecording(false);
    } else {
      // Start recording
      setIsRecording(true);
      setTranscription(null);
      setError(null);
    }
  };

  // Simplified transcription function - generates a random transcription
  const handleTranscribeClick = () => {
    if (isRecording) {
      setError('Please stop recording first');
      return;
    }

    setIsTranscribing(true);
    setError(null);

    // Simulate a short delay for better UX
    setTimeout(() => {
      const phrases = [
        "I would solve this problem using a dynamic programming approach to optimize the time complexity.",
        "For this algorithm, we need to consider the edge cases carefully, especially when dealing with empty inputs.",
        "The time complexity of this solution is O(n log n) and the space complexity is O(n).",
        "We can use a hash map to store the values and their frequencies, which will give us constant time lookups.",
        "I would implement this using a breadth-first search algorithm to traverse the tree level by level.",
        "This problem can be solved efficiently using a two-pointer technique to avoid nested loops.",
        "We need to handle potential integer overflow in this solution, especially when dealing with large inputs.",
        "A greedy algorithm works here because we can prove that the locally optimal choice leads to a globally optimal solution.",
        "I would use recursion with memoization to avoid recalculating the same subproblems multiple times.",
        "For concurrency issues, we need to implement proper synchronization mechanisms to avoid race conditions.",
        "Write a program that prints hello world to the screen.",
        "To solve this problem, I would first initialize the variables and then iterate through the array.",
        "The key insight is to use a stack data structure to keep track of the opening and closing brackets.",
        "We can optimize this solution by using a binary search instead of a linear search.",
        "The edge case we need to handle is when the input is empty or contains only whitespace."
      ];

      // Pick 1-2 random phrases
      const numPhrases = Math.floor(Math.random() * 2) + 1;
      let text = "";

      for (let i = 0; i < numPhrases; i++) {
        const randomIndex = Math.floor(Math.random() * phrases.length);
        text += phrases[randomIndex] + " ";
      }

      const result = text.trim();
      setTranscription(result);
      setIsTranscribing(false);

      if (onTranscriptionComplete) {
        onTranscriptionComplete(result);
      }
    }, 500);
  };

  return (
    <div className="bg-black/60 backdrop-blur-md rounded-lg p-4 text-white">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">Voice Input</h3>
          {isRecording && (
            <div className="flex items-center">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse mr-1"></div>
              <span className="text-xs text-red-400">Recording...</span>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleRecordClick}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm transition-colors ${
              isRecording
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-blue-600 hover:bg-blue-700'
            } text-white`}
          >
            <Mic className="w-4 h-4" />
            {isRecording ? 'Stop Recording' : 'Start Recording'}
          </button>

          <button
            onClick={handleTranscribeClick}
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

export default AudioRecorder;
