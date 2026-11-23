import React, { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import { Copy, Check, Terminal } from 'lucide-react'

interface StreamingMarkdownProps {
  content: string
  animate?: boolean
  speedMs?: number
  onComplete?: () => void
}

export const StreamingMarkdown: React.FC<StreamingMarkdownProps> = ({
  content,
  animate = true,
  speedMs = 18,
  onComplete,
}) => {
  const [displayedText, setDisplayedText] = useState(animate ? '' : content)
  const [isTyping, setIsTyping] = useState(animate)
  const timerRef = useRef<any>(null)
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null)

  useEffect(() => {
    if (!animate) {
      setDisplayedText(content)
      setIsTyping(false)
      return
    }

    if (!content) {
      setDisplayedText('')
      setIsTyping(false)
      return
    }

    // Split by words/whitespace to stream word-by-word
    const words = content.split(/(\s+)/)
    let currentIdx = 0
    let accumulated = ''
    setIsTyping(true)

    if (timerRef.current) clearInterval(timerRef.current)

    timerRef.current = setInterval(() => {
      if (currentIdx < words.length) {
        accumulated += words[currentIdx]
        setDisplayedText(accumulated)
        currentIdx++
      } else {
        if (timerRef.current) clearInterval(timerRef.current)
        setIsTyping(false)
        if (onComplete) onComplete()
      }
    }, speedMs)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [content, animate, speedMs])

  const copyCode = (codeText: string, id: string) => {
    navigator.clipboard.writeText(codeText)
    setCopiedCodeId(id)
    setTimeout(() => setCopiedCodeId(null), 2000)
  }

  return (
    <div className="relative text-slate-100 font-sans text-sm sm:text-base leading-relaxed break-words space-y-3">
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h1 className="text-xl sm:text-2xl font-bold text-white mt-4 mb-2 pb-1 border-b border-white/10 tracking-tight flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg sm:text-xl font-semibold text-blue-300 mt-3 mb-2 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block" />
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base sm:text-lg font-semibold text-slate-200 mt-2 mb-1">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="my-2 text-slate-200 leading-relaxed font-sans">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="my-2 space-y-1.5 list-none pl-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-2 space-y-1.5 list-decimal pl-5 text-slate-200">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="flex items-start gap-2 text-slate-300">
              <span className="text-blue-400 font-bold mt-1 text-xs select-none">▸</span>
              <span className="flex-1">{children}</span>
            </li>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-blue-200 bg-blue-500/10 px-1 py-0.5 rounded border border-blue-500/20">
              {children}
            </strong>
          ),
          em: ({ children }) => (
            <em className="text-cyan-300 not-italic font-medium">{children}</em>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-blue-500/60 pl-3 my-2 text-slate-400 italic bg-blue-500/[0.03] py-1 rounded-r-lg">
              {children}
            </blockquote>
          ),
          code: ({ className, children, ...props }: any) => {
            const match = /language-(\w+)/.exec(className || '')
            const isInline = !match && !String(children).includes('\n')
            const codeString = String(children).replace(/\n$/, '')
            const codeId = `code_${Math.random().toString(36).substring(2, 7)}`

            if (isInline) {
              return (
                <code
                  className="px-1.5 py-0.5 mx-0.5 font-mono text-xs rounded-md bg-white/10 text-cyan-300 border border-white/10"
                  {...props}
                >
                  {children}
                </code>
              )
            }

            return (
              <div className="my-3 rounded-xl overflow-hidden border border-white/10 bg-[#070b14] shadow-lg">
                <div className="flex items-center justify-between px-3.5 py-1.5 bg-[#0b1120] border-b border-white/5 font-mono text-xs text-slate-400">
                  <div className="flex items-center gap-2">
                    <Terminal size={12} className="text-blue-400" />
                    <span className="uppercase text-[10px] tracking-wider font-semibold text-slate-400">
                      {match ? match[1] : 'code'}
                    </span>
                  </div>
                  <button
                    onClick={() => copyCode(codeString, codeId)}
                    className="flex items-center gap-1 text-[11px] hover:text-white transition px-2 py-0.5 rounded hover:bg-white/5"
                  >
                    {copiedCodeId === codeId ? (
                      <>
                        <Check size={12} className="text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-3.5 text-xs sm:text-sm font-mono text-slate-200 overflow-x-auto leading-relaxed">
                  <code>{children}</code>
                </pre>
              </div>
            )
          },
        }}
      >
        {displayedText}
      </ReactMarkdown>

      {/* Blinking Cursor during live streaming */}
      {isTyping && (
        <span className="inline-block w-2 h-4 ml-1 bg-blue-400 animate-pulse rounded-sm align-middle shadow-[0_0_8px_#3b82f6]" />
      )}
    </div>
  )
}
export default StreamingMarkdown
