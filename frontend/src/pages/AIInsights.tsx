import { useState } from 'react';
import {
  Sparkles, TrendingUp, AlertTriangle, CheckCircle, Send,
  Lightbulb, Star, RefreshCw, Info
} from 'lucide-react';
import { api } from '../api';
import { AIAnalysis, Period } from '../types';
import PeriodSelector from '../components/PeriodSelector';
import toast from 'react-hot-toast';

function HighlightIcon({ type }: { type: 'positive' | 'negative' | 'neutral' }) {
  if (type === 'positive') return <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />;
  if (type === 'negative') return <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />;
  return <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />;
}

export default function AIInsights() {
  const [period, setPeriod] = useState<Period>('all');
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [queryAnswer, setQueryAnswer] = useState('');
  const [queryLoading, setQueryLoading] = useState(false);

  async function runAnalysis() {
    setLoading(true);
    setAnalysis(null);
    try {
      const result = await api.analyzeTeam(period);
      setAnalysis(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Analysis failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function runQuery() {
    if (!query.trim()) return;
    setQueryLoading(true);
    setQueryAnswer('');
    try {
      const result = await api.queryAI(query, period);
      setQueryAnswer(result.answer);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Query failed';
      toast.error(msg);
    } finally {
      setQueryLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      {/* Header */}
      <div className="lux-panel p-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-950">AI Insights</h1>
          <p className="text-sm text-slate-500 mt-1">Powered by Groq (free) · LLaMA 3.1 8B</p>
        </div>
        <div className="flex items-center gap-3">
          <PeriodSelector value={period} onChange={setPeriod} />
          <button onClick={runAnalysis} disabled={loading} className="btn-primary">
            {loading ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> Analyzing...</>
            ) : (
              <><Sparkles className="w-4 h-4" /> Analyze Team</>
            )}
          </button>
        </div>
      </div>

      {/* Analysis Results */}
      {!analysis && !loading && (
        <div className="lux-panel p-12 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-brand-50 rounded-full flex items-center justify-center mb-4">
            <Sparkles className="w-8 h-8 text-brand-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-700">Run AI Analysis</h3>
          <p className="text-gray-500 mt-1 max-w-sm">
            Click "Analyze Team" to generate AI-powered insights about your team's performance
          </p>
        </div>
      )}

      {loading && (
        <div className="lux-panel p-12 flex flex-col items-center text-center">
          <RefreshCw className="w-10 h-10 text-brand-400 animate-spin mb-4" />
          <p className="text-gray-600 font-medium">Analyzing team performance...</p>
          <p className="text-gray-400 text-sm mt-1">This may take a few seconds</p>
        </div>
      )}

      {analysis && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="lux-panel p-6">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-cyan-600" />
              <h2 className="font-semibold text-gray-900">Executive Summary</h2>
            </div>
            <p className="text-gray-700 leading-relaxed">{analysis.summary}</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Highlights */}
            <div className="lux-panel p-5">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-gray-600" />
                <h2 className="font-semibold text-gray-900 text-sm">Key Highlights</h2>
              </div>
              <div className="space-y-2.5">
                {analysis.highlights.map((h, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <HighlightIcon type={h.type} />
                    <p className="text-sm text-gray-700">{h.text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Trends */}
            <div className="lux-panel p-5">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-gray-600" />
                <h2 className="font-semibold text-gray-900 text-sm">Trends</h2>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{analysis.trends}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Top Performers */}
            {analysis.topPerformers.length > 0 && (
              <div className="lux-panel p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Star className="w-4 h-4 text-amber-500" />
                  <h2 className="font-semibold text-gray-900 text-sm">Top Performers</h2>
                </div>
                <div className="space-y-3">
                  {analysis.topPerformers.map((p, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                      <div className="w-7 h-7 bg-green-100 rounded-full flex items-center justify-center text-xs font-bold text-green-700 flex-shrink-0">
                        {i + 1}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{p.name}</p>
                        <p className="text-xs text-gray-500 font-mono">{p.techId}</p>
                        <p className="text-xs text-gray-600 mt-0.5">{p.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Concerning Techs */}
            {analysis.concerningTechs.length > 0 && (
              <div className="lux-panel p-5">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <h2 className="font-semibold text-gray-900 text-sm">Needs Attention</h2>
                </div>
                <div className="space-y-3">
                  {analysis.concerningTechs.map((t, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg">
                      <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{t.name}</p>
                        <p className="text-xs text-gray-500 font-mono">{t.techId}</p>
                        <p className="text-xs text-gray-600 mt-0.5">{t.issue}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Recommendations */}
          {analysis.recommendations.length > 0 && (
            <div className="lux-panel p-5">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="w-4 h-4 text-cyan-600" />
                <h2 className="font-semibold text-gray-900 text-sm">Recommendations</h2>
              </div>
              <div className="space-y-2">
                {analysis.recommendations.map((r, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-cyan-100 text-cyan-700 text-xs flex items-center justify-center font-bold flex-shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <p className="text-sm text-gray-700">{r}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Natural Language Query */}
      <div className="lux-panel p-5">
        <div className="flex items-center gap-2 mb-3">
          <Send className="w-4 h-4 text-gray-600" />
          <h2 className="font-semibold text-gray-900 text-sm">Ask a Question</h2>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          Ask anything about your team's performance data
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && runQuery()}
            placeholder="e.g. Who had the most jobs on Monday? Which tech improved the most?"
            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button onClick={runQuery} disabled={queryLoading || !query.trim()} className="btn-primary">
            {queryLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        {queryAnswer && (
          <div className="mt-3 p-4 bg-gray-50 rounded-lg border border-gray-100">
            <div className="flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-cyan-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{queryAnswer}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
