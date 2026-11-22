import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import LegalPage from './LegalPage'
import './style.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {location.pathname === '/terms' || location.pathname === '/privacy' ? (
      <LegalPage page={location.pathname === '/terms' ? 'terms' : 'privacy'} />
    ) : (
      <App />
    )}
  </React.StrictMode>,
)
