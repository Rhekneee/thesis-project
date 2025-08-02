const db = require('./db');

/**
 * Script to update legacy employees to have onboarding_completed = 1
 * This prevents them from being blocked by the pre-onboarding system
 */
async function updateLegacyEmployees() {
    try {
        console.log('🔍 Starting legacy employee update...');
        
        // Get all users who don't have onboarding_completed set
        const [users] = await db.query(`
            SELECT u.id, u.email, u.username, e.employee_id
            FROM users u
            LEFT JOIN employees e ON u.id = e.user_id
            WHERE u.onboarding_completed IS NULL
        `);
        
        console.log(`Found ${users.length} users without onboarding_completed status`);
        
        if (users.length === 0) {
            console.log('✅ No users need updating');
            return;
        }
        
        // Update all users to have onboarding_completed = 1
        const [result] = await db.query(`
            UPDATE users 
            SET onboarding_completed = 1 
            WHERE onboarding_completed IS NULL
        `);
        
        console.log(`✅ Updated ${result.affectedRows} legacy users`);
        
        // Log the updated users
        for (const user of users) {
            console.log(`  - User ID: ${user.id}, Email: ${user.email}, Employee ID: ${user.employee_id || 'N/A'}`);
        }
        
    } catch (error) {
        console.error('❌ Error updating legacy employees:', error);
        throw error;
    }
}

// Run the update if this script is executed directly
if (require.main === module) {
    updateLegacyEmployees()
        .then(() => {
            console.log('✅ Legacy employee update completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Legacy employee update failed:', error);
            process.exit(1);
        });
}

module.exports = { updateLegacyEmployees }; 