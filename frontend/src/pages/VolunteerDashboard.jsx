import { useEffect, useState } from 'react'
import { Activity, Navigation, CheckCircle2, Clock, ChevronDown, ChevronUp, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { incidentApi, volunteerApi } from '../api/endpoints'
import IncidentCard from '../components/IncidentCard'
import IncidentTimeline from '../components/IncidentTimeline'
import { useWebSocket } from '../hooks/useWebSocket'

const SEV_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }

function IncidentRow({ incident, actions }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <IncidentCard incident={incident} actions={actions} />
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-center gap-1 py-2 text-xs text-gray-400 hover:text-brand-600 border-t hover:bg-gray-50 transition"
      >
        <Clock size={12} />
        {expanded ? 'Hide timeline' : 'View timeline'}
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {expanded && (
        <div className="px-4 pb-4 pt-2 border-t border-gray-100">
          <IncidentTimeline incidentId={incident.id} />
        </div>
      )}
    </div>
  )
}

export default function VolunteerDashboard() {
  const [available, setAvailable] = useState([])
  const [mine, setMine] = useState([])
  const [loading, setLoading] = useState(true)
  const [onDuty, setOnDuty] = useState(true)
  const [resolved, setResolved] = useState(0)

  const load = async () => {
    try {
      const [all, assigned] = await Promise.all([incidentApi.active(), incidentApi.assignedToMe()])
      const assignedIds = new Set(assigned.map(a => a.id))
      setAvailable(
        all.filter(i => !assignedIds.has(i.id) && i.status === 'REPORTED')
           .sort((a, b) => (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9))
      )
      const activeAssigned = assigned.filter(a => a.status !== 'RESOLVED' && a.status !== 'CANCELLED')
      setMine(activeAssigned)
      setResolved(assigned.filter(a => a.status === 'RESOLVED').length)
    } catch { toast.error('Failed to load') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  useWebSocket(['/topic/incidents'], (msg) => {
    if (msg.type === 'INCIDENT_CREATED' && msg.payload.status === 'REPORTED') {
      setAvailable(prev => [msg.payload, ...prev])
      toast(`🚨 New ${msg.payload.severity} incident: ${msg.payload.title}`, { duration: 5000 })
    }
    if (msg.type === 'INCIDENT_UPDATED') load()
  })

  useEffect(() => {
    if (!onDuty || !navigator.geolocation) return
    const send = () => navigator.geolocation.getCurrentPosition(
      pos => volunteerApi.updateLocation(pos.coords.latitude, pos.coords.longitude, true).catch(() => {}),
      () => {}
    )
    send()
    const id = setInterval(send, 30000)
    return () => clearInterval(id)
  }, [onDuty])

  const accept = async (id) => {
    try { await incidentApi.accept(id); toast.success('Incident accepted'); load() }
    catch (e) { toast.error(e.response?.data?.message || 'Failed') }
  }

  const setStatus = async (id, status, note) => {
    try { await incidentApi.updateStatus(id, status, note); toast.success(`Marked as ${status}`); load() }
    catch { toast.error('Failed to update status') }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      {/* Header + stats */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Volunteer Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">Accept incidents and update response progress in real time</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-3">
            <div className="text-center bg-white rounded-xl px-4 py-2 shadow-sm border border-gray-100">
              <div className="text-xl font-bold text-orange-500">{mine.length}</div>
              <div className="text-xs text-gray-500">Active</div>
            </div>
            <div className="text-center bg-white rounded-xl px-4 py-2 shadow-sm border border-gray-100">
              <div className="text-xl font-bold text-emerald-500">{resolved}</div>
              <div className="text-xs text-gray-500">Resolved</div>
            </div>
            <div className="text-center bg-white rounded-xl px-4 py-2 shadow-sm border border-gray-100">
              <div className="text-xl font-bold text-blue-500">{available.length}</div>
              <div className="text-xs text-gray-500">Available</div>
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer bg-white rounded-xl px-3 py-2 shadow-sm border border-gray-100">
            <div className={`relative w-10 h-5 rounded-full transition-colors ${onDuty ? 'bg-emerald-500' : 'bg-gray-300'}`}
              onClick={() => setOnDuty(d => !d)}>
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${onDuty ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </div>
            <div className="text-xs">
              <div className={`font-semibold ${onDuty ? 'text-emerald-600' : 'text-gray-500'}`}>{onDuty ? 'On Duty' : 'Off Duty'}</div>
              <div className="text-gray-400">Location {onDuty ? 'sharing' : 'paused'}</div>
            </div>
          </label>
        </div>
      </div>

      {/* Active rescues */}
      <section>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Activity size={18} className="text-orange-500" /> My Active Rescues
          <span className="text-sm font-normal text-gray-400">({mine.length})</span>
        </h2>
        {mine.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center text-gray-400">
            No active rescues — accept an available incident below
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mine.map(i => (
              <IncidentRow key={i.id} incident={i} actions={
                <div className="flex flex-col gap-1.5 mt-2">
                  {/* Navigate button — always visible for active assignments */}
                  <Link to={`/navigate/${i.id}`}
                    className="w-full flex items-center justify-center gap-2 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition">
                    <Navigation size={13} /> Navigate to Incident
                  </Link>
                  <div className="flex gap-1.5">
                    {i.status === 'ASSIGNED' && (
                      <button onClick={() => setStatus(i.id, 'IN_PROGRESS', 'Volunteer en route')}
                        className="flex-1 bg-yellow-500 text-white py-1.5 rounded-lg hover:bg-yellow-600 text-xs font-medium transition">
                        En Route
                      </button>
                    )}
                    {i.status === 'IN_PROGRESS' && (
                      <button onClick={() => setStatus(i.id, 'RESOLVED', 'Incident resolved by volunteer')}
                        className="flex-1 bg-emerald-500 text-white py-1.5 rounded-lg hover:bg-emerald-600 text-xs font-medium transition">
                        Mark Resolved
                      </button>
                    )}
                  </div>
                </div>
              } />
            ))}
          </div>
        )}
      </section>

      {/* Available incidents */}
      <section>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Navigation size={18} className="text-brand-600" /> Available Incidents
          <span className="text-sm font-normal text-gray-400">(sorted by severity)</span>
        </h2>
        {available.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center text-gray-400">
            No incidents awaiting volunteers — great work! 🎉
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {available.map(i => (
              <IncidentRow key={i.id} incident={i} actions={
                <button onClick={() => accept(i.id)}
                  className="w-full mt-2 bg-brand-600 text-white py-1.5 rounded-lg hover:bg-brand-700 text-xs font-medium transition">
                  Accept Rescue
                </button>
              } />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
