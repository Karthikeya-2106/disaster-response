import { useEffect, useState } from 'react'
import { CheckCircle2, Clock, AlertCircle, XCircle, UserCheck, Activity } from 'lucide-react'
import { analyticsApi } from '../api/endpoints'

const STATUS_CONFIG = {
  REPORTED:    { icon: AlertCircle, color: 'bg-blue-100 text-blue-600',    line: 'bg-blue-200' },
  ASSIGNED:    { icon: UserCheck,   color: 'bg-purple-100 text-purple-600', line: 'bg-purple-200' },
  IN_PROGRESS: { icon: Activity,    color: 'bg-orange-100 text-orange-600', line: 'bg-orange-200' },
  RESOLVED:    { icon: CheckCircle2,color: 'bg-emerald-100 text-emerald-600', line: 'bg-emerald-200' },
  CANCELLED:   { icon: XCircle,     color: 'bg-gray-100 text-gray-500',    line: 'bg-gray-200' },
}

function fmt(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function IncidentTimeline({ incidentId }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!incidentId) return
    analyticsApi.timeline(incidentId)
      .then(setEntries)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [incidentId])

  if (loading) return <div className="text-xs text-gray-400 py-2">Loading timeline…</div>
  if (!entries.length) return <div className="text-xs text-gray-400 py-2">No timeline data yet</div>

  return (
    <div className="space-y-0">
      {entries.map((e, i) => {
        const cfg = STATUS_CONFIG[e.toStatus] || STATUS_CONFIG.REPORTED
        const Icon = cfg.icon
        const isLast = i === entries.length - 1
        return (
          <div key={e.id} className="flex gap-3">
            {/* Timeline line + dot */}
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${cfg.color}`}>
                <Icon size={14} />
              </div>
              {!isLast && <div className={`w-0.5 flex-1 my-1 ${cfg.line}`} style={{ minHeight: 16 }} />}
            </div>
            {/* Content */}
            <div className="pb-4 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.color}`}>
                  {e.toStatus.replace('_', ' ')}
                </span>
                <span className="text-xs text-gray-400">{fmt(e.changedAt)}</span>
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                By <span className="font-medium text-gray-700">{e.changedByName}</span>
                {e.changedByRole && <span className="text-gray-400"> ({e.changedByRole})</span>}
              </div>
              {e.note && (
                <div className="mt-1 text-xs text-gray-600 bg-gray-50 rounded px-2 py-1 border-l-2 border-gray-300">
                  {e.note}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
