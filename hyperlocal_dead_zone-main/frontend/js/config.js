// Configuration file for Frontend
const CONFIG = {
  API_BASE_URL: window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
    ? 'http://127.0.0.1:8000/api'
    : 'https://deadzone-backend.onrender.com/api', // Update later if deployed
  MAP_DEFAULT_CENTER: [17.422, 78.488], // Default center (Hyderabad coordinates)
  MAP_DEFAULT_ZOOM: 13,
  REPORT_THRESHOLD: 3,
  RADIUS_THRESHOLD_METERS: 200,
  TIME_WINDOW_MINUTES: 30
};
export default CONFIG;
