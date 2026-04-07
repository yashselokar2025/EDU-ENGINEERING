import './index.css'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

// Apply saved theme immediately to prevent flash
const saved = localStorage.getItem('dmis_theme') || 'dark';
document.documentElement.setAttribute('data-theme', saved);

createRoot(document.getElementById('root')).render(<App />)

