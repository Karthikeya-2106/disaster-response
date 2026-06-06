import { useState, useRef, useEffect } from 'react'
import { MessageCircle, X, Send, Bot, User, Zap, Shield, MapPin, FileText } from 'lucide-react'
import { aiApi } from '../api/endpoints'

const QUICK_ACTIONS = [
  { label: 'Fire emergency', icon: '🔥', msg: 'There is a fire emergency near me. What should I do?' },
  { label: 'Flood situation', icon: '🌊', msg: 'There is flooding in my area. What are the safety steps?' },
  { label: 'Find shelter', icon: '🏠', msg: 'How do I find the nearest emergency shelter?' },
  { label: 'Report incident', icon: '📋', msg: 'How do I report a disaster incident on this platform?' },
]

export default function AiEmergencyChat() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([
    { role: 'assistant', text: "Hi! I'm your AI Emergency Assistant. I can help with disaster safety guidance, platform navigation, and emergency procedures. How can I help you right now?" }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  const sendMessage = async (text) => {
    const msg = text || input.trim()
    if (!msg || loading) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: msg }])
    setLoading(true)
    try {
      const { reply } = await aiApi.chat(msg)
      setMessages(prev => [...prev, { role: 'assistant', text: reply }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Connection error. For emergencies call 112 immediately.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-brand-600 hover:bg-brand-700 text-white rounded-full shadow-2xl flex items-center justify-center transition-all duration-200 hover:scale-110"
        title="AI Emergency Assistant"
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
        {!open && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white animate-pulse" />
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl flex flex-col border border-gray-200 overflow-hidden" style={{ height: 480 }}>
          {/* Header */}
          <div className="bg-brand-600 px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center">
              <Bot size={18} className="text-white" />
            </div>
            <div className="flex-1">
              <div className="text-white font-semibold text-sm">AI Emergency Assistant</div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 bg-green-400 rounded-full inline-block" />
                <span className="text-white/80 text-xs">Online • Powered by Claude AI</span>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white"><X size={18} /></button>
          </div>

          {/* Emergency banner */}
          <div className="bg-red-50 border-b border-red-100 px-3 py-1.5 flex items-center gap-2">
            <Shield size={12} className="text-red-500 shrink-0" />
            <span className="text-red-600 text-xs">Emergency? Call <strong>112</strong> immediately</span>
          </div>

          {/* Quick actions */}
          <div className="px-3 pt-2 pb-1 flex gap-1.5 overflow-x-auto scrollbar-hide">
            {QUICK_ACTIONS.map(a => (
              <button
                key={a.label}
                onClick={() => sendMessage(a.msg)}
                className="shrink-0 flex items-center gap-1 px-2.5 py-1 bg-gray-100 hover:bg-brand-50 hover:text-brand-700 rounded-full text-xs text-gray-600 transition"
              >
                <span>{a.icon}</span> {a.label}
              </button>
            ))}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${m.role === 'assistant' ? 'bg-brand-100' : 'bg-gray-200'}`}>
                  {m.role === 'assistant' ? <Bot size={14} className="text-brand-600" /> : <User size={14} className="text-gray-600" />}
                </div>
                <div className={`max-w-[78%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                  m.role === 'assistant'
                    ? 'bg-gray-100 text-gray-800 rounded-tl-sm'
                    : 'bg-brand-600 text-white rounded-tr-sm'
                }`}>
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-2">
                <div className="w-7 h-7 bg-brand-100 rounded-full flex items-center justify-center shrink-0">
                  <Bot size={14} className="text-brand-600" />
                </div>
                <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-2 border-t border-gray-100">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                placeholder="Ask about safety, shelters, reporting..."
                className="flex-1 px-3 py-2 bg-gray-100 rounded-full text-sm outline-none focus:ring-2 focus:ring-brand-300"
                disabled={loading}
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || loading}
                className="w-9 h-9 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white rounded-full flex items-center justify-center shrink-0 transition"
              >
                <Send size={15} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
