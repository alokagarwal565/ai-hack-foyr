import { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { 
  Mic, 
  MicOff, 
  Send, 
  RotateCcw, 
  Wifi, 
  WifiOff 
} from "lucide-react";
import { ChatMessage } from '@/types/canvas';
import { useVoiceInput } from '@/hooks/use-voice-input';

interface AIControlPanelProps {
  connected: boolean;
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  onSendVoice: (audioData: string) => void;
  onClearChat: () => void;
}

const commandSuggestions = [
  "Draw a red square",
  "Delete all shapes", 
  "Create a house outline",
  "Draw three circles in a row",
  "Change all shapes to blue"
];

export function AIControlPanel({
  connected,
  messages,
  onSendMessage,
  onSendVoice,
  onClearChat,
}: AIControlPanelProps) {
  const [inputValue, setInputValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const { isRecording, isSupported, toggleRecording, setOnVoiceData } = useVoiceInput();

  useEffect(() => {
    setOnVoiceData(onSendVoice);
  }, [onSendVoice, setOnVoiceData]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = () => {
    if (inputValue.trim()) {
      onSendMessage(inputValue.trim());
      setInputValue('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion);
  };

  const formatTime = (date: Date | string) => {
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
      {/* AI Panel Header */}
      <div className="h-14 border-b border-gray-200 flex items-center justify-between px-4">
        <h2 className="font-semibold text-gray-900">AI Assistant</h2>
        <div className="flex items-center space-x-2">
          {isSupported && (
            <Button
              size="sm"
              variant="ghost"
              className={cn(
                "p-2",
                isRecording && "bg-emerald-100 text-emerald-600"
              )}
              onClick={toggleRecording}
              title={isRecording ? "Stop Recording" : "Start Voice Input"}
            >
              {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="p-2"
            onClick={onClearChat}
            title="Clear Chat"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Chat Messages Area */}
      <ScrollArea className="flex-1 p-4">
        <div ref={scrollRef} className="space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 text-sm py-8">
              <p>Start a conversation with the AI assistant!</p>
              <p className="mt-2">Try: "Draw a red circle" or use voice input</p>
            </div>
          )}
          
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex",
                message.sender === 'user' ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "rounded-lg px-4 py-2 max-w-xs text-sm",
                  message.sender === 'user'
                    ? "bg-blue-500 text-white rounded-br-none"
                    : "bg-gray-100 text-gray-800 rounded-bl-none"
                )}
              >
                {message.sender === 'ai' && (
                  <div className="flex items-center space-x-2 mb-1">
                    <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <span className="text-xs font-medium text-emerald-600">AI Assistant</span>
                  </div>
                )}
                <p>{message.content}</p>
                <span 
                  className={cn(
                    "text-xs mt-1 block",
                    message.sender === 'user' ? "opacity-75" : "text-gray-500"
                  )}
                >
                  {formatTime(message.timestamp)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Voice Input Status */}
      {isRecording && (
        <div className="bg-emerald-50 border-t border-emerald-200 p-4">
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-emerald-700 font-medium">Listening...</span>
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto p-1 text-emerald-600 hover:text-emerald-800"
              onClick={toggleRecording}
            >
              <MicOff className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Command Input */}
      <div className="border-t border-gray-200 p-4">
        <div className="flex space-x-2">
          <Input
            type="text"
            placeholder="Type your drawing command..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            className="flex-1 text-sm"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!inputValue.trim()}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        
        {/* Command Suggestions */}
        <div className="mt-3 flex flex-wrap gap-2">
          {commandSuggestions.map((suggestion, index) => (
            <Button
              key={index}
              size="sm"
              variant="ghost"
              className="px-3 py-1 text-xs h-auto"
              onClick={() => handleSuggestionClick(suggestion)}
            >
              {suggestion}
            </Button>
          ))}
        </div>
      </div>

      {/* AI Status Indicator */}
      <div className="border-t border-gray-200 px-4 py-3 bg-gray-50">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center space-x-2">
            {connected ? <Wifi className="w-3 h-3 text-green-500" /> : <WifiOff className="w-3 h-3 text-red-500" />}
            <span>{connected ? 'Connected' : 'Disconnected'}</span>
          </div>
          <span>Groq GPT-OSS 120B</span>
        </div>
        <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
          <div className="flex items-center space-x-2">
            <div className={cn("w-2 h-2 rounded-full", connected ? "bg-blue-500" : "bg-gray-400")}></div>
            <span>Whisper Large v3 Turbo</span>
          </div>
          <span>216x real-time</span>
        </div>
      </div>
    </div>
  );
}
