// Finance Role-Based Visibility Script
// Handles showing/hiding menu items based on user role (accountant vs finance_accounting)

// Run immediately to prevent flickering - check document ready state
(function() {
    // Hide items immediately on script load (before DOM is ready)
    function hideItemsImmediately() {
        if (typeof document === 'undefined') return;
        // Use a style tag to hide ALL sidebar items immediately - prevents any flickering
        if (!document.getElementById('finance-role-visibility-inline-style')) {
            const style = document.createElement('style');
            style.id = 'finance-role-visibility-inline-style';
            style.textContent = '.accountant-restricted { display: none !important; } #sidebar > ul > li.nav-item { display: none !important; opacity: 0 !important; visibility: hidden !important; }';
            (document.head || document.getElementsByTagName('head')[0] || document.documentElement).appendChild(style);
        }
    }
    
    // Hide items immediately when script loads - BEFORE anything renders
    hideItemsImmediately();
    
    // Function to hide all items initially - prevents flickering
    function hideAllItemsInitially() {
        const allNavItems = document.querySelectorAll('#sidebar > ul > li.nav-item');
        allNavItems.forEach(item => {
            item.style.setProperty('display', 'none', 'important');
        });
    }
    
    function initRoleVisibility() {
        console.log('🔍 DEBUG: Starting finance role visibility script...');
        
        // Hide all items initially - they'll be shown based on role
        hideAllItemsInitially();
        
        // Function to hide accountant-restricted items (for accountants)
        function hideAccountantRestrictedItems() {
            console.log('🔍 DEBUG: Hiding accountant-restricted items for accountant');
            const accountantRestrictedItems = document.querySelectorAll('.accountant-restricted');
            accountantRestrictedItems.forEach(item => {
                item.style.setProperty('display', 'none', 'important');
                item.style.setProperty('opacity', '0', 'important');
                item.style.setProperty('visibility', 'hidden', 'important');
            });
        }
        
        // Function to show accountant-restricted items (for finance_accounting)
        function showAccountantRestrictedItems() {
            console.log('🔍 DEBUG: Showing accountant-restricted items for finance_accounting');
            const accountantRestrictedItems = document.querySelectorAll('.accountant-restricted');
            accountantRestrictedItems.forEach(item => {
                item.style.setProperty('display', 'block', 'important');
                item.style.setProperty('opacity', '1', 'important');
                item.style.setProperty('visibility', 'visible', 'important');
            });
        }
        
        // Function to configure menu for accountant
        function configureAccountantMenu() {
            console.log('🔍 DEBUG: Configuring menu for accountant');
            
            // Show all items except accountant-restricted
            const allNavItems = document.querySelectorAll('#sidebar > ul > li.nav-item');
            allNavItems.forEach(item => {
                if (item.classList.contains('accountant-restricted')) {
                    // Hide Cash Management for accountants
                    item.style.setProperty('display', 'none', 'important');
                    item.style.setProperty('opacity', '0', 'important');
                    item.style.setProperty('visibility', 'hidden', 'important');
                } else {
                    // Show all other items
                    item.style.setProperty('display', 'block', 'important');
                    item.style.setProperty('opacity', '1', 'important');
                    item.style.setProperty('visibility', 'visible', 'important');
                }
            });
        }
        
        // Function to show all items (for finance_accounting/admin)
        function showAllItems() {
            console.log('🔍 DEBUG: Showing all items for finance_accounting');
            const allNavItems = document.querySelectorAll('#sidebar ul li.nav-item');
            allNavItems.forEach(item => {
                // Show all items and restore visibility properties
                item.style.setProperty('display', 'block', 'important');
                item.style.setProperty('opacity', '1', 'important');
                item.style.setProperty('visibility', 'visible', 'important');
            });
        }
        
        fetch('/finance/check-session')
            .then(response => {
                console.log('🔍 DEBUG: Finance session API response received:', response.status);
                if (!response.ok) {
                    throw new Error('Failed to fetch session');
                }
                return response.json();
            })
            .then(data => {
                console.log('🔍 DEBUG: Finance session API data:', data);
                console.log('🔍 DEBUG: User role is:', data?.user?.role_name);
                const roleName = data?.user?.role_name || '';
                console.log('🔍 DEBUG: Role name value:', roleName);
                const roleLower = roleName.toLowerCase();
                
                // Check if role is accountant (exact match)
                const isAccountant = (roleLower === 'accountant' || 
                                     roleLower === 'accountant_staff') &&
                                    !roleLower.includes('finance_accounting'); // Exclude finance_accounting
                console.log('🔍 DEBUG: Is accountant?', isAccountant);
                
                if (isAccountant) {
                    console.log('🔍 DEBUG: User IS accountant, hiding Cash Management');
                    configureAccountantMenu();
                } else {
                    console.log('🔍 DEBUG: User is finance_accounting/admin, showing ALL items');
                    showAllItems();
                }
            })
            .catch(error => {
                console.log('🔍 DEBUG: Could not fetch user role:', error);
                // Fallback: show all items if API fails (finance_accounting view)
                console.log('🔍 DEBUG: API failed, defaulting to show all items (finance_accounting view)');
                showAllItems();
            });
    }
    
    // Expose function globally for immediate execution if needed
    window.initRoleVisibility = initRoleVisibility;
    
    // Run immediately if DOM is ready, otherwise wait for DOMContentLoaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initRoleVisibility);
    } else {
        // DOM is already loaded, run immediately
        initRoleVisibility();
    }
})();

