// Dashboard Logic
import { loadComponents } from './utils.js';
import CONFIG from './config.js';

let reports = [];

document.addEventListener('DOMContentLoaded', async () => {
  // Load common templates (Navbar and Footer)
  await loadComponents('dashboard');

  // Load database/local reports
  await loadReports();

  // Process data & render UI components
  renderDashboard();
});

/**
 * Loads reports from Backend API. If offline, falls back to LocalStorage or seeds defaults.
 */
async function loadReports() {
  try {
    const res = await fetch(`${CONFIG.API_BASE_URL}/reports`);
    if (res.ok) {
      reports = await res.json();
      localStorage.setItem('deadzone_reports', JSON.stringify(reports));
      console.log('Loaded dashboard reports from database API');
      return;
    }
  } catch (err) {
    console.warn('Backend offline. Loading dashboard reports from local storage fallback.', err);
  }

  const localData = localStorage.getItem('deadzone_reports');
  if (localData) {
    reports = JSON.parse(localData);
  } else {
    // Generate default mock data if dashboard is opened first
    const baseLat = CONFIG.MAP_DEFAULT_CENTER[0];
    const baseLng = CONFIG.MAP_DEFAULT_CENTER[1];
    reports = [
      {
        latitude: baseLat + 0.002,
        longitude: baseLng - 0.003,
        provider: 'Jio',
        issue: 'No Signal',
        comments: 'No network inside the basement.',
        timestamp: new Date(Date.now() - 5 * 60000).toISOString()
      },
      {
        latitude: baseLat + 0.0018,
        longitude: baseLng - 0.0028,
        provider: 'Jio',
        issue: 'Call Drop',
        comments: 'Calls drop immediately.',
        timestamp: new Date(Date.now() - 10 * 60000).toISOString()
      },
      {
        latitude: baseLat + 0.0022,
        longitude: baseLng - 0.0029,
        provider: 'Jio',
        issue: 'Weak Signal',
        comments: 'Hardly 1 bar.',
        timestamp: new Date(Date.now() - 15 * 60000).toISOString()
      },
      {
        latitude: baseLat - 0.004,
        longitude: baseLng + 0.005,
        provider: 'Airtel',
        issue: 'Slow Internet',
        comments: 'Speeds below 50Kbps.',
        timestamp: new Date(Date.now() - 40 * 60000).toISOString()
      },
      {
        latitude: baseLat + 0.006,
        longitude: baseLng + 0.001,
        provider: 'VI',
        issue: 'No Signal',
        comments: 'Complete network blackout.',
        timestamp: new Date(Date.now() - 2 * 3600000).toISOString()
      }
    ];
    localStorage.setItem('deadzone_reports', JSON.stringify(reports));
  }
}

/**
 * Calculates distance in meters
 */
function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const deltaPhi = (lat2 - lat1) * Math.PI / 180;
  const deltaLambda = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate dead zone clusters
 */
function calculateDeadZones() {
  const clusters = [];
  const timeLimitMs = CONFIG.TIME_WINDOW_MINUTES * 60 * 1000;

  reports.forEach(ref => {
    const refTime = new Date(ref.timestamp).getTime();
    
    const nearby = reports.filter(other => {
      const dist = getDistanceMeters(ref.latitude, ref.longitude, other.latitude, other.longitude);
      const otherTime = new Date(other.timestamp).getTime();
      const timeDiff = Math.abs(refTime - otherTime);
      
      return ref.provider === other.provider && 
             dist <= CONFIG.RADIUS_THRESHOLD_METERS && 
             timeDiff <= timeLimitMs;
    });

    if (nearby.length >= CONFIG.REPORT_THRESHOLD) {
      const avgLat = nearby.reduce((sum, r) => sum + r.latitude, 0) / nearby.length;
      const avgLng = nearby.reduce((sum, r) => sum + r.longitude, 0) / nearby.length;
      
      const duplicate = clusters.some(c => 
        getDistanceMeters(avgLat, avgLng, c.lat, c.lng) < 50
      );

      if (!duplicate) {
        clusters.push({
          lat: avgLat,
          lng: avgLng,
          provider: ref.provider,
          reports: nearby
        });
      }
    }
  });

  return clusters;
}

