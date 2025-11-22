import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWebSocketContext } from '@/hooks/websocket-provider';
import { useVoiceInput } from '@/hooks/use-voice-input';
import { apiRequest } from '@/lib/queryClient';
import { cn } from "@/lib/utils";
import { 
  Grid3X3,
  Plus,
  Type,
  Image,
  Square,
  Package,
  Mic,
  MicOff,
  Send,
  Brain,
  Edit,
  Move,
  Trash2,
  Copy
} from "lucide-react";

interface Layout {
  id: string;
  name: string;
  description?: string;
  gridConfig: {
    columns: number;
    rows?: number;
    gap?: number;
  };
  blocks: any[];
  createdAt: Date;
  updatedAt: Date;
}

interface Block {
  id: string;
  type: 'text' | 'image' | 'container' | 'widget';
  content: any;
  position: {
    col: number;
    row: number;
    colSpan?: number;
    rowSpan?: number;
  };
  style: any;
  layoutId: string;
}

const blockTypes = [
  { id: 'text', label: 'Text Block', icon: Type, color: 'bg-blue-100 text-blue-700' },
  { id: 'image', label: 'Image Block', icon: Image, color: 'bg-green-100 text-green-700' },
  { id: 'container', label: 'Container', icon: Square, color: 'bg-purple-100 text-purple-700' },
  { id: 'widget', label: 'Widget', icon: Package, color: 'bg-orange-100 text-orange-700' },
];

