import { ReactNode, useEffect, useRef, useState } from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  iconBg?: string;
  color?: 'indigo' | 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'slate';
  comparison?: { curr: number; prev: number };
  gradient?: string;
  loading?: boolean;
}

function useAnimatedNumber(target: number): number {
  const [display, setDisplay] = useState(target);
  const prev = useRef(target);

  useEffect(() => {
    const from = prev.current;
    prev.current = target;
    if (from === target) return;

    const dur = 700;
    const start = Date.now();
    const raf = () => {
      const t = Math.min((Date.now() - start) / dur, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (target - from) * ease));
      if (t < 1) requestAnimationFrame(raf);
      else setDisplay(target);
    };
    requestAnimationFrame(raf);
  }, [target]);

  return display;
}

function CompBadge({ curr, prev }: { curr: number; prev: number }) {
  if (!prev || prev === 0) return null;
  const pct = Math.round(((curr - prev) / prev) * 100);
  const isUp = pct > 0;
  const isFlat = pct === 0;

  return (
    <span className={`badge text-xs ${
      isFlat ? 'bg-gray-50 text-gray-500' :
      isUp ? 'bg-emerald-400/10 text-emerald-200 border border-emerald-400/20' :
      'bg-rose-400/10 text-rose-200 border border-rose-400/20'
    }`}>
      {isFlat ? '→' : isUp ? '↑' : '↓'} {Math.abs(pct)}%
    </span>
  );
}

const COLOR_STYLES: Record<NonNullable<StatCardProps['color']>, { bg: string; fg: string }> = {
  indigo: { bg: 'linear-gradient(135deg,#6366f1,#8b5cf6)', fg: '#041018' },
  blue: { bg: 'linear-gradient(135deg,#0ea5e9,#3b82f6)', fg: '#041018' },
  green: { bg: 'linear-gradient(135deg,#10b981,#34d399)', fg: '#041018' },
  amber: { bg: 'linear-gradient(135deg,#f59e0b,#fbbf24)', fg: '#041018' },
  red: { bg: 'linear-gradient(135deg,#ef4444,#f97316)', fg: '#041018' },
  purple: { bg: 'linear-gradient(135deg,#a78bfa,#c084fc)', fg: '#041018' },
  slate: { bg: 'linear-gradient(135deg,#94a3b8,#64748b)', fg: '#041018' },
};

export default function StatCard({
  title, value, subtitle, icon,
  color, comparison, gradient, loading = false,
}: StatCardProps) {
  const numericValue = typeof value === 'number' ? value : parseFloat(String(value));
  const isNumeric = !isNaN(numericValue) && !String(value).includes(' ');
  const animated = useAnimatedNumber(isNumeric ? numericValue : 0);
  const resolvedIconBg = color ? COLOR_STYLES[color] : undefined;

  const displayValue = isNumeric
    ? (numericValue % 1 !== 0 ? numericValue.toFixed(1) : animated.toLocaleString())
    : value;

  if (loading) {
    return (
      <div className="card p-5">
        <div className="skeleton h-4 w-20 mb-3 rounded" />
        <div className="skeleton h-8 w-16 mb-2 rounded" />
        <div className="skeleton h-3 w-24 rounded" />
      </div>
    );
  }

  return (
    <div className={`card card-3d card-holo p-5 relative overflow-hidden transition-all duration-200 slide-up ${gradient || ''}`}>
      {gradient && (
        <div className="absolute inset-0 opacity-5 pointer-events-none" style={{
          background: 'linear-gradient(135deg, currentColor 0%, transparent 100%)'
        }} />
      )}
      <div className="relative">
        <div className="flex items-start justify-between mb-3">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ring-1 ring-white/10 shadow-[0_12px_26px_rgba(0,0,0,0.16)]"
            style={resolvedIconBg ? { background: resolvedIconBg.bg, color: resolvedIconBg.fg } : undefined}
          >
            {icon}
          </div>
          {comparison && <CompBadge curr={comparison.curr} prev={comparison.prev} />}
        </div>
        <p className="text-2xl font-bold text-slate-50 tracking-tight num-anim">
          {displayValue}
        </p>
        <p className="text-sm text-slate-300 mt-0.5 font-medium">{title}</p>
        {subtitle && <p className="text-xs text-slate-400 mt-1 truncate">{subtitle}</p>}
      </div>
    </div>
  );
}
