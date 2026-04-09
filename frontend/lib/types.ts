export interface User {
  id: string;
  email: string;
  leetcode_username: string | null;
  github_repo: string | null;
  active_roadmap: string | null;
  target_companies: string[] | null;
  last_synced_at: string | null;
  lc_session_expires_at: string | null;
  streak_current: number;
  streak_longest: number;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface Problem {
  id: string;
  frontend_id: number;
  title: string;
  difficulty: "easy" | "medium" | "hard";
  topic_tags: string[];
  company_tags: string[];
  acceptance_rate: number;
  is_premium: boolean;
  neetcode150: boolean;
  blind75: boolean;
  grind169: boolean;
}

export interface Submission {
  id: number;
  problem_id: string;
  status: string;
  language: string;
  runtime_ms: number | null;
  memory_mb: number | null;
  submitted_at: string;
  attempt_number: number;
  struggle_label: string | null;
  committed_to_github: boolean;
  commit_sha: string | null;
  problem?: Problem;
}

export interface MasteryScore {
  pattern: string;
  score: number;
  first_attempt_rate: number;
  avg_attempts: number;
  problems_attempted: number;
  last_practiced_at: string | null;
  srs_retention_rate: number;
}

export interface SRSItem {
  id: string;
  problem_id: string;
  due_at: string;
  interval_days: number;
  ease_factor: number;
  repetitions: number;
  last_result: string | null;
  problem: Problem;
}

export interface Recommendation {
  problem: Problem;
  score: number;
  why: string;
  mode: string;
}

export interface SyncStatus {
  state: "PENDING" | "STARTED" | "SUCCESS" | "FAILURE";
  result?: { synced: number; new_problems: number };
  error?: string;
}

export interface AnalyticsOverview {
  streak_current: number;
  streak_longest: number;
  solved_easy: number;
  solved_medium: number;
  solved_hard: number;
  total_solved: number;
  bottom_patterns: MasteryScore[];
  srs_due_today: number;
}
