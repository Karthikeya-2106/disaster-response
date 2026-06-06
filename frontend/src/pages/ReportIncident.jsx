import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, Camera, Send, Brain, ChevronDown, ChevronUp, AlertCircle, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { incidentApi, aiApi } from '../api/endpoints'

const SEVERITY_COLOR = { LOW: 'bg-green-500', MEDIUM: 'bg-yellow-500', HIGH: 'bg-orange-500', CRITICAL: 'bg-red-500' }

export default function ReportIncident() {
  const [form, setForm] = useState({
    title: '', description: '', disasterType: 'FLOOD', severity: 'MEDIUM',
    latitude: null, longitude: null, address: '', imageUrl: null
  })
  const [aiScore, setAiScore] = useState(null)
  const [aiAnalysis, setAiAnalysis] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [showAnalysis, setShowAnalysis] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      pos => setForm(f => ({ ...f, latitude: pos.coords.latitude, longitude: pos.coords.longitude })),
      () => { setForm(f => ({ ...f, latitude: 17.4485, longitude: 78.3908 })); toast('Using default location (Hyderabad)') }
    )
  }, [])

  const handleFile = async (file) => {
    if (!file) return
    setUploading(true)
    try {
      const data = await incidentApi.uploadImage(file, form.severity)
      setForm(f => ({ ...f, imageUrl: data.imageUrl }))
      setAiScore(data.aiSeverityScore)
      toast.success(`Image uploaded · AI score: ${(data.aiSeverityScore * 100).toFixed(0)}%`)
    } catch (e) {
      toast.error(e.response?.data?.message || 'Upload failed')
    } finally { setUploading(false) }
  }

  const runAiAnalysis = async () => {
    if (!form.title || !form.description) {
      toast.error('Fill in title and description first')
      return
    }
    setAnalyzing(true)
    try {
      const result = await aiApi.analyzeIncident(form.title, form.description, form.disasterType, form.severity)
      setAiAnalysis(result)
      if (result.score) setAiScore(result.score)
      setShowAnalysis(true)
      toast.success('AI analysis complete')
    } catch {
      toast.error('AI analysis failed')
    } finally { setAnalyzing(false) }
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!form.latitude || !form.longitude) return toast.error('Location required')
    setSubmitting(true)
    try {
      const inc = await incidentApi.create(form)
      toast.success('Incident reported! Help is on the way.')
      navigate('/citizen')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to report')
    } finally { setSubmitting(false) }
  }

  const u = (k, v) => setForm({ ...form, [k]: v })

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Report an Incident</h1>
        <p className="text-gray-500 text-sm mt-0.5">Provide clear details so responders can act fast.</p>
      </div>

      <form onSubmit={submit} className="space-y-5">
        {/* Core Fields */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
          <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Incident Details</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input required value={form.title} onChange={e => u('title', e.target.value)}
              placeholder="e.g. Building collapsed on main road"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
            <textarea required rows={4} value={form.description} onChange={e => u('description', e.target.value)}
              placeholder="Describe what you see — people affected, immediate dangers, resources needed"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Disaster Type</label>
              <select value={form.disasterType} onChange={e => u('disasterType', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                {['FLOOD', 'FIRE', 'EARTHQUAKE', 'CYCLONE', 'LANDSLIDE', 'ACCIDENT', 'OTHER'].map(t => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
              <select value={form.severity} onChange={e => u('severity', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address (optional)</label>
            <input value={form.address} onChange={e => u('address', e.target.value)}
              placeholder="Street, area, landmark"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
            <MapPin size={15} className="text-brand-600 shrink-0" />
            {form.latitude
              ? <span>Location detected: <span className="font-mono text-xs">{form.latitude.toFixed(5)}, {form.longitude.toFixed(5)}</span></span>
              : <span className="animate-pulse">Detecting your location…</span>
            }
          </div>
        </div>

        {/* AI Analysis */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide flex items-center gap-2">
              <Brain size={16} className="text-purple-600" /> AI Severity Analysis
            </h2>
            <button type="button" onClick={runAiAnalysis} disabled={analyzing}
              className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white rounded-lg text-xs font-medium transition">
              <Brain size={13} />
              {analyzing ? 'Analyzing…' : 'Analyze with Claude AI'}
            </button>
          </div>

          {aiScore !== null && (
            <div className="mb-3">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-gray-600">AI Severity Score</span>
                <span className="font-bold text-gray-800">{(aiScore * 100).toFixed(0)}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2.5">
                <div className={`${SEVERITY_COLOR[form.severity] || 'bg-brand-600'} h-2.5 rounded-full transition-all`}
                  style={{ width: `${aiScore * 100}%` }} />
              </div>
            </div>
          )}

          {aiAnalysis && (
            <div>
              <button type="button" onClick={() => setShowAnalysis(s => !s)}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 mb-2">
                {showAnalysis ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                {showAnalysis ? 'Hide' : 'Show'} full AI analysis
              </button>
              {showAnalysis && (
                <div className="bg-purple-50 border border-purple-100 rounded-lg p-4 space-y-3 text-sm">
                  <div>
                    <div className="font-semibold text-purple-800 text-xs uppercase tracking-wide mb-1">Assessment</div>
                    <p className="text-gray-700">{aiAnalysis.assessment}</p>
                  </div>
                  {aiAnalysis.estimatedAffected && (
                    <div>
                      <div className="font-semibold text-purple-800 text-xs uppercase tracking-wide mb-1">Estimated Affected</div>
                      <p className="text-gray-700">{aiAnalysis.estimatedAffected}</p>
                    </div>
                  )}
                  {aiAnalysis.recommendations?.length > 0 && (
                    <div>
                      <div className="font-semibold text-purple-800 text-xs uppercase tracking-wide mb-2">Recommendations</div>
                      <ul className="space-y-1">
                        {aiAnalysis.recommendations.map((r, i) => (
                          <li key={i} className="flex items-start gap-2 text-gray-700">
                            <CheckCircle2 size={13} className="text-purple-500 mt-0.5 shrink-0" />
                            {r}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {!aiAnalysis && !analyzing && (
            <p className="text-xs text-gray-400">Click "Analyze" to get AI-powered severity assessment and response recommendations powered by Claude.</p>
          )}
        </div>

        {/* Photo Upload */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide mb-3">Photo Evidence</h2>
          <label className="flex flex-col items-center justify-center gap-2 px-4 py-6 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-brand-400 hover:bg-brand-50/30 transition">
            <Camera size={24} className="text-gray-400" />
            <span className="text-sm text-gray-500">
              {uploading ? 'Uploading…' : form.imageUrl ? '✓ Image uploaded — click to replace' : 'Click to upload photo (helps AI analysis)'}
            </span>
            <input type="file" accept="image/*" className="hidden" onChange={e => handleFile(e.target.files[0])} />
          </label>
          {form.imageUrl && (
            <div className="mt-3">
              <img src={form.imageUrl} alt="incident" className="w-full max-h-48 object-cover rounded-lg" />
            </div>
          )}
        </div>

        {/* Submit */}
        <button disabled={submitting || !form.latitude}
          className="w-full bg-brand-600 text-white py-3.5 rounded-xl hover:bg-brand-700 disabled:opacity-50 flex items-center justify-center gap-2 font-semibold text-sm transition shadow-lg shadow-brand-200">
          <Send size={17} />
          {submitting ? 'Reporting…' : 'Report Incident'}
        </button>
      </form>
    </div>
  )
}
