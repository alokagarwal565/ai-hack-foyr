import { useEffect, useState, useCallback, useRef } from 'react';
import { WebSocketMessage, Shape, ChatMessage } from '@/types/canvas';

export function useWebSocket() {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  const connect = useCallback(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('WebSocket connected');
      setConnected(true);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
    
    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        handleMessage(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };
    
    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setConnected(false);
      setSocket(null);
      
      // Attempt to reconnect after 3 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 3000);
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    setSocket(ws);
  }, []);

  const handleMessage = useCallback((message: WebSocketMessage) => {
    switch (message.type) {
      case 'initial_state':
        setShapes(message.shapes || []);
        setMessages(message.messages || []);
        break;
      case 'shapes_updated':
        setShapes(message.shapes || []);
        break;
      case 'shape_created':
        setShapes(prev => [...prev, message.shape]);
        break;
      case 'shape_deleted':
        setShapes(prev => prev.filter(shape => shape.id !== message.id));
        break;
      case 'shapes_cleared':
        setShapes([]);
        break;
      case 'chat_message':
        setMessages(prev => [...prev, {
          ...message.message,
          timestamp: new Date(message.message.timestamp)
        }]);
        break;
      default:
        console.log('Unknown message type:', message.type);
    }
  }, []);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    } else {
      console.error('WebSocket is not connected');
    }
  }, [socket]);

  const sendChatMessage = useCallback((content: string) => {
    sendMessage({ type: 'chat_message', content });
  }, [sendMessage]);

  const sendVoiceData = useCallback((audioData: string) => {
    sendMessage({ type: 'voice_data', data: audioData });
  }, [sendMessage]);

  useEffect(() => {
    connect();
    
    return () => {
      if (socket) {
        socket.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  return {
    connected,
    shapes,
    messages,
    sendChatMessage,
    sendVoiceData,
  };
}
