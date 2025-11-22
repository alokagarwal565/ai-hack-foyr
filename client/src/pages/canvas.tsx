import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCanvas } from '@/hooks/use-canvas';
import { useWebSocketContext } from '@/hooks/websocket-provider';
import { ToolSidebar } from '@/components/canvas/tool-sidebar';
import { DrawingCanvas } from '@/components/canvas/drawing-canvas';
import { AIControlPanel } from '@/components/canvas/ai-control-panel';
import { Button } from '@/components/ui/button';

export default function CanvasPage() {
  const queryClient = useQueryClient();
  const {
    canvasRef,
    canvasState,
    setMode,
    setSelectedTool,
    setSelectedColor,
    setShapes,
    handleMouseDown,
    handleMouseUp,
    deleteSelected,
    clearCanvas,
  } = useCanvas();

  const {
    connected,
    shapes,
    messages: wsMessages,
    sendChatMessage,
    sendVoiceData,
  } = useWebSocketContext();

  // Load canvas-specific messages from REST API
  const { data: apiMessages = [] } = useQuery({
    queryKey: ['/api/chat-messages', { appType: 'canvas' }],
    queryFn: async () => {
      const response = await fetch('/api/chat-messages?appType=canvas');
      return response.json();
    },
  });

  // Merge API messages with WebSocket messages (deduplicate by ID)
  const messages = React.useMemo(() => {
    const messageMap = new Map();
    // Add API messages first
    apiMessages.forEach((msg: any) => messageMap.set(msg.id, msg));
    // Add/update with WebSocket messages
    wsMessages.filter((msg: any) => msg.appType === 'canvas').forEach((msg: any) => messageMap.set(msg.id, msg));
    return Array.from(messageMap.values()).sort((a: any, b: any) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }, [apiMessages, wsMessages]);

  // Update canvas shapes when WebSocket shapes change
  React.useEffect(() => {
    console.log('Canvas page received shapes update:', shapes.length, 'shapes');
    console.log('Shape details:', shapes);
    setShapes(shapes);
  }, [shapes, setShapes]);

  const handleClearChat = async () => {
    try {
      await fetch('/api/chat-messages?appType=canvas', { method: 'DELETE' });
      queryClient.invalidateQueries({ queryKey: ['/api/chat-messages', { appType: 'canvas' }] });
    } catch (error) {
      console.error('Failed to clear chat:', error);
    }
  };

  return (
    <div className="flex h-full bg-slate-50">
      <ToolSidebar
        mode={canvasState.mode}
        selectedTool={canvasState.selectedTool}
        selectedColor={canvasState.selectedColor}
        onModeChange={setMode}
        onToolChange={setSelectedTool}
        onColorChange={setSelectedColor}
        onDeleteSelected={deleteSelected}
        onClearCanvas={clearCanvas}
      />

      <div className="flex-1 flex flex-col">
        {/* Top Toolbar */}
        <div className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6">
          <div className="flex items-center space-x-4">
            <h1 className="text-lg font-semibold text-gray-900">Smart Shape Canvas</h1>
            <div className="flex items-center space-x-2">
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                canvasState.mode === 'manual' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'bg-emerald-100 text-emerald-700'
              }`}>
                {canvasState.mode === 'manual' ? 'Manual Mode' : 'AI Mode'}
              </div>
              <div className="flex items-center space-x-1 text-sm">
                <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className={connected ? 'text-green-600' : 'text-red-600'}>
                  {connected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-500">
              {shapes.length} {shapes.length === 1 ? 'shape' : 'shapes'}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {/* TODO: Implement undo */}}
            >
              Undo
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {/* TODO: Implement redo */}}
            >
              Redo
            </Button>
          </div>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 p-6">
          <DrawingCanvas
            shapes={shapes}
            mode={canvasState.mode}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            canvasRef={canvasRef}
          />
        </div>
      </div>

      <AIControlPanel
        connected={connected}
        messages={messages}
        onSendMessage={sendChatMessage}
        onSendVoice={sendVoiceData}
        onClearChat={handleClearChat}
      />
    </div>
  );
}
