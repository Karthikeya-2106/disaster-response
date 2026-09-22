import { useRef } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { useWebSocket } from './hooks/useWebSocket'
import toast from 'react-hot-toast'
import Navbar from './components/Navbar'
import PrivateRoute from './components/PrivateRoute'
import AiEmergencyChat from './components/AiEmergencyChat'
import Login from './pages/Login'
import Signup from './pages/Signup'
import CitizenDashboard from './pages/CitizenDashboard'
import ReportIncident from './pages/ReportIncident'
import VolunteerDashboard from './pages/VolunteerDashboard'
import AdminDashboard from './pages/AdminDashboard'
import AdminVolunteers from './pages/AdminVolunteers'
import AnalyticsDashboard from './pages/AnalyticsDashboard'
import MapView from './pages/MapView'
import IncidentNavigation from './pages/IncidentNavigation'

export default function App() {
  const { user } = useAuth()
  const notifRef = useRef(null)

  // Global alert listener — every logged-in user gets emergency broadcasts
  useWebSocket(user ? ['/topic/alerts'] : [], (msg) => {
    if (msg.type === 'EMERGENCY_ALERT') {
      const p = msg.payload
      toast.error(`🚨 ${p.title}: ${p.message}`, { duration: 8000 })
      // Push to NotificationCenter
      if (notifRef.current) notifRef.current({ ...p })
    }
  })

  const home = user
    ? user.role === 'ADMIN' ? '/admin' : user.role === 'VOLUNTEER' ? '/volunteer' : '/citizen'
    : '/login'

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar notifRef={notifRef} />
      <Routes>
        <Route path="/login"  element={user ? <Navigate to={home} replace /> : <Login />} />
        <Route path="/signup" element={user ? <Navigate to={home} replace /> : <Signup />} />

        <Route path="/citizen" element={<PrivateRoute roles={['CITIZEN']}><CitizenDashboard /></PrivateRoute>} />
        <Route path="/report"  element={<PrivateRoute roles={['CITIZEN','VOLUNTEER','ADMIN']}><ReportIncident /></PrivateRoute>} />

        <Route path="/volunteer" element={<PrivateRoute roles={['VOLUNTEER']}><VolunteerDashboard /></PrivateRoute>} />

        <Route path="/admin"            element={<PrivateRoute roles={['ADMIN']}><AdminDashboard /></PrivateRoute>} />
        <Route path="/admin/volunteers" element={<PrivateRoute roles={['ADMIN']}><AdminVolunteers /></PrivateRoute>} />
        <Route path="/analytics"        element={<PrivateRoute roles={['ADMIN']}><AnalyticsDashboard /></PrivateRoute>} />

        <Route path="/map" element={<PrivateRoute><MapView /></PrivateRoute>} />
        <Route path="/navigate/:id" element={<PrivateRoute roles={['VOLUNTEER','ADMIN']}><IncidentNavigation /></PrivateRoute>} />
        <Route path="*"    element={<Navigate to={home} replace />} />
      </Routes>

      {/* AI Emergency Chat — visible on all authenticated pages */}
      {user && <AiEmergencyChat />}
    </div>
  )
}
