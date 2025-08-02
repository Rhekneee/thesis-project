const authMiddleware = {
  verifySession: (req, res, next) => {

      
      if (!req.session || !req.session.user) {
          return res.status(401).json({ message: "Unauthorized: Please log in" });
      }
      req.user = req.session.user;
      next();
  },

  verifyHRRole: (req, res, next) => {
 
      // Check if user has HR role
      if (!req.user || req.user.role_name !== 'office_administrator') {
          return res.status(403).json({ message: "Forbidden: HR access required" });
      }
      next();
  },

  // Add the new pre-onboarding check middleware
  checkPreOnboardingRequired: async (req, res, next) => {
    try {
        console.log('🔍 HR Middleware: checkPreOnboardingRequired called');
        
        if (!req.session?.user?.id) {
            console.log('🔍 HR Middleware: No user ID in session');
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const userId = req.session.user.id;
        console.log('🔍 HR Middleware: User ID:', userId);
        
        const onboardingStatus = await HRModel.checkIfUserNeedsPreOnboarding(userId);
        console.log('🔍 HR Middleware: Onboarding status:', onboardingStatus);
        
        if (onboardingStatus.needsOnboarding) {
            console.log('🔍 HR Middleware: User needs pre-onboarding, blocking access');
            return res.status(403).json({
                error: 'Pre-onboarding required',
                message: 'Please complete your pre-onboarding documents before accessing this feature',
                needsOnboarding: true,
                reason: onboardingStatus.reason,
                employeeId: onboardingStatus.employeeId,
                totalDocuments: onboardingStatus.totalDocuments,
                approvedDocuments: onboardingStatus.approvedDocuments
            });
        }
        
        console.log('🔍 HR Middleware: User does not need pre-onboarding, allowing access');
        next();
    } catch (error) {
        console.error('🔍 HR Middleware: Error checking pre-onboarding status:', error);
        res.status(500).json({ error: 'Failed to check pre-onboarding status' });
    }
  }
};

const HRModel = require('../model/hr.model');

// ✅ Fix the export to match the import in routes
module.exports = authMiddleware;
