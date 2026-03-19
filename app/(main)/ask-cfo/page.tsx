'use client'

import { useState, useRef, useEffect, FormEvent, DragEvent } from 'react'
import { MessageCircle, Send, RotateCcw, Paperclip, FileText, FileSpreadsheet, FileImage, X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useStore } from '@/lib/store'

const SUGGESTED_QUESTIONS = [
  'Can I afford to hire a new teacher?',
  'How is our cash position?',
  'Are we at risk of ending the year in deficit?',
  'Analyze this vendor proposal',
  'What are our biggest budget risks right now?',
  'Review this contract for budget impact',
]

const ACCEPTED_EXTENSIONS = ['pdf', 'docx', 'xlsx', 'jpg', 'jpeg', 'png']
const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10 MB

const EXT_ICON: Record<string, React.ReactNode> = {
  pdf: <FileText size={14} />,
  docx: <FileText size={14} />,
  xlsx: <FileSpreadsheet size={14} />,
  jpg: <FileImage size={14} />,
  jpeg: <FileImage size={14} />,
  png: <FileImage size={14} />,
}

const EXT_COLOR: Record<string, string> = {
  pdf: 'text-red-600 bg-red-50 border-red-200',
  docx: 'text-blue-600 bg-blue-50 border-blue-200',
  xlsx: 'text-green-600 bg-green-50 border-green-200',
  jpg: 'text-purple-600 bg-purple-50 border-purple-200',
  jpeg: 'text-purple-600 bg-purple-50 border-purple-200',
  png: 'text-purple-600 bg-purple-50 border-purple-200',
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'document'; source: { type: 'base64'; media_type: 'application/pdf'; data: string } }
  | { type: 'image'; source: { type: 'base64'; media_type: 'image/jpeg' | 'image/png'; data: string } }

async function buildApiContent(file: File, userText: string): Promise<string | ContentBlock[]> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''

  if (ext === 'pdf') {
    const data = await toBase64(file)
    const blocks: ContentBlock[] = [
      { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } },
    ]
    if (userText.trim()) blocks.push({ type: 'text', text: userText })
    return blocks
  }

  if (ext === 'jpg' || ext === 'jpeg' || ext === 'png') {
    const data = await toBase64(file)
    const mediaType: 'image/jpeg' | 'image/png' = ext === 'png' ? 'image/png' : 'image/jpeg'
    const blocks: ContentBlock[] = [
      { type: 'image', source: { type: 'base64', media_type: mediaType, data } },
    ]
    if (userText.trim()) blocks.push({ type: 'text', text: userText })
    return blocks
  }

  if (ext === 'docx') {
    const mammoth = await import('mammoth')
    const arrayBuffer = await file.arrayBuffer()
    const result = await mammoth.extractRawText({ arrayBuffer })
    const extracted = result.value.trim()
    const prefix = `[Document: ${file.name}]\n\n${extracted}\n\n---\n\n`
    return prefix + (userText.trim() ? userText : 'Please analyze this document.')
  }

  if (ext === 'xlsx') {
    const XLSX = await import('xlsx')
    const arrayBuffer = await file.arrayBuffer()
    const wb = XLSX.read(arrayBuffer, { type: 'array' })
    const csvParts = wb.SheetNames.map((name: string) => {
      const ws = wb.Sheets[name]
      return `[Sheet: ${name}]\n${XLSX.utils.sheet_to_csv(ws)}`
    })
    const prefix = `[Spreadsheet: ${file.name}]\n\n${csvParts.join('\n\n')}\n\n---\n\n`
    return prefix + (userText.trim() ? userText : 'Please analyze this spreadsheet.')
  }

  return userText
}