export default function LayoutPage() {
  const [mode, setMode] = useState<'manual' | 'ai'>('manual');
  const [selectedLayout, setSelectedLayout] = useState<string | null>(null);
  const [newLayout, setNewLayout] = useState({ name: '', columns: 12, gap: 16 });
  const [chatInput, setChatInput] = useState('');
  const [showNewLayoutDialog, setShowNewLayoutDialog] = useState(false);
  const [draggedBlock, setDraggedBlock] = useState<Block | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<{col: number, row: number} | null>(null);
  
  const queryClient = useQueryClient();
  const { connected, messages: wsMessages, sendChatMessage, sendVoiceData } = useWebSocketContext();
  const { isRecording, isSupported, toggleRecording, setOnVoiceData } = useVoiceInput();

  useEffect(() => {
    setOnVoiceData((audioData: string) => sendVoiceData(audioData, 'layout'));
  }, [sendVoiceData, setOnVoiceData]);

  const { data: layouts = [] } = useQuery<Layout[]>({
    queryKey: ['/api/layouts'],
    refetchInterval: 2000,
  });

  const { data: blocks = [] } = useQuery<Block[]>({
    queryKey: ['/api/blocks', { layoutId: selectedLayout }],
    queryFn: () => selectedLayout ? 
      fetch(`/api/blocks?layoutId=${selectedLayout}`).then(res => res.json()) : 
      Promise.resolve([]),
    enabled: !!selectedLayout,
    refetchInterval: 2000,
  });

  // Debug logging
  useEffect(() => {
    console.log('Selected layout:', selectedLayout);
    console.log('Blocks data:', blocks);
  }, [selectedLayout, blocks]);

  const createLayoutMutation = useMutation({
    mutationFn: (layout: any) => apiRequest('POST', '/api/layouts', layout),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/layouts'] });
      setNewLayout({ name: '', columns: 12, gap: 16 });
      setShowNewLayoutDialog(false);
    },
  });

  const createBlockMutation = useMutation({
    mutationFn: (block: any) => apiRequest('POST', '/api/blocks', block),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/blocks'] });
    },
  });

  const updateBlockMutation = useMutation({
    mutationFn: ({ id, ...block }: any) => apiRequest('PATCH', `/api/blocks/${id}`, block),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/blocks'] });
    },
  });

  const deleteBlockMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/blocks/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/blocks'] });
    },
  });

  const handleCreateLayout = () => {
    if (newLayout.name.trim()) {
      createLayoutMutation.mutate({
        name: newLayout.name,
        gridConfig: {
          columns: newLayout.columns,
          gap: newLayout.gap,
        },
        blocks: [],
      });
    }
  };

  const handleAddBlock = (type: string, specificPosition?: { col: number; row: number }) => {
    if (!selectedLayout) return;
    
    const defaultContent = {
      text: { text: 'New text block', fontSize: 16, color: '#000000' },
      image: { src: '', alt: 'Image placeholder', width: '100%', height: 'auto' },
      container: { background: '#f3f4f6', padding: 16, borderRadius: 8 },
      widget: { type: 'chart', config: {} },
    };

    let col = 1, row = 1;
    
    if (specificPosition) {
      col = specificPosition.col;
      row = specificPosition.row;
    } else {
      // Find next available position
      const occupiedPositions = (blocks as Block[]).map((b: Block) => `${b.position.col}-${b.position.row}`);
      while (occupiedPositions.includes(`${col}-${row}`)) {
        col++;
        if (col > 12) { col = 1; row++; }
      }
    }

    createBlockMutation.mutate({
      type,
      content: defaultContent[type as keyof typeof defaultContent],
      position: { col, row, colSpan: 2, rowSpan: 1 },
      style: {},
      layoutId: selectedLayout,
    });
  };

  const handleSendMessage = () => {
    if (chatInput.trim()) {
      sendChatMessage(chatInput.trim(), 'layout');
      setChatInput('');
    }
  };

  const handleBlockClick = (block: Block) => {
    console.log('Block clicked:', block);
    // TODO: Implement block editing modal or inline editing
  };

  const handleDeleteBlock = (blockId: string) => {
    if (confirm('Are you sure you want to delete this block?')) {
      deleteBlockMutation.mutate(blockId);
    }
  };

  const handleDragStart = (e: React.DragEvent, block: Block) => {
    setDraggedBlock(block);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', ''); // Required for Firefox
  };

  const handleDragEnd = () => {
    setDraggedBlock(null);
    setDragOverPosition(null);
  };

  const handleDragOver = (e: React.DragEvent, col: number, row: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverPosition({ col, row });
  };

  const handleDrop = (e: React.DragEvent, newCol: number, newRow: number) => {
    e.preventDefault();
    if (!draggedBlock) return;

    // Don't update if dropping in the same position
    if (draggedBlock.position.col === newCol && draggedBlock.position.row === newRow) {
      setDraggedBlock(null);
      setDragOverPosition(null);
      return;
    }

    // Update block position
    updateBlockMutation.mutate({
      id: draggedBlock.id,
      position: {
        ...draggedBlock.position,
        col: newCol,
        row: newRow,
      }
    });

    setDraggedBlock(null);
    setDragOverPosition(null);
  };

  const getGridPositionFromCoords = (layout: Layout, clientX: number, clientY: number, gridElement: HTMLElement) => {
    const rect = gridElement.getBoundingClientRect();
    const relativeX = clientX - rect.left;
    const relativeY = clientY - rect.top;
    
    const columnWidth = rect.width / layout.gridConfig.columns;
    const rowHeight = 60; // Estimated row height
    
    const col = Math.max(1, Math.min(layout.gridConfig.columns, Math.ceil(relativeX / columnWidth)));
    const row = Math.max(1, Math.ceil(relativeY / rowHeight));
    
    return { col, row };
  };

  // Load layout-specific messages from REST API so they persist across navigation
  const { data: apiMessages = [] } = useQuery({
    queryKey: ['/api/chat-messages', { appType: 'layout' }],
    queryFn: async () => {
      const response = await fetch('/api/chat-messages?appType=layout');
      return response.json();
    },
  });

  const currentLayout = layouts.find((l: Layout) => l.id === selectedLayout);
  // Merge persisted API messages with live WebSocket messages (filter by appType) and sort chronologically
  const layoutMessages = React.useMemo(() => {
    const map = new Map();
    apiMessages.forEach((m: any) => map.set(m.id, m));
    wsMessages.filter((m: any) => m.appType === 'layout').forEach((m: any) => map.set(m.id, m));
    return Array.from(map.values()).sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [apiMessages, wsMessages]);

  const renderGridPreview = (layout: Layout) => {
    const layoutBlocks = (blocks as Block[]).filter((b: Block) => b.layoutId === layout.id);
    
    // Create drop zones for empty grid positions
    const maxRow = Math.max(...layoutBlocks.map(b => b.position.row), 3);
    const dropZones = [];
    for (let row = 1; row <= maxRow + 1; row++) {
      for (let col = 1; col <= layout.gridConfig.columns; col++) {
        const hasBlock = layoutBlocks.some(b => 
          b.position.col === col && b.position.row === row
        );
        if (!hasBlock) {
          dropZones.push({ col, row });
        }
      }
    }

    return (
      <div 
        className="grid gap-2 bg-gray-50 p-4 rounded-lg min-h-32 relative"
        style={{
          gridTemplateColumns: `repeat(${layout.gridConfig.columns}, 1fr)`,
          gap: `${layout.gridConfig.gap || 16}px`,
        }}
        onDragOver={(e) => e.preventDefault()}
      >
        {layoutBlocks.map((block: Block) => {
          const blockType = blockTypes.find(t => t.id === block.type);
          const Icon = blockType?.icon || Square;
          
          return (
            <div
              key={block.id}
              draggable
              className={cn(
                "bg-white border-2 border-dashed border-gray-300 rounded p-2 flex items-center justify-center text-sm transition-all hover:border-blue-400 cursor-move relative group select-none",
                blockType?.color || 'bg-gray-100',
                draggedBlock?.id === block.id && "opacity-50 scale-105"
              )}
              style={{
                gridColumn: `${block.position.col} / span ${block.position.colSpan || 1}`,
                gridRow: `${block.position.row} / span ${block.position.rowSpan || 1}`,
              }}
              onDragStart={(e) => handleDragStart(e, block)}
              onDragEnd={handleDragEnd}
              onClick={() => handleBlockClick(block)}
            >
              <div className="text-center">
                <Icon className="w-4 h-4 mx-auto mb-1" />
                <div className="text-xs">{blockType?.label}</div>
                {draggedBlock?.id === block.id && (
                  <div className="absolute inset-0 flex items-center justify-center bg-blue-100 bg-opacity-75 rounded">
                    <div className="text-xs text-blue-600 font-medium">Dragging...</div>
                  </div>
                )}
              </div>
              
              {/* Block actions - visible on hover */}
              <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-6 h-6 p-0 bg-white shadow-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteBlock(block.id);
                  }}
                  onDragStart={(e) => e.stopPropagation()}
                  title="Delete block"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          );
        })}
        
        {/* Drop zones for empty positions */}
        {draggedBlock && dropZones.map(({ col, row }) => (
          <div
            key={`drop-${col}-${row}`}
            className={cn(
              "border-2 border-transparent rounded transition-all min-h-12 flex items-center justify-center",
              dragOverPosition?.col === col && dragOverPosition?.row === row 
                ? "border-blue-400 border-dashed bg-blue-50" 
                : "border-gray-200 border-dashed opacity-60"
            )}
            style={{
              gridColumn: `${col} / span 1`,
              gridRow: `${row} / span 1`,
            }}
            onDragOver={(e) => handleDragOver(e, col, row)}
            onDrop={(e) => handleDrop(e, col, row)}
          >
            {dragOverPosition?.col === col && dragOverPosition?.row === row && (
              <div className="text-xs text-blue-600 font-medium">Drop here</div>
            )}
          </div>
        ))}
        
        {/* Also allow dropping on existing blocks to swap positions */}
        {layoutBlocks.map((block: Block) => {
          if (draggedBlock?.id === block.id) return null;
          
          return (
            <div
              key={`overlay-${block.id}`}
              className={cn(
                "absolute pointer-events-none transition-all",
                dragOverPosition?.col === block.position.col && dragOverPosition?.row === block.position.row && draggedBlock
                  ? "border-2 border-yellow-400 border-dashed bg-yellow-50 bg-opacity-75 rounded"
                  : ""
              )}
              style={{
                gridColumn: `${block.position.col} / span ${block.position.colSpan || 1}`,
                gridRow: `${block.position.row} / span ${block.position.rowSpan || 1}`,
                pointerEvents: draggedBlock ? 'auto' : 'none',
              }}
              onDragOver={(e) => draggedBlock && handleDragOver(e, block.position.col, block.position.row)}
              onDrop={(e) => draggedBlock && handleDrop(e, block.position.col, block.position.row)}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex h-full bg-slate-50">
      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-semibold text-gray-900">Layout Builder</h1>
            <div className="flex items-center space-x-2">
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                mode === 'manual' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'bg-emerald-100 text-emerald-700'
              }`}>
                {mode === 'manual' ? 'Manual Mode' : 'AI Mode'}
              </div>
              <div className="bg-gray-100 rounded-lg p-1 flex space-x-1">
                <Button
                  size="sm"
                  variant={mode === 'manual' ? 'default' : 'ghost'}
                  className="h-8"
                  onClick={() => setMode('manual')}
                >
                  <Edit className="w-4 h-4 mr-1" />
                  Manual
                </Button>
                <Button
                  size="sm"
                  variant={mode === 'ai' ? 'default' : 'ghost'}
                  className="h-8"
                  onClick={() => setMode('ai')}
                >
                  <Brain className="w-4 h-4 mr-1" />
                  AI
                </Button>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <Dialog open={showNewLayoutDialog} onOpenChange={setShowNewLayoutDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  New Layout
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Layout</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Layout Name</label>
                    <Input
                      placeholder="Enter layout name..."
                      value={newLayout.name}
                      onChange={(e) => setNewLayout({...newLayout, name: e.target.value})}
                    />
                  </div>
                  <div className="flex space-x-4">
                    <div className="flex-1">
                      <label className="text-sm font-medium">Columns</label>
                      <Select value={newLayout.columns.toString()} onValueChange={(value) => setNewLayout({...newLayout, columns: parseInt(value)})}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[2,3,4,6,8,12].map(cols => (
                            <SelectItem key={cols} value={cols.toString()}>{cols} columns</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1">
                      <label className="text-sm font-medium">Gap (px)</label>
                      <Input
                        type="number"
                        value={newLayout.gap}
                        onChange={(e) => setNewLayout({...newLayout, gap: parseInt(e.target.value)})}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setShowNewLayoutDialog(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateLayout} disabled={createLayoutMutation.isPending}>
                      Create Layout
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex">
          {/* Layout List */}
          <div className="w-80 border-r border-gray-200 bg-white">
            <div className="p-4 border-b">
              <h3 className="font-medium text-gray-900">Layouts</h3>
            </div>
            <ScrollArea className="h-full">
              <div className="p-4 space-y-3">
                {layouts.map((layout: Layout) => (
                  <Card 
                    key={layout.id} 
                    className={cn(
                      "cursor-pointer transition-all group",
                      selectedLayout === layout.id ? "ring-2 ring-blue-500" : "hover:shadow-md"
                    )}
                    onClick={() => setSelectedLayout(layout.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{layout.name}</h4>
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline">
                            {layout.gridConfig.columns} cols
                          </Badge>
                        </div>
                      </div>
                      <div className="text-sm text-gray-600 mb-3">
                        {(blocks as Block[]).filter((b: Block) => b.layoutId === layout.id).length} blocks
                      </div>
                      <div className="grid grid-cols-4 gap-1 bg-gray-100 p-2 rounded">
                        {Array.from({ length: 8 }, (_, i) => {
                          const hasBlock = (blocks as Block[]).some((b: Block) => 
                            b.layoutId === layout.id && 
                            Math.floor((b.position.col - 1) / 3) === Math.floor(i / 4) &&
                            Math.floor((b.position.row - 1) / 2) === (i % 4) / 2
                          );
                          return (
                            <div 
                              key={i} 
                              className={cn(
                                "aspect-square rounded-sm",
                                hasBlock ? "bg-blue-200" : "bg-white"
                              )}
                            />
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                ))}
                
                {layouts.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Grid3X3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="text-sm">No layouts yet</p>
                    <p className="text-xs">Create your first layout</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Layout Editor */}
          <div className="flex-1 p-6">
            {currentLayout ? (
              <div className="h-full flex flex-col">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">{currentLayout.name}</h2>
                    <p className="text-sm text-gray-600">
                      {currentLayout.gridConfig.columns} columns • {(blocks as Block[]).filter((b: Block) => b.layoutId === currentLayout.id).length} blocks
                    </p>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <div className="text-sm text-gray-600">Add blocks:</div>
                    {blockTypes.map(blockType => {
                      const Icon = blockType.icon;
                      return (
                        <Button
                          key={blockType.id}
                          variant="outline"
                          size="sm"
                          onClick={() => handleAddBlock(blockType.id)}
                          className="flex items-center space-x-2"
                        >
                          <Icon className="w-4 h-4" />
                          <span>{blockType.label}</span>
                        </Button>
                      );
                    })}
                  </div>
                </div>
                
                <div className="flex-1 bg-white rounded-lg shadow-sm border p-6">
                  {renderGridPreview(currentLayout)}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <Grid3X3 className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">Select a layout to edit</h3>
                  <p>Choose a layout from the sidebar or create a new one.</p>
                </div>
              </div>
            )}
          </div>

          {/* AI Control Panel */}
          <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
            <div className="h-14 border-b border-gray-200 flex items-center justify-between px-4">
              <h2 className="font-semibold text-gray-900">AI Assistant</h2>
              <div className="flex items-center space-x-2">
                {isSupported && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className={cn("p-2", isRecording && "bg-emerald-100 text-emerald-600")}
                    onClick={toggleRecording}
                  >
                    {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </Button>
                )}
              </div>
            </div>

            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {layoutMessages.length === 0 && (
                  <div className="text-center text-gray-500 text-sm py-8">
                    <p>Try saying:</p>
                    <div className="mt-3 space-y-1 text-xs">
                      <p>"Create a 2-column layout with sidebar"</p>
                      <p>"Add 3 text blocks to the main area"</p>
                      <p>"Arrange blocks in mobile-friendly stack"</p>
                    </div>
                  </div>
                )}
                
                {layoutMessages.map((message) => (
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
                      <p>{message.content}</p>
                      <span className="text-xs opacity-75 mt-1 block">
                        {message.timestamp instanceof Date 
                          ? message.timestamp.toLocaleTimeString()
                          : new Date(message.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {isRecording && (
              <div className="bg-emerald-50 border-t border-emerald-200 p-4">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
                  <span className="text-sm text-emerald-700 font-medium">Listening...</span>
                </div>
              </div>
            )}

            <div className="border-t border-gray-200 p-4">
              <div className="flex space-x-2">
                <Input
                  placeholder="Describe your layout..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  className="flex-1 text-sm"
                />
                <Button onClick={handleSendMessage} disabled={!chatInput.trim()}>
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}