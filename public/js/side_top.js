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
                console.log('User active status from session:', sessionData.user?.is_active);
                console.log('User role from session:', sessionData.user?.role_name);

                if (!sessionData.user || !sessionData.user.employee_id) {
                    throw new Error('No employee ID in session');
                }

                // Fetch employee details
                const employeeResponse = await fetch(`/hr/employees/${sessionData.user.employee_id}`, {
                    credentials: 'include'
                });

                if (!employeeResponse.ok) {
                    throw new Error('Failed to fetch employee details');
                }

                const employeeData = await employeeResponse.json();
                console.log('Full employee data:', employeeData);

                const profileName = document.querySelector('.profile-name');
                const profilePosition = document.querySelector('.profile-position');
                const topbarProfilePicture = document.getElementById('topbarProfilePicture');

                if (profileName && profilePosition) {
                    profileName.textContent = employeeData.full_name || 'Not Set';
                    profilePosition.textContent = employeeData.role_name || 'Not Set';
                }

                // Update profile picture with proper path handling
                if (employeeData.profile_picture) {
                    // Extract just the filename if it's a full path
                    const filename = employeeData.profile_picture.includes('/') 
                        ? employeeData.profile_picture.split('/').pop() 
                        : employeeData.profile_picture;
                    
                    // Add timestamp to prevent caching
                    const timestamp = new Date().getTime();
                    const imageUrl = `/uploads/profile_pictures/${filename}?t=${timestamp}`;
                    console.log('Loading profile picture from:', imageUrl);
                    
                    topbarProfilePicture.src = imageUrl;

                    // If the path was a full path, update it in the database
                    if (employeeData.profile_picture.includes('/')) {
                        try {
                            const updateResponse = await fetch(`/hr/employees/${sessionData.user.employee_id}/profile-picture`, {
                                method: 'PUT',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({ profile_picture: filename }),
                                credentials: 'include'
                            });

                            if (!updateResponse.ok) {
                                console.error('Failed to update profile picture path in database');
                            } else {
                                console.log('Successfully updated profile picture path in database');
                            }
                        } catch (error) {
                            console.error('Error updating profile picture path:', error);
                        }
                    }
                } else {
                    console.log('No profile picture found, using default');
                    topbarProfilePicture.src = '/images/default-profile.png';
                }

            } catch (error) {
                console.error('Error in getUserInfo:', error);
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