import { useEffect, useState } from 'react'
import { Sparkles, Route, UserCheck, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { aiApi, incidentApi } from '../api/endpoints'

const PROVIDER_LABEL = { gemini: 'Gemini', ollama: 'Ollama (local)', none: 'Heuristic' }

/**
 * Board-wide dispatch plan: the backend matches free volunteers to open incidents by
 * severity and real distance, and the admin confirms each assignment with one click.
 */
export default function AiDispatchPanel({ incidents, onAssigned }) {
  const [status, setStatus] = useState(null)
  const [plan, setPlan] = useState(null)
  const [planning, setPlanning] = useState(false)
  const [assigned, setAssigned] = useState({})   // incidentId -> true once confirmed

  useEffect(() => { aiApi.status().then(setStatus).catch(() => {}) }, [])

  const titleOf = (id) => incidents.find(i => i.id === id)?.title || `Incident #${id}`

  const runPlan = async () => {
    setPlanning(true); setPlan(null); setAssigned({})
    try {
      setPlan(await aiApi.dispatch())
    } catch (e) {
      toast.error(e.response?.data?.message || 'Dispatch planning failed')
    } finally { setPlanning(false) }
  }

  const assign = async (a) => {
    try {
      await incidentApi.assign(a.incidentId, a.volunteerId, a.volunteerName)
      setAssigned(s => ({ ...s, [a.incidentId]: true }))
      toast.success(`${a.volunteerName} dispatched to #${a.incidentId}`)
      onAssigned?.()
    } catch (e) {
      toast.error(e.response?.data?.message || 'Assignment failed')
    }
  }

  const assignAll = async () => {
    for (const a of plan.assignments.filter(a => !assigned[a.incidentId])) await assign(a)
  }

  const pending = plan?.assignments?.filter(a => !assigned[a.incidentId]) || []

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <h2 className="font-semibold flex items-center gap-2 text-gray-800">
          <Sparkles size={18} className="text-indigo-600" /> AI Dispatch
        </h2>
        <div className="flex items-center gap-2">
          {status && (
            <span className={`text-xs px-2 py-0.5 rounded-full ${status.enabled ? 'bg-indigo-50 text-indigo-700' : 'bg-gray-100 text-gray-500'}`}
              title={status.enabled ? `Model: ${status.model}` : 'No free AI provider configured — using a greedy nearest-volunteer plan'}>
              {PROVIDER_LABEL[status.provider] || status.provider}{status.enabled ? ` · ${status.model}` : ''}
            </span>
          )}
          <button onClick={runPlan} disabled={planning}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition">
            {planning ? <Loader2 size={14} className="animate-spin" /> : <Route size={14} />}
            {planning ? 'Planning…' : 'Plan dispatch'}
          </button>
        </div>
      </div>

      {!plan && !planning && (
        <p className="text-sm text-gray-500">
          Matches every free volunteer to open incidents by threat to life, severity and travel distance — across the
          whole board at once, instead of first-come-first-served.
        </p>
      )}
      {planning && status?.provider === 'ollama' && (
        <p className="text-xs text-gray-400">Running on a local model — this can take a minute on CPU.</p>
      )}

      {plan && (
        <div className="space-y-3">
          {plan.overallStrategy && <p className="text-sm text-gray-600">{plan.overallStrategy}</p>}

          {plan.assignments.length > 0 && (
            <ol className="space-y-2">
              {plan.assignments.map(a => (
                <li key={a.incidentId} className="flex items-start gap-3 border border-gray-100 rounded-lg p-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
                    {a.priority}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-800">
                      {a.volunteerName} → <span className="text-gray-600">#{a.incidentId} {titleOf(a.incidentId)}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{a.rationale}</p>
                  </div>
                  {assigned[a.incidentId] ? (
                    <span className="shrink-0 flex items-center gap-1 text-xs text-emerald-600 font-medium">
                      <UserCheck size={14} /> Dispatched
                    </span>
                  ) : (
                    <button onClick={() => assign(a)}
                      className="shrink-0 text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-md font-medium transition">
                      Assign
                    </button>
                  )}
                </li>
              ))}
            </ol>
          )}

          {pending.length > 1 && (
            <button onClick={assignAll} className="text-sm text-indigo-700 hover:text-indigo-900 font-medium">
              Assign all {pending.length} →
            </button>
          )}

          {plan.unassignedNotes?.length > 0 && (
            <div className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-md px-3 py-2">
              <span className="font-semibold">Still waiting for a volunteer:</span> {plan.unassignedNotes.join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
