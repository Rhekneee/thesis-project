// SCM Role-Based Visibility Script
// Handles showing/hiding menu items based on user role (procurement staff vs supply chain staff vs admin)

// Run immediately to prevent flickering - check document ready state
(function() {
    // Hide items immediately on script load (before DOM is ready)
    function hideItemsImmediately() {
        if (typeof document === 'undefined') return;
        // Use a style tag to hide ALL sidebar items immediately - prevents any flickering
        if (!document.getElementById('scm-role-visibility-inline-style')) {
            const style = document.createElement('style');
            style.id = 'scm-role-visibility-inline-style';
            style.textContent = '.procurement-restricted, .supply-chain-restricted { display: none !important; } #sidebar > ul > li.nav-item { display: none !important; opacity: 0 !important; visibility: hidden !important; }';
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
        console.log('🔍 DEBUG: Starting SCM role visibility script...');
        
        // Hide all items initially - they'll be shown based on role
        hideAllItemsInitially();
        
        // Helper function to hide procurement-restricted items in Supplier collapse
        function hideProcurementRestrictedInSupplier() {
            const supplierCollapse = document.querySelector('#supplyrequest');
            if (supplierCollapse) {
                const supplierItems = supplierCollapse.querySelectorAll('li.nav-item');
                supplierItems.forEach(item => {
                    if (item.classList.contains('procurement-restricted')) {
                        item.style.setProperty('display', 'none', 'important');
                    } else {
                        item.style.setProperty('display', 'block', 'important');
                    }
                });
            }
        }
        
        // Set up MutationObserver to watch for changes in Supplier collapse
        function setupSupplierObserver() {
            const supplierCollapse = document.querySelector('#supplyrequest');
            if (!supplierCollapse) return;
            
            const observer = new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                        if (supplierCollapse.classList.contains('show')) {
                            setTimeout(() => {
                                hideProcurementRestrictedInSupplier();
                            }, 100);
                        }
                    }
                });
            });
            
            observer.observe(supplierCollapse, {
                attributes: true,
                attributeFilter: ['class']
            });
            
            supplierCollapse.addEventListener('shown.bs.collapse', function() {
                hideProcurementRestrictedInSupplier();
            });
            
            const supplierParent = document.querySelector('a[data-bs-target="#supplyrequest"]');
            if (supplierParent) {
                supplierParent.addEventListener('click', function() {
                    setTimeout(() => {
                        hideProcurementRestrictedInSupplier();
                    }, 200);
                });
            }
        }
        
        // Helper function to hide supply-chain-restricted items in Purchase Request collapse
        function hideSupplyChainRestrictedInPurchaseRequest() {
            const purchaseRequestCollapse = document.querySelector('#PurchaseRequest');
            if (purchaseRequestCollapse) {
                const purchaseRequestItems = purchaseRequestCollapse.querySelectorAll('li.nav-item');
                purchaseRequestItems.forEach(item => {
                    if (item.classList.contains('supply-chain-restricted')) {
                        item.style.setProperty('display', 'none', 'important');
                    } else {
                        item.style.setProperty('display', 'block', 'important');
                    }
                });
            }
        }
        
        // Set up MutationObserver to watch for changes in Purchase Request collapse
        function setupPurchaseRequestObserver() {
            const purchaseRequestCollapse = document.querySelector('#PurchaseRequest');
            if (!purchaseRequestCollapse) return;
            
            const observer = new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                        if (purchaseRequestCollapse.classList.contains('show')) {
                            setTimeout(() => {
                                hideSupplyChainRestrictedInPurchaseRequest();
                            }, 100);
                        }
                    }
                });
            });
            
            observer.observe(purchaseRequestCollapse, {
                attributes: true,
                attributeFilter: ['class']
            });
            
            purchaseRequestCollapse.addEventListener('shown.bs.collapse', function() {
                hideSupplyChainRestrictedInPurchaseRequest();
            });
            
            const purchaseRequestParent = document.querySelector('a[data-bs-target="#PurchaseRequest"]');
            if (purchaseRequestParent) {
                purchaseRequestParent.addEventListener('click', function() {
                    setTimeout(() => {
                        hideSupplyChainRestrictedInPurchaseRequest();
                    }, 200);
                });
            }
        }
    
        // Function to configure menu for procurement staff
        function configureProcurementMenu() {
            console.log('🔍 DEBUG: Configuring menu for procurement staff');
            const allNavItems = document.querySelectorAll('#sidebar > ul > li.nav-item');
            allNavItems.forEach(item => {
                if (item.classList.contains('procurement-restricted')) {
                    // Hide procurement-restricted items (Supplier collapse)
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
            hideProcurementRestrictedInSupplier();
            setupSupplierObserver();
        }
        
        // Function to configure menu for supply chain staff
        function configureSupplyChainMenu() {
            console.log('🔍 DEBUG: Configuring menu for supply chain staff');
            const allNavItems = document.querySelectorAll('#sidebar > ul > li.nav-item');
            allNavItems.forEach(item => {
                if (item.classList.contains('supply-chain-restricted')) {
                    // Hide supply-chain-restricted items (Owners Supply, Purchase Request, Request Material)
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
            hideSupplyChainRestrictedInPurchaseRequest();
            setupPurchaseRequestObserver();
        }
        
        // Function to show all items (for admin)
        function showAllItems() {
            console.log('🔍 DEBUG: Showing all items for admin');
            const allNavItems = document.querySelectorAll('#sidebar ul li.nav-item');
            allNavItems.forEach(item => {
                item.style.setProperty('display', 'block', 'important');
                item.style.setProperty('opacity', '1', 'important');
                item.style.setProperty('visibility', 'visible', 'important');
            });
        }
        
        fetch('/scm/check-session')
            .then(response => {
                console.log('🔍 DEBUG: SCM Session API response received:', response.status);
                if (!response.ok) {
                    throw new Error('Failed to fetch session');
                }
                return response.json();
            })
            .then(data => {
                console.log('🔍 DEBUG: SCM Session API data:', data);
                const roleName = data?.user?.role_name || '';
                console.log('🔍 DEBUG: User role is:', roleName);
                const roleLower = roleName.toLowerCase();
                
                // Check if role is procurement staff
                const isProcurementStaff = (roleLower === 'procurement staff' || 
                                           roleLower === 'procurement_staff');
                console.log('🔍 DEBUG: Is procurement staff?', isProcurementStaff);
                
                // Check if role is supply chain staff
                const isSupplyChainStaff = (roleLower === 'supply chain staff' || 
                                            roleLower === 'supply_chain_staff' ||
                                            roleLower === 'supply chain' ||
                                            roleLower === 'supply_chain');
                console.log('🔍 DEBUG: Is supply chain staff?', isSupplyChainStaff);
                
                if (isProcurementStaff) {
                    console.log('🔍 DEBUG: User IS procurement staff, hiding Supplier items');
                    configureProcurementMenu();
                } else if (isSupplyChainStaff) {
                    console.log('🔍 DEBUG: User IS supply chain staff, hiding Owners Supply, Purchase Request, Request Material');
                    configureSupplyChainMenu();
                } else {
                    console.log('🔍 DEBUG: User is admin or other, showing ALL items');
                    showAllItems();
                }
            })
            .catch(error => {
                console.error('🔍 DEBUG: Could not fetch user role for SCM:', error);
                console.log('🔍 DEBUG: API failed, defaulting to show all items (admin view)');
                showAllItems();
            });
    }
    
    // Expose function globally for immediate execution if needed
    window.initSCMRoleVisibility = initRoleVisibility;
    
    // Run immediately if DOM is ready, otherwise wait for DOMContentLoaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initRoleVisibility);
    } else {
        // DOM is already loaded, run immediately
        initRoleVisibility();
    }
})();

