import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { SubdomainRedirect } from "./components/SubdomainRedirect";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import NewAnalysis from "./pages/NewAnalysis";
import AnalysisDetails from "./pages/AnalysisDetails";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";
import AdminTools from "./pages/AdminTools";
import Settings from "./pages/Settings";
import AdminSupport from "./pages/AdminSupport";
import SupportWidget from "./components/SupportWidget";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <SupportWidget />
        <BrowserRouter>
          <SubdomainRedirect />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/new" element={
              <ProtectedRoute>
                <NewAnalysis />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/analysis/:id" element={
              <ProtectedRoute>
                <AnalysisDetails />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/settings" element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            } />
            <Route path="/admin" element={
              <ProtectedRoute>
                <Admin />
              </ProtectedRoute>
            } />
            <Route path="/admin/support" element={
              <ProtectedRoute>
                <AdminSupport />
              </ProtectedRoute>
            } />
            <Route path="/admin-tools" element={<AdminTools />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
