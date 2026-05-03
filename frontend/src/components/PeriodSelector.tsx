import { Period } from '../types';

interface PeriodSelectorProps {
  value: Period;
  onChange: (period: Period) => void;
}

const options: { value: Period; label: string }[] = [
  { value: 'daily', label: 'Today' },
  { value: 'weekly', label: 'This Week' },
  { value: 'monthly', label: 'This Month' },
  { value: 'all', label: 'All Time' },
];

export default function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  return (
    <div className="inline-flex rounded-2xl border border-white/10 bg-white/5 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-md">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
            value === opt.value
              ? 'bg-gradient-to-r from-emerald-300 via-cyan-300 to-amber-300 text-slate-950 shadow-[0_10px_24px_rgba(84,224,215,0.18)]'
              : 'text-slate-300 hover:text-slate-50 hover:bg-white/10'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
