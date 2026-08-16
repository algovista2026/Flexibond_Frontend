import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Session ends when the tab closes (2026-08-15, security). The JWT + user profile live in
// sessionStorage, which the browser discards on tab close — so no explicit logout is needed and it
// cannot be defeated by simply killing the tab. A refresh (F5) keeps you signed in, because
// sessionStorage survives reloads within the same tab.
// This purges credentials left in localStorage by the previous build; without it an old token would
// linger on disk indefinitely, which is exactly what this change is meant to prevent.
// NOTE: `flexibond_device_id` deliberately STAYS in localStorage — it identifies the browser for
// new-device approval, and per-tab storage would make every tab look like an unknown device.
try {
  localStorage.removeItem('flexibond_token');
  localStorage.removeItem('flexibond_user');
} catch (_) { /* private mode / storage disabled — nothing to clean up */ }

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { percentBarPlugin } from './utils/percentBarPlugin';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  percentBarPlugin
);

// Set default ChartJS styles
ChartJS.defaults.font.family = "'Inter', sans-serif";
ChartJS.defaults.color = '#64748b';
ChartJS.defaults.plugins.tooltip.backgroundColor = 'rgba(10, 22, 40, 0.9)';
ChartJS.defaults.plugins.tooltip.padding = 12;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
