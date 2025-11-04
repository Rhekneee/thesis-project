// Manufacturing Role-Based Visibility Script
// Handles showing/hiding menu items based on user role (foreman_1 to foreman_4 vs general_foreman)

// Run immediately to prevent flickering - check document ready state
(function() {
    // Hide items immediately on script load (before DOM is ready)
    function hideItemsImmediately() {
        if (typeof document === 'undefined') return;
        // Use a style tag to hide foreman-restricted items immediately - prevents any flickering
        if (!document.getElementById('manufacturing-role-visibility-inline-style')) {
            const style = document.createElement('style');
            style.id = 'manufacturing-role-visibility-inline-style';
            style.textContent = '.foreman-restricted { display: none !important; } #sidebar > ul > li.nav-item { display: none !important; opacity: 0 !important; visibility: hidden !important; }';
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
        console.log('🔍 DEBUG: Starting manufacturing role visibility script...');
        
        // Hide all items initially - they'll be shown based on role
        hideAllItemsInitially();
        
        // Function to hide foreman-restricted items (for foreman_1 to foreman_4)
        function hideForemanRestrictedItems() {
            console.log('🔍 DEBUG: Hiding foreman-restricted items for foreman');
            const foremanRestrictedItems = document.querySelectorAll('.foreman-restricted');
            foremanRestrictedItems.forEach(item => {
                item.style.setProperty('display', 'none', 'important');
                item.style.setProperty('opacity', '0', 'important');
                item.style.setProperty('visibility', 'hidden', 'important');
            });
        }
        
        // Helper function to hide specific items in Projects collapse
        function hideNonForemanInProjects() {
            const projectsCollapse = document.querySelector('#Projects');
            if (projectsCollapse) {
                const projectItems = projectsCollapse.querySelectorAll('li.nav-item');
                projectItems.forEach(item => {
                    const link = item.querySelector('a');
                    if (link) {
                        const href = link.getAttribute('href');
                        // Hide Developer Projects and Approved Projects
                        if (href === '/manufacturing/manufacturing_projects' || 
                            href === '/manufacturing/manufacturing_approved_project') {
                            item.style.setProperty('display', 'none', 'important');
                            item.style.setProperty('opacity', '0', 'important');
                            item.style.setProperty('visibility', 'hidden', 'important');
                        } else {
                            // Show Project Progress and other items
                            item.style.setProperty('display', 'block', 'important');
                            item.style.setProperty('opacity', '1', 'important');
                            item.style.setProperty('visibility', 'visible', 'important');
                        }
                    }
                });
            }
        }
        
        // Set up MutationObserver to watch for changes in Projects collapse
        function setupProjectsObserver() {
            const projectsCollapse = document.querySelector('#Projects');
            if (!projectsCollapse) return;
            
            // Watch for class changes (when collapse opens/closes)
            const observer = new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                        // If collapse is shown, re-hide non-foreman items
                        if (projectsCollapse.classList.contains('show')) {
                            setTimeout(() => {
                                hideNonForemanInProjects();
                            }, 100);
                        }
                    }
                });
            });
            
            observer.observe(projectsCollapse, {
                attributes: true,
                attributeFilter: ['class']
            });
            
            // Also listen for Bootstrap collapse events
            projectsCollapse.addEventListener('shown.bs.collapse', function() {
                hideNonForemanInProjects();
            });
            
            // Listen for any click on Projects parent
            const projectsParent = document.querySelector('a[data-bs-target="#Projects"]');
            if (projectsParent) {
                projectsParent.addEventListener('click', function() {
                    setTimeout(() => {
                        hideNonForemanInProjects();
                    }, 200);
                });
            }
        }
        
        // Function to configure menu for foreman_1 to foreman_4
        function configureForemanMenu() {
            console.log('🔍 DEBUG: Configuring menu for foreman (foreman_1 to foreman_4)');
            
            // Show all items except foreman-restricted
            const allNavItems = document.querySelectorAll('#sidebar > ul > li.nav-item');
            allNavItems.forEach(item => {
                if (item.classList.contains('foreman-restricted')) {
                    // Hide Ratings & Feedback, Foremen List for foremen
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
            
            // Special handling for Projects collapse
            // Hide Developer Projects and Approved Projects inside Projects
            hideNonForemanInProjects();
            
            // Set up observer and event listeners for Projects
            setupProjectsObserver();
        }
        
        // Function to show all items (for general_foreman/admin)
        function showAllItems() {
            console.log('🔍 DEBUG: Showing all items for general_foreman');
            const allNavItems = document.querySelectorAll('#sidebar ul li.nav-item');
            allNavItems.forEach(item => {
                // Show all items and restore visibility properties
                item.style.setProperty('display', 'block', 'important');
                item.style.setProperty('opacity', '1', 'important');
                item.style.setProperty('visibility', 'visible', 'important');
            });
            
            // Also show all items in Projects collapse
            const projectsCollapse = document.querySelector('#Projects');
            if (projectsCollapse) {
                const projectItems = projectsCollapse.querySelectorAll('li.nav-item');
                projectItems.forEach(item => {
                    item.style.setProperty('display', 'block', 'important');
                    item.style.setProperty('opacity', '1', 'important');
                    item.style.setProperty('visibility', 'visible', 'important');
                });
            }
        }
        
        fetch('/hr/check-session')
            .then(response => {
                console.log('🔍 DEBUG: Manufacturing session API response received:', response.status);
                if (!response.ok) {
                    throw new Error('Failed to fetch session');
                }
                return response.json();
            })
            .then(data => {
                console.log('🔍 DEBUG: Manufacturing session API data:', data);
                console.log('🔍 DEBUG: User role is:', data?.user?.role_name);
                const roleName = data?.user?.role_name || '';
                console.log('🔍 DEBUG: Role name value:', roleName);
                const roleLower = roleName.toLowerCase();
                
                // Check if role is foreman_1 to foreman_4 (exact match)
                const isForeman = (roleLower === 'foreman_1' || 
                                  roleLower === 'foreman_2' || 
                                  roleLower === 'foreman_3' || 
                                  roleLower === 'foreman_4') &&
                                 roleLower !== 'general_foreman'; // Exclude general_foreman
                console.log('🔍 DEBUG: Is foreman (foreman_1 to foreman_4)?', isForeman);
                
                if (isForeman) {
                    console.log('🔍 DEBUG: User IS foreman (foreman_1 to foreman_4), hiding restricted items');
                    configureForemanMenu();
                } else {
                    console.log('🔍 DEBUG: User is general_foreman/admin, showing ALL items');
                    showAllItems();
                }
            })
            .catch(error => {
                console.log('🔍 DEBUG: Could not fetch user role:', error);
                // Fallback: show all items if API fails (general_foreman view)
                console.log('🔍 DEBUG: API failed, defaulting to show all items (general_foreman view)');
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

