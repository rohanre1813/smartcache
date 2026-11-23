# 🧠 SmartCache & LLM Router

> An intelligent LLM Gateway with Semantic Caching, Complexity-Based Model Routing, PII Guardrails, and a real-time Observability Dashboard.

---

## 🚀 What It Does

| Feature | Description |
|---|---|
| **Semantic Cache** | Converts prompts to embeddings, finds similar past queries (>90% cosine similarity), serves cached responses in <50ms |
| **Model Router** | Routes simple queries to Gemini Flash, complex reasoning to Gemini Pro |
| **PII Guardrail** | Detects personal data (names, emails, SSNs, etc.) and skips caching for sensitive prompts |
| **Observability** | Real-time dashboard: cache hit rate, latency saved, token cost reduction, model distribution |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **LLM** | Google Gemini 1.5 Flash + Pro (via LangChain) |
| **Embeddings** | Gemini `text-embedding-004` |
| **Vector DB** | ChromaDB (cosine similarity search) |
| **Cache** | Redis (key-value response storage) |
| **PII Detection** | Microsoft Presidio + spaCy |
| **Backend** | FastAPI + Python 3.11 |
| **Frontend** | React + TypeScript + Vite + Tailwind CSS |
| **Charts** | Recharts |

---

## ⚙️ Prerequisites

- Python 3.11+
- Node.js 18+
- Redis running on `localhost:6379`
- Google Gemini API key ([get one here](https://aistudio.google.com/))

---

## 📦 Setup & Run

### 1. Clone & Configure

```bash
cd smartcache-llm-router
```

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Mac/Linux

# Install dependencies
pip install -r requirements.txt

# Download spaCy model for PII detection
python -m spacy download en_core_web_sm

# Configure environment
copy .env.example .env
# Edit .env and add your GEMINI_API_KEY

# Start backend
uvicorn main:app --reload --port 8000
```

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

### 4. Start Redis (if not running)

```bash
# Using Docker
docker run -d -p 6379:6379 redis:7-alpine

# Or install Redis locally: https://redis.io/download
```

### 5. Open Dashboard

Navigate to **http://localhost:5173**

---

## 🐳 Docker (One Command)

```bash
# Add your API key
echo "GEMINI_API_KEY=your_key_here" > .env

# Build and run everything
docker-compose up --build
```

Then open **http://localhost:5173**

---

## 🔌 API Reference

### `POST /api/query`

```json
{
  "prompt": "How do I reset my password?",
  "user_id": "user_123"
}
```

**Response:**
```json
{
  "response": "Go to Settings → Click Forgot Password...",
  "cache_hit": true,
  "cache_type": "semantic",
  "similarity_score": 0.967,
  "model_used": "redis-cache",
  "latency_ms": 42,
  "pii_detected": false,
  "tokens_used": 0
}
```

### `GET /api/stats`

```json
{
  "total_queries": 1500,
  "cache_hits": 1050,
  "cache_misses": 450,
  "cache_hit_rate": 0.70,
  "avg_latency_ms": 312,
  "tokens_saved_estimate": 84000,
  "cost_saved_usd": 0.42,
  "flash_queries": 310,
  "pro_queries": 140
}
```

### `GET /api/recent`

Returns last 20 queries with metadata.

---

## 📊 How It Works

```
User Query
    ↓
[PII Detector] → sensitive? → Skip cache → LLM directly
    ↓ safe
[Embedder] → Generate vector via Gemini text-embedding-004
    ↓
[ChromaDB] → Cosine similarity search
    ↓
Similarity > 0.90?
  YES → [Redis] → Return cached response in ~40ms ⚡
  NO  → [Complexity Router] → Flash or Pro?
            ↓
        [Gemini API] → Generate response
            ↓
        [ChromaDB + Redis] → Store for future cache hits
            ↓
        Return response with full metadata
```

---

## 🗂️ Project Structure

```
smartcache-llm-router/
├── backend/
│   ├── main.py                 # FastAPI app + lifespan
│   ├── config.py               # Settings from .env
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── routes/
│   │   └── query.py            # /api/query + /api/recent + /api/stats
│   └── services/
│       ├── embedder.py         # Gemini text-embedding-004
│       ├── vector_store.py     # ChromaDB similarity search
│       ├── cache.py            # Redis cache layer
│       ├── pii_detector.py     # Presidio PII detection
│       ├── router.py           # Complexity classifier
│       └── llm_client.py       # Gemini Flash + Pro via LangChain
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── Navbar.tsx
│   │   │   ├── HeroSection.tsx
│   │   │   ├── QueryInterface.tsx
│   │   │   ├── MetricsDashboard.tsx
│   │   │   ├── RecentQueries.tsx
│   │   │   └── HowItWorks.tsx
│   │   └── hooks/
│   │       ├── useStats.ts
│   │       └── useQuery.ts
│   └── package.json
├── docker-compose.yml
└── README.md
```

---

## 🎯 Key Design Decisions

| Decision | Reason |
|---|---|
| ChromaDB for vector search | Simple to run locally, no external service needed |
| Redis for response cache | Sub-millisecond retrieval, TTL support |
| Presidio for PII | Production-grade, used by Microsoft — not regex hacks |
| Threshold = 0.90 | Empirically balances hit rate vs answer correctness |
| Two-layer cache | Vector DB finds the match; Redis serves the response |

---

## 📈 Expected Performance

| Metric | Value |
|---|---|
| Cache hit response time | < 50ms |
| Uncached (Gemini Flash) | ~1–2s |
| Uncached (Gemini Pro) | ~3–5s |
| Cache hit rate (after warmup) | 60–75% |
| Estimated cost reduction | ~70–80% |

---

## 🤝 Built With

- [FastAPI](https://fastapi.tiangolo.com/)
- [LangChain](https://www.langchain.com/)
- [Google Gemini API](https://aistudio.google.com/)
- [ChromaDB](https://www.trychroma.com/)
- [Redis](https://redis.io/)
- [Microsoft Presidio](https://microsoft.github.io/presidio/)
- [React](https://react.dev/) + [Vite](https://vitejs.dev/) + [Tailwind CSS](https://tailwindcss.com/)
- [Recharts](https://recharts.org/)
