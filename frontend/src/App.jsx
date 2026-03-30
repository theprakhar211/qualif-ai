import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Component } from 'react'
import Setup from './pages/Setup'
import Interview from './pages/Interview'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import Register from './pages/Register'

// Global error boundary — catches any unhandled React crash
class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('App error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', background: '#0f0f0f', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: '1rem', padding: '2rem', textAlign: 'center'
        }}>
          <div style={{ fontSize: '32px' }}>⚠</div>
          <h2 style={{ fontSize: '20px', fontWeight: '600' }}>Something went wrong</h2>
          <p style={{ color: '#888', maxWidth: '400px', lineHeight: '1.6' }}>
            An unexpected error occurred. Your interview data is safe.
          </p>
          <button
            onClick={() => { this.setState({ hasError: false }); window.location.href = '/' }}
            style={{
              background: '#6366f1', color: '#fff', border: 'none',
              borderRadius: '8px', padding: '0.75rem 1.5rem',
              fontSize: '14px', fontWeight: '600', cursor: 'pointer', marginTop: '0.5rem'
            }}
          >
            Return to home
          </button>
          {this.state.error && (
            <p style={{ color: '#333', fontSize: '12px', marginTop: '1rem', fontFamily: 'monospace' }}>
              {this.state.error.message}
            </p>
          )}
        </div>
      )
    }
    return this.props.children
  }
}

const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('token')
  return token ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/login"    element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={
            <PrivateRoute><Setup /></PrivateRoute>
          }/>
          <Route path="/interview/:sessionId" element={
            <PrivateRoute><Interview /></PrivateRoute>
          }/>
          <Route path="/dashboard" element={
            <PrivateRoute><Dashboard /></PrivateRoute>
          }/>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
