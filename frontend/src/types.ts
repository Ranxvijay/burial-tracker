export interface Tech {
  id: string;
  name: string;
  total_jobs: number;
  active_days: number;
  avg_jobs_per_day: number;
  productivity_score: number;
  first_job: string | null;
  last_job: string | null;
}

export interface Job {
  id: number;
  address: string;
  date: string;
  upload_id: number;
}

export interface TechDetail {
  tech: { id: string; name: string; created_at: string };
  stats: {
    total_jobs: number;
    active_days: number;
    avg_jobs_per_day: number;
    first_job: string;
    last_job: string;
    team_avg: number;
    productivity_score: number;
  };
  dailyJobs: Array<{ date: string; jobs: number }>;
  weeklySummary: Array<{ week: string; jobs: number }>;
  jobs: Job[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  dateRange: { start: string; end: string };
}

export interface DayHeader {
  date: string;
  dayName: string;
  dayNum: number;
  monthName: string;
  fullLabel: string;
  jobs: number;
  isToday: boolean;
  isWeekend: boolean;
}

export interface TechRow {
  rank: number;
  id: string;
  name: string;
  jobs: number;
  activeDays: number;
  avgPerDay: number;
  productivity: number;
}

export interface DashboardJob {
  id: number;
  tech_id: string;
  tech_name: string;
  address: string;
  date: string;
}

export interface DashboardData {
  period: string;
  dateRange: { start: string; end: string };
  dataRange: { start: string; end: string } | null;
  stats: {
    totalJobs: number;
    totalTechs: number;
    avgJobsPerTech: number;
    avgJobsPerDay: number;
    activeDays: number;
    topPerformer: { name: string; tech_id: string; job_count: number } | null;
    bottomPerformer: { name: string; tech_id: string; job_count: number } | null;
    bestDay: { date: string; jobs: number } | null;
  };
  trendData: Array<{ date: string; jobs: number }>;
  dayHeaders: DayHeader[];
  techBreakdown: TechRow[];
  dowDistribution: Array<{ day: string; jobs: number }>;
  comparison: ComparisonStats;
  municipalities: Municipality[];
  jobs: {
    data: DashboardJob[];
    total: number;
    page: number;
    totalPages: number;
  };
  recentUploads: Upload[];
}

export interface Upload {
  id: number;
  filename: string;
  uploaded_at: string;
  job_count: number;
  date_range_start: string;
  date_range_end: string;
}

export interface ColumnMapping {
  techId: string;
  techName: string;
  address: string;
  date: string;
  addressMode: 'single' | 'combined';
  addressStreetNo?: string;
  addressStreetName?: string;
  addressStreetType?: string;
  addressSuffix?: string;
  addressMunicipality?: string;
}

export interface UploadPreview {
  sessionId: string;
  columnMapping: ColumnMapping;
  detectedHeaders: string[];
  totalRows: number;
  validRows: number;
  dateRange: { start: string; end: string };
  preview: Array<{
    techId: string;
    techName: string;
    address: string;
    date: string;
  }>;
}

export interface AIAnalysis {
  summary: string;
  highlights: Array<{ type: 'positive' | 'negative' | 'neutral'; text: string }>;
  topPerformers: Array<{ name: string; techId: string; reason: string }>;
  concerningTechs: Array<{ name: string; techId: string; issue: string }>;
  trends: string;
  recommendations: string[];
}

export interface Municipality {
  city: string;
  jobs: number;
}

export interface ComparisonStats {
  totalJobs: number;
  totalTechs: number;
  avgJobsPerTech: number;
  period: { start: string; end: string };
}

export type Period = 'daily' | 'weekly' | 'monthly' | 'all';
