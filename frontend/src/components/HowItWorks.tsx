import React from 'react'
import {
  Inbox, ShieldCheck, Hash, Search, Zap, ChevronRight,
} from 'lucide-react'

interface Step {
  id: string
  number: string
  icon: React.ReactNode
  title: string
  description: string
  color: string
  borderColor: string
}

const STEPS: Step[] = [
  {
    id: 'receive',
    number: '01',
    icon: <Inbox size={22} />,
    title: 'Receive Request',
    description:
      'User prompt arrives at the FastAPI gateway. The request is validated and queued for processing.',
    color: '#3b82f6',
    borderColor: 'rgba(59,130,246,0.3)',
  },
  {
    id: 'pii',
    number: '02',
    icon: <ShieldCheck size={22} />,
    title: 'PII Detection',
    description:
      'Microsoft Presidio scans the prompt for personal identifiable information. PII-flagged requests are blocked and the user is notified.',
    color: '#ef4444',
    borderColor: 'rgba(239,68,68,0.3)',
  },
  {
    id: 'embed',
    number: '03',
    icon: <Hash size={22} />,
    title: 'Embed Prompt',
    description:
      "The clean prompt is embedded into a 768-dimensional vector using Google's text-embedding-004 model for semantic comparison.",
    color: '#f59e0b',
    borderColor: 'rgba(245,158,11,0.3)',
  },
  {
    id: 'search',
    number: '04',
    icon: <Search size={22} />,
    title: 'Vector Search',
    description:
      'ChromaDB performs cosine similarity search against cached embeddings. Similarity ≥ 90% triggers a cache hit.',
    color: '#8b5cf6',
    borderColor: 'rgba(139,92,246,0.3)',
  },
  {
    id: 'respond',
    number: '05',
    icon: <Zap size={22} />,
    title: 'Cache or LLM',
    description:
      'On a hit, the cached answer is served instantly from Redis. On a miss, a complexity router picks Gemini Flash or Pro, calls the LLM, and stores the result.',
    color: '#10b981',
    borderColor: 'rgba(16,185,129,0.3)',
  },
]

const HowItWorks: React.FC = () => {
  return (
    <section id="how-it-works" className="px-6 md:px-10 py-24 max-w-6xl mx-auto w-full">
      {/* Section label */}
      <span className="section-label">// 04. ARCHITECTURE</span>
      <h2 className="mt-3 text-2xl sm:text-3xl font-semibold text-foreground">
        How It Works
      </h2>
      <p className="mt-2 text-sm text-muted-text">
        Every request flows through a five-stage intelligent pipeline.
      </p>

      {/* Flow — horizontal on large, vertical on small */}
      <div className="mt-10 flex flex-col lg:flex-row items-stretch gap-0">
        {STEPS.map((step, idx) => (
          <React.Fragment key={step.id}>
            {/* Step card */}
            <div
              className="flex-1 glass-card p-6 flex flex-col gap-4 group transition-all duration-300"
              style={{
                borderColor: step.borderColor,
                boxShadow: `0 0 20px ${step.borderColor.replace('0.3', '0.08')}`,
              }}
            >
              {/* Number + icon */}
              <div className="flex items-center justify-between">
                <span
                  className="font-mono text-xs font-bold"
                  style={{ color: step.color }}
                >
                  {step.number}
                </span>
                <span style={{ color: step.color }}>{step.icon}</span>
              </div>

              {/* Title */}
              <h3 className="font-semibold text-sm text-foreground">{step.title}</h3>

              {/* Description */}
              <p className="text-xs text-muted-text leading-relaxed flex-1">
                {step.description}
              </p>
            </div>

            {/* Arrow between steps */}
            {idx < STEPS.length - 1 && (
              <div className="hidden lg:flex items-center justify-center px-1 text-muted-text opacity-30">
                <ChevronRight size={20} />
              </div>
            )}
            {idx < STEPS.length - 1 && (
              <div className="flex lg:hidden items-center justify-center py-1 text-muted-text opacity-30">
                <span className="text-lg">↓</span>
              </div>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Tech stack strip */}
      <div
        className="mt-10 glass-card px-6 py-5 flex flex-wrap gap-3 items-center"
        style={{ borderColor: 'rgba(255,255,255,0.08)' }}
      >
        <span className="font-mono text-xs text-muted-text mr-2">Tech stack:</span>
        {[
          { label: 'FastAPI', color: '#10b981' },
          { label: 'Gemini 1.5', color: '#3b82f6' },
          { label: 'ChromaDB', color: '#8b5cf6' },
          { label: 'Redis', color: '#ef4444' },
          { label: 'Presidio', color: '#f59e0b' },
          { label: 'LangChain', color: '#3b82f6' },
          { label: 'React', color: '#06b6d4' },
          { label: 'Tailwind', color: '#38bdf8' },
        ].map((tech) => (
          <span
            key={tech.label}
            className="font-mono text-xs px-2.5 py-1 rounded-lg"
            style={{
              background: `${tech.color}18`,
              border: `1px solid ${tech.color}40`,
              color: tech.color,
            }}
          >
            {tech.label}
          </span>
        ))}
      </div>
    </section>
  )
}

export default HowItWorks
