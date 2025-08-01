const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const ProfileController = require('../controllers/profile.controller');
const {
    authenticateToken,
    validateUserType,
    validateProfileOwnership,
    validateProfilePicture,
    validateContactInfo,
    validateSecurityQuestions,
    validatePasswordChange
} = require('../middleware/profileMiddleware');

// Configure multer for file upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '..', 'uploads', 'profile_pictures');
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `profile_${req.session.user.id}_${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: function (req, file, cb) {
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
            return cb(new Error('Only image files are allowed!'), false);
        }
        cb(null, true);
    }
}).single('profile_picture');

// Get user profile
router.get('/', 
    authenticateToken,
    validateUserType,
    validateProfileOwnership,
    ProfileController.getProfile
);

// Update contact information
router.put('/contact',
    authenticateToken,
    validateUserType,
    validateProfileOwnership,
    validateContactInfo,
    ProfileController.updateContactInfo
);

// Upload profile picture
router.post('/picture',
    authenticateToken,
    validateUserType,
    validateProfileOwnership,
    validateProfilePicture,
    upload,
    ProfileController.uploadProfilePicture
);

// Get security questions
router.get('/security-questions',
    authenticateToken,
    validateUserType,
    validateProfileOwnership,
    ProfileController.getSecurityQuestions
);

// Update security questions
router.put('/security-questions',
    authenticateToken,
    validateUserType,
    validateProfileOwnership,
    validateSecurityQuestions,
    ProfileController.updateSecurityQuestions
);

// Change password
router.put('/password',
    authenticateToken,
    validateUserType,
    validateProfileOwnership,
    validatePasswordChange,
    ProfileController.changePassword
);

module.exports = router; 