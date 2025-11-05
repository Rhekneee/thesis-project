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
                <div style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #f9fafc; padding: 30px;">
                <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); padding: 30px;">
                    
                    <div style="text-align: center; border-bottom: 2px solid #4f6ef5; padding-bottom: 10px; margin-bottom: 20px;">
                    <h2 style="color: #1a2a6c; margin: 0;">Interview Schedule Notification</h2>
                    </div>
                    
                    <p style="font-size: 16px; color: #333;">Dear Applicant,</p>
                    <p style="font-size: 15px; color: #444; line-height: 1.6;">
                    We are pleased to inform you that your interview has been scheduled. Please see the details below:
                    </p>

                    <div style="background-color: #f4f6ff; border-left: 4px solid #4f6ef5; padding: 15px 20px; border-radius: 5px; margin: 20px 0;">
                    <p style="margin: 5px 0; font-size: 15px;"><strong>Date:</strong> ${formattedDate}</p>
                    <p style="margin: 5px 0; font-size: 15px;"><strong>Time:</strong> ${formattedTime}</p>
                    <p style="margin: 5px 0; font-size: 15px;"><strong>Location:</strong> M.D. Buendia Construction Inc. Office</p>
                    </div>

                    <p style="font-size: 15px; color: #444; line-height: 1.6;">
                    Please arrive at least <strong>15 minutes before</strong> your scheduled interview time. 
                    </p>

                    <p style="font-size: 15px; color: #444; line-height: 1.6;">
                    Interview schedules are <strong>strictly followed</strong>. Failure to attend on the assigned date and time 
                    will be considered as a <strong>withdrawal or rejection</strong> of your application.
                    </p>

                    <p style="font-size: 15px; color: #444; line-height: 1.6;">
                    If you need to reschedule or have any questions, please contact our HR Department immediately.
                    </p>

                    <br>
                    <p style="font-size: 15px; color: #333; margin-bottom: 4px;">Best regards,</p>
                    <p style="font-size: 15px; color: #1a2a6c; font-weight: 600; margin: 0;">HR Department</p>
                    <p style="font-size: 14px; color: #555; margin: 0;">M.D. Buendia Construction Inc.</p>
                    
                </div>

                <p style="text-align: center; font-size: 12px; color: #888; margin-top: 20px;">
                    This is an automated message. Please do not reply directly to this email.
                </p>
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
const sendRejectNotification = async (to, remarks = null) => {
    try {
        // Escape HTML in remarks for security
        const escapedRemarks = remarks ? remarks.toString().replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
        
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
                    ${remarks ? `
                        <p><strong>Remarks from HR Department:</strong></p>
                        <div style="background-color: #f8f9fa; border-left: 4px solid #e74c3c; padding: 12px 16px; margin: 16px 0; border-radius: 4px; white-space: pre-wrap;">${escapedRemarks}</div>
                    ` : ''}
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

// Email notification for new employee account
const sendEmployeeAccountNotification = async (to, username, password, link) => {
    try {
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: to,
            subject: 'Welcome to MDB Construction – Your Temporary Account Details',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #4f6ef5;">Welcome to MDB Construction!</h2>
                    <p>Dear New Employee,</p>
                    <p>We are excited to welcome you to the team! Your temporary employee account has been created. Please find your login credentials below. <strong>This is a temporary account for onboarding purposes.</strong></p>
                    <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
                        <p style="margin: 5px 0;"><strong>Login Username:</strong> ${username}</p>
                        <p style="margin: 5px 0;"><strong>Temporary Password:</strong> ${password}</p>
                    </div>
                    <p>You can access the employee portal here:<br>
                        <a href="${link}" style="color: #4f6ef5;">${link}</a>
                    </p>
                    <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
                        <h4 style="color: #856404; margin-top: 0;">Important: Onboarding Process</h4>
                        <ul style="margin: 10px 0; color: #856404;">
                            <li>Log in using your email address and the temporary password above</li>
                            <li>Complete your onboarding process</li>
                            <li>After onboarding completion, you can also log in using your Employee ID</li>
                            <li>You can change your password after your first login</li>
                            <li>Keep your login information confidential and do not share it with others</li>
                        </ul>
                    </div>
                    <p>If you have any questions or require assistance, please contact our HR team.</p>
                    <br>
                    <p>We look forward to working with you!</p>
                    <p>Best regards,<br>HR Department<br>MDB Construction</p>
                </div>
            `
        };
        const info = await transporter.sendMail(mailOptions);
        console.log('Employee account email sent:', info.messageId);
        return true;
    } catch (error) {
        console.error('Error sending employee account email:', error);
        throw error;
    }
};

// Email notification for developer approval
const sendDeveloperApprovalNotification = async (to, username, password, link) => {
    try {
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: to,
            subject: '🎉 Welcome to MDB Construction - Your Developer Account is Now Active',
            html: `
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Developer Account Approved</title>
                </head>
                <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
                    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                        <!-- Header -->
                        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
                            <div style="background-color: rgba(255, 255, 255, 0.1); border-radius: 50%; width: 80px; height: 80px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                                <span style="font-size: 36px; color: white;">🏗️</span>
                            </div>
                            <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 600; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">
                                Welcome to MDB Construction
                            </h1>
                            <p style="color: rgba(255, 255, 255, 0.9); margin: 10px 0 0; font-size: 16px;">
                                Your Developer Account Has Been Approved
                            </p>
                        </div>

                        <!-- Main Content -->
                        <div style="padding: 40px 30px;">
                            <div style="text-align: center; margin-bottom: 30px;">
                                <div style="background-color: #10b981; color: white; padding: 12px 24px; border-radius: 25px; display: inline-block; font-weight: 600; font-size: 16px;">
                                    ✅ Account Approved Successfully
                                </div>
                            </div>

                            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
                                Dear <strong>${username}</strong>,
                            </p>

                            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
                                We are delighted to inform you that your developer account has been <strong>approved</strong> and is now active! You can now access our comprehensive developer portal and begin collaborating with our professional construction team.
                            </p>

                            <!-- Login Credentials Card -->
                            <div style="background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%); border: 2px solid #d1d5db; border-radius: 12px; padding: 25px; margin: 30px 0; position: relative;">
                                <div style="position: absolute; top: -12px; left: 20px; background-color: #667eea; color: white; padding: 6px 16px; border-radius: 20px; font-size: 14px; font-weight: 600;">
                                    🔐 Your Login Credentials
                                </div>
                                <div style="margin-top: 15px;">
                                    <div style="display: flex; align-items: center; margin-bottom: 12px;">
                                        <span style="background-color: #667eea; color: white; padding: 6px 12px; border-radius: 6px; font-size: 14px; font-weight: 600; margin-right: 15px; min-width: 80px;">Username</span>
                                        <span style="font-family: 'Courier New', monospace; background-color: white; padding: 8px 12px; border-radius: 6px; border: 1px solid #d1d5db; font-weight: 600; color: #374151;">${username}</span>
                                    </div>
                                    <div style="display: flex; align-items: center;">
                                        <span style="background-color: #667eea; color: white; padding: 6px 12px; border-radius: 6px; font-size: 14px; font-weight: 600; margin-right: 15px; min-width: 80px;">Password</span>
                                        <span style="font-family: 'Courier New', monospace; background-color: white; padding: 8px 12px; border-radius: 6px; border: 1px solid #d1d5db; font-weight: 600; color: #374151;">Your original registration password</span>
                                    </div>
                                </div>
                                <div style="margin-top: 15px; padding: 12px; background-color: #fef3c7; border-radius: 6px; border-left: 4px solid #f59e0b;">
                                    <p style="margin: 0; color: #92400e; font-size: 14px; font-weight: 600;">
                                        💡 Use the same password you entered during registration
                                    </p>
                                </div>
                            </div>

                            <!-- Access Portal Button -->
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="${link}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4); transition: all 0.3s ease;">
                                    🚀 Access Developer Portal
                                </a>
                            </div>

                            <!-- Next Steps -->
                            <div style="background-color: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
                                <h3 style="color: #0c4a6e; margin: 0 0 15px; font-size: 18px; font-weight: 600;">
                                    📋 Next Steps
                                </h3>
                                <ul style="color: #0c4a6e; margin: 0; padding-left: 20px; line-height: 1.6;">
                                    <li style="margin-bottom: 8px;">Log in using your username and original registration password</li>
                                    <li style="margin-bottom: 8px;">Complete your profile setup in the dashboard</li>
                                    <li style="margin-bottom: 8px;">Review available projects and collaboration tools</li>
                                    <li style="margin-bottom: 8px;">Update your password if desired (optional)</li>
                                </ul>
                            </div>

                            <!-- Features -->
                            <div style="margin: 30px 0;">
                                <h3 style="color: #374151; margin: 0 0 20px; font-size: 20px; font-weight: 600; text-align: center;">
                                    🛠️ What You'll Have Access To
                                </h3>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                                    <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; text-align: center;">
                                        <div style="font-size: 24px; margin-bottom: 8px;">📊</div>
                                        <div style="font-weight: 600; color: #374151; font-size: 14px;">Project Management</div>
                                    </div>
                                    <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; text-align: center;">
                                        <div style="font-size: 24px; margin-bottom: 8px;">📈</div>
                                        <div style="font-weight: 600; color: #374151; font-size: 14px;">Progress Tracking</div>
                                    </div>
                                </div>
                            </div>

                            <!-- Security Notice -->
                            <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 20px; margin: 25px 0;">
                                <div style="display: flex; align-items: center; margin-bottom: 10px;">
                                    <span style="font-size: 20px; margin-right: 10px;">🔒</span>
                                    <h4 style="color: #92400e; margin: 0; font-size: 16px; font-weight: 600;">Security Notice</h4>
                                </div>
                                <p style="color: #92400e; margin: 0; font-size: 14px; line-height: 1.5;">
                                    Please keep your login credentials confidential and change your password immediately after your first login. Do not share your account details with anyone.
                                </p>
                            </div>

                            <!-- Support -->
                            <div style="text-align: center; margin: 30px 0; padding: 20px; background-color: #f8fafc; border-radius: 8px;">
                                <h4 style="color: #374151; margin: 0 0 10px; font-size: 16px; font-weight: 600;">Need Help?</h4>
                                <p style="color: #6b7280; margin: 0 0 15px; font-size: 14px;">
                                    Our development team is here to assist you with any questions or technical support.
                                </p>
                                <p style="color: #667eea; margin: 0; font-weight: 600; font-size: 14px;">
                                    📧 Contact: development@mdbconstruction.com
                                </p>
                            </div>
                        </div>

                        <!-- Footer -->
                        <div style="background-color: #1f2937; padding: 30px; text-align: center; border-top: 1px solid #374151;">
                            <div style="margin-bottom: 15px;">
                                <span style="color: white; font-size: 24px; font-weight: 700;">MDB Construction</span>
                            </div>
                            <p style="color: #9ca3af; margin: 0 0 10px; font-size: 14px;">
                                Building Dreams, Creating Excellence
                            </p>
                            <p style="color: #6b7280; margin: 0; font-size: 12px;">
                                © 2024 MDB Construction Inc. All rights reserved.
                            </p>
                            <div style="margin-top: 20px;">
                                <span style="color: #9ca3af; font-size: 12px;">
                                    This is an automated message. Please do not reply to this email.
                                </span>
                            </div>
                        </div>
                    </div>
                </body>
                </html>
            `
        };
        const info = await transporter.sendMail(mailOptions);
        console.log('Developer approval email sent:', info.messageId);
        return true;
    } catch (error) {
        console.error('Error sending developer approval email:', error);
        throw error;
    }
};

// Email notification for manual supplier welcome (no system access)
const sendManualSupplierWelcome = async (to, supplierName) => {
    try {
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: to,
            subject: 'Welcome to MDB Construction – Supplier Onboarding',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #4f6ef5;">Welcome to MDB Construction!</h2>
                    <p>Dear ${supplierName},</p>
                    <p>Thank you for partnering with <strong>MDB Construction</strong>. Your supplier profile has been successfully added to our system.</p>
                    <p>This email is a confirmation of your onboarding. Since your account is configured as <strong>Manual</strong>, you will coordinate orders and pricing directly with our Supply Chain team.</p>
                    <div style="background-color: #f5f5f5; padding: 16px; border-radius: 6px; margin: 16px 0;">
                        <p style="margin: 6px 0; color: #374151;">For any updates (pricing, catalog, contact info) kindly reach out to:</p>
                        <p style="margin: 0; color: #111827; font-weight: 600;">SCM Team – scm@mdbconstruction.com</p>
                    </div>
                    <p>If you were expecting portal access, please let us know and we can upgrade your account to a <strong>Registered</strong> supplier with portal credentials.</p>
                    <br>
                    <p>We look forward to a successful partnership.</p>
                    <p>Best regards,<br>Supply Chain Management Team<br>MDB Construction</p>
                </div>
            `
        };
        const info = await transporter.sendMail(mailOptions);
        console.log('Manual supplier welcome email sent:', info.messageId);
        return true;
    } catch (error) {
        console.error('Error sending manual supplier welcome email:', error);
        throw error;
    }
};

// Email for purchase estimation rejection (finance -> supplier)
const sendPurchaseEstimationRejection = async ({ to, supplierName, purchaseId, materialName, quantity, unit, remarks }) => {
    try {
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: to,
            subject: `Purchase Estimation Rejected – Ref #${purchaseId}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
                    <h2 style="color: #e74c3c;">Purchase Estimation Rejected</h2>
                    <p>Dear ${supplierName || 'Supplier'},</p>
                    <p>Your submitted estimation for the following order has been <strong>rejected</strong> by Finance:</p>
                    <div style="background:#f8f9fa;border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;margin:12px 0;">
                        <p style="margin:6px 0;"><strong>Purchase ID:</strong> ${purchaseId}</p>
                        <p style="margin:6px 0;"><strong>Material:</strong> ${materialName || '-'}</p>
                        <p style="margin:6px 0;"><strong>Quantity:</strong> ${quantity || '-'} ${unit || ''}</p>
                    </div>
                    <p><strong>Remarks from Finance:</strong></p>
                    <div style="white-space: pre-wrap; background:#fff7ed; border-left:4px solid #f59e0b; padding:12px 16px; border-radius:4px; color:#7c2d12;">${(remarks || '').toString().replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
                    <p style="margin-top:16px;">You may revise your estimation and resubmit if applicable. For questions, kindly reply to this email.</p>
                    <br>
                    <p>Best regards,<br>Finance Department<br>MDB Construction</p>
                </div>
            `
        };
        const info = await transporter.sendMail(mailOptions);
        console.log('Estimation rejection email sent:', info.messageId);
        return true;
    } catch (error) {
        console.error('Error sending estimation rejection email:', error);
        throw error;
    }
};

