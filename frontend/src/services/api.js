import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  headers: { 'Content-Type': 'application/json' },
  timeout: 60000,
})

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  res => res,
  async err => {
    const config = err.config

    // Retry once on network errors or 503 (server waking up)
    if (!config._retry && (!err.response || err.response.status === 503)) {
      config._retry = true
      await new Promise(resolve => setTimeout(resolve, 3000))
      return api(config)
    }

    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }

    return Promise.reject(err)
  }
)

export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login:    (data) => api.post('/auth/login', data),
  me:       ()     => api.get('/auth/me')
}

export const interviewAPI = {
  start:        (data)      => api.post('/interview/start', data),
  answer:       (data)      => api.post('/interview/answer', data),
  submitAnswer: (id, data)  => api.post(`/interview/submit-answer/${id}`, data),
  nextQuestion: (id)        => api.post(`/interview/next-question/${id}`),
  endSession:   (id)        => api.post(`/interview/end/${id}`),
  getSession:   (id)        => api.get(`/interview/session/${id}`),
  evaluate:     (id)        => api.post(`/interview/evaluate/${id}`),
}

export const dashboardAPI = {
  getSessions: ()   => api.get('/dashboard/sessions'),
  getSession:  (id) => api.get(`/dashboard/session/${id}`),
  getStats:    ()   => api.get('/dashboard/stats'),
  getInsights: ()   => api.get('/dashboard/insights'),
  getSkills: () => api.get('/dashboard/skills'),
}

export const resumeAPI = {
  upload:  (formData) => api.post('/resume/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getmine: () => api.get('/resume/me'),
}

export default api