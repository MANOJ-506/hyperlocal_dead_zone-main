// Home Page Logic
import { loadComponents } from './utils.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Load common templates (Navbar and Footer)
  await loadComponents('home');
});