const sendOnboardingApprovalNotification = async (to, employeeId, defaultPassword = 'default123') => {
    try {
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: to,
            subject: 'Onboarding Documents Approved – Your Login Credentials',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #4f6ef5;">Onboarding Documents Approved</h2>
                    <p>Dear Employee,</p>
                    <p>Congratulations! Your onboarding documents have been approved and validated. Your permanent employee account is now active.</p>
                    
                    <div style="background-color: #f5f5f5; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #4f6ef5;">
                        <h3 style="color: #4f6ef5; margin-top: 0;">Your Login Credentials</h3>
                        <p style="margin: 8px 0;"><strong>Employee ID (Username):</strong> ${employeeId}</p>
                        <p style="margin: 8px 0;"><strong>Password:</strong> ${defaultPassword}</p>
                        <p style="margin: 8px 0; color: #666; font-size: 14px;"><em>Note: Your password for your permanent account.</em></p>
                    </div>
                    
                    <div style="background:#fff3cd;border-left:4px solid #ffc107;padding:12px 16px;border-radius:4px;color:#7c2d12;margin:16px 0;">
                        <p style="margin: 0; font-weight: 600;">Important Security Notice:</p>
                        <ul style="margin: 8px 0 0 20px; padding: 0;">
                            <li>Please change your password immediately after first login</li>
                            <li>Keep your login credentials confidential</li>
                            <li>Do not share your password with anyone</li>
                        </ul>
                    </div>
                    
                    <p style="background:#d1ecf1;border-left:4px solid #17a2b8;padding:12px 16px;border-radius:4px;color:#0c5460;margin:16px 0;">
                        <strong>Next Steps:</strong> You can now log in to the system using your Employee ID and the default password above. Please report to the HR office for any additional onboarding requirements.
                    </p>
                    
                    <br>
                    <p>Welcome to the team!</p>
                    <p>Best regards,<br>HR Department<br>M.D. Buendia Construction Inc.</p>
                </div>
            `
        };
        const info = await transporter.sendMail(mailOptions);
        if (process.env.NODE_ENV === 'development') console.debug('Onboarding approval email sent:', info.messageId);
        return true;
    } catch (error) {
        console.error('Error sending onboarding approval email:', error);
        throw error;
    }
};

// Email notification for labor submission with estimated cost
const sendLaborSubmissionNotification = async (to, developerName, projectName, estimatedCost) => {
    try {
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: to,
            subject: `Project Labor Submission Update - ${projectName}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; color: white;">
                        <h1 style="margin: 0; font-size: 24px; font-weight: 600;">🏗️ Labor Submission Update</h1>
                        <p style="margin: 10px 0 0; opacity: 0.9;">MDB Construction Manufacturing Department</p>
                    </div>
                    
                    <div style="padding: 30px;">
                        <p style="color: #374151; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                            Dear <strong>${developerName}</strong>,
                        </p>
                        
                        <p style="color: #374151; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
                            We are pleased to inform you that the labor requirements for your project <strong>"${projectName}"</strong> have been successfully submitted and processed by our manufacturing team.
                        </p>
                        
                        <!-- Project Cost Information -->
                        <div style="background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%); border: 2px solid #d1d5db; border-radius: 12px; padding: 25px; margin: 25px 0; position: relative;">
                            <div style="position: absolute; top: -12px; left: 20px; background-color: #10b981; color: white; padding: 6px 16px; border-radius: 20px; font-size: 14px; font-weight: 600;">
                                💰 Initial Cost Estimate
                            </div>
                            <div style="margin-top: 15px; text-align: center;">
                                <div style="font-size: 32px; font-weight: 700; color: #059669; margin-bottom: 10px;">
                                    ₱${parseFloat(estimatedCost).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                                <p style="color: #6b7280; margin: 0; font-size: 14px;">
                                    Initial manufacturing cost estimate for your project
                                </p>
                            </div>
                        </div>
                        
                        <!-- Important Notice -->
                        <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
                            <div style="display: flex; align-items: center; margin-bottom: 10px;">
                                <span style="font-size: 20px; margin-right: 10px;">📋</span>
                                <h3 style="color: #92400e; margin: 0; font-size: 18px; font-weight: 600;">Important Reminder</h3>
                            </div>
                            <p style="color: #92400e; margin: 0; font-size: 16px; line-height: 1.6;">
                                Please <strong>login to your developer account</strong> to review the detailed labor breakdown, track project progress, and stay updated with the latest information about your project.
                            </p>
                        </div>
                        
                        <!-- Next Steps -->
                        <div style="background-color: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
                            <h3 style="color: #0c4a6e; margin: 0 0 15px; font-size: 18px; font-weight: 600;">
                                📋 What's Next?
                            </h3>
                            <ul style="color: #0c4a6e; margin: 0; padding-left: 20px; line-height: 1.6;">
                                <li style="margin-bottom: 8px;">Log in to your developer portal to view detailed labor requirements</li>
                                <li style="margin-bottom: 8px;">Review the submitted manpower specifications</li>
                                <li style="margin-bottom: 8px;">Track project progress and updates</li>
                                <li style="margin-bottom: 8px;">Contact our manufacturing team if you have any questions</li>
                            </ul>
                        </div>
                        
                        <!-- Contact Information -->
                        <div style="text-align: center; margin: 30px 0; padding: 20px; background-color: #f8fafc; border-radius: 8px;">
                            <h4 style="color: #374151; margin: 0 0 10px; font-size: 16px; font-weight: 600;">Need Assistance?</h4>
                            <p style="color: #6b7280; margin: 0 0 15px; font-size: 14px;">
                                Our manufacturing team is here to assist you with any questions or concerns.
                            </p>
                            <p style="color: #667eea; margin: 0; font-weight: 600; font-size: 14px;">
                                📧 Contact: manufacturing@mdbconstruction.com
                            </p>
                        </div>
                        
                        <p style="color: #374151; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                            Thank you for choosing MDB Construction for your project needs.
                        </p>
                        
                        <p style="color: #374151; font-size: 16px; line-height: 1.6;">
                            Best regards,<br>
                            <strong>Manufacturing Department</strong><br>
                            MDB Construction Inc.
                        </p>
                    </div>
                    
                    <!-- Footer -->
                    <div style="background-color: #1f2937; padding: 20px; text-align: center; border-top: 1px solid #374151;">
                        <p style="color: #9ca3af; margin: 0 0 10px; font-size: 14px;">
                            Building Dreams, Creating Excellence
                        </p>
                        <p style="color: #6b7280; margin: 0; font-size: 12px;">
                            © 2024 MDB Construction Inc. All rights reserved.
                        </p>
                        <div style="margin-top: 15px;">
                            <span style="color: #9ca3af; font-size: 12px;">
                                This is an automated message. Please do not reply to this email.
                            </span>
                        </div>
                    </div>
                </div>
            `
        };
        const info = await transporter.sendMail(mailOptions);
        console.log('Labor submission notification email sent:', info.messageId);
        return true;
    } catch (error) {
        console.error('Error sending labor submission notification email:', error);
        throw error;
    }
};

module.exports = {
    sendEmailNotification,
    sendHireNotification,
    sendRejectNotification,
    sendSupplierAccountNotification,
    sendEmployeeAccountNotification,
    sendDeveloperApprovalNotification,
    sendManualSupplierWelcome,
    sendPurchaseEstimationRejection,
    sendOnboardingApprovalNotification,
    sendLaborSubmissionNotification
}; 