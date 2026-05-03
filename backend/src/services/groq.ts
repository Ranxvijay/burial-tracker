import Groq from 'groq-sdk';
import dotenv from 'dotenv';
dotenv.config();

const groqApiKey = process.env.GROQ_API_KEY?.trim();
const groq = new Groq({ apiKey: groqApiKey });

const MODEL = 'llama-3.1-8b-instant';

export interface TechStats {
  techId: string;
  name: string;
  totalJobs: number;
  avgJobsPerDay: number;
  activeDays: number;
  trend: 'up' | 'down' | 'stable';
}

export interface TeamAnalysisInput {
  period: string;
  totalJobs: number;
  totalTechs: number;
  avgJobsPerTech: number;
  techs: TechStats[];
  topPerformer: TechStats | null;
  bottomPerformer: TechStats | null;
}

export interface AIAnalysisResult {
  summary: string;
  highlights: Array<{ type: 'positive' | 'negative' | 'neutral'; text: string }>;
  topPerformers: Array<{ name: string; techId: string; reason: string }>;
  concerningTechs: Array<{ name: string; techId: string; issue: string }>;
  trends: string;
  recommendations: string[];
}

export async function analyzeTeamPerformance(data: TeamAnalysisInput): Promise<AIAnalysisResult> {
  const prompt = `You are a workforce analytics AI. Analyze this team performance data and respond ONLY with valid JSON.

Period: ${data.period}
Total Jobs Completed: ${data.totalJobs}
Active Technicians: ${data.totalTechs}
Average Jobs per Technician: ${data.avgJobsPerTech.toFixed(1)}

Technician Details:
${data.techs.map(t => `- ${t.name} (ID: ${t.techId}): ${t.totalJobs} jobs, ${t.activeDays} active days, trend: ${t.trend}`).join('\n')}

Respond ONLY with this JSON structure, no other text:
{
  "summary": "2-3 sentence executive summary of team performance",
  "highlights": [
    {"type": "positive", "text": "positive finding"},
    {"type": "negative", "text": "concern"},
    {"type": "neutral", "text": "neutral observation"}
  ],
  "topPerformers": [
    {"name": "Tech Name", "techId": "ID", "reason": "why they stand out"}
  ],
  "concerningTechs": [
    {"name": "Tech Name", "techId": "ID", "issue": "what needs attention"}
  ],
  "trends": "Description of overall trends observed",
  "recommendations": [
    "Specific actionable recommendation 1",
    "Specific actionable recommendation 2",
    "Specific actionable recommendation 3"
  ]
}`;

  const response = await groq.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_tokens: 1500,
  });

  const content = response.choices[0]?.message?.content || '';

  // Extract JSON from response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('AI returned invalid response format');
  }

  return JSON.parse(jsonMatch[0]) as AIAnalysisResult;
}

function localAnalysis(data: TeamAnalysisInput): AIAnalysisResult {
  const sorted = [...data.techs].sort((a, b) => b.totalJobs - a.totalJobs);
  const top = data.topPerformer || sorted[0] || null;
  const bottom = data.bottomPerformer || sorted[sorted.length - 1] || null;
  const avg = data.avgJobsPerTech;
  const strongPerformers = sorted.filter(t => avg > 0 && t.totalJobs >= avg * 1.15).slice(0, 3);
  const concerns = sorted.filter(t => avg > 0 && t.totalJobs <= avg * 0.75).slice(-3);

  const positiveTrendCount = data.techs.filter(t => t.trend === 'up').length;
  const negativeTrendCount = data.techs.filter(t => t.trend === 'down').length;

  return {
    summary: top
      ? `${data.totalJobs} jobs were completed across ${data.totalTechs} technicians. ${top.name} led the group with ${top.totalJobs} jobs, while ${bottom?.name ?? 'the lowest performer'} finished at the bottom of the table. ${positiveTrendCount} technicians are trending up and ${negativeTrendCount} are trending down.`
      : 'Not enough data was available to generate a performance summary.',
    highlights: [
      { type: 'positive', text: `${top?.name ?? 'The team'} was the top performer with ${top?.totalJobs ?? 0} jobs.` },
      { type: 'negative', text: concerns.length > 0 ? `${concerns.length} technicians are running below expected volume for this period.` : 'No major performance concerns were detected.' },
      { type: 'neutral', text: `${positiveTrendCount} technicians are trending upward, ${negativeTrendCount} are trending downward.` },
    ],
    topPerformers: strongPerformers.map(t => ({
      name: t.name,
      techId: t.techId,
      reason: `${t.totalJobs} jobs completed, averaging ${t.avgJobsPerDay.toFixed(1)} per active day.`,
    })),
    concerningTechs: concerns.map(t => ({
      name: t.name,
      techId: t.techId,
      issue: `Only ${t.totalJobs} jobs completed in the selected period, which is below the team norm of ${avg.toFixed(1)}.`,
    })),
    trends: `The team is showing ${positiveTrendCount > negativeTrendCount ? 'more upward than downward' : positiveTrendCount < negativeTrendCount ? 'more downward than upward' : 'a balanced'} momentum across the selected period.`,
    recommendations: [
      `Replicate the workflow of ${top?.name ?? 'the leading technician'} across the rest of the team.`,
      concerns.length > 0 ? 'Review schedules, territory coverage, and dispatch balance for lower-volume technicians.' : 'Keep monitoring activity patterns to maintain the current performance level.',
      'Use weekly check-ins to spot momentum shifts early and prevent productivity drops.',
    ],
  };
}

