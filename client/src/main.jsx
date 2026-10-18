import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './styles/theme.css'
import './styles/layout.css'
import './styles/roles.css'
import './styles/lane-local.css'
import './styles/customer-commerce.css'
import './styles/feature-auth.css'
import App from './App.jsx'
import { AuthProvider } from './auth.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)