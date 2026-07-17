// Report Page Logic
import { loadComponents, showNotification } from './utils.js';
import CONFIG from './config.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Load common templates (Navbar and Footer)
  await loadComponents('report');

  // Initialize Radio card selectors style toggling
  initRadioCards();

  // Initialize GPS detection
  initGeolocation();

  // Initialize Form submit logic
  initFormSubmit();
});

/**
 * Custom Radio button selection class toggler
 */
function initRadioCards() {
  const radioContainers = ['provider-grid', 'issue-grid'];

  radioContainers.forEach(containerId => {
    const container = document.getElementById(containerId);
    if (!container) return;

    const cards = container.querySelectorAll('.radio-card');
    cards.forEach(card => {
      const input = card.querySelector('input[type="radio"]');

      // Update card visual on direct click
      card.addEventListener('click', () => {
        // Unselect siblings
        cards.forEach(c => c.classList.remove('selected'));
        // Select current
        card.classList.add('selected');
        input.checked = true;
      });
      
      // Sync on initial checked state if any
      if (input.checked) {
        card.classList.add('selected');
      }
    });
  });
}

/**
 * Handle GPS capturing via Geolocation API
 */
function initGeolocation() {
  const detectBtn = document.getElementById('btn-detect-gps');
  const statusIndicator = document.getElementById('status-indicator');
  const statusText = document.getElementById('status-text');
  const latInput = document.getElementById('latitude');
  const lngInput = document.getElementById('longitude');

  if (!detectBtn) return;

  function updateStatus(state, message) {
    statusIndicator.className = 'status-indicator';
    statusIndicator.classList.add(state);
    statusText.textContent = message;
  }

  function getGPSLocation() {
    if (!navigator.geolocation) {
      updateStatus('error', 'Geolocation not supported by browser');
      showNotification('Your browser does not support GPS Geolocation', 'error');
      return;
    }

    updateStatus('pending', 'Acquiring GPS signal...');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude.toFixed(6);
        const lng = position.coords.longitude.toFixed(6);

        latInput.value = lat;
        lngInput.value = lng;

        updateStatus('success', 'GPS Location Captured');
        showNotification('GPS coordinates captured successfully', 'success');
      },
      (error) => {
        let errorMsg = 'Failed to acquire location';
        if (error.code === error.PERMISSION_DENIED) {
          errorMsg = 'GPS Access Denied by User';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorMsg = 'Location unavailable';
        } else if (error.code === error.TIMEOUT) {
          errorMsg = 'Location request timeout';
        }
        updateStatus('error', errorMsg);
        showNotification(errorMsg, 'error');

        // Fallback mock coordinates (Hyderabad Center) for testing if access is blocked or unavailable
        console.warn('Geolocation failed. Setting standard coordinates for convenience.');
        latInput.value = CONFIG.MAP_DEFAULT_CENTER[0];
        lngInput.value = CONFIG.MAP_DEFAULT_CENTER[1];
        updateStatus('success', 'Mock Coordinates Applied (CORS/Fallback)');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  }

  // Trigger on load
  getGPSLocation();

  // Re-trigger on click
  detectBtn.addEventListener('click', getGPSLocation);
}

/**
 * Validate and submit the report form
 */
function initFormSubmit() {
  const form = document.getElementById('report-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const providerInput = form.querySelector('input[name="provider"]:checked');
    const issueInput = form.querySelector('input[name="issue"]:checked');
    const lat = document.getElementById('latitude').value;
    const lng = document.getElementById('longitude').value;
    const comments = document.getElementById('comments').value;

    // Validations
    if (!providerInput) {
      showNotification('Please select a mobile network operator', 'warning');
      return;
    }
    if (!issueInput) {
      showNotification('Please select the type of issue', 'warning');
      return;
    }
    if (!lat || !lng) {
      showNotification('GPS Coordinates are required. Please share location.', 'warning');
      return;
    }

    const payload = {
      latitude: parseFloat(lat),
      longitude: parseFloat(lng),
      provider: providerInput.value,
      issue: issueInput.value,
      comments: comments.trim(),
      timestamp: new Date().toISOString()
    };

    try {
      // Send report to backend API first
      const response = await fetch(`${CONFIG.API_BASE_URL}/reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      // Handle non-OK responses with the actual error message
      if (!response.ok) {
        let errorMsg = `Server error (${response.status})`;
        try {
          const errorData = await response.json();
          errorMsg = errorData.detail || errorMsg;
        } catch {
          errorMsg = await response.text() || errorMsg;
        }
        showNotification(errorMsg, 'error');
        return;
      }

      // Backend saved successfully
      const dbRecord = await response.json();
      console.log('Successfully saved to backend database:', dbRecord);

      // Sync localStorage from the backend to keep it in perfect sync
      try {
        const listRes = await fetch(`${CONFIG.API_BASE_URL}/reports`);
        if (listRes.ok) {
          const allReports = await listRes.json();
          localStorage.setItem('deadzone_reports', JSON.stringify(allReports));
        }
      } catch (syncErr) {
        console.warn('Report saved but failed to sync list from database.', syncErr);
      }

      showNotification('Complaint submitted successfully!', 'success');

      // Redirect to map after short delay to show success
      setTimeout(() => {
        window.location.href = 'map.html';
      }, 1200);

    } catch (err) {
      console.error('Error submitting report:', err);
      showNotification('Backend server is unreachable. Please ensure the server is running.', 'error');
    }
  });
}
