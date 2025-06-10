const ProfileModel = require('../models/profile.model');
const { sendEmailNotification } = require('../utils/emailService');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '..', 'uploads', 'profile_pictures');
        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Generate unique filename: userId_timestamp.extension
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `profile_${req.params.id}_${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: function (req, file, cb) {
        // Accept only image files
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
            return cb(new Error('Only image files are allowed!'), false);
        }
        cb(null, true);
    }
}).single('profile_picture');

const ProfileController = {
    // Get user profile
    getProfile: async (req, res) => {
        try {
            if (!req.session?.user) {
                return res.status(401).json({ error: "Unauthorized: No session found" });
            }

            const userId = req.session.user.id;
            // Determine user type based on session flags
            let userType;
            if (req.session.user.is_supplier) {
                userType = 'supplier';
            } else if (req.session.user.is_external) {
                userType = 'developer';
            } else {
                userType = 'employee';
            }

            const profile = await ProfileModel.getProfile(userId, userType);

            if (!profile) {
                return res.status(404).json({ error: "Profile not found" });
            }

            res.json(profile);
        } catch (error) {
            console.error("Error fetching profile:", error);
            res.status(500).json({ error: "Failed to fetch profile" });
        }
    },

    // Update contact information
    updateContactInfo: async (req, res) => {
        try {
            if (!req.session?.user) {
                return res.status(401).json({ error: "Unauthorized: No session found" });
            }

            const userId = req.session.user.id;
            // Determine user type based on session flags
            let userType;
            if (req.session.user.is_supplier) {
                userType = 'supplier';
            } else if (req.session.user.is_external) {
                userType = 'developer';
            } else {
                userType = 'employee';
            }

            const contactData = req.body;

            // Validate required fields based on user type
            const requiredFields = ['birthday', 'address', 'contact'];
            if (userType === 'employee') {
                requiredFields.push('emergency_contact_name', 'emergency_contact_relationship', 'emergency_contact_phone');
            }

            const missingFields = requiredFields.filter(field => !contactData[field]);
            if (missingFields.length > 0) {
                return res.status(400).json({ 
                    error: `Missing required fields: ${missingFields.join(', ')}` 
                });
            }

            // Validate date format for birthday
            const birthdayDate = new Date(contactData.birthday);
            if (isNaN(birthdayDate.getTime())) {
                return res.status(400).json({ error: "Invalid birthday date format" });
            }

            // Validate phone number format
            const phoneRegex = /^[0-9+\-\s()]{10,15}$/;
            if (!phoneRegex.test(contactData.contact) || 
                (userType === 'employee' && !phoneRegex.test(contactData.emergency_contact_phone))) {
                return res.status(400).json({ error: "Invalid phone number format" });
            }

            const updatedProfile = await ProfileModel.updateContactInfo(userId, userType, contactData);
            res.json({ 
                message: "Contact information updated successfully",
                profile: updatedProfile
            });

        } catch (error) {
            console.error("Error updating contact info:", error);
            res.status(500).json({ error: "Failed to update contact information" });
        }
    },

    // Upload profile picture
    uploadProfilePicture: async (req, res) => {
        upload(req, res, async function(err) {
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({ error: 'File size too large. Maximum size is 5MB.' });
                }
                return res.status(400).json({ error: err.message });
            } else if (err) {
                return res.status(500).json({ error: err.message });
            }

            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            try {
                if (!req.session?.user) {
                    throw new Error("Unauthorized: No session found");
                }

                const userId = req.session.user.id;
                // Determine user type based on session flags
                let userType;
                if (req.session.user.is_supplier) {
                    userType = 'supplier';
                } else if (req.session.user.is_external) {
                    userType = 'developer';
                } else {
                    userType = 'employee';
                }

                const imagePath = req.file.filename;

                await ProfileModel.updateProfilePicture(userId, userType, imagePath);

                res.json({ 
                    message: 'Profile picture uploaded successfully',
                    imagePath: imagePath
                });
            } catch (error) {
                if (req.file) {
                    fs.unlinkSync(req.file.path);
                }
                console.error('Error uploading profile picture:', error);
                res.status(500).json({ error: 'Failed to update profile picture' });
            }
        });
    },

    // Get security questions
    getSecurityQuestions: async (req, res) => {
        try {
            if (!req.session?.user) {
                return res.status(401).json({ error: "Unauthorized: No session found" });
            }

            const userId = req.session.user.id;
            const questions = await ProfileModel.getSecurityQuestions(userId);
            res.json(questions);
        } catch (error) {
            console.error("Error fetching security questions:", error);
            res.status(500).json({ error: "Failed to fetch security questions" });
        }
    },

    // Update security questions
    updateSecurityQuestions: async (req, res) => {
        try {
            if (!req.session?.user) {
                return res.status(401).json({ error: "Unauthorized: No session found" });
            }

            const userId = req.session.user.id;
            const questions = req.body;

            // Validate required fields
            const requiredFields = ['question1', 'answer1', 'question2', 'answer2', 'question3', 'answer3'];
            const missingFields = requiredFields.filter(field => !questions[field]);
            
            if (missingFields.length > 0) {
                return res.status(400).json({ 
                    error: `Missing required fields: ${missingFields.join(', ')}` 
                });
            }

            // Validate that all questions are different
            const selectedQuestions = new Set([
                questions.question1,
                questions.question2,
                questions.question3
            ]);

            if (selectedQuestions.size !== 3) {
                return res.status(400).json({ 
                    error: "Please select different questions for each security question" 
                });
            }

            await ProfileModel.updateSecurityQuestions(userId, questions);
            res.json({ message: "Security questions updated successfully" });
        } catch (error) {
            console.error("Error updating security questions:", error);
            res.status(500).json({ error: "Failed to update security questions" });
        }
    },

    // Change password
    changePassword: async (req, res) => {
        try {
            if (!req.session?.user) {
                return res.status(401).json({ error: "Unauthorized: No session found" });
            }

            const { currentPassword, newPassword } = req.body;
            const userId = req.session.user.id;

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

            await ProfileModel.changePassword(userId, currentPassword, newPassword);
            res.json({ message: 'Password changed successfully' });
        } catch (error) {
            console.error('Error changing password:', error);
            if (error.message === 'Current password is incorrect') {
                return res.status(400).json({ error: error.message });
            }
            res.status(500).json({ error: 'Failed to change password' });
        }
    }
};

module.exports = ProfileController; 