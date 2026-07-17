// Live Map Page Logic
import { loadComponents } from './utils.js';
import CONFIG from './config.js';

let map;
let markerLayerGroup;
let clusterLayerGroup;
let reports = [];

document.addEventListener('DOMContentLoaded', async () => {
  // Load common templates (Navbar and Footer)
  await loadComponents('map');

  // Load and normalize reports (LocalStorage + Mock fallbacks)
  await initReportsData();

  // Initialize Leaflet Map
  initMap();

  // Draw markers & clusters
  renderMapLayers();

  // Register filter event listeners
  document.getElementById('filter-provider').addEventListener('change', renderMapLayers);
  document.getElementById('filter-issue').addEventListener('change', renderMapLayers);
});

/**
 * Loads reports from Backend API. If offline, falls back to LocalStorage or seeds mocks.
 */
async function initReportsData() {
  try {
    const res = await fetch(`${CONFIG.API_BASE_URL}/reports`);
    if (res.ok) {
      reports = await res.json();
      localStorage.setItem('deadzone_reports', JSON.stringify(reports));
      console.log('Loaded reports from database API');
      return;
    }
  } catch (err) {
    console.warn('Backend offline. Loading reports from local storage fallback.', err);
  }

  const localData = localStorage.getItem('deadzone_reports');
  if (localData) {
    reports = JSON.parse(localData);
  } else {
    // Generate realistic professional mock reports around default center (Hyderabad)
    const baseLat = CONFIG.MAP_DEFAULT_CENTER[0];
    const baseLng = CONFIG.MAP_DEFAULT_CENTER[1];
    
    reports = [
      {
        latitude: baseLat + 0.002,
        longitude: baseLng - 0.003,
        provider: 'Jio',
        issue: 'No Signal',
        comments: 'No network inside the basement and lower floors.',
        timestamp: new Date(Date.now() - 5 * 60000).toISOString() // 5 mins ago
      },
      {
        latitude: baseLat + 0.0018,
        longitude: baseLng - 0.0028,
        provider: 'Jio',
        issue: 'Call Drop',
        comments: 'Calls drop immediately upon connecting.',
        timestamp: new Date(Date.now() - 10 * 60000).toISOString() // 10 mins ago
      },
      {
        latitude: baseLat + 0.0022,
        longitude: baseLng - 0.0029,
        provider: 'Jio',
        issue: 'Weak Signal',
        comments: 'Hardly 1 bar of signal outside the building.',
        timestamp: new Date(Date.now() - 15 * 60000).toISOString() // 15 mins ago
      },
      {
        latitude: baseLat - 0.004,
        longitude: baseLng + 0.005,
        provider: 'Airtel',
        issue: 'Slow Internet',
        comments: '4G is active but speeds are below 50Kbps.',
        timestamp: new Date(Date.now() - 40 * 60000).toISOString() // 40 mins ago
      },
      {
        latitude: baseLat + 0.006,
        longitude: baseLng + 0.001,
        provider: 'VI',
        issue: 'No Signal',
        comments: 'Complete network blackout in the residential park.',
        timestamp: new Date(Date.now() - 2 * 3600000).toISOString() // 2 hours ago
      },
      {
        latitude: baseLat - 0.002,
        longitude: baseLng - 0.005,
        provider: 'BSNL',
        issue: 'Weak Signal',
        comments: 'Signal fluctuations make voice calls distorted.',
        timestamp: new Date(Date.now() - 24 * 3600000).toISOString() // 1 day ago
      }
    ];

    // Seed local storage so user can inspect it and play around
    localStorage.setItem('deadzone_reports', JSON.stringify(reports));
  }
}

/**
 * Set up the Leaflet map element
 */
function initMap() {
  // If reports exist, center map on the latest reported location. Otherwise use default.
  const centerCoords = reports.length > 0 
    ? [reports[0].latitude, reports[0].longitude] 
    : CONFIG.MAP_DEFAULT_CENTER;

  map = L.map('map', {
    zoomControl: false // Position zoom control elsewhere for cleaner look
  }).setView(centerCoords, CONFIG.MAP_DEFAULT_ZOOM);

  // Position zoom controls in top-left
  L.control.zoom({ position: 'topleft' }).addTo(map);

  // OpenStreetMap Tile Layer
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  // Layer groups for markers and deadzone cluster circles
  markerLayerGroup = L.layerGroup().addTo(map);
  clusterLayerGroup = L.layerGroup().addTo(map);
}

