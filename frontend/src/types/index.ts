// ── Request / Response types ──────────────────────────────────────────────

export interface QueryRequest {
  prompt: string;
  force_model?: string;
  tenant_id?: string;
  is_private?: boolean;
}

export interface QueryResponse {
  answer: string;
  response?: string;
  cache_hit: boolean;
  cached?: boolean;
  model_used: 'gemini-flash' | 'gemini-pro' | 'redis-cache' | string;
  latency_ms: number;
  similarity_score?: number;
  pii_detected: boolean;
  tokens_used?: number;
  cache_type?: 'exact' | 'semantic' | string | null;
  guardrail_status?: string | null;
  is_temporal?: boolean;
  tenant_id?: string;
  error?: string;
}

// ── Stats ─────────────────────────────────────────────────────────────────

export interface ModelDistribution {
  flash: number;
  pro: number;
  cache: number;
}

export interface StatsData {
  total_queries: number;
  cache_hits: number;
  cache_misses: number;
  cache_hit_rate: number;        // 0–100 percentage
  avg_latency_ms: number;
  avg_cached_latency_ms: number;
  avg_uncached_latency_ms: number;
  total_tokens_saved: number;
  estimated_cost_savings_usd: number;
  model_distribution: ModelDistribution;
  pii_blocked: number;
}

// ── Recent queries ─────────────────────────────────────────────────────────

export interface RecentQuery {
  id: string;
  prompt: string;
  answer: string;
  cache_hit: boolean;
  model_used: 'gemini-flash' | 'gemini-pro' | 'redis-cache' | string;
  latency_ms: number;
  similarity_score?: number;
  pii_detected: boolean;
  timestamp: string;            // ISO-8601
  guardrail_status?: string | null;
}

// ── Chat Session & Message types (Full-Stack Workspace) ────────────────────

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  cache_hit?: boolean;
  cache_type?: string | null;
  model_used?: string;
  latency_ms?: number;
  similarity_score?: number;
  pii_detected?: boolean;
  guardrail_status?: string | null;
  is_temporal?: boolean;
  tenant_id?: string;
  tokens_used?: number;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  tenantId: string;
  messages: ChatMessage[];
}
