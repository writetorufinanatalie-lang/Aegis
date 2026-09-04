import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import Business from './Business'
import ErrorBoundary from './ErrorBoundary'
import './index.css'

// Top-level split between the worker app and the completely separate business/lender portal —
// a real URL boundary (#/business/...), not just a UI toggle, so the two can never be confused
// and each keeps its own auth realm (see Business.tsx and App.tsx).
function Root() {
  const [isBusiness, setIsBusiness] = useState(window.location.hash.startsWith('#/business'))
  useEffect(() => {
    const onHashChange = () => setIsBusiness(window.location.hash.startsWith('#/business'))
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])
  return isBusiness
    ? <Business onExit={() => { window.location.hash = '' }} />
    : <App onOpenBusiness={() => { window.location.hash = '/business' }} />
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Root />
    </ErrorBoundary>
  </React.StrictMode>,
)
