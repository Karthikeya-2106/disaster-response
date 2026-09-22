import { MapPin, Clock, User, Brain, Zap, ScanEye, AlertTriangle, Wrench } from 'lucide-react'

/** What the vision model saw in the reporter's photo — what a responder needs before leaving. */
function AiPhotoCheck({ a }) {
  return (
    <div className="mb-3 rounded-lg border border-indigo-100 bg-indigo-50/50 px-2.5 py-2 space-y-1.5 text-xs">
      <div className="flex items-center justify-between gap-1">
        <span className="flex items-center gap-1 font-semibold text-indigo-800">
          <ScanEye size={12} /> AI photo check · {a.severityLabel}
        </span>
        <span className="text-[10px] text-gray-400" title="AI can misread photos — confirm hazards on arrival">verify on scene</span>
      </div>
      {a.imageMatchesReport === false && (
        <div className="flex items-start gap-1 text-amber-800">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          Photo doesn't match the reported disaster type — verify before dispatching.
        </div>
      )}
      {a.hazards?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {a.hazards.slice(0, 3).map((h, i) => (
            <span key={i} className="px-1.5 py-0.5 rounded bg-white border border-red-200 text-red-700">{h}</span>
          ))}
        </div>
      )}
      {a.recommendedResources?.length > 0 && (
        <div className="flex items-start gap-1 text-gray-600">
          <Wrench size={12} className="mt-0.5 shrink-0" />
          <span className="line-clamp-2">{a.recommendedResources.join(' · ')}</span>
        </div>
      )}
    </div>
  )
}

const SEV_BADGE = {
  CRITICAL: 'bg-red-100 text-red-700 border border-red-200',
  HIGH:     'bg-orange-100 text-orange-700 border border-orange-200',
  MEDIUM:   'bg-yellow-100 text-yellow-700 border border-yellow-200',
  LOW:      'bg-green-100 text-green-700 border border-green-200',
}
const STATUS_BADGE = {
  REPORTED:    'bg-blue-100 text-blue-700',
  ASSIGNED:    'bg-purple-100 text-purple-700',
  IN_PROGRESS: 'bg-orange-100 text-orange-700',
  RESOLVED:    'bg-emerald-100 text-emerald-700',
  CANCELLED:   'bg-gray-100 text-gray-500',
}

function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function IncidentCard({ incident, actions }) {
  const isSos = incident.title?.startsWith('🆘')
  return (
    <div className={`bg-white rounded-xl border overflow-hidden transition hover:shadow-md ${isSos ? 'border-red-300 ring-1 ring-red-200' : 'border-gray-100 shadow-sm'}`}>
      {isSos && (
        <div className="bg-red-600 text-white text-xs font-bold px-3 py-1 flex items-center gap-1">
          <Zap size={11} /> SOS EMERGENCY
        </div>
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-semibold text-gray-900 text-sm leading-tight line-clamp-2">{incident.title}</h3>
          <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 font-medium ${SEV_BADGE[incident.severity] || 'bg-gray-100 text-gray-600'}`}>
            {incident.severity}
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-2">
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{incident.disasterType}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[incident.status] || 'bg-gray-100 text-gray-600'}`}>
            {incident.status?.replace('_', ' ')}
          </span>
        </div>

        <p className="text-sm text-gray-600 line-clamp-2 mb-3">{incident.description}</p>

        {incident.imageUrl && (
          <img src={incident.imageUrl} alt="incident" className="w-full h-28 object-cover rounded-lg mb-3" />
        )}

        {incident.aiAnalysis && <AiPhotoCheck a={incident.aiAnalysis} />}

        <div className="space-y-1 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <MapPin size={11} className="shrink-0" />
            <span className="truncate">{incident.address || `${incident.latitude?.toFixed(3)}, ${incident.longitude?.toFixed(3)}`}</span>
          </div>
          <div className="flex items-center gap-1">
            <User size={11} className="shrink-0" />
            <span className="truncate">{incident.reporterName}</span>
          </div>
          {incident.assignedVolunteerName && (
            <div className="flex items-center gap-1">
              <User size={11} className="text-purple-500 shrink-0" />
              <span className="truncate text-purple-600">{incident.assignedVolunteerName}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Clock size={11} className="shrink-0" />
              {fmtDate(incident.createdAt)}
            </div>
            {incident.aiSeverityScore != null && (
              <div className="flex items-center gap-1 text-purple-500">
                <Brain size={11} />
                <span>{(incident.aiSeverityScore * 100).toFixed(0)}%</span>
              </div>
            )}
          </div>
        </div>

        {incident.progressNote && (
          <div className="mt-2 text-xs text-gray-500 bg-gray-50 rounded px-2 py-1.5 border-l-2 border-gray-200">
            {incident.progressNote}
          </div>
        )}

        {actions && <div className="mt-3">{actions}</div>}
      </div>
    </div>
  )
}
