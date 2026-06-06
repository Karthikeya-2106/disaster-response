import { useEffect, useState } from 'react'
import { Activity, AlertTriangle, CheckCircle2, Home, Users, Megaphone, BarChart2, Download, FileText, Shield, ChevronDown, ChevronUp, Clock } from 'lucide-react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { adminApi, incidentApi, volunteerApi, shelterApi, analyticsApi } from '../api/endpoints'
import IncidentCard from '../components/IncidentCard'
import IncidentMap from '../components/IncidentMap'
import IncidentTimeline from '../components/IncidentTimeline'
import { useWebSocket } from '../hooks/useWebSocket'

function IncidentRow({ incident }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
      <IncidentCard incident={incident} />
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

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [incidents, setIncidents] = useState([])
  const [shelters, setShelters] = useState([])
  const [volunteers, setVolunteers] = useState([])
  const [filter, setFilter] = useState('ALL')
  const [alert, setAlert] = useState({ title: '', message: '', severity: 'HIGH' })
  const [auditLogs, setAuditLogs] = useState([])
  const [showAudit, setShowAudit] = useState(false)
  const [exporting, setExporting] = useState(false)

  const load = async () => {
    try {
      const [s, all, sh, vl] = await Promise.all([
        adminApi.stats(), incidentApi.active(), shelterApi.list(), volunteerApi.available()
      ])
      setStats(s); setIncidents(all); setShelters(sh); setVolunteers(vl)
    } catch { toast.error('Failed to load admin data') }
  }

  useEffect(() => { load() }, [])

  useWebSocket(['/topic/incidents', '/topic/volunteers'], (msg) => {
    if (msg.type === 'INCIDENT_CREATED') toast(`🚨 NEW: ${msg.payload.title}`, { duration: 5000 })
    load()
  })

  const broadcast = async () => {
    if (!alert.title || !alert.message) return toast.error('Title and message required')
    try {
      await adminApi.broadcastAlert(alert.title, alert.message, alert.severity)
      toast.success('Alert broadcast to all users')
      setAlert({ title: '', message: '', severity: 'HIGH' })
    } catch { toast.error('Broadcast failed') }
  }

  const loadAuditLogs = async () => {
    if (!showAudit) {
      try {
        const logs = await adminApi.auditLogs()
        setAuditLogs(logs)
      } catch { toast.error('Failed to load audit logs') }
    }
    setShowAudit(s => !s)
  }

  const exportCsv = async () => {
    setExporting(true)
    try {
      const blob = await adminApi.exportCsv()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = 'incidents.csv'; a.click()
      URL.revokeObjectURL(url)
      toast.success('CSV exported')
    } catch { toast.error('Export failed') }
    finally { setExporting(false) }
  }

  const filtered = filter === 'ALL' ? incidents : incidents.filter(i => i.severity === filter)

  const Stat = ({ icon: Icon, label, value, color, sub }) => (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
      <div className={`inline-flex p-2 rounded-lg ${color} mb-2`}><Icon size={18} className="text-white" /></div>
      <div className="text-2xl font-bold text-gray-800">{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  )

  if (!stats) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Command Center</h1>
          <p className="text-gray-500 text-sm">Real-time disaster response operations</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link to="/analytics" className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium transition">
            <BarChart2 size={16} /> Analytics
          </Link>
          <button onClick={exportCsv} disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-60 text-sm font-medium transition">
            <Download size={16} /> {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
          <button onClick={loadAuditLogs}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm font-medium transition">
            <Shield size={16} /> Audit Log
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={Activity}       label="Active Incidents"       value={stats.activeIncidents}       color="bg-blue-500"    />
        <Stat icon={AlertTriangle}  label="Critical"               value={stats.criticalIncidents}     color="bg-red-500"     />
        <Stat icon={CheckCircle2}   label="Resolved Today"         value={stats.resolvedToday}         color="bg-emerald-500" />
        <Stat icon={Users}          label="Available Volunteers"   value={stats.availableVolunteers}   color="bg-purple-500"  />
        <Stat icon={Home}           label="Shelters"               value={stats.totalShelters}         color="bg-amber-500"   />
        <Stat icon={Home}           label="Shelter Capacity"       value={`${stats.currentOccupancy}/${stats.totalShelterCapacity}`} color="bg-indigo-500" />
        <Stat icon={Activity}       label="Total Incidents"        value={stats.totalIncidents}        color="bg-gray-500"    />
        <Stat icon={FileText}       label="View Analytics"         value="→ Insights" color="bg-brand-600"
          sub={<Link to="/analytics" className="text-brand-600 hover:underline text-xs">Open dashboard</Link>} />
      </div>

      {/* Map */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden" style={{ height: 420 }}>
        <IncidentMap incidents={incidents} shelters={shelters} volunteers={volunteers} />
      </div>

      {/* Broadcast */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-semibold mb-3 flex items-center gap-2 text-gray-800">
          <Megaphone size={18} className="text-brand-600" /> Broadcast Emergency Alert
        </h2>
        <div className="grid md:grid-cols-3 gap-2">
          <input placeholder="Alert title" value={alert.title}
            onChange={e => setAlert({ ...alert, title: e.target.value })}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
          <input placeholder="Alert message" value={alert.message}
            onChange={e => setAlert({ ...alert, message: e.target.value })}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 md:col-span-2" />
        </div>
        <div className="flex gap-2 mt-2">
          <select value={alert.severity} onChange={e => setAlert({ ...alert, severity: e.target.value })}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
            {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(s => <option key={s}>{s}</option>)}
          </select>
          <button onClick={broadcast}
            className="bg-brand-600 text-white px-5 py-2 rounded-lg hover:bg-brand-700 text-sm font-medium transition">
            Broadcast
          </button>
        </div>
      </div>

      {/* Incident List */}
      <div>
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <h2 className="font-semibold text-gray-800">Active Incidents</h2>
          <select value={filter} onChange={e => setFilter(e.target.value)}
            className="px-2 py-1 border border-gray-200 rounded-lg text-sm">
            <option value="ALL">All severity</option>
            {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(s => <option key={s}>{s}</option>)}
          </select>
          <span className="text-xs text-gray-400">{filtered.length} incidents</span>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(i => <IncidentRow key={i.id} incident={i} />)}
        </div>
      </div>

      {/* Audit Log */}
      {showAudit && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Shield size={18} /> Audit Log <span className="text-xs font-normal text-gray-400">(last 200 actions)</span>
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Time', 'Actor', 'Role', 'Action', 'Entity', 'Details'].map(h => (
                    <th key={h} className="text-left px-2 py-2 text-gray-500 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {auditLogs.slice(0, 50).map(log => (
                  <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-2 py-1.5 text-gray-400 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-2 py-1.5 text-gray-600">{log.actorId}</td>
                    <td className="px-2 py-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        log.actorRole === 'ADMIN' ? 'bg-red-100 text-red-600' :
                        log.actorRole === 'VOLUNTEER' ? 'bg-purple-100 text-purple-600' :
                        'bg-blue-100 text-blue-600'
                      }`}>{log.actorRole}</span>
                    </td>
                    <td className="px-2 py-1.5 font-medium text-gray-700">{log.action}</td>
                    <td className="px-2 py-1.5 text-gray-500">{log.entityType} #{log.entityId}</td>
                    <td className="px-2 py-1.5 text-gray-500 max-w-xs truncate">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
