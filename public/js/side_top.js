// JavaScript for toggling the sidebar visibility
function toggleSidebar() {
    var sidebar = document.getElementById('sidebar');
    var content = document.getElementById('content');
    
    // Toggle sidebar visibility
    if (sidebar.style.display === 'none' || sidebar.style.display === '') {
        sidebar.style.display = 'block';
        content.style.marginLeft = '300px';  // Shift content to the right
    } else {
        sidebar.style.display = 'none';
        content.style.marginLeft = '0';  // No shift
    }
}

// JavaScript for toggling the chevron icon rotation
function toggleChevron() {
    var chevronIcon = document.getElementById('chevron-icon');
    if (chevronIcon) {
        chevronIcon.classList.toggle('rotate');
    }
}


        // Add notification toggle functionality
        function toggleNotifications() {
            const dropdown = document.getElementById('notificationDropdown');
            dropdown.classList.toggle('show');
        }

        function markAllAsRead() {
            const badge = document.querySelector('.notification-badge');
            badge.style.display = 'none';
            // Add your logic here to mark notifications as read
        }

        // Close notification dropdown when clicking outside
        window.onclick = function(event) {
            const dropdown = document.getElementById('notificationDropdown');
            if (!event.target.matches('.notification-icon') && !event.target.matches('.notification-icon *')) {
                if (dropdown.classList.contains('show')) {
                    dropdown.classList.remove('show');
                }
            }
        }
        
        /* Update toggle function */
        function toggleSidebar() {
            const sidebar = document.getElementById('sidebar');
            const topbar = document.querySelector('.topbar');
            const content = document.getElementById('content');
            
            // Toggle collapsed class on sidebar
            sidebar.classList.toggle('collapsed');
            
            // Update topbar and content positions
            if (sidebar.classList.contains('collapsed')) {
                topbar.style.left = '80px';
                content.style.marginLeft = '80px';
                content.style.width = 'calc(100% - 80px)';
            } else {
                topbar.style.left = '300px';
                content.style.marginLeft = '300px';
                content.style.width = 'calc(100% - 300px)';
            }
        }

        // Initialize on page load
        document.addEventListener('DOMContentLoaded', function() {
            const sidebar = document.getElementById('sidebar');
            const topbar = document.querySelector('.topbar');
            const content = document.getElementById('content');
            
            // Set initial state
            if (window.innerWidth < 768) {
                sidebar.classList.add('collapsed');
                topbar.style.left = '80px';
                content.style.marginLeft = '80px';
                content.style.width = 'calc(100% - 80px)';
            } else {
                topbar.style.left = '300px';
                content.style.marginLeft = '300px';
                content.style.width = 'calc(100% - 300px)';
            }
        });

        // Handle window resize
        window.addEventListener('resize', function() {
            const sidebar = document.getElementById('sidebar');
            const topbar = document.querySelector('.topbar');
            const content = document.getElementById('content');
            
            if (window.innerWidth < 768) {
                sidebar.classList.add('collapsed');
                topbar.style.left = '80px';
                content.style.marginLeft = '80px';
                content.style.width = 'calc(100% - 80px)';
            } else {
                sidebar.classList.remove('collapsed');
                topbar.style.left = '300px';
                content.style.marginLeft = '300px';
                content.style.width = 'calc(100% - 300px)';
            }
        });
 
        // Function to fetch user info
        async function getUserInfo() {
            try {
                console.log('=== Fetching User Info ===');
                
                const sessionResponse = await fetch('/hr/check-session', {
                    credentials: 'include'
                });

                if (!sessionResponse.ok) {
                    throw new Error('Failed to fetch session data');
                }

                const sessionData = await sessionResponse.json();
                console.log('Full session data:', sessionData);

                if (!sessionData || !sessionData.user) {
                    throw new Error('No user data in session');
                }

                const user = sessionData.user;
                console.log('User active status from session:', user.is_active);
                console.log('User role from session:', user.role_name);

                let userData;
                const role = user.role_name?.toLowerCase();

                // Fetch user details based on role
                if (role === 'developer' || role === 'customer') {
                    // For developers and customers, use CRM endpoints
                    if (!user.id) {
                        console.log('No user ID in session, using session data directly');
                        // If no user ID, use the session data directly
                        userData = {
                            ...user,
                            profile_picture: null,
                            status: user.is_active ? 'active' : 'inactive'
                        };
                    } else {
                        try {
                            const developerResponse = await fetch(`/crm/developer/${user.id}`, {
                                credentials: 'include'
                            });

                            if (!developerResponse.ok) {
                                console.log('Failed to fetch developer details, using session data');
                                // If fetch fails, use session data
                                userData = {
                                    ...user,
                                    profile_picture: null,
                                    status: user.is_active ? 'active' : 'inactive'
                                };
                            } else {
                                const responseData = await developerResponse.json();
                                console.log('Developer response data:', responseData);

                                if (!responseData.success || !responseData.profile) {
                                    console.log('Invalid developer data, using session data');
                                    userData = {
                                        ...user,
                                        profile_picture: null,
                                        status: user.is_active ? 'active' : 'inactive'
                                    };
                                } else {
                                    userData = responseData.profile;
                                }
                            }
                        } catch (error) {
                            console.log('Error fetching developer details, using session data:', error);
                            userData = {
                                ...user,
                                profile_picture: null,
                                status: user.is_active ? 'active' : 'inactive'
                            };
                        }
                    }
                    console.log('Final developer data:', userData);
                } else if (role === 'employee' || role === 'hr' || role === 'office_administrator' || 
                          role === 'finance_accounting' || role === 'general_foreman' || 
                          role === 'corporate_secretary' || role === 'admin_staff' || 
                          role === 'sales_marketing_head' || role === 'logistics' || 
                          role === 'agents') {
                    // For employees and related roles, use HR endpoints
                    if (!user.employee_id) {
                        console.log('No employee ID in session, using session data directly');
                        userData = {
                            ...user,
                            profile_picture: null,
                            is_active: user.is_active ? 1 : 0,
                            is_deleted: 0
                        };
                    } else {
                        try {
                            const employeeResponse = await fetch(`/hr/employees/${user.employee_id}`, {
                                credentials: 'include'
                            });

                            if (!employeeResponse.ok) {
                                console.log('Failed to fetch employee details, using session data');
                                userData = {
                                    ...user,
                                    profile_picture: null,
                                    is_active: user.is_active ? 1 : 0,
                                    is_deleted: 0
                                };
                            } else {
                                userData = await employeeResponse.json();
                            }
                        } catch (error) {
                            console.log('Error fetching employee details, using session data:', error);
                            userData = {
                                ...user,
                                profile_picture: null,
                                is_active: user.is_active ? 1 : 0,
                                is_deleted: 0
                            };
                        }
                    }
                } else {
                    console.log('Invalid user role, using session data directly');
                    userData = {
                        ...user,
                        profile_picture: null,
                        status: user.is_active ? 'active' : 'inactive'
                    };
                }

                // Update profile pictures
                const profilePicture = document.getElementById('profilePicture');
                const topbarProfilePicture = document.getElementById('topbarProfilePicture');

                // Simple function to set profile picture
                const setProfilePicture = (imgElement, imagePath, role) => {
                    if (!imgElement) return;
                    
                    // Always use CRM default for developers and customers
                    if (role === 'developer' || role === 'customer') {
                        imgElement.src = '/crm/default-profile-picture';
                        return;
                    }
                    
                    if (imagePath) {
                        const filename = imagePath.includes('/') 
                            ? imagePath.split('/').pop() 
                            : imagePath;
                        
                        const timestamp = new Date().getTime();
                        const imageUrl = `/uploads/profile_pictures/${filename}?t=${timestamp}`;
                        
                        imgElement.src = imageUrl;
                        
                        imgElement.onerror = () => {
                            console.error('Failed to load image:', imageUrl);
                            imgElement.src = '/hr/default-profile-picture';
                        };
                    } else {
                        imgElement.src = '/hr/default-profile-picture';
                    }
                };

                // Set both profile pictures
                const imagePath = userData.profile_picture;
                console.log('Setting profile pictures with path:', imagePath);
                
                setProfilePicture(profilePicture, imagePath, role);
                setProfilePicture(topbarProfilePicture, imagePath, role);

                // Update profile information
                const profileName = document.querySelector('.profile-name');
                const profilePosition = document.querySelector('.profile-position');
                const statusBadge = document.getElementById('statusBadge');

                if (profileName && profilePosition) {
                    let displayName;
                    let displayPosition;

                    if (role === 'developer' || role === 'customer') {
                        // For developers, use username if name is not available
                        displayName = userData.username || role.charAt(0).toUpperCase() + role.slice(1);
                        displayPosition = userData.position || role.charAt(0).toUpperCase() + role.slice(1);
                    } else {
                        displayName = userData.full_name || userData.username || role.charAt(0).toUpperCase() + role.slice(1);
                        displayPosition = userData.role_name || role.charAt(0).toUpperCase() + role.slice(1);
                    }

                    profileName.textContent = displayName;
                    profilePosition.textContent = displayPosition;
                }

                // Update status badge
                if (statusBadge) {
                    let isActive;
                    if (role === 'developer' || role === 'customer') {
                        isActive = userData.status === 'active' || userData.is_active;
                    } else {
                        isActive = userData.is_deleted === 0 && (userData.is_active === 1 || user.is_active === 1);
                    }

                    if (isActive) {
                        statusBadge.className = 'status-badge status-active';
                        statusBadge.textContent = 'Active';
                    } else {
                        statusBadge.className = 'status-badge status-inactive';
                        statusBadge.textContent = 'Inactive';
                    }
                }

            } catch (error) {
                console.error('Error in getUserInfo:', error);
                // Set default images on error based on role
                const profilePicture = document.getElementById('profilePicture');
                const topbarProfilePicture = document.getElementById('topbarProfilePicture');
                
                // Get role from session if available, otherwise default to developer
                const role = sessionData?.user?.role_name?.toLowerCase() || 'developer';
                
                const defaultImage = role === 'developer' || role === 'customer' 
                    ? '/crm/default-profile-picture' 
                    : '/hr/default-profile-picture';
                    
                if (profilePicture) profilePicture.src = defaultImage;
                if (topbarProfilePicture) topbarProfilePicture.src = defaultImage;
                
                // Don't throw the error, just log it
                return;
            }
        }

        // Function to toggle sidebar
        function toggleSidebar() {
            const sidebar = document.getElementById('sidebar');
            const topbar = document.querySelector('.topbar');
            const content = document.getElementById('content');
            const menuToggle = document.querySelector('.menu-toggle i');
            
            sidebar.classList.toggle('collapsed');
            menuToggle.classList.toggle('fa-bars');
            menuToggle.classList.toggle('fa-times');
            
            if (sidebar.classList.contains('collapsed')) {
                topbar.style.left = '80px';
                content.style.marginLeft = '80px';
                content.style.width = 'calc(100% - 80px)';
            } else {
                topbar.style.left = '300px';
                content.style.marginLeft = '300px';
                content.style.width = 'calc(100% - 300px)';
            }
        }

        // Initialize on page load
        document.addEventListener('DOMContentLoaded', function() {
            // Set initial state
            const sidebar = document.getElementById('sidebar');
            const topbar = document.querySelector('.topbar');
            const content = document.getElementById('content');
            
            if (window.innerWidth < 768) {
                sidebar.classList.add('collapsed');
                topbar.style.left = '80px';
                content.style.marginLeft = '80px';
                content.style.width = 'calc(100% - 80px)';
            } else {
                topbar.style.left = '300px';
                content.style.marginLeft = '300px';
                content.style.width = 'calc(100% - 300px)';
            }

            // Fetch user info
            getUserInfo();
        });

        // Handle window resize
        window.addEventListener('resize', function() {
            const sidebar = document.getElementById('sidebar');
            const topbar = document.querySelector('.topbar');
            const content = document.getElementById('content');
            
            if (window.innerWidth < 768) {
                sidebar.classList.add('collapsed');
                topbar.style.left = '80px';
                content.style.marginLeft = '80px';
                content.style.width = 'calc(100% - 80px)';
            } else {
                sidebar.classList.remove('collapsed');
                topbar.style.left = '300px';
                content.style.marginLeft = '300px';
                content.style.width = 'calc(100% - 300px)';
            }
        });