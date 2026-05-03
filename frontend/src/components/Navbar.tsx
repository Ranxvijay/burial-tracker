import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Upload, Users, Sparkles,
  Clock, Activity, Zap,
} from 'lucide-react';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/upload', label: 'Upload Data', icon: Upload },
  { to: '/techs', label: 'Technicians', icon: Users },
  { to: '/ai', label: 'AI Insights', icon: Sparkles },
  { to: '/history', label: 'Upload History', icon: Clock },
];

interface NavbarProps {
  isLive?: boolean;
}

export default function Navbar({ isLive = false }: NavbarProps) {
  return (
    <header className="lux-nav sticky top-0 z-20 text-slate-900 relative">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-emerald-300 via-cyan-400 to-amber-300 shadow-[0_18px_40px_rgba(84,224,215,0.24)] ring-1 ring-white/10">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-slate-400">Burial Tracker</p>
            <p className="text-sm font-extrabold tracking-tight text-slate-50">Operations Studio</p>
          </div>
        </div>

        <nav className="flex flex-1 items-center gap-1 overflow-x-auto rounded-[1.15rem] border border-white/10 bg-white/5 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-emerald-300/90 via-cyan-300/90 to-amber-300/90 text-slate-950 shadow-[0_12px_28px_rgba(6,182,212,0.22)] ring-1 ring-cyan-200/70'
                    : 'text-slate-300 hover:bg-white/10 hover:text-slate-50 hover:shadow-sm'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-cyan-600' : ''}`} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <div className={`glass-chip flex items-center gap-2 px-3 py-2 text-xs font-semibold ${
            isLive ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' : 'border-white/10 bg-white/5 text-slate-300'
          }`}>
            <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-500 live-dot' : 'bg-slate-400'}`} />
            {isLive ? 'Live' : 'Connecting...'}
            {isLive && <Zap className="w-3 h-3 text-emerald-500" />}
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 shadow-[0_10px_24px_rgba(0,0,0,0.25)] backdrop-blur-md">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-100 to-slate-400 flex items-center justify-center ring-1 ring-white/15">
              <span className="text-xs text-slate-900 font-black">B</span>
            </div>
            <div className="hidden sm:block">
              <p className="text-xs font-semibold text-slate-50">Premium Mode</p>
              <p className="text-[11px] text-slate-300">Command view</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
