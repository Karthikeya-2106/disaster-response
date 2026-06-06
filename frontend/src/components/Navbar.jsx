import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { AlertTriangle, LogOut, MapPin, LayoutDashboard, FileText, Users, BarChart2, Menu, X } from 'lucide-react'
import NotificationCenter from './NotificationCenter'
import { useState } from 'react'

export default function Navbar({ notifRef }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const loc = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  if (!user) return null

  const NavLink = ({ to, label, Icon }) => {
    const active = loc.pathname === to
    return (
      <Link
        to={to}
        onClick={() => setMobileOpen(false)}
        className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition ${
          active ? 'bg-white/20 text-white font-medium' : 'text-gray-100 hover:bg-white/10'
        }`}
      >
        <Icon size={16} /> {label}
      </Link>
    )
  }

  const links = {
    CITIZEN:   [{ to: '/citizen', l: 'Dashboard', I: LayoutDashboard }, { to: '/report', l: 'Report', I: FileText }, { to: '/map', l: 'Map', I: MapPin }],
    VOLUNTEER: [{ to: '/volunteer', l: 'Dashboard', I: LayoutDashboard }, { to: '/map', l: 'Map', I: MapPin }],
    ADMIN:     [{ to: '/admin', l: 'Dashboard', I: LayoutDashboard }, { to: '/analytics', l: 'Analytics', I: BarChart2 }, { to: '/map', l: 'Map', I: MapPin }, { to: '/admin/volunteers', l: 'Volunteers', I: Users }],
  }[user.role] || []

  return (
    <nav className="bg-brand-600 shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 text-white font-bold text-base">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
              <AlertTriangle size={16} className="text-white" />
            </div>
            <span className="hidden sm:inline">DisasterResponse</span>
            <span className="sm:hidden">DR</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {links.map(({ to, l, I }) => <NavLink key={to} to={to} label={l} Icon={I} />)}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            <NotificationCenter onNewAlert={notifRef} />
            <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-white/20">
              <div className="text-right hidden md:block">
                <div className="text-white text-sm font-medium leading-tight">{user.fullName}</div>
                <div className="text-white/60 text-xs">{user.role}</div>
              </div>
              <button
                onClick={() => { logout(); navigate('/login') }}
                className="flex items-center gap-1 text-white/80 hover:text-white text-sm transition"
                title="Logout"
              >
                <LogOut size={16} />
              </button>
            </div>
            {/* Mobile menu toggle */}
            <button
              className="md:hidden text-white p-1"
              onClick={() => setMobileOpen(o => !o)}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-white/20 px-4 py-3 space-y-1">
          {links.map(({ to, l, I }) => <NavLink key={to} to={to} label={l} Icon={I} />)}
          <button
            onClick={() => { logout(); navigate('/login') }}
            className="flex items-center gap-2 w-full px-3 py-2 text-gray-200 hover:bg-white/10 rounded-md text-sm"
          >
            <LogOut size={16} /> Logout ({user.fullName})
          </button>
        </div>
      )}
    </nav>
  )
}
