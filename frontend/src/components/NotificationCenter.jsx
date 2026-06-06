import { useState, useEffect, useRef } from 'react'
import { Bell, X, AlertTriangle, Info, CheckCircle2 } from 'lucide-react'

const SEVERITY_ICON = {
  CRITICAL: <AlertTriangle size={14} className="text-red-500" />,
  HIGH:     <AlertTriangle size={14} className="text-orange-500" />,
  MEDIUM:   <Info size={14} className="text-yellow-500" />,
  LOW:      <Info size={14} className="text-blue-500" />,
}

export default function NotificationCenter({ onNewAlert }) {
  const [alerts, setAlerts] = useState([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const panelRef = useRef(null)

  // Expose a push function for App.jsx to call when broadcast arrives
  useEffect(() => {
    if (onNewAlert) {
      onNewAlert.current = (alert) => {
        setAlerts(prev => [{ ...alert, id: Date.now(), receivedAt: new Date() }, ...prev].slice(0, 50))
        setUnread(n => n + 1)
      }
    }
  }, [onNewAlert])

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleOpen = () => {
    setOpen(o => !o)
    if (!open) setUnread(0)
  }

  const dismiss = (id) => setAlerts(prev => prev.filter(a => a.id !== id))

  const fmtTime = (d) => {
    if (!d) return ''
    const diff = Math.floor((Date.now() - new Date(d)) / 1000)
    if (diff < 60) return 'just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    return `${Math.floor(diff / 3600)}h ago`
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={handleOpen}
        className="relative p-2 text-white hover:bg-white/20 rounded-lg transition"
        title="Notifications"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="font-semibold text-gray-800 text-sm">Notifications</span>
            {alerts.length > 0 && (
              <button onClick={() => setAlerts([])} className="text-xs text-gray-400 hover:text-red-500 transition">
                Clear all
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {alerts.length === 0 ? (
              <div className="py-10 text-center text-gray-400 text-sm">
                <Bell size={28} className="mx-auto mb-2 opacity-30" />
                No notifications yet
              </div>
            ) : (
              alerts.map(a => (
                <div key={a.id} className="flex gap-3 px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-0">
                  <div className="mt-0.5 shrink-0">{SEVERITY_ICON[a.severity] || SEVERITY_ICON.LOW}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 truncate">{a.title}</div>
                    <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">{a.message}</div>
                    <div className="text-[10px] text-gray-400 mt-1">{fmtTime(a.receivedAt)}</div>
                  </div>
                  <button onClick={() => dismiss(a.id)} className="text-gray-300 hover:text-gray-500 shrink-0 mt-0.5">
                    <X size={13} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
