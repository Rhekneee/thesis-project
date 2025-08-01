const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

/**
 * Middleware to authenticate user token
 * Verifies JWT token and attaches user to request
 */
const authenticateToken = (req, res, next) => {
    // Check for session first
    if (req.session?.user) {
        // If we have a session, attach the user to req.user for consistency
        req.user = req.session.user;
        return next();
    }

    // If no session, check for JWT token
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: "Unauthorized: No session or token provided" });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: "Forbidden: Invalid token" });
        }
        req.user = user;
        next();
    });
};

/**
 * Middleware to validate user type
 * Ensures the user is either an employee, supplier, or developer
 */
const validateUserType = (req, res, next) => {
    if (!req.session?.user) {
        return res.status(401).json({ error: "Unauthorized: No session found" });
    }

    const { is_supplier, is_external } = req.session.user;

    // Supplier check
    if (is_supplier) {
        req.userType = 'supplier';
        return next();
    }

    // Developer check (is_external is set for developers)
    if (is_external) {
        req.userType = 'developer';
        return next();
    }

    // If not supplier or developer, must be employee
    req.userType = 'employee';
    next();
};

/**
 * Middleware to validate profile ownership
 * Ensures users can only access their own profile
 */
const validateProfileOwnership = (req, res, next) => {
    if (!req.session?.user) {
        return res.status(401).json({ error: "Unauthorized: No session found" });
    }

    const userId = req.session.user.id;
    const requestedUserId = req.params.id;

    // If no specific user ID is requested, allow access to own profile
    if (!requestedUserId) {
        return next();
    }

    // Check if user is trying to access their own profile
    if (userId !== parseInt(requestedUserId)) {
        return res.status(403).json({ 
            error: "Forbidden: Cannot access another user's profile",
            message: "You can only access your own profile"
        });
    }

    next();
};

/**
 * Middleware to validate profile picture upload
 * Checks file type and size before upload
 */
const validateProfilePicture = (req, res, next) => {
    if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
    }

    // Check file size (5MB limit)
    if (req.file.size > 5 * 1024 * 1024) {
        return res.status(400).json({ error: "File size too large. Maximum size is 5MB." });
    }

    // Check file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(req.file.mimetype)) {
        return res.status(400).json({ error: "Invalid file type. Only JPEG, PNG, and GIF are allowed." });
    }

    next();
};

/**
 * Middleware to validate contact information
 * Ensures all required fields are present and properly formatted
 */
const validateContactInfo = (req, res, next) => {
    const { birthday, address, contact, emergency_contact_name, emergency_contact_relationship, emergency_contact_phone } = req.body;

    // Check required fields
    const requiredFields = ['birthday', 'address', 'contact'];
    if (!req.session.user.is_supplier && !req.session.user.is_external) {
        requiredFields.push('emergency_contact_name', 'emergency_contact_relationship', 'emergency_contact_phone');
    }

    const missingFields = requiredFields.filter(field => !req.body[field]);
    if (missingFields.length > 0) {
        return res.status(400).json({ 
            error: `Missing required fields: ${missingFields.join(', ')}` 
        });
    }

    // Validate date format for birthday
    const birthdayDate = new Date(birthday);
    if (isNaN(birthdayDate.getTime())) {
        return res.status(400).json({ error: "Invalid birthday date format" });
    }

    // Validate phone number format
    const phoneRegex = /^[0-9+\-\s()]{10,15}$/;
    if (!phoneRegex.test(contact) || 
        (!req.session.user.is_supplier && !req.session.user.is_external && !phoneRegex.test(emergency_contact_phone))) {
        return res.status(400).json({ error: "Invalid phone number format" });
    }

    next();
};

/**
 * Middleware to validate security questions
 * Ensures all questions are different and answers are provided
 */
const validateSecurityQuestions = (req, res, next) => {
    const { question1, answer1, question2, answer2, question3, answer3 } = req.body;

    // Check required fields
    const requiredFields = ['question1', 'answer1', 'question2', 'answer2', 'question3', 'answer3'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
        return res.status(400).json({ 
            error: `Missing required fields: ${missingFields.join(', ')}` 
        });
    }

    // Validate that all questions are different
    const selectedQuestions = new Set([question1, question2, question3]);
    if (selectedQuestions.size !== 3) {
        return res.status(400).json({ 
            error: "Please select different questions for each security question" 
        });
    }

    // Validate answer lengths
    const answers = [answer1, answer2, answer3];
    const invalidAnswers = answers.filter(answer => answer.length < 3);
    if (invalidAnswers.length > 0) {
        return res.status(400).json({ 
            error: "All answers must be at least 3 characters long" 
        });
    }

    next();
};

/**
 * Middleware to validate password change
 * Ensures password meets requirements and current password is correct
 */
const validatePasswordChange = async (req, res, next) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current password and new password are required' });
    }

    // Validate password requirements
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
        return res.status(400).json({ 
            error: 'New password must be at least 8 characters long and contain uppercase, lowercase, number, and special character' 
        });
    }

    // Check if new password is same as current password
    if (currentPassword === newPassword) {
        return res.status(400).json({ 
            error: 'New password must be different from current password' 
        });
    }

    try {
        // Verify current password
        const user = await req.db.query('SELECT password FROM users WHERE id = ?', [req.session.user.id]);
        if (!user || !user[0]) {
            return res.status(404).json({ error: 'User not found' });
        }

        const isValid = await bcrypt.compare(currentPassword, user[0].password);
        if (!isValid) {
            return res.status(400).json({ error: 'Current password is incorrect' });
        }

        next();
    } catch (error) {
        console.error('Error validating password:', error);
        res.status(500).json({ error: 'Failed to validate password' });
    }
};

module.exports = {
    authenticateToken,
    validateUserType,
    validateProfileOwnership,
    validateProfilePicture,
    validateContactInfo,
    validateSecurityQuestions,
    validatePasswordChange
}; 