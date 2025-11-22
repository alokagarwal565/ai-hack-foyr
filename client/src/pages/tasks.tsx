import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useWebSocketContext } from '@/hooks/websocket-provider';
import { useVoiceInput } from '@/hooks/use-voice-input';
import { apiRequest } from '@/lib/queryClient';
import { cn } from "@/lib/utils";
import { 
  Plus, 
  CheckSquare, 
  Square, 
  Clock, 
  AlertTriangle, 
  Mic, 
  MicOff, 
  Send,
  Filter,
  Brain,
  Edit,
  RotateCcw
} from "lucide-react";

interface Task {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  category?: string;
  dueDate?: Date;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const priorityColors = {
  low: 'bg-blue-100 text-blue-700',
  medium: 'bg-yellow-100 text-yellow-700', 
  high: 'bg-red-100 text-red-700'
};

export default function TasksPage() {
  const [mode, setMode] = useState<'manual' | 'ai'>('manual');
  const [newTask, setNewTask] = useState({ title: '', description: '', priority: 'medium' as const, category: '' });
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [chatInput, setChatInput] = useState('');
  const [showNewTaskDialog, setShowNewTaskDialog] = useState(false);
  
  const queryClient = useQueryClient();
  const { connected, messages: wsMessages, sendChatMessage, sendVoiceData } = useWebSocketContext();
  const { isRecording, isSupported, toggleRecording, setOnVoiceData } = useVoiceInput();

  useEffect(() => {
    setOnVoiceData((audioData: string) => sendVoiceData(audioData, 'tasks'));
  }, [sendVoiceData, setOnVoiceData]);

  const { data: tasks = [], refetch } = useQuery<Task[]>({
    queryKey: ['/api/tasks'],
    refetchInterval: 2000,
  });

  // Load task-specific messages from REST API
  const { data: apiMessages = [] } = useQuery({
    queryKey: ['/api/chat-messages', { appType: 'tasks' }],
    queryFn: async () => {
      const response = await fetch('/api/chat-messages?appType=tasks');
      return response.json();
    },
  });

  // Merge API messages with WebSocket messages (deduplicate by ID)
  const taskMessages = React.useMemo(() => {
    const messageMap = new Map();
    // Add API messages first
    apiMessages.forEach((msg: any) => messageMap.set(msg.id, msg));
    // Add/update with WebSocket messages (filter by appType)
    wsMessages.filter((msg: any) => msg.appType === 'tasks')
      .forEach((msg: any) => messageMap.set(msg.id, msg));
    return Array.from(messageMap.values()).sort((a: any, b: any) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }, [apiMessages, wsMessages]);

  const createTaskMutation = useMutation({
    mutationFn: (task: any) => apiRequest('POST', '/api/tasks', task),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      setNewTask({ title: '', description: '', priority: 'medium', category: '' });
      setShowNewTaskDialog(false);
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, ...task }: any) => apiRequest('PATCH', `/api/tasks/${id}`, task),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/tasks/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
    },
  });

  const handleCreateTask = () => {
    if (newTask.title.trim()) {
      createTaskMutation.mutate(newTask);
    }
  };

  const handleToggleTask = (task: Task) => {
    updateTaskMutation.mutate({ id: task.id, completed: !task.completed });
  };

  const handleSendMessage = () => {
    if (chatInput.trim()) {
      sendChatMessage(chatInput.trim(), 'tasks');
      setChatInput('');
    }
  };

  const handleClearChat = async () => {
    try {
      await fetch('/api/chat-messages?appType=tasks', { method: 'DELETE' });
      queryClient.invalidateQueries({ queryKey: ['/api/chat-messages', { appType: 'tasks' }] });
    } catch (error) {
      console.error('Failed to clear chat:', error);
    }
  };

  const filteredTasks = tasks.filter((task: Task) => {
    if (filter === 'active') return !task.completed;
    if (filter === 'completed') return task.completed;
    return true;
  });

  const taskStats = {
    total: tasks.length,
    completed: tasks.filter((t: Task) => t.completed).length,
    active: tasks.filter((t: Task) => !t.completed).length,
    highPriority: tasks.filter((t: Task) => t.priority === 'high' && !t.completed).length,
  };

  return (
    <div className="flex h-full bg-slate-50">
      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-semibold text-gray-900">Task Management</h1>
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
            {/* Stats */}
            <div className="flex items-center space-x-4 text-sm">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span>{taskStats.total} total</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span>{taskStats.completed} done</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span>{taskStats.highPriority} urgent</span>
              </div>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex">
          {/* Tasks List */}
          <div className="flex-1 p-6">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Select value={filter} onValueChange={setFilter as any}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tasks</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <Dialog open={showNewTaskDialog} onOpenChange={setShowNewTaskDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    New Task
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Task</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Title</label>
                      <Input
                        placeholder="Enter task title..."
                        value={newTask.title}
                        onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Description</label>
                      <Textarea
                        placeholder="Task description (optional)..."
                        value={newTask.description}
                        onChange={(e) => setNewTask({...newTask, description: e.target.value})}
                      />
                    </div>
                    <div className="flex space-x-4">
                      <div className="flex-1">
                        <label className="text-sm font-medium">Priority</label>
                        <Select value={newTask.priority} onValueChange={(value: any) => setNewTask({...newTask, priority: value})}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex-1">
                        <label className="text-sm font-medium">Category</label>
                        <Input
                          placeholder="Category (optional)"
                          value={newTask.category}
                          onChange={(e) => setNewTask({...newTask, category: e.target.value})}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end space-x-2">
                      <Button variant="outline" onClick={() => setShowNewTaskDialog(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleCreateTask} disabled={createTaskMutation.isPending}>
                        Create Task
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Task List */}
            <ScrollArea className="h-full">
              <div className="space-y-3">
                {filteredTasks.map((task: Task) => (
                  <Card key={task.id} className={cn("transition-all", task.completed && "opacity-60")}>
                    <CardContent className="p-4">
                      <div className="flex items-start space-x-3">
                        <Checkbox
                          checked={task.completed}
                          onCheckedChange={() => handleToggleTask(task)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h3 className={cn("font-medium", task.completed && "line-through text-gray-500")}>
                              {task.title}
                            </h3>
                            <div className="flex items-center space-x-2">
                              <Badge className={priorityColors[task.priority]}>
                                {task.priority}
                              </Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteTaskMutation.mutate(task.id)}
                              >
                                Delete
                              </Button>
                            </div>
                          </div>
                          {task.description && (
                            <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                          )}
                          <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                            {task.category && (
                              <span className="bg-gray-100 px-2 py-1 rounded">{task.category}</span>
                            )}
                            <span>Created {new Date(task.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                
                {filteredTasks.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    <CheckSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-medium mb-2">No tasks found</h3>
                    <p>Create your first task or try a different filter.</p>
                  </div>
                )}
              </div>
            </ScrollArea>
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
                <Button
                  size="sm"
                  variant="ghost"
                  className="p-2"
                  onClick={handleClearChat}
                  title="Clear Chat"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {taskMessages.length === 0 && (
                  <div className="text-center text-gray-500 text-sm py-8">
                    <p>Try saying:</p>
                    <div className="mt-3 space-y-1 text-xs">
                      <p>"Add a high priority task to review designs"</p>
                      <p>"Mark all today's tasks as done"</p>
                      <p>"Show me urgent tasks"</p>
                    </div>
                  </div>
                )}
                
                {taskMessages.map((message) => (
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
                        {new Date(message.timestamp).toLocaleTimeString()}
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
                  placeholder="Type your command..."
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