import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, Zap, Shield, Radio, Brain } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'

const DEMO_ACCOUNTS = [
  { label: 'Admin', icon: '👮', email: 'admin@disaster.com', password: 'admin123', color: 'bg-red-50 border-red-200 hover:bg-red-100' },
  { label: 'Volunteer', icon: '🚑', email: 'volunteer@disaster.com', password: 'vol123', color: 'bg-purple-50 border-purple-200 hover:bg-purple-100' },
  { label: 'Citizen', icon: '👤', email: 'citizen@disaster.com', password: 'cit123', color: 'bg-blue-50 border-blue-200 hover:bg-blue-100' },
]

const FEATURES = [
  { icon: Zap,    label: 'Real-Time Updates',   desc: 'WebSocket-powered live incident tracking' },
  { icon: Brain,  label: 'Claude AI Assistant', desc: 'AI severity analysis & emergency guidance' },
  { icon: Radio,  label: 'SOS Panic Button',    desc: 'One-tap emergency alert with geolocation' },
  { icon: Shield, label: 'Role-Based Access',   desc: 'Citizen · Volunteer · Admin workflows' },
]

export default function Login() {
  const [email, setEmail] = useState('admin@disaster.com')
  const [password, setPassword] = useState('admin123')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const data = await login(email, password)
      toast.success('Welcome back!')
      navigate(data.role === 'ADMIN' ? '/admin' : data.role === 'VOLUNTEER' ? '/volunteer' : '/citizen')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-red-950 to-gray-900 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-4xl flex flex-col lg:flex-row gap-8 items-center">
        {/* Left — branding */}
        <div className="flex-1 text-white max-w-md">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-brand-600 rounded-xl flex items-center justify-center shadow-lg shadow-red-900">
              <AlertTriangle size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">DisasterResponse</h1>
              <p className="text-white/60 text-xs">Coordination Platform</p>
            </div>
          </div>
          <h2 className="text-3xl font-bold leading-tight mb-3">
            Real-Time Emergency<br />
            <span className="text-brand-400">Response System</span>
          </h2>
          <p className="text-white/70 text-sm mb-8 leading-relaxed">
            A full-stack disaster coordination platform with AI-powered triage, live WebSocket updates,
            geospatial incident mapping, and multi-role response workflows.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {FEATURES.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="bg-white/10 backdrop-blur rounded-xl p-3 border border-white/10">
                <Icon size={16} className="text-brand-400 mb-1.5" />
                <div className="text-white text-xs font-semibold">{label}</div>
                <div className="text-white/50 text-[11px] mt-0.5">{desc}</div>
              </div>
            ))}
          </div>
          <div className="mt-6 flex gap-3 text-xs text-white/40">
            <span>React 18</span><span>·</span>
            <span>Spring Boot 3</span><span>·</span>
            <span>WebSocket</span><span>·</span>
            <span>Claude AI</span><span>·</span>
            <span>Docker</span>
          </div>
        </div>

        {/* Right — login form */}
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-7">
          <h3 className="text-lg font-bold text-gray-900 mb-5">Sign In</h3>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
            </div>
            <button disabled={loading}
              className="w-full bg-brand-600 text-white py-2.5 rounded-lg hover:bg-brand-700 disabled:opacity-50 transition font-medium text-sm shadow-lg shadow-red-200">
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
          <p className="text-sm text-center text-gray-500 mt-4">
            No account?{' '}
            <Link to="/signup" className="text-brand-600 hover:underline font-medium">Create one</Link>
          </p>

          {/* Quick login */}
          <div className="mt-5 pt-5 border-t border-gray-100">
            <p className="text-xs text-gray-400 mb-2 font-medium">Quick Demo Login</p>
            <div className="space-y-2">
              {DEMO_ACCOUNTS.map(a => (
                <button
                  key={a.label}
                  type="button"
                  onClick={() => { setEmail(a.email); setPassword(a.password) }}
                  className={`w-full flex items-center gap-2 px-3 py-2 border rounded-lg text-xs transition cursor-pointer text-left ${a.color}`}
                >
                  <span className="text-base">{a.icon}</span>
                  <div>
                    <div className="font-semibold text-gray-700">{a.label}</div>
                    <div className="text-gray-400">{a.email}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
