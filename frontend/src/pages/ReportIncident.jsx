import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, Camera, Send, Brain, ChevronDown, ChevronUp, CheckCircle2, ScanEye, AlertTriangle, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { incidentApi, aiApi } from '../api/endpoints'
import AddressSearch from '../components/AddressSearch'

const SEVERITY_COLOR = { LOW: 'bg-green-500', MEDIUM: 'bg-yellow-500', HIGH: 'bg-orange-500', CRITICAL: 'bg-red-500' }

export default function ReportIncident() {
  const [form, setForm] = useState({
    title: '', description: '', disasterType: 'FLOOD', severity: 'MEDIUM',
    latitude: null, longitude: null, address: '', imageUrl: null
  })
  const [aiScore, setAiScore] = useState(null)
  const [aiAnalysis, setAiAnalysis] = useState(null)
  const [photoAssessment, setPhotoAssessment] = useState(null)
  const [photoAiState, setPhotoAiState] = useState(null)   // null | 'pending' | 'done' | 'unavailable'
  const pollTimer = useRef(null)
  const currentPhoto = useRef(null)                           // ignore results for a replaced photo
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

  useEffect(() => () => clearTimeout(pollTimer.current), [])

  // The vision check runs in the background (minutes on a local CPU model), so poll for it.
  // Reporting never waits on it: if the incident is submitted first, the backend attaches the
  // analysis when it finishes.
  const pollPhotoAnalysis = (url, startedAt = Date.now()) => {
    pollTimer.current = setTimeout(async () => {
      if (currentPhoto.current !== url) return
      try {
        const r = await incidentApi.imageAnalysis(url)
        if (currentPhoto.current !== url) return
        if (r.status === 'done') {
          setPhotoAssessment(r.aiAnalysis)
          setAiScore(r.aiSeverityScore)
          setPhotoAiState('done')
          toast.success(`AI read the photo · ${r.aiAnalysis.severityLabel}`)
          return
        }
        if (r.status === 'unavailable') { setPhotoAiState('unavailable'); return }
      } catch { /* transient network error — keep polling */ }
      if (Date.now() - startedAt < 8 * 60 * 1000) pollPhotoAnalysis(url, startedAt)
      else setPhotoAiState('unavailable')
    }, 3000)
  }

  const handleFile = async (file) => {
    if (!file) return
    clearTimeout(pollTimer.current)
    currentPhoto.current = null
    setUploading(true)
    setPhotoAssessment(null)
    setPhotoAiState(null)
    try {
      const data = await incidentApi.uploadImage(file, form.severity, form.description)
      currentPhoto.current = data.imageUrl
      setForm(f => ({ ...f, imageUrl: data.imageUrl }))
      setAiScore(data.aiSeverityScore)
      if (data.aiStatus === 'pending') {
        setPhotoAiState('pending')
        pollPhotoAnalysis(data.imageUrl)
        toast.success('Photo uploaded — AI is examining it')
      } else {
        toast.success('Image uploaded')
      }
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
    if (!form.address?.trim()) return toast.error('Address is required — search and select from suggestions')
    if (!form.latitude || !form.longitude) return toast.error('Location required — select an address from the dropdown')
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address <span className="text-red-500">*</span>
              <span className="text-xs font-normal text-gray-400 ml-1">— type to search, select from map suggestions</span>
            </label>
            <AddressSearch
              required
              value={form.address}
              placeholder="Search street, area, landmark…"
              onChange={(val) => u('address', val)}
              onSelect={(loc) => {
                if (loc) {
                  setForm(f => ({ ...f, address: loc.address, latitude: loc.latitude, longitude: loc.longitude }))
                  toast.success('Location set from address')
                }
              }}
            />
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
            <MapPin size={15} className={form.latitude ? 'text-emerald-500 shrink-0' : 'text-gray-400 shrink-0'} />
            {form.latitude
              ? <span>📍 Location set: <span className="font-mono text-xs">{form.latitude.toFixed(5)}, {form.longitude.toFixed(5)}</span></span>
              : <span className="animate-pulse text-gray-400">Detecting your location…</span>
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
              {analyzing ? 'Analyzing…' : 'Analyze with AI'}
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
            <p className="text-xs text-gray-400">Click "Analyze" to get an AI severity assessment and response recommendations. Uploading a photo lets the AI assess the scene itself.</p>
          )}
        </div>

        {/* Photo Upload */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide mb-3">Photo Evidence</h2>
          <label className="flex flex-col items-center justify-center gap-2 px-4 py-6 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-brand-400 hover:bg-brand-50/30 transition">
            <Camera size={24} className="text-gray-400" />
            <span className="text-sm text-gray-500">
              {uploading ? 'Uploading photo…' : form.imageUrl ? '✓ Image uploaded — click to replace' : 'Click to upload photo — AI will assess the scene'}
            </span>
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => handleFile(e.target.files[0])} />
          </label>
          {form.imageUrl && (
            <div className="mt-3">
              <img src={form.imageUrl} alt="incident" className="w-full max-h-48 object-cover rounded-lg" />
            </div>
          )}
          {photoAiState === 'pending' && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-indigo-100 bg-indigo-50/60 px-3 py-2.5 text-xs text-indigo-800">
              <Loader2 size={14} className="mt-0.5 shrink-0 animate-spin" />
              <span>
                <span className="font-semibold">AI is examining your photo.</span> This can take a couple of minutes.
                {' '}<span className="font-semibold">You don't need to wait</span> — submit your report now and the analysis
                will be added to it automatically.
              </span>
            </div>
          )}
          {photoAssessment && <PhotoAssessment a={photoAssessment} />}
        </div>

        {/* Submit */}
        {/* Blocked only while the photo file itself is uploading — submitting then would file
            the report without it. The AI check afterwards never blocks reporting. */}
        <button disabled={submitting || uploading || !form.latitude}
          className="w-full bg-brand-600 text-white py-3.5 rounded-xl hover:bg-brand-700 disabled:opacity-50 flex items-center justify-center gap-2 font-semibold text-sm transition shadow-lg shadow-brand-200">
          <Send size={17} />
          {submitting ? 'Reporting…' : uploading ? 'Uploading photo…' : 'Report Incident'}
        </button>
      </form>
    </div>
  )
}

