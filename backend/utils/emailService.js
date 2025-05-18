require('dotenv').config();
const nodemailer = require('nodemailer');

// Create reusable transporter object using Gmail SMTP
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, // Your Gmail address
        pass: process.env.EMAIL_PASSWORD // Your Gmail app password
    }
});

// Email notification function
const sendEmailNotification = async (to, subject, date, time) => {
    try {
        // Format the date and time for better readability
        const formattedDate = new Date(date).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        const formattedTime = new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });

        // Email content
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: to,
            subject: subject,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #4f6ef5;">Interview Schedule Notification</h2>
                    <p>Dear Applicant,</p>
                    <p>We are pleased to inform you that your interview has been scheduled:</p>
                    <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
                        <p style="margin: 5px 0;"><strong>Date:</strong> ${formattedDate}</p>
                        <p style="margin: 5px 0;"><strong>Time:</strong> ${formattedTime}</p>
                    </div>
                    <p>Please arrive 15 minutes before your scheduled time.</p>
                    <p>Location: M.D. Buendia Construction Inc. Office</p>
                    <p>If you need to reschedule or have any questions, please contact us immediately.</p>
                    <br>
                    <p>Best regards,</p>
                    <p>HR Department<br>M.D. Buendia Construction Inc.</p>
                </div>
            `
        };

        // Send email
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully:', info.messageId);
        return true;
    } catch (error) {
        console.error('Error sending email:', error);
        throw error;
    }
};

// Email notification for hiring (accepted)
const sendHireNotification = async (to) => {
    try {
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: to,
            subject: 'Congratulations! You are Hired - M.D. Buendia Construction Inc.',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #4f6ef5;">Congratulations!</h2>
                    <p>Dear Applicant,</p>
                    <p>We are pleased to inform you that you have been <strong>accepted</strong> for the position you applied for at M.D. Buendia Construction Inc.</p>
                    <p>Our HR team will contact you soon with further instructions regarding your onboarding process.</p>
                    <br>
                    <p>Welcome to the team!</p>
                    <p>Best regards,</p>
                    <p>HR Department<br>M.D. Buendia Construction Inc.</p>
                </div>
            `
        };
        const info = await transporter.sendMail(mailOptions);
        console.log('Hire email sent:', info.messageId);
        return true;
    } catch (error) {
        console.error('Error sending hire email:', error);
        throw error;
    }
};

// Email notification for rejection
const sendRejectNotification = async (to) => {
    try {
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: to,
            subject: 'Application Update - M.D. Buendia Construction Inc.',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #e74c3c;">Application Update</h2>
                    <p>Dear Applicant,</p>
                    <p>Thank you for your interest in joining M.D. Buendia Construction Inc. We appreciate the time and effort you invested in your application.</p>
                    <p>After careful consideration, we regret to inform you that you have not been selected for the position at this time.</p>
                    <p>We encourage you to apply for future openings that match your skills and experience.</p>
                    <br>
                    <p>We wish you all the best in your job search.</p>
                    <p>Best regards,</p>
                    <p>HR Department<br>M.D. Buendia Construction Inc.</p>
                </div>
            `
        };
        const info = await transporter.sendMail(mailOptions);
        console.log('Reject email sent:', info.messageId);
        return true;
    } catch (error) {
        console.error('Error sending reject email:', error);
        throw error;
    }
};

// Email notification for new supplier account
const sendSupplierAccountNotification = async (to, username, password, link) => {
    try {
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: to,
            subject: 'Welcome to MDB Construction – Your Supplier Account Details',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #4f6ef5;">Welcome to MDB Construction!</h2>
                    <p>Dear Valued Supplier,</p>
                    <p>We are pleased to inform you that your supplier account has been successfully created in our system. Please find your login credentials below. For your security, we recommend changing your password after your first login.</p>
                    <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
                        <p style="margin: 5px 0;"><strong>Username:</strong> ${username}</p>
                        <p style="margin: 5px 0;"><strong>Temporary Password:</strong> ${password}</p>
                    </div>
                    <p>You can access the supplier portal here:<br>
                        <a href="${link}" style="color: #4f6ef5;">${link}</a>
                    </p>
                    <ul style="margin: 16px 0 16px 20px; color: #374151;">
                        <li>Log in using the credentials above.</li>
                        <li>Change your password immediately after logging in for the first time.</li>
                        <li>Keep your login information confidential and do not share it with others.</li>
                    </ul>
                    <p>If you have any questions or require assistance, please contact our support team.</p>
                    <br>
                    <p>We look forward to a successful partnership.</p>
                    <p>Best regards,<br>Supply Chain Management Team<br>MDB Construction</p>
                </div>
            `
        };
        const info = await transporter.sendMail(mailOptions);
        console.log('Supplier account email sent:', info.messageId);
        return true;
    } catch (error) {
        console.error('Error sending supplier account email:', error);
        throw error;
    }
};

module.exports = {
    sendEmailNotification,
    sendHireNotification,
    sendRejectNotification,
    sendSupplierAccountNotification
}; 