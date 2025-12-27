import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import Incidents from "./pages/Incidents";
import IncidentDetail from "./pages/IncidentDetail";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";
import Reports from "./pages/Reports";
import Playbooks from "./pages/Playbooks";
import Demo from "./pages/Demo";
import Integrations from "./pages/Integrations";
import Compliance from "./pages/Compliance";
import Approvals from "./pages/Approvals";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/incidents" element={<ProtectedRoute><Incidents /></ProtectedRoute>} />
            <Route path="/incidents/:id" element={<ProtectedRoute><IncidentDetail /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute requiredRole="soc_analyst"><Reports /></ProtectedRoute>} />
            <Route path="/playbooks" element={<ProtectedRoute requiredRole="admin"><Playbooks /></ProtectedRoute>} />
            <Route path="/integrations" element={<ProtectedRoute requiredRole="admin"><Integrations /></ProtectedRoute>} />
            <Route path="/approvals" element={<ProtectedRoute requiredRole="soc_analyst"><Approvals /></ProtectedRoute>} />
            <Route path="/compliance" element={<ProtectedRoute requiredRole="admin"><Compliance /></ProtectedRoute>} />
            <Route path="/demo" element={<ProtectedRoute><Demo /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute requiredRole="admin"><Settings /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
