import React, { createContext, useContext } from 'react';
import { useWebSocket } from './use-websocket';

interface IWebSocketContext {
  connected: boolean;
  shapes: any[];
  messages: any[];
  sendChatMessage: (content: string, appType?: 'canvas' | 'tasks' | 'layout') => void;
  sendVoiceData: (data: string, appType?: 'canvas' | 'tasks' | 'layout') => void;
}

const WebSocketContext = createContext<IWebSocketContext | null>(null);

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Single shared hook instance for entire app lifecycle
  const ws = useWebSocket();
  return <WebSocketContext.Provider value={ws}>{children}</WebSocketContext.Provider>;
};

export function useWebSocketContext() {
  const ctx = useContext(WebSocketContext);
  if (!ctx) throw new Error('useWebSocketContext must be used within WebSocketProvider');
  return ctx;
}
