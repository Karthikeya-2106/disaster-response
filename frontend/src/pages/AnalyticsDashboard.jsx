import { useEffect, useState } from 'react'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { TrendingUp, Clock, CheckCircle2, AlertTriangle, Download, FileText, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import { analyticsApi, adminApi } from '../api/endpoints'

const SEVERITY_COLORS = { CRITICAL: '#ef4444', HIGH: '#f97316', MEDIUM: '#f59e0b', LOW: '#22c55e' }
const STATUS_COLORS = ['#3b82f6', '#8b5cf6', '#f97316', '#22c55e', '#6b7280']
const TYPE_COLOR = '#6366f1'

function StatCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div className="text-2xl font-bold text-gray-800">{value}</div>
      <div className="text-sm text-gray-500 mt-0.5">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-sm">
      <p className="font-medium text-gray-700">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: <strong>{p.value}</strong></p>
      ))}
    </div>
  )
}

export default function AnalyticsDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    analyticsApi.dashboard()
      .then(setData)
      .catch(() => toast.error('Failed to load analytics'))
      .finally(() => setLoading(false))
  }, [])

  const exportCsv = async () => {
    setExporting(true)
    try {
      const blob = await adminApi.exportCsv()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = 'incidents.csv'; a.click()
      URL.revokeObjectURL(url)
      toast.success('Export downloaded')
    } catch { toast.error('Export failed') }
    finally { setExporting(false) }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!data) return null

  const weekTrend = data.thisWeekCount > data.lastWeekCount
    ? `+${data.thisWeekCount - data.lastWeekCount} vs last week`
    : data.lastWeekCount > 0
      ? `${data.thisWeekCount - data.lastWeekCount} vs last week`
      : 'vs last week'

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics &amp; Insights</h1>
          <p className="text-gray-500 text-sm mt-0.5">Real-time disaster response performance metrics</p>
        </div>
        <button
          onClick={exportCsv}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-60 text-sm font-medium transition"
        >
          <Download size={16} />
          {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={FileText} label="Total Incidents" value={data.totalIncidents} sub={weekTrend} color="bg-blue-500" />
        <StatCard icon={CheckCircle2} label="Resolution Rate" value={`${data.resolutionRate}%`} sub={`${data.resolvedIncidents} resolved`} color="bg-emerald-500" />
        <StatCard icon={Clock} label="Avg Response Time" value={`${data.avgResponseHours}h`} sub="Reported → Resolved" color="bg-indigo-500" />
        <StatCard icon={AlertTriangle} label="Critical Active" value={data.criticalActive} sub="Needs immediate attention" color="bg-red-500" />
      </div>

      {/* Incident Trends + Severity Distribution */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Incident Trends — Last 14 Days</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data.dailyTrends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={1} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="incidents" stroke="#dc2626" strokeWidth={2.5}
                dot={{ fill: '#dc2626', r: 3 }} activeDot={{ r: 5 }} name="Incidents" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Severity Distribution</h2>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={data.severityDistribution} dataKey="value" nameKey="name"
                cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3}>
                {data.severityDistribution.map((e, i) => (
                  <Cell key={i} fill={SEVERITY_COLORS[e.name] || '#9ca3af'} />
                ))}
              </Pie>
              <Tooltip formatter={(v, n) => [v, n]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-1 mt-2">
            {data.severityDistribution.map(e => (
              <div key={e.name} className="flex items-center gap-1.5 text-xs text-gray-600">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: SEVERITY_COLORS[e.name] || '#9ca3af' }} />
                {e.name}: <strong>{e.value}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Type Distribution + Status + Leaderboard */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Incidents by Disaster Type</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.typeDistribution} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" fill={TYPE_COLOR} radius={[4, 4, 0, 0]} name="Incidents" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Status Breakdown</h2>
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie data={data.statusDistribution} dataKey="value" nameKey="name"
                cx="50%" cy="50%" outerRadius={60} paddingAngle={2}>
                {data.statusDistribution.map((e, i) => (
                  <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1 mt-2">
            {data.statusDistribution.filter(e => e.value > 0).map((e, i) => (
              <div key={e.name} className="flex items-center justify-between text-xs text-gray-600">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: STATUS_COLORS[i % STATUS_COLORS.length] }} />
                  {e.name}
                </div>
                <strong>{e.value}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Volunteer Leaderboard */}
      {data.volunteerLeaderboard?.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Users size={18} /> Volunteer Leaderboard — Incidents Resolved
          </h2>
          <div className="space-y-3">
            {data.volunteerLeaderboard.map((v, i) => (
              <div key={v.name} className="flex items-center gap-3">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white
                  ${i === 0 ? 'bg-yellow-400' : i === 1 ? 'bg-gray-400' : i === 2 ? 'bg-amber-600' : 'bg-gray-300'}`}>
                  {i + 1}
                </span>
                <div className="flex-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-700">{v.name}</span>
                    <span className="text-emerald-600 font-semibold">{v.resolved} resolved</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
                    <div className="bg-emerald-500 h-1.5 rounded-full"
                      style={{ width: `${Math.min(100, (v.resolved / (data.volunteerLeaderboard[0]?.resolved || 1)) * 100)}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
