import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { getAdminToken } from './lib/api';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Users } from './pages/Users';
import { Games } from './pages/Games';
import { Events } from './pages/Events';
import { Leaderboards } from './pages/Leaderboards';
import { Fraud } from './pages/Fraud';
import { Moderation } from './pages/Moderation';
import { Economy } from './pages/Economy';
import { Payments } from './pages/Payments';
import { Analytics } from './pages/Analytics';
import { Experiments } from './pages/Experiments';
import { Features } from './pages/Features';
import { Emergency } from './pages/Emergency';
import { Alerts } from './pages/Alerts';
import { Audit } from './pages/Audit';
import { AICenter } from './pages/AICenter';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = getAdminToken();
  if (!token) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/users" element={<ProtectedRoute><Users /></ProtectedRoute>} />
        <Route path="/games" element={<ProtectedRoute><Games /></ProtectedRoute>} />
        <Route path="/events" element={<ProtectedRoute><Events /></ProtectedRoute>} />
        <Route path="/leaderboards" element={<ProtectedRoute><Leaderboards /></ProtectedRoute>} />
        <Route path="/fraud" element={<ProtectedRoute><Fraud /></ProtectedRoute>} />
        <Route path="/moderation" element={<ProtectedRoute><Moderation /></ProtectedRoute>} />
        <Route path="/economy" element={<ProtectedRoute><Economy /></ProtectedRoute>} />
        <Route path="/payments" element={<ProtectedRoute><Payments /></ProtectedRoute>} />
        <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
        <Route path="/experiments" element={<ProtectedRoute><Experiments /></ProtectedRoute>} />
        <Route path="/features" element={<ProtectedRoute><Features /></ProtectedRoute>} />
        <Route path="/emergency" element={<ProtectedRoute><Emergency /></ProtectedRoute>} />
        <Route path="/alerts" element={<ProtectedRoute><Alerts /></ProtectedRoute>} />
        <Route path="/audit" element={<ProtectedRoute><Audit /></ProtectedRoute>} />
        <Route path="/ai-center" element={<ProtectedRoute><AICenter /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
