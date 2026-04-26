import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { CommandPalette } from "./components/CommandPalette";
import { PageLoadingSkeleton } from "@/components/ui/page-loading-skeleton";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Lazy load all pages
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Incidents = lazy(() => import("./pages/Incidents"));
const IncidentDetail = lazy(() => import("./pages/IncidentDetail"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Settings = lazy(() => import("./pages/Settings"));
const Reports = lazy(() => import("./pages/Reports"));
const Playbooks = lazy(() => import("./pages/Playbooks"));
const Demo = lazy(() => import("./pages/Demo"));
const Integrations = lazy(() => import("./pages/Integrations"));
const Compliance = lazy(() => import("./pages/Compliance"));
const Approvals = lazy(() => import("./pages/Approvals"));
const Auth = lazy(() => import("./pages/Auth"));
const About = lazy(() => import("./pages/About"));
const HowItWorks = lazy(() => import("./pages/HowItWorks"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Trust = lazy(() => import("./pages/Trust"));
const Landing = lazy(() => import("./pages/Landing"));
const DemoLanding = lazy(() => import("./pages/DemoLanding"));
const NotFound = lazy(() => import("./pages/NotFound"));
const MitreCoverage = lazy(() => import("./pages/MitreCoverage"));
const CloudAdmin = lazy(() => import("./pages/CloudAdmin"));
const DataSources = lazy(() => import("./pages/DataSources"));
const LiveLogs = lazy(() => import("./pages/LiveLogs"));
const ThreatHunting = lazy(() => import("./pages/ThreatHunting"));
const ThreatIntel = lazy(() => import("./pages/ThreatIntel"));
const TeamChat = lazy(() => import("./pages/TeamChat"));
const Profile = lazy(() => import("./pages/Profile"));
const WarRoom = lazy(() => import("./pages/WarRoom"));
const AttackSimulator = lazy(() => import("./pages/AttackSimulator"));
const ExecutiveDashboard = lazy(() => import("./pages/ExecutiveDashboard"));
const AgentPlatform = lazy(() => import("./pages/AgentPlatform"));
const SOARActions = lazy(() => import("./pages/SOARActions"));
const AuditLogs = lazy(() => import("./pages/AuditLogs"));
const Resume = lazy(() => import("./pages/Resume"));
const KnowledgeHub = lazy(() => import("./pages/KnowledgeHub"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <CommandPalette />
            <Suspense fallback={<PageLoadingSkeleton />}>
              <Routes>
              {/* Public Routes with PublicLayout */}
              <Route element={<PublicLayout />}>
                <Route path="/" element={<Landing />} />
                <Route path="/about" element={<About />} />
                <Route path="/how-it-works" element={<HowItWorks />} />
                <Route path="/trust" element={<Trust />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/resume" element={<Resume />} />
                <Route path="/knowledge-hub" element={<KnowledgeHub />} />
              </Route>
              
              {/* Demo Landing (standalone - no layout) */}
              <Route path="/demo-landing" element={<DemoLanding />} />
              
              {/* Auth Route (standalone) */}
              <Route path="/auth" element={<Auth />} />
              
              {/* Protected Routes */}
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/incidents" element={<ProtectedRoute><Incidents /></ProtectedRoute>} />
              <Route path="/incidents/:id" element={<ProtectedRoute><IncidentDetail /></ProtectedRoute>} />
              <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
              <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
              <Route path="/playbooks" element={<ProtectedRoute><Playbooks /></ProtectedRoute>} />
              <Route path="/integrations" element={<ProtectedRoute><Integrations /></ProtectedRoute>} />
              <Route path="/approvals" element={<ProtectedRoute><Approvals /></ProtectedRoute>} />
              <Route path="/compliance" element={<ProtectedRoute><Compliance /></ProtectedRoute>} />
              <Route path="/mitre-coverage" element={<ProtectedRoute><MitreCoverage /></ProtectedRoute>} />
              <Route path="/demo" element={<ProtectedRoute><Demo /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="/data-sources" element={<ProtectedRoute><DataSources /></ProtectedRoute>} />
              <Route path="/live-logs" element={<ProtectedRoute><LiveLogs /></ProtectedRoute>} />
              <Route path="/threat-hunting" element={<ProtectedRoute><ThreatHunting /></ProtectedRoute>} />
              <Route path="/threat-intel" element={<ProtectedRoute><ThreatIntel /></ProtectedRoute>} />
              <Route path="/team-chat" element={<ProtectedRoute><TeamChat /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/profile/:userId" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/war-room/:id" element={<ProtectedRoute><WarRoom /></ProtectedRoute>} />
              <Route path="/attack-simulator" element={<ProtectedRoute><AttackSimulator /></ProtectedRoute>} />
              <Route path="/executive" element={<ProtectedRoute><ExecutiveDashboard /></ProtectedRoute>} />
              <Route path="/agent-platform" element={<ProtectedRoute><AgentPlatform /></ProtectedRoute>} />
              <Route path="/soar-actions" element={<ProtectedRoute><SOARActions /></ProtectedRoute>} />
              <Route path="/audit-logs" element={<ProtectedRoute><AuditLogs /></ProtectedRoute>} />
              <Route path="/admin/cloud" element={<ProtectedRoute requiredRole="ciso"><CloudAdmin /></ProtectedRoute>} />
              
              {/* Fallback */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