function localAnswer(question: string, context: string): string {
  const totalJobsMatch = context.match(/Total Jobs:\s*(\d+)/i);
  const totalTechsMatch = context.match(/Total Active Technicians:\s*(\d+)/i);
  const avgMatch = context.match(/Average Jobs per Tech:\s*([\d.]+)/i);
  const topLine = context.match(/-\s*(.+?)\s*\(([^)]+)\):\s*(\d+) jobs over (\d+) active days/i);
  const techLines = [...context.matchAll(/-\s*(.+?)\s*\(([^)]+)\):\s*(\d+) jobs over (\d+) active days \(([\d.]+) avg\/day\)/gi)];

  const totalJobs = totalJobsMatch?.[1] ?? '0';
  const totalTechs = totalTechsMatch?.[1] ?? '0';
  const avgJobs = avgMatch?.[1] ?? '0';
  const topName = topLine?.[1] ?? 'the leading technician';
  const topJobs = topLine?.[3] ?? '0';

  const bestBusy = techLines
    .map(match => ({ name: match[1], jobs: Number(match[3]), days: Number(match[4]) }))
    .sort((a, b) => b.jobs - a.jobs)[0];

  const lowerQuestion = question.toLowerCase();

  if (lowerQuestion.includes('top') || lowerQuestion.includes('best') || lowerQuestion.includes('most')) {
    return `${topName} is currently the top performer with ${topJobs} jobs. Across the selected period, the team completed ${totalJobs} jobs with ${totalTechs} active technicians, averaging ${avgJobs} jobs per technician.`;
  }

  if (lowerQuestion.includes('average') || lowerQuestion.includes('avg')) {
    return `The team average is ${avgJobs} jobs per technician for this period. ${bestBusy ? `${bestBusy.name} is the busiest technician with ${bestBusy.jobs} jobs over ${bestBusy.days} active days.` : ''}`.trim();
  }

  return `Across the selected period, the team completed ${totalJobs} jobs with ${totalTechs} active technicians. ${topName} leads the group with ${topJobs} jobs. ${bestBusy ? `${bestBusy.name} is another standout with ${bestBusy.jobs} jobs.` : ''}`.trim();
}

function shouldFallback(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /invalid api key|401|unauthorized|api key/i.test(message);
}

export async function analyzeTeamPerformanceSafe(data: TeamAnalysisInput): Promise<AIAnalysisResult> {
  try {
    return await analyzeTeamPerformance(data);
  } catch (err) {
    if (shouldFallback(err)) return localAnalysis(data);
    throw err;
  }
}

export async function answerQuery(question: string, context: string): Promise<string> {
  const prompt = `You are a workforce analytics assistant. Answer this question about the technician performance data.

Data Context:
${context}

Question: ${question}

Provide a clear, concise, helpful answer based on the data. Be specific with numbers when possible.`;

  const response = await groq.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.5,
    max_tokens: 500,
  });

  return response.choices[0]?.message?.content || 'Unable to generate a response.';
}

export async function answerQuerySafe(question: string, context: string): Promise<string> {
  try {
    return await answerQuery(question, context);
  } catch (err) {
    if (shouldFallback(err)) return localAnswer(question, context);
    throw err;
  }
}
