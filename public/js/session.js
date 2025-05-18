// Session management utilities
const SessionManager = {
    // Check session status
    async checkSession() {
        try {
            const response = await fetch('/hr/check-session', {
                credentials: 'include',
                headers: {
                    'Cache-Control': 'no-cache'
                }
            });

            if (!response.ok) {
                if (response.status === 401) {
                    this.handleSessionExpired();
                    return false;
                }
                throw new Error('Session check failed');
            }

            const data = await response.json();
            return data.user ? true : false;
        } catch (error) {
            console.error('Session check error:', error);
            this.handleSessionError();
            return false;
        }
    },

    // Handle session expiration
    handleSessionExpired() {
        // Clear any sensitive data
        localStorage.removeItem('userPreferences');
        sessionStorage.clear();

        // Show session expired message
        const message = 'Your session has expired. Please log in again.';
        if (window.showNotification) {
            window.showNotification(message, 'error');
        } else {
            alert(message);
        }

        // Redirect to login page
        setTimeout(() => {
            window.location.href = '/';
        }, 2000);
    },

    // Handle session errors
    handleSessionError() {
        const message = 'There was an error with your session. Please try logging in again.';
        if (window.showNotification) {
            window.showNotification(message, 'error');
        } else {
            alert(message);
        }
    },

    // Setup periodic session checks
    setupSessionChecks(interval = 5 * 60 * 1000) { // Check every 5 minutes
        // Initial check
        this.checkSession();

        // Setup periodic checks
        setInterval(() => {
            this.checkSession();
        }, interval);

        // Add visibility change listener
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                this.checkSession();
            }
        });
    },

    // Refresh session
    async refreshSession() {
        try {
            const response = await fetch('/hr/refresh-session', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Cache-Control': 'no-cache'
                }
            });

            if (!response.ok) {
                throw new Error('Session refresh failed');
            }

            return true;
        } catch (error) {
            console.error('Session refresh error:', error);
            return false;
        }
    }
};

// Initialize session checks when the script loads
document.addEventListener('DOMContentLoaded', () => {
    SessionManager.setupSessionChecks();
});

// Export for use in other files
window.SessionManager = SessionManager; 