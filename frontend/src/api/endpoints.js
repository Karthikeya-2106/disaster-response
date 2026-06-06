import api from './client'

export const authApi = {
  login: (email, password) => api.post('/auth/login', { email, password }).then(r => r.data),
  signup: (data) => api.post('/auth/signup', data).then(r => r.data),
}

export const incidentApi = {
  list: () => api.get('/incidents').then(r => r.data),
  active: () => api.get('/incidents/active').then(r => r.data),
  nearby: (lat, lng, radiusKm = 10) => api.get('/incidents/nearby', { params: { lat, lng, radiusKm } }).then(r => r.data),
  bySeverity: (sev) => api.get(`/incidents/severity/${sev}`).then(r => r.data),
  myReports: () => api.get('/incidents/my-reports').then(r => r.data),
  assignedToMe: () => api.get('/incidents/assigned-to-me').then(r => r.data),
  get: (id) => api.get(`/incidents/${id}`).then(r => r.data),
  create: (data) => api.post('/incidents', data).then(r => r.data),
  uploadImage: (file, severity) => {
    const fd = new FormData()
    fd.append('file', file); fd.append('severity', severity)
    return api.post('/incidents/upload-image', fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data)
  },
  updateStatus: (id, status, progressNote) =>
    api.patch(`/incidents/${id}/status`, { status, progressNote }).then(r => r.data),
  assign: (id, volunteerId, volunteerName) =>
    api.post(`/incidents/${id}/assign`, { volunteerId, volunteerName }).then(r => r.data),
  accept: (id) => api.post(`/incidents/${id}/accept`).then(r => r.data),
  sos: (latitude, longitude, address) =>
    api.post('/incidents/sos', { latitude, longitude, address }).then(r => r.data),
}

export const shelterApi = {
  list: () => api.get('/shelters').then(r => r.data),
  nearby: (lat, lng, radiusKm = 10) => api.get('/shelters/nearby', { params: { lat, lng, radiusKm } }).then(r => r.data),
  create: (data) => api.post('/shelters', data).then(r => r.data),
}

export const volunteerApi = {
  updateLocation: (lat, lng, available) =>
    api.post('/volunteers/location', { latitude: lat, longitude: lng, available }).then(r => r.data),
  available: () => api.get('/volunteers/available').then(r => r.data),
}

export const adminApi = {
  stats: () => api.get('/admin/stats').then(r => r.data),
  volunteers: () => api.get('/admin/volunteers').then(r => r.data),
  broadcastAlert: (title, message, severity) =>
    api.post('/admin/broadcast-alert', { title, message, severity }).then(r => r.data),
  exportCsv: () => api.get('/admin/export/incidents.csv', { responseType: 'blob' }).then(r => r.data),
  auditLogs: () => api.get('/admin/audit-logs').then(r => r.data),
}

export const analyticsApi = {
  dashboard: () => api.get('/analytics/dashboard').then(r => r.data),
  timeline: (id) => api.get(`/analytics/incident/${id}/timeline`).then(r => r.data),
}

export const aiApi = {
  chat: (message) => api.post('/ai/chat', { message }).then(r => r.data),
  analyzeIncident: (title, description, disasterType, severity) =>
    api.post('/ai/analyze-incident', { title, description, disasterType, severity }).then(r => r.data),
}