const LABEL_STYLE = {
  CRITICAL: 'bg-red-100 text-red-700', HIGH: 'bg-orange-100 text-orange-700',
  MEDIUM: 'bg-yellow-100 text-yellow-800', LOW: 'bg-green-100 text-green-700',
}

/** What the vision model saw in the uploaded photo. */
function PhotoAssessment({ a }) {
  return (
    <div className="mt-3 border border-indigo-100 bg-indigo-50/60 rounded-lg p-4 space-y-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 font-semibold text-indigo-800 text-xs uppercase tracking-wide">
          <ScanEye size={14} /> What the AI sees in your photo
        </span>
        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${LABEL_STYLE[a.severityLabel] || 'bg-gray-100 text-gray-700'}`}>
          {a.severityLabel} · {(a.severityScore * 100).toFixed(0)}%
        </span>
      </div>

      {!a.imageMatchesReport && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-md px-3 py-2 text-xs">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          This photo doesn't look like the disaster type you selected. Please check the type, or upload a photo of the scene.
        </div>
      )}

      {a.summary && <p className="text-gray-700">{a.summary}</p>}

      {a.hazards?.length > 0 && (
        <div>
          <div className="font-semibold text-indigo-800 text-xs uppercase tracking-wide mb-1">Hazards spotted</div>
          <div className="flex flex-wrap gap-1.5">
            {a.hazards.map((h, i) => (
              <span key={i} className="px-2 py-0.5 bg-white border border-red-200 text-red-700 rounded-full text-xs">{h}</span>
            ))}
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        {a.peopleAtRisk && (
          <div>
            <div className="font-semibold text-indigo-800 text-xs uppercase tracking-wide mb-1">People at risk</div>
            <p className="text-gray-700">{a.peopleAtRisk}</p>
          </div>
        )}
        {a.accessNotes && (
          <div>
            <div className="font-semibold text-indigo-800 text-xs uppercase tracking-wide mb-1">Access for responders</div>
            <p className="text-gray-700">{a.accessNotes}</p>
          </div>
        )}
      </div>

      {a.recommendedResources?.length > 0 && (
        <div>
          <div className="font-semibold text-indigo-800 text-xs uppercase tracking-wide mb-1">Resources needed</div>
          <ul className="space-y-1">
            {a.recommendedResources.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-gray-700">
                <CheckCircle2 size={13} className="text-indigo-500 mt-0.5 shrink-0" />{r}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-[11px] text-gray-400">AI can misread photos. Responders confirm on arrival.</p>
    </div>
  )
}