/**
 * Calculates distance between two coordinates in meters using the Haversine formula
 */
function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const deltaPhi = (lat2 - lat1) * Math.PI / 180;
  const deltaLambda = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

/**
 * Identify clusters of 3+ reports within a 200m radius in a 30m window
 */
function detectDeadZones(filteredReports) {
  const deadZones = [];
  const timeLimitMs = CONFIG.TIME_WINDOW_MINUTES * 60 * 1000;

  for (let i = 0; i < filteredReports.length; i++) {
    const ref = filteredReports[i];
    const refTime = new Date(ref.timestamp).getTime();
    
    // Find matching reports within 200m and 30 minutes of the reference report
    const nearby = filteredReports.filter(other => {
      const dist = getDistanceMeters(ref.latitude, ref.longitude, other.latitude, other.longitude);
      const otherTime = new Date(other.timestamp).getTime();
      const timeDiff = Math.abs(refTime - otherTime);
      
      // Match same provider and within proximity constraints
      return ref.provider === other.provider && 
             dist <= CONFIG.RADIUS_THRESHOLD_METERS && 
             timeDiff <= timeLimitMs;
    });

    // If threshold met (3 or more matching complaints)
    if (nearby.length >= CONFIG.REPORT_THRESHOLD) {
      // Calculate cluster center average coordinates
      const avgLat = nearby.reduce((sum, r) => sum + r.latitude, 0) / nearby.length;
      const avgLng = nearby.reduce((sum, r) => sum + r.longitude, 0) / nearby.length;

      // Check if we already registered a similar cluster center
      const duplicate = deadZones.some(dz => 
        getDistanceMeters(avgLat, avgLng, dz.lat, dz.lng) < 50
      );

      if (!duplicate) {
        deadZones.push({
          lat: avgLat,
          lng: avgLng,
          provider: ref.provider,
          count: nearby.length
        });
      }
    }
  }

  return deadZones;
}

/**
 * Filter, group, and render markers/clusters onto map
 */
function renderMapLayers() {
  // Clear previous layers
  markerLayerGroup.clearLayers();
  clusterLayerGroup.clearLayers();

  const selectedProvider = document.getElementById('filter-provider').value;
  const selectedIssue = document.getElementById('filter-issue').value;

  // Filter reports
  const filtered = reports.filter(r => {
    const providerMatch = selectedProvider === 'All' || r.provider === selectedProvider;
    const issueMatch = selectedIssue === 'All' || r.issue === selectedIssue;
    return providerMatch && issueMatch;
  });

  // 1. Detect and Draw Dead Zone Highlight Proximities
  const deadZones = detectDeadZones(filtered);
  deadZones.forEach(dz => {
    const circle = L.circle([dz.lat, dz.lng], {
      color: '#dc2626',
      fillColor: '#dc2626',
      fillOpacity: 0.12,
      weight: 1,
      dashArray: '5, 5',
      radius: CONFIG.RADIUS_THRESHOLD_METERS
    });

    circle.bindTooltip(`Potential ${dz.provider} Dead Zone (${dz.count} reports)`, {
      permanent: false,
      direction: 'top'
    });

    clusterLayerGroup.addLayer(circle);
  });

  // 2. Draw Complaint Markers
  filtered.forEach(report => {
    let color = '#3b82f6'; // default
    if (report.provider === 'Airtel') color = '#dc2626';
    else if (report.provider === 'Jio') color = '#0284c7';
    else if (report.provider === 'VI') color = '#d97706';
    else if (report.provider === 'BSNL') color = '#16a34a';

    const marker = L.circleMarker([report.latitude, report.longitude], {
      radius: 8,
      fillColor: color,
      color: '#ffffff',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.95
    });

    // Formatting date
    const dateObj = new Date(report.timestamp);
    const timeString = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateString = dateObj.toLocaleDateString();

    const popupContent = `
      <div class="popup-details">
        <div class="popup-header">
          <span class="popup-provider">${report.provider}</span>
          <span class="provider-tag ${report.provider}">${report.provider}</span>
        </div>
        <div class="popup-issue">⚠️ ${report.issue}</div>
        <div class="popup-time">🕒 ${timeString} - ${dateString}</div>
        ${report.comments ? `<div class="popup-comments">${report.comments}</div>` : ''}
      </div>
    `;

    marker.bindPopup(popupContent, {
      className: 'custom-popup',
      closeButton: false
    });

    markerLayerGroup.addLayer(marker);
  });
}
