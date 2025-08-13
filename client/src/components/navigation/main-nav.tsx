import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { 
  Palette, 
  CheckSquare, 
  Grid3X3,
  Brain,
  Sparkles
} from "lucide-react";

const navigationItems = [
  {
    id: 'canvas',
    label: 'Smart Canvas',
    path: '/',
    icon: Palette,
    description: 'AI-powered drawing with shape tools'
  },
  {
    id: 'tasks', 
    label: 'Task Manager',
    path: '/tasks',
    icon: CheckSquare,
    description: 'Intelligent task management system'
  },
  {
    id: 'layout',
    label: 'Layout Builder',
    path: '/layout',
    icon: Grid3X3,
    description: 'Dynamic grid and block layouts'
  }
];

export function MainNavigation() {
  const [location] = useLocation();

  const getActiveApp = () => {
    if (location === '/tasks') return 'tasks';
    if (location === '/layout') return 'layout';
    return 'canvas';
  };

  const activeApp = getActiveApp();

  return (
    <div className="w-64 bg-gradient-to-br from-slate-900 to-slate-800 text-white flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-slate-700">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold">AI Studio</h1>
            <p className="text-sm text-slate-400">Multi-mode AI Apps</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <div className="space-y-2">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeApp === item.id;
            
            return (
              <Link key={item.id} href={item.path}>
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-start p-4 h-auto flex-col items-start space-y-2 text-left",
                    isActive 
                      ? "bg-white/10 text-white border border-white/20" 
                      : "text-slate-300 hover:text-white hover:bg-white/5"
                  )}
                >
                  <div className="flex items-center space-x-3 w-full">
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </div>
                  <p className="text-xs opacity-75 leading-relaxed">
                    {item.description}
                  </p>
                </Button>
              </Link>
            );
          })}
        </div>

        {/* AI Features Section */}
        <div className="mt-8 p-4 bg-gradient-to-r from-emerald-600/20 to-blue-600/20 rounded-lg border border-emerald-500/20">
          <div className="flex items-center space-x-2 mb-3">
            <Brain className="w-5 h-5 text-emerald-400" />
            <span className="font-medium text-emerald-100">AI Features</span>
          </div>
          <div className="space-y-2 text-sm text-slate-300">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
              <span>Voice Commands</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
              <span>Natural Language</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
              <span>Smart Automation</span>
            </div>
          </div>
        </div>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-700">
        <div className="text-xs text-slate-400 space-y-1">
          <div className="flex items-center justify-between">
            <span>Groq GPT-OSS 120B</span>
            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
          </div>
          <div className="flex items-center justify-between">
            <span>Whisper v3 Turbo</span>
            <span className="text-emerald-400">216x RT</span>
          </div>
        </div>
      </div>
    </div>
  );
}