'use client'

import { useState, useRef, useEffect, FormEvent } from 'react'
import { MessageCircle, Send, RotateCcw } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useStore } from '@/lib/store'

const SUGGESTED_QUESTIONS = [
  'Can I afford to hire a new teacher?',
  'How is our cash position?',
  'Are we at risk of ending the year in deficit?',
  'How is our Title I spending tracking?',
  'What are our biggest budget risks right now?',
  'Should I be concerned about any grants?',
]

export default function AskCFOPage() {
  const { chatMessages, addChatMessage, updateChatMessage, clearChat, schoolProfile, financialData, grants, alerts, otherGrants } =
    useStore()

  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const send = async (message: string) => {
    if (!message.trim() || loading) return
    setInput('')
    setLoading(true)

    const userMsg = { id: crypto.randomUUID(), role: 'user' as const, content: message }
    addChatMessage(userMsg)

    const assistantId = crypto.randomUUID()
    addChatMessage({ id: assistantId, role: 'assistant', content: '' })

    const apiMessages = [...chatMessages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }))

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          schoolProfile,
          financialData,
          grants,
          alerts,
          otherGrants,
        }),
      })

      if (!res.ok || !res.body) {
        updateChatMessage(
          assistantId,
          'Sorry, something went wrong. Make sure your ANTHROPIC_API_KEY environment variable is set.'
        )
        setLoading(false)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        updateChatMessage(assistantId, accumulated)
      }
    } catch {
      updateChatMessage(
        assistantId,
        'Connection error. Please check your network and try again.'
      )
    }

    setLoading(false)
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    send(input)
  }

  return (
    <div className="max-w-3xl flex flex-col" style={{ height: 'calc(100vh - 64px)' }}>
      {/* Header */}
      <div className="flex items-start justify-between mb-6 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ask Your CFO</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Ask questions about your school&apos;s finances in plain English
          </p>
        </div>
        {chatMessages.length > 0 && (
          <button
            onClick={clearChat}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors mt-1"
          >
            <RotateCcw size={13} />
            Clear
          </button>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {chatMessages.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full pb-8">
            <div className="w-14 h-14 rounded-full bg-[#1e3a5f]/10 flex items-center justify-center mb-4">
              <MessageCircle size={26} className="text-[#1e3a5f]" />
            </div>
            <h2 className="text-lg font-semibold text-gray-800 mb-1">
              What would you like to know?
            </h2>
            <p className="text-sm text-gray-400 mb-7 text-center max-w-sm">
              Ask anything about {schoolProfile.name}&apos;s finances — I&apos;ll answer in plain English.
            </p>

            {/* Suggested questions */}
            <div className="grid grid-cols-2 gap-2.5 w-full max-w-xl">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="text-left px-4 py-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:border-[#1e3a5f] hover:text-[#1e3a5f] transition-colors leading-snug"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Message thread */
          <div className="space-y-5 pb-4">
            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-full bg-[#1e3a5f] flex items-center justify-center shrink-0 mr-2.5 mt-0.5">
                    <MessageCircle size={13} className="text-white" />
                  </div>
                )}
                <div
                  className={`rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'max-w-[85%] px-4 py-3 bg-[#1e3a5f] text-white rounded-br-sm'
                      : 'w-full px-5 py-4 bg-white border border-gray-200 text-gray-800 rounded-bl-sm'
                  }`}
                >
                  {msg.content === '' && msg.role === 'assistant' ? (
                    <span className="flex gap-1 items-center text-gray-400 py-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce [animation-delay:0ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce [animation-delay:300ms]" />
                    </span>
                  ) : msg.role === 'assistant' ? (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        h1: ({ children }) => (
                          <h1 className="text-base font-bold text-gray-900 mt-5 mb-2 first:mt-0">{children}</h1>
                        ),
                        h2: ({ children }) => (
                          <h2 className="text-sm font-bold text-gray-900 mt-5 mb-2 first:mt-0 pt-4 border-t border-gray-100">{children}</h2>
                        ),
                        h3: ({ children }) => (
                          <h3 className="text-sm font-semibold text-gray-800 mt-4 mb-1.5 first:mt-0">{children}</h3>
                        ),
                        p: ({ children }) => (
                          <p className="text-sm text-gray-800 mb-3 last:mb-0 leading-relaxed">{children}</p>
                        ),
                        ul: ({ children }) => (
                          <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>
                        ),
                        ol: ({ children }) => (
                          <ol className="list-decimal pl-5 mb-3 space-y-1.5">{children}</ol>
                        ),
                        li: ({ children }) => (
                          <li className="text-sm text-gray-800 leading-relaxed">{children}</li>
                        ),
                        strong: ({ children }) => (
                          <strong className="font-semibold text-gray-900">{children}</strong>
                        ),
                        em: ({ children }) => (
                          <em className="italic text-gray-700">{children}</em>
                        ),
                        hr: () => <hr className="border-gray-200 my-4" />,
                        blockquote: ({ children }) => (
                          <blockquote className="border-l-4 border-[#1e3a5f]/30 pl-4 my-3 text-gray-600 italic">
                            {children}
                          </blockquote>
                        ),
                        table: ({ children }) => (
                          <div className="overflow-x-auto my-3">
                            <table className="w-full text-sm border-collapse">{children}</table>
                          </div>
                        ),
                        thead: ({ children }) => (
                          <thead className="bg-gray-50">{children}</thead>
                        ),
                        th: ({ children }) => (
                          <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 py-2 border-b border-gray-200">
                            {children}
                          </th>
                        ),
                        td: ({ children }) => (
                          <td className="px-3 py-2 border-b border-gray-100 text-gray-800">{children}</td>
                        ),
                        code: ({ children }) => (
                          <code className="bg-gray-100 text-gray-800 rounded px-1.5 py-0.5 text-xs font-mono">
                            {children}
                          </code>
                        ),
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="shrink-0 pt-4 border-t border-gray-200 mt-2">
        <form onSubmit={onSubmit} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question about your finances…"
            disabled={loading}
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30 focus:border-[#1e3a5f] disabled:opacity-50 bg-white"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="px-4 py-2.5 bg-[#1e3a5f] text-white rounded-lg hover:bg-[#162d4a] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={16} />
          </button>
        </form>
        <p className="text-xs text-gray-400 mt-2 text-center">
          Powered by Claude · Answers are based on {schoolProfile.name}&apos;s uploaded financial data
        </p>
      </div>
    </div>
  )
}
