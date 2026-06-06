import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'

export default function Signup() {
  const [form, setForm] = useState({ email: '', password: '', fullName: '', phone: '', role: 'CITIZEN' })
  const [loading, setLoading] = useState(false)
  const { signup } = useAuth()
  const navigate = useNavigate()

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const data = await signup(form)
      toast.success('Account created!')
      navigate(data.role === 'ADMIN' ? '/admin' : data.role === 'VOLUNTEER' ? '/volunteer' : '/citizen')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Signup failed')
    } finally { setLoading(false) }
  }

  const u = (k, v) => setForm({ ...form, [k]: v })

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-4 py-6 bg-gradient-to-br from-brand-50 to-amber-50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <div className="flex flex-col items-center text-center mb-5">
          <div className="bg-brand-600 rounded-full p-3 mb-3"><AlertTriangle className="text-white"/></div>
          <h1 className="text-2xl font-bold">Create Account</h1>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <input required placeholder="Full name" value={form.fullName} onChange={(e)=>u('fullName', e.target.value)}
                 className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500" />
          <input required type="email" placeholder="Email" value={form.email} onChange={(e)=>u('email', e.target.value)}
                 className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500" />
          <input required type="password" placeholder="Password (min 6 chars)" value={form.password} onChange={(e)=>u('password', e.target.value)}
                 className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500" />
          <input placeholder="Phone (optional)" value={form.phone} onChange={(e)=>u('phone', e.target.value)}
                 className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500" />
          <select value={form.role} onChange={(e)=>u('role', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500">
            <option value="CITIZEN">Citizen — Report disasters</option>
            <option value="VOLUNTEER">Volunteer — Help with rescue</option>
            <option value="ADMIN">Admin — Coordinate response</option>
          </select>
          <button disabled={loading} className="w-full bg-brand-600 text-white py-2 rounded-lg hover:bg-brand-700 disabled:opacity-50">
            {loading ? 'Creating...' : 'Create Account'}
          </button>
        </form>
        <p className="text-sm text-center text-gray-600 mt-4">
          Already have an account? <Link to="/login" className="text-brand-600 hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