/**
 * Render all overview stats, bar graphs, and logs table
 */
function renderDashboard() {
  // 1. Calculate Clusters (Dead Zones)
  const deadZones = calculateDeadZones();
  
  // 2. Set Overview Numbers
  document.getElementById('stat-total-reports').textContent = reports.length;
  document.getElementById('stat-dead-zones').textContent = deadZones.length;
  document.getElementById('stat-alerts-sent').textContent = deadZones.length;

  // 3. Provider Distribution Calculations
  const providers = ['Airtel', 'Jio', 'VI', 'BSNL'];
  const providerCounts = {};
  providers.forEach(p => providerCounts[p] = 0);
  
  reports.forEach(r => {
    if (providerCounts[r.provider] !== undefined) {
      providerCounts[r.provider]++;
    }
  });

  const providerBreakdownContainer = document.getElementById('provider-breakdown-container');
  providerBreakdownContainer.innerHTML = '';
  
  providers.forEach(p => {
    const count = providerCounts[p];
    const percentage = reports.length > 0 ? ((count / reports.length) * 100).toFixed(0) : 0;
    
    const itemHTML = `
      <div class="breakdown-item">
        <div class="breakdown-item-header">
          <span>${p}</span>
          <span>${count} reports (${percentage}%)</span>
        </div>
        <div class="breakdown-progress-container">
          <div class="breakdown-progress-bar ${p}" style="width: ${percentage}%"></div>
        </div>
      </div>
    `;
    providerBreakdownContainer.insertAdjacentHTML('beforeend', itemHTML);
  });

  // 4. Issue Type Distribution Calculations
  const issues = ['No Signal', 'Weak Signal', 'Call Drop', 'Slow Internet'];
  const issueCounts = {};
  issues.forEach(i => issueCounts[i] = 0);
  
  reports.forEach(r => {
    if (issueCounts[r.issue] !== undefined) {
      issueCounts[r.issue]++;
    }
  });

  const issueBreakdownContainer = document.getElementById('issue-breakdown-container');
  issueBreakdownContainer.innerHTML = '';
  
  issues.forEach(i => {
    const count = issueCounts[i];
    const percentage = reports.length > 0 ? ((count / reports.length) * 100).toFixed(0) : 0;
    
    const itemHTML = `
      <div class="breakdown-item">
        <div class="breakdown-item-header">
          <span>${i}</span>
          <span>${count} reports (${percentage}%)</span>
        </div>
        <div class="breakdown-progress-container">
          <div class="breakdown-progress-bar issue" style="width: ${percentage}%"></div>
        </div>
      </div>
    `;
    issueBreakdownContainer.insertAdjacentHTML('beforeend', itemHTML);
  });

  // 5. Recent Logs Table Rendering
  const tbody = document.getElementById('recent-logs-tbody');
  tbody.innerHTML = '';

  if (reports.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No reports registered.</td></tr>`;
    return;
  }

  // Helper to check if a report is part of any deadzone cluster
  function isReportInCluster(report) {
    return deadZones.some(dz => 
      dz.provider === report.provider &&
      dz.reports.some(r => r.latitude === report.latitude && r.longitude === report.longitude)
    );
  }

  // Show newest first (limit to 10 for dashboard preview)
  const previewReports = [...reports].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 10);

  previewReports.forEach(r => {
    const inCluster = isReportInCluster(r);
    const dateObj = new Date(r.timestamp);
    const timeString = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + dateObj.toLocaleDateString();
    
    const statusHTML = inCluster 
      ? `<span class="status-tag active">🔴 Active Alert</span>`
      : `<span class="status-tag monitoring">🟡 Monitoring</span>`;

    const rowHTML = `
      <tr>
        <td><span class="provider-badge ${r.provider}">${r.provider}</span></td>
        <td style="font-weight: 500;">${r.issue}</td>
        <td style="font-family: monospace; color: var(--text-secondary); font-size: 0.8rem;">
          ${r.latitude.toFixed(4)}, ${r.longitude.toFixed(4)}
        </td>
        <td style="color: var(--text-secondary); font-size: 0.85rem;">${timeString}</td>
        <td>${statusHTML}</td>
      </tr>
    `;
    tbody.insertAdjacentHTML('beforeend', rowHTML);
  });
}
