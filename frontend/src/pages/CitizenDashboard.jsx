import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Home, Phone, ChevronDown, ChevronUp, Clock, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import { incidentApi, shelterApi } from '../api/endpoints'
import IncidentCard from '../components/IncidentCard'
import IncidentTimeline from '../components/IncidentTimeline'
import { useWebSocket } from '../hooks/useWebSocket'

function SosButton() {
  const [confirming, setConfirming] = useState(false)
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const timerRef = useRef(null)

  const handlePress = () => {
    if (sent) return
    setConfirming(true)
    timerRef.current = setTimeout(() => setConfirming(false), 4000)
  }

  const confirm = async () => {
    clearTimeout(timerRef.current)
    setConfirming(false)
    setLoading(true)
    try {
      const pos = await new Promise((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 })
      ).catch(() => null)
      const lat = pos?.coords?.latitude || 17.3850
      const lng = pos?.coords?.longitude || 78.4867
      const inc = await incidentApi.sos(lat, lng, null)
      setSent(true)
      toast.success(`🆘 SOS sent! Incident #${inc.id} created. Help is on the way.`, { duration: 8000 })
      setTimeout(() => setSent(false), 30000)
    } catch {
      toast.error('SOS failed — call 112 immediately!')
    } finally {
      setLoading(false)
    }
  }

  const cancel = () => { clearTimeout(timerRef.current); setConfirming(false) }

  if (confirming) return (
    <div className="bg-red-600 rounded-2xl p-4 text-white shadow-2xl animate-pulse">
      <p className="font-bold text-center mb-3">Confirm SOS Emergency?</p>
      <div className="flex gap-2">
        <button onClick={confirm} className="flex-1 bg-white text-red-600 font-bold py-2 rounded-lg">
          YES — Send SOS
        </button>
        <button onClick={cancel} className="flex-1 bg-red-700 text-white font-medium py-2 rounded-lg">
          Cancel
        </button>
      </div>
    </div>
  )

  if (sent) return (
    <div className="bg-emerald-600 rounded-2xl p-4 text-white shadow-lg text-center">
      <div className="text-3xl mb-1">✅</div>
      <p className="font-bold">SOS Sent! Help is on the way.</p>
      <p className="text-sm opacity-80 mt-1">Emergency responders have been notified.</p>
    </div>
  )

  return (
    <button
      onClick={handlePress}
      disabled={loading}
      className="w-full bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold py-4 rounded-2xl shadow-lg flex items-center justify-center gap-3 transition-all text-lg disabled:opacity-60"
      style={{ boxShadow: '0 0 0 4px rgba(220,38,38,0.2), 0 4px 24px rgba(220,38,38,0.35)' }}
    >
      {loading ? (
        <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
      ) : (
        <>
          <span className="text-2xl">🆘</span>
          <span>SOS — Emergency Help Needed</span>
        </>
      )}
    </button>
  )
}

function ReportRow({ incident }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="bg-white rounded-lg shadow border border-gray-100 overflow-hidden">
      <IncidentCard incident={incident} />
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-center gap-1 py-2 text-xs text-gray-400 hover:text-brand-600 border-t border-gray-100 hover:bg-gray-50 transition"
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

export default function CitizenDashboard() {
  const [reports, setReports] = useState([])
  const [shelters, setShelters] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      const [myReports, shelterList] = await Promise.all([incidentApi.myReports(), shelterApi.list()])
      setReports(myReports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)))
      setShelters(shelterList)
    } catch {
      toast.error('Failed to load dashboard')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  useWebSocket(['/topic/incidents'], (msg) => {
    if (msg.type === 'INCIDENT_UPDATED') {
      setReports(prev => prev.map(r => r.id === msg.payload.id ? msg.payload : r))
      toast(`Your report "${msg.payload.title}" was updated to ${msg.payload.status}`)
    }
  })

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      {/* SOS Panel */}
      <div className="bg-red-50 border border-red-100 rounded-2xl p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center shrink-0">
            <Phone size={18} className="text-red-600" />
          </div>
          <div>
            <h2 className="font-bold text-red-700">Emergency SOS</h2>
            <p className="text-sm text-red-500 mt-0.5">One-tap emergency alert — sends your location to all responders instantly</p>
          </div>
        </div>
        <SosButton />
        <p className="text-center text-xs text-red-400 mt-3">For life-threatening emergencies. Also call <strong>112</strong>.</p>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Reports</h1>
          <p className="text-gray-500 text-sm mt-0.5">Track the status of incidents you've reported</p>
        </div>
        <Link to="/report" className="bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 flex items-center gap-2 text-sm font-medium transition">
          <Plus size={16} /> New Report
        </Link>
      </div>

      {reports.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-10 text-center text-gray-400">
          <FileText size={40} className="mx-auto mb-3 opacity-30" />
          <p>You haven't reported any incidents yet.</p>
          <Link to="/report" className="text-brand-600 hover:underline text-sm mt-1 inline-block">Report one now</Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reports.map(r => <ReportRow key={r.id} incident={r} />)}
        </div>
      )}

      {/* Shelters */}
      <div>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-900">
          <Home size={20} className="text-brand-600" /> Nearby Shelters
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {shelters.map(s => {
            const pct = Math.round((s.currentOccupancy / s.capacity) * 100)
            const color = pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-400' : 'bg-emerald-500'
            return (
              <div key={s.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-gray-800 text-sm">{s.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full text-white font-medium ${pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-400' : 'bg-emerald-500'}`}>
                    {pct < 100 ? `${100 - pct}% free` : 'FULL'}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mb-3">{s.address}</p>
                <div className="text-xs text-gray-600 mb-1 flex justify-between">
                  <span>Occupancy</span>
                  <span className="font-medium">{s.currentOccupancy}/{s.capacity}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
                {s.contactPhone && (
                  <a href={`tel:${s.contactPhone}`} className="flex items-center gap-1 text-xs text-brand-600 mt-2 hover:underline">
                    <Phone size={11} /> {s.contactPhone}
                  </a>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