export default function AskCFOPage() {
  const { chatMessages, addChatMessage, updateChatMessage, clearChat, schoolProfile, financialData, grants, alerts, otherGrants, activeMonth, schoolContextEntries, agentFindings, financialAssumptions } =
    useStore()

  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [attachedFile, setAttachedFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragCounter = useRef(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  function handleFileSelect(file: File) {
    setFileError(null)
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      setFileError(`Unsupported file type. Accepted: PDF, Word, Excel, JPG, PNG`)
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      setFileError(`File too large (max 10 MB)`)
      return
    }
    setAttachedFile(file)
  }

  const onDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    dragCounter.current++
    if (dragCounter.current === 1) setIsDragging(true)
  }

  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    dragCounter.current--
    if (dragCounter.current <= 0) {
      dragCounter.current = 0
      setIsDragging(false)
    }
  }

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    dragCounter.current = 0
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }

  const send = async (message: string) => {
    if (!message.trim() || loading) return
    setSendError(null)
    const currentFile = attachedFile
    setInput('')
    setAttachedFile(null)
    setFileError(null)
    setLoading(true)

    const displayContent = currentFile ? `📎 ${currentFile.name}\n\n${message}`.trim() : message

    const userMsg = { id: crypto.randomUUID(), role: 'user' as const, content: displayContent }
    addChatMessage(userMsg)

    const assistantId = crypto.randomUUID()
    addChatMessage({ id: assistantId, role: 'assistant', content: '' })

    let apiContent: string | ContentBlock[]
    if (currentFile) {
      try {
        apiContent = await buildApiContent(currentFile, message)
      } catch {
        updateChatMessage(assistantId, 'Failed to process the attached file. Please try again.')
        setLoading(false)
        return
      }
    } else {
      apiContent = message
    }

    const apiMessages = [
      ...chatMessages.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: apiContent },
    ]

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
          activeMonth,
          schoolContextEntries,
          agentFindings: agentFindings.map((f) => ({
            agent_name: f.agentName,
            severity: f.severity,
            title: f.title,
            summary: f.summary,
            finding_type: f.findingType,
          })),
          financialAssumptions,
        }),
      })

      if (!res.ok || !res.body) {
        updateChatMessage(
          assistantId,
          'Sorry, something went wrong. Make sure your ANTHROPIC_API_KEY environment variable is set.'
        )
        setSendError(message)
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
      setSendError(message)
    }

    setLoading(false)
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    send(input)
  }

  const ext = attachedFile?.name.split('.').pop()?.toLowerCase() ?? ''

  return (
    <div
      className="max-w-3xl flex flex-col relative"
      style={{ height: 'calc(100vh - 64px)' }}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-xl bg-blue-50/90 border-2 border-dashed border-blue-400 pointer-events-none">
          <Paperclip size={32} className="text-blue-400 mb-3" />
          <p className="text-blue-600 font-semibold text-sm">Drop to attach</p>
          <p className="text-blue-400 text-xs mt-1">PDF, Word, Excel, JPG, PNG · max 10 MB</p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-6 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-display), system-ui, sans-serif' }}>Ask Your CFO</h1>
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
            <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4" style={{ background: 'var(--brand-50)' }}>
              <MessageCircle size={26} style={{ color: 'var(--brand-500)' }} />
            </div>
            <h2 className="text-lg font-semibold text-gray-800 mb-1" style={{ fontFamily: 'var(--font-display), system-ui, sans-serif' }}>
              What would you like to know?
            </h2>
            <p className="text-sm text-gray-400 mb-7 text-center max-w-sm">
              Ask anything about {schoolProfile.name}&apos;s finances — or attach a document to analyze.
            </p>

            {/* Suggested questions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-xl">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="text-left px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 hover:border-[#1e3a5f] hover:text-[#1e3a5f] transition-all leading-snug hover:shadow-sm"
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
                  <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mr-2.5 mt-0.5" style={{ background: 'linear-gradient(135deg, var(--brand-700) 0%, var(--accent-500) 100%)' }}>
                    <MessageCircle size={13} className="text-white" />
                  </div>
                )}
                <div
                  className={`rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'max-w-[85%] px-4 py-3 text-white rounded-br-sm'
                      : 'w-full px-5 py-4 bg-white border border-gray-200 text-gray-800 rounded-bl-sm'
                  }`}
                  style={msg.role === 'user'
                    ? { background: 'linear-gradient(135deg, var(--brand-700) 0%, var(--brand-800) 100%)' }
                    : { borderRadius: 'var(--radius-lg)' }
                  }
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
        {/* Retry bar — shown when the last request failed */}
        {sendError && !loading && (
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs text-red-500">Request failed.</p>
            <button
              onClick={() => send(sendError)}
              className="text-xs text-[#1e3a5f] font-medium underline hover:no-underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* File chip */}
        {attachedFile && (
          <div className="mb-2 flex items-center gap-2">
            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium ${EXT_COLOR[ext] ?? 'text-gray-600 bg-gray-50 border-gray-200'}`}>
              {EXT_ICON[ext] ?? <FileText size={14} />}
              <span className="max-w-[180px] truncate">{attachedFile.name}</span>
              <span className="opacity-60">· {formatBytes(attachedFile.size)}</span>
              <button
                onClick={() => { setAttachedFile(null); setFileError(null) }}
                className="ml-1 opacity-60 hover:opacity-100 transition-opacity"
                aria-label="Remove attachment"
              >
                <X size={12} />
              </button>
            </div>
          </div>
        )}

        {/* File error */}
        {fileError && (
          <p className="mb-2 text-xs text-red-500">{fileError}</p>
        )}

        <form onSubmit={onSubmit} className="flex gap-2">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFileSelect(file)
              e.target.value = ''
            }}
          />

          {/* Paperclip button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="px-3 py-2.5 border border-gray-300 rounded-lg text-gray-400 hover:text-[#1e3a5f] hover:border-[#1e3a5f] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Attach a file (PDF, Word, Excel, JPG, PNG)"
          >
            <Paperclip size={16} />
          </button>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={attachedFile ? 'Add a message about this file…' : 'Ask a question about your finances…'}
            disabled={loading}
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30 focus:border-[#1e3a5f] disabled:opacity-50 bg-white"
          />
          <button
            type="submit"
            disabled={(!input.trim() && !attachedFile) || loading}
            className="px-4 py-2.5 text-white hover:bg-[#162d4a] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            style={{ background: 'var(--brand-700)', borderRadius: 'var(--radius-sm)' }}
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
