import { Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import Upload from './pages/Upload';
import Techs from './pages/Techs';
import TechDetail from './pages/TechDetail';
import AIInsights from './pages/AIInsights';
import History from './pages/History';

export default function App() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden text-slate-900">
      <div className="app-depth" />
      <div className="neon-grid" />
      <Navbar />
      <main className="page-shell relative flex-1 overflow-y-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/techs" element={<Techs />} />
          <Route path="/techs/:id" element={<TechDetail />} />
          <Route path="/ai" element={<AIInsights />} />
          <Route path="/history" element={<History />} />
        </Routes>
      </main>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            borderRadius: 16,
            fontSize: 14,
            background: 'rgba(8,14,26,0.94)',
            color: '#eef3fb',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 18px 45px rgba(0,0,0,0.38)',
            backdropFilter: 'blur(12px)',
          },
          success: { iconTheme: { primary: '#f4c96b', secondary: '#07111f' } },
        }}
      />
    </div>
  );
}
