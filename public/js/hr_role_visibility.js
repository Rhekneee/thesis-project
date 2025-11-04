// HR Role-Based Visibility Script
// Handles showing/hiding menu items based on user role (recruitment staff vs admin)

// Run immediately to prevent flickering - check document ready state
(function() {
    // Hide items immediately on script load (before DOM is ready)
    function hideItemsImmediately() {
        if (typeof document === 'undefined') return;
        // Use a style tag to hide ALL sidebar items immediately - prevents any flickering
        if (!document.getElementById('hr-role-visibility-inline-style')) {
            const style = document.createElement('style');
            style.id = 'hr-role-visibility-inline-style';
            style.textContent = '.recruitment-only, .payroll-restricted { display: none !important; } #sidebar > ul > li.nav-item { display: none !important; opacity: 0 !important; visibility: hidden !important; }';
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
        console.log('🔍 DEBUG: Starting recruitment visibility script...');
        
        // Hide all items initially - they'll be shown based on role
        hideAllItemsInitially();
        
        // Function to show recruitment items (for recruitment staff)
        function showRecruitmentItems() {
            console.log('🔍 DEBUG: Showing recruitment items for recruitment staff');
            const recruitmentItems = document.querySelectorAll('.recruitment-only');
            recruitmentItems.forEach(item => {
                item.style.setProperty('display', 'block', 'important');
            });
        }
        
        // Function to hide recruitment items (for admin)
        function hideRecruitmentItems() {
            console.log('🔍 DEBUG: Hiding recruitment items for admin');
            const recruitmentItems = document.querySelectorAll('.recruitment-only');
            recruitmentItems.forEach(item => {
                item.style.setProperty('display', 'none', 'important');
            });
        }
    
    // Helper function to hide non-recruitment items in Employee Management
    function hideNonRecruitmentInEmployeeManagement() {
        const empCollapse = document.querySelector('#Employee');
        if (empCollapse) {
            const empItems = empCollapse.querySelectorAll('li.nav-item');
            empItems.forEach(item => {
                if (!item.classList.contains('recruitment-only')) {
                    // Hide all non-recruitment items inside Employee Management with !important
                    item.style.setProperty('display', 'none', 'important');
                } else {
                    // Show recruitment-only items (like Employee Documents)
                    item.style.setProperty('display', 'block', 'important');
                }
            });
        }
    }
    
    // Set up MutationObserver to watch for changes in Employee Management collapse
    function setupEmployeeManagementObserver() {
        const empCollapse = document.querySelector('#Employee');
        if (!empCollapse) return;
        
        // Watch for class changes (when collapse opens/closes)
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    // If collapse is shown, re-hide non-recruitment items
                    if (empCollapse.classList.contains('show')) {
                        setTimeout(() => {
                            hideNonRecruitmentInEmployeeManagement();
                        }, 100);
                    }
                }
            });
        });
        
        observer.observe(empCollapse, {
            attributes: true,
            attributeFilter: ['class']
        });
        
        // Also listen for Bootstrap collapse events
        empCollapse.addEventListener('shown.bs.collapse', function() {
            hideNonRecruitmentInEmployeeManagement();
        });
        
        // Listen for any click on Employee Management parent
        const empParent = document.querySelector('a[data-bs-target="#Employee"]');
        if (empParent) {
            empParent.addEventListener('click', function() {
                setTimeout(() => {
                    hideNonRecruitmentInEmployeeManagement();
                }, 200);
            });
        }
    }
    
    // Function to configure menu for recruitment staff
    function configureRecruitmentMenu() {
        console.log('🔍 DEBUG: Configuring menu for recruitment staff');
        // Show all recruitment-only items
        showRecruitmentItems();
        
        // Hide all top-level menu items that are NOT recruitment-only
        const allNavItems = document.querySelectorAll('#sidebar > ul > li.nav-item');
        allNavItems.forEach(item => {
            if (!item.classList.contains('recruitment-only')) {
                // Hide Dashboard, Attendance, Payroll, etc. (not recruitment-only)
                item.style.setProperty('display', 'none', 'important');
                item.style.setProperty('opacity', '0', 'important');
                item.style.setProperty('visibility', 'hidden', 'important');
            } else {
                // Show recruitment-only items and restore visibility
                item.style.setProperty('display', 'block', 'important');
                item.style.setProperty('opacity', '1', 'important');
                item.style.setProperty('visibility', 'visible', 'important');
            }
        });
        
        // Special handling for Employee Management collapse
        // Even though parent has recruitment-only, hide non-recruitment children
        hideNonRecruitmentInEmployeeManagement();
        
        // Set up observer and event listeners for Employee Management
        setupEmployeeManagementObserver();
    }
    
    // Function to show payroll-restricted items (for payroll officers)
    function showPayrollRestrictedItems() {
        console.log('🔍 DEBUG: Showing payroll-restricted items for payroll officer');
        const payrollRestrictedItems = document.querySelectorAll('.payroll-restricted');
        payrollRestrictedItems.forEach(item => {
            item.style.setProperty('display', 'block', 'important');
        });
    }
    
    // Function to hide payroll-restricted items (for non-payroll officers)
    function hidePayrollRestrictedItems() {
        console.log('🔍 DEBUG: Hiding payroll-restricted items');
        const payrollRestrictedItems = document.querySelectorAll('.payroll-restricted');
        payrollRestrictedItems.forEach(item => {
            item.style.setProperty('display', 'none', 'important');
        });
    }
    
    // Function to configure menu for payroll officer
    function configurePayrollOfficerMenu() {
        console.log('🔍 DEBUG: Configuring menu for payroll officer');
        
        // Show all payroll-restricted items (Dashboard, Attendance, Payroll)
        showPayrollRestrictedItems();
        
        // Show Payroll Management (it has payroll-restricted class)
        const allNavItems = document.querySelectorAll('#sidebar > ul > li.nav-item');
        allNavItems.forEach(item => {
            const hasPayrollLink = item.querySelector('a[data-bs-target="#Payroll"]');
            const hasDashboardLink = item.querySelector('a[href="/hr/hr_admin"]');
            const hasAttendanceLink = item.querySelector('a[data-bs-target="#Attendance"]');
            
            if (hasPayrollLink || hasDashboardLink || hasAttendanceLink || item.classList.contains('payroll-restricted')) {
                // Show Dashboard, Attendance, and Payroll
                item.style.setProperty('display', 'block', 'important');
                item.style.setProperty('opacity', '1', 'important');
                item.style.setProperty('visibility', 'visible', 'important');
            } else {
                // Hide Employee Management, Recruitment, etc.
                item.style.setProperty('display', 'none', 'important');
                item.style.setProperty('opacity', '0', 'important');
                item.style.setProperty('visibility', 'hidden', 'important');
            }
        });
    }
    
    // Function to show all items (for admin)
    function showAllItems() {
        console.log('🔍 DEBUG: Showing all items for admin');
        const allNavItems = document.querySelectorAll('#sidebar ul li.nav-item');
        allNavItems.forEach(item => {
            // Show all items and restore visibility properties
            item.style.setProperty('display', 'block', 'important');
            item.style.setProperty('opacity', '1', 'important');
            item.style.setProperty('visibility', 'visible', 'important');
        });
    }
    
    fetch('/hr/check-session')
        .then(response => {
            console.log('🔍 DEBUG: Session API response received:', response.status);
            if (!response.ok) {
                throw new Error('Failed to fetch session');
            }
            return response.json();
        })
        .then(data => {
            console.log('🔍 DEBUG: Session API data:', data);
            console.log('🔍 DEBUG: User role is:', data?.user?.role_name);
            const roleName = data?.user?.role_name || '';
            const employeeId = data?.user?.employee_id || '';
            console.log('🔍 DEBUG: Role name value:', roleName);
            console.log('🔍 DEBUG: Employee ID:', employeeId);
            const roleLower = roleName.toLowerCase();
            
            // Check if role is specifically recruitment staff (exact match)
            const isRecruitment = (roleLower === 'recruitment staff' || 
                                  roleLower === 'recruitment_staff') &&
                                 !employeeId.includes('101'); // Exclude admin employee IDs
            console.log('🔍 DEBUG: Is recruitment staff?', isRecruitment);
            
            // Check if role is payroll officer
            const isPayrollOfficer = (roleLower === 'payroll officer' || 
                                     roleLower === 'payroll_officer') &&
                                    !employeeId.includes('101') && // Exclude admin employee IDs
                                    !isRecruitment; // Exclude recruitment staff
            console.log('🔍 DEBUG: Is payroll officer?', isPayrollOfficer);
            
            if (isRecruitment) {
                console.log('🔍 DEBUG: User IS recruitment staff, showing ONLY recruitment-only items');
                configureRecruitmentMenu();
            } else if (isPayrollOfficer) {
                console.log('🔍 DEBUG: User IS payroll officer, showing Dashboard, Attendance, and Payroll only');
                configurePayrollOfficerMenu();
            } else {
                console.log('🔍 DEBUG: User is admin, showing ALL items');
                showAllItems();
            }
        })
        .catch(error => {
            console.log('🔍 DEBUG: Could not fetch user role:', error);
            // Fallback: show all items if API fails (admin view)
            console.log('🔍 DEBUG: API failed, defaulting to show all items (admin view)');
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

