import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { adminApi, incidentApi } from '../api/endpoints'

export default function AdminVolunteers() {
  const [volunteers, setVolunteers] = useState([])
  const [unassigned, setUnassigned] = useState([])

  const load = async () => {
    try {
      const [vols, all] = await Promise.all([adminApi.volunteers(), incidentApi.active()])
      setVolunteers(vols)
      setUnassigned(all.filter(i => !i.assignedVolunteerId))
    } catch (e) { toast.error('Failed to load') }
  }
  useEffect(() => { load() }, [])

  const assign = async (incidentId, vol) => {
    try {
      await incidentApi.assign(incidentId, vol.id, vol.fullName)
      toast.success(`Assigned to ${vol.fullName}`)
      load()
    } catch (e) { toast.error('Assign failed') }
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Volunteers</h1>
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr><th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">Phone</th><th className="p-3">Status</th></tr>
          </thead>
          <tbody>
            {volunteers.map((v) => (
              <tr key={v.id} className="border-t">
                <td className="p-3">{v.fullName}</td>
                <td className="p-3">{v.email}</td>
                <td className="p-3">{v.phone || '—'}</td>
                <td className="p-3">{v.enabled ? <span className="text-emerald-600">Active</span> : <span className="text-gray-400">Disabled</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {unassigned.length > 0 && (
        <>
          <h2 className="text-lg font-semibold mt-8 mb-3">Quick Assign — Unassigned Incidents</h2>
          <div className="space-y-2">
            {unassigned.map((i) => (
              <div key={i.id} className="bg-white p-3 rounded-lg shadow flex flex-wrap items-center gap-3">
                <span className={`text-xs px-2 py-0.5 rounded-full sev-${i.severity}`}>{i.severity}</span>
                <span className="font-medium">{i.title}</span>
                <span className="text-xs text-gray-500">{i.address || `${i.latitude.toFixed(2)},${i.longitude.toFixed(2)}`}</span>
                <div className="ml-auto flex gap-2">
                  {volunteers.slice(0, 3).map((v) => (
                    <button key={v.id} onClick={()=>assign(i.id, v)} className="text-xs px-2 py-1 border rounded hover:bg-gray-50">
                      Assign {v.fullName}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
