import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MainNavigation } from "@/components/navigation/main-nav";
import CanvasPage from "@/pages/canvas";
import TasksPage from "@/pages/tasks";
import LayoutPage from "@/pages/layout";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <div className="flex h-screen bg-slate-50">
      <MainNavigation />
      <div className="flex-1">
        <Switch>
          <Route path="/" component={CanvasPage} />
          <Route path="/tasks" component={TasksPage} />
          <Route path="/layout" component={LayoutPage} />
          <Route component={NotFound} />
        </Switch>
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
