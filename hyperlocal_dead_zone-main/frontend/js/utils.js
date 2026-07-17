// Utility functions for frontend

/**
 * Loads navbar and footer components dynamically
 * @param {string} activePage - The name of the active page (e.g. 'home', 'map', 'report', 'about', 'dashboard')
 */
export async function loadComponents(activePage) {
  try {
    // Determine path prefix based on location (in case pages are in a subdirectory, though currently in root)
    const prefix = './components/';
    
    // Load Navbar
    const navPlaceholder = document.getElementById('navbar-placeholder');
    if (navPlaceholder) {
      const response = await fetch(`${prefix}navbar.html`);
      if (response.ok) {
        navPlaceholder.innerHTML = await response.text();
        
        // Highlight active link
        const activeLink = document.querySelector(`.navbar-link[data-page="${activePage}"]`);
        if (activeLink) {
          activeLink.classList.add('active');
        }
        
        // Setup mobile menu
        setupMobileMenu();
      } else {
        console.error('Failed to load navbar component.');
      }
    }

    // Load Footer
    const footerPlaceholder = document.getElementById('footer-placeholder');
    if (footerPlaceholder) {
      const response = await fetch(`${prefix}footer.html`);
      if (response.ok) {
        footerPlaceholder.innerHTML = await response.text();
      } else {
        console.error('Failed to load footer component.');
      }
    }
  } catch (error) {
    console.error('Error loading components:', error);
  }
}

/**
 * Sets up mobile menu navigation toggle logic
 */
function setupMobileMenu() {
  const toggle = document.getElementById('mobile-menu-toggle');
  const menu = document.getElementById('navbar-menu');
  
  if (toggle && menu) {
    toggle.addEventListener('click', () => {
      toggle.classList.toggle('active');
      menu.classList.toggle('active');
    });
  }
}

/**
 * Simple toast notification generator
 * @param {string} message - Message text
 * @param {'success' | 'warning' | 'error' | 'info'} type - Type of toast
 */
export function showNotification(message, type = 'info') {
  let container = document.getElementById('notification-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'notification-container';
    container.style.position = 'fixed';
    container.style.bottom = '24px';
    container.style.right = '24px';
    container.style.zIndex = '9999';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '12px';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'glass-panel';
  toast.style.padding = '12px 24px';
  toast.style.borderRadius = '8px';
  toast.style.display = 'flex';
  toast.style.alignItems = 'center';
  toast.style.gap = '12px';
  toast.style.animation = 'slideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards';
  toast.style.borderLeft = '4px solid';
  toast.style.fontSize = '0.9rem';
  toast.style.fontWeight = '500';

  const styles = {
    slideIn: `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
      }
    `
  };
  
  // Inject style if not already present
  if (!document.getElementById('toast-animation-styles')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'toast-animation-styles';
    styleEl.textContent = styles.slideIn;
    document.head.appendChild(styleEl);
  }

  let icon = 'ℹ️';
  let color = 'var(--accent-blue)';
  if (type === 'success') {
    icon = '✅';
    color = 'var(--color-success)';
  } else if (type === 'warning') {
    icon = '⚠️';
    color = 'var(--color-warning)';
  } else if (type === 'error') {
    icon = '❌';
    color = 'var(--color-danger)';
  }

  toast.style.borderLeftColor = color;
  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  container.appendChild(toast);

  // Auto-remove after 4 seconds
  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.3s forwards';
    setTimeout(() => {
      toast.remove();
      if (container.children.length === 0) {
        container.remove();
      }
    }, 300);
  }, 4000);
}
