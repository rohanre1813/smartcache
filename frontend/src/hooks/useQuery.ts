import { useState, useCallback } from 'react'
import axios from 'axios'
import { QueryRequest, QueryResponse } from '../types'

export function useQuery() {
  const [response, setResponse] = useState<QueryResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = useCallback(async (
    promptText: string,
    options?: { force_model?: string; tenant_id?: string; is_private?: boolean }
  ) => {
    const text = promptText.trim()
    if (!text) return

    setLoading(true)
    setError(null)

    const payload: QueryRequest = {
      prompt: text,
      ...(options?.force_model ? { force_model: options.force_model } : {}),
      ...(options?.tenant_id ? { tenant_id: options.tenant_id } : {}),
      ...(options?.is_private !== undefined ? { is_private: options.is_private } : {}),
    }

    try {
      const { data } = await axios.post<QueryResponse>('/api/query', payload)
      setResponse(data)
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const rawDetail = err.response?.data?.detail
        let serverMsg = err.message
        if (typeof rawDetail === 'string') {
          serverMsg = rawDetail
        } else if (Array.isArray(rawDetail)) {
          serverMsg = rawDetail.map((d: any) => d.msg || JSON.stringify(d)).join(', ')
        } else if (rawDetail && typeof rawDetail === 'object') {
          serverMsg = JSON.stringify(rawDetail)
        }
        setError(serverMsg)
      } else {
        setError('An unexpected error occurred')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const reset = useCallback(() => {
    setResponse(null)
    setError(null)
  }, [])

  return { response, loading, error, submit, reset }
}
