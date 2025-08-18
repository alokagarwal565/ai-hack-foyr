import { useEffect, useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { WebSocketMessage, Shape, ChatMessage } from '@/types/canvas';

export function useWebSocket() {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const queryClient = useQueryClient();

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
    console.log('WebSocket message received:', message.type, message);
    
    switch (message.type) {
      case 'initial_state':
        console.log('Setting initial state with shapes:', message.shapes?.length || 0);
        setShapes(message.shapes || []);
        setMessages(message.messages || []);
        break;
      case 'shapes_updated':
        console.log('Updating shapes:', message.shapes?.length || 0);
        console.log('Shape details:', message.shapes);
        setShapes(message.shapes || []);
        break;
      case 'shape_created':
        console.log('Shape created:', message.shape);
        setShapes(prev => [...prev, message.shape]);
        break;
      case 'shape_deleted':
        console.log('Shape deleted:', message.id);
        setShapes(prev => prev.filter(shape => shape.id !== message.id));
        break;
      case 'shapes_cleared':
        console.log('All shapes cleared');
        setShapes([]);
        break;
      case 'chat_message':
        setMessages(prev => [...prev, {
          ...message.message,
          timestamp: new Date(message.message.timestamp)
        }]);
        break;
      case 'layout_created':
        // Invalidate layout queries to refresh the UI
        queryClient.invalidateQueries({ queryKey: ['/api/layouts'] });
        break;
      case 'layout_updated':
        // Invalidate layout queries to refresh the UI
        queryClient.invalidateQueries({ queryKey: ['/api/layouts'] });
        break;
      case 'block_created':
        // Invalidate block queries to refresh the UI
        queryClient.invalidateQueries({ queryKey: ['/api/blocks'] });
        break;
      case 'block_updated':
        // Invalidate block queries to refresh the UI
        queryClient.invalidateQueries({ queryKey: ['/api/blocks'] });
        break;
      case 'block_deleted':
        // Invalidate block queries to refresh the UI
        queryClient.invalidateQueries({ queryKey: ['/api/blocks'] });
        break;
      case 'layout_deleted':
        queryClient.invalidateQueries({ queryKey: ['/api/layouts'] });
        break;
      case 'layouts_updated':
        queryClient.invalidateQueries({ queryKey: ['/api/layouts'] });
        break;
      case 'command_executed':
        console.log('Command executed:', message.interpretation);
        // The shapes_updated message should follow this, so we don't need to do anything here
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

  const sendChatMessage = useCallback((content: string, appType: 'canvas' | 'tasks' | 'layout' = 'canvas') => {
    sendMessage({ type: 'chat_message', content, appType });
  }, [sendMessage]);

  const sendVoiceData = useCallback((audioData: string, appType: 'canvas' | 'tasks' | 'layout' = 'canvas') => {
    sendMessage({ type: 'voice_data', data: audioData, appType });
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
