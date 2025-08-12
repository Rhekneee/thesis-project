/**
 * Onboarding Status Checker
 * This script automatically checks if a user needs to complete onboarding
 * and shows the onboarding form if needed.
 */

// Onboarding Status Checker
class OnboardingChecker {
    constructor() {
        console.log('🔍 OnboardingChecker: Initializing...');
        this.init();
    }

    async init() {
        try {
            console.log('🔍 OnboardingChecker: Starting status check...');
            
            // Check if user is logged in by making a session check request
            let hasValidSession = false;
            try {
                const sessionResponse = await fetch('/hr/check-session', {
                    method: 'GET',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                
                if (sessionResponse.ok) {
                    const sessionData = await sessionResponse.json();
                    console.log('🔍 OnboardingChecker: Session detection:', sessionData);
                    
                    if (sessionData && sessionData.user) {
                        hasValidSession = true;
                        console.log('🔍 OnboardingChecker: Valid session found, user:', sessionData.user.role_name);
                    }
                }
            } catch (sessionError) {
                console.log('🔍 OnboardingChecker: Session check failed:', sessionError);
            }
            
            // If no valid session, skip the check
            if (!hasValidSession) {
                console.log('🔍 OnboardingChecker: No valid session found, skipping check');
                return;
            }
            
            console.log('🔍 OnboardingChecker: Session found, checking onboarding status...');
            const response = await fetch('/hr/onboarding/check-needs', {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            console.log('🔍 OnboardingChecker: Response status:', response.status);
            
            if (!response.ok) {
                console.error('❌ OnboardingChecker: Failed to check onboarding status:', response.status);
                const errorText = await response.text();
                console.error('❌ OnboardingChecker: Error response:', errorText);
                return;
            }

            const data = await response.json();
            console.log('🔍 OnboardingChecker: Response data:', data);

            if (data.needsOnboarding) {
                console.log('✅ OnboardingChecker: User needs pre-onboarding, showing form...');
                
                // If this is a new employee with no documents, initialize them first
                if (data.reason === 'New employee - pre-onboarding required' && data.totalDocuments === 0) {
                    console.log('🔍 OnboardingChecker: New employee detected, initializing documents...');
                    await this.initializeDocuments();
                }
                
                // Show appropriate status message
                if (data.onboardingStatus === 'documents_submitted') {
                    this.showHRNotification(data.statusMessage);
                } else if (data.onboardingStatus === 'essential_complete') {
                    this.showEssentialCompleteNotification(data.statusMessage);
                } else {
                    this.showOnboardingForm();
                }
            } else {
                console.log('✅ OnboardingChecker: User does not need pre-onboarding');
                this.hideOnboardingForm();
            }
        } catch (error) {
            console.error('❌ OnboardingChecker: Error checking onboarding status:', error);
        }
    }

    showOnboardingForm() {
        console.log('🔍 OnboardingChecker: Creating onboarding form overlay...');
        
        // Remove any existing overlay first
        this.hideOnboardingForm();
        
        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'onboarding-overlay';
        overlay.id = 'onboardingOverlay';
        
        // Create modal content with multi-step form
        overlay.innerHTML = `
            <div class="onboarding-modal">
                <button type="button" class="btn-close-onboarding" onclick="window.OnboardingCheckerInstance.hideOnboardingForm()">
                    <i class="fas fa-times"></i>
                </button>
                
                <!-- Step 1: Company Policy Agreement -->
                <div id="policyStep" class="policy-step">
                    <div class="text-center mb-4">
                        <h2 class="text-primary">
                            <i class="fas fa-file-contract me-2"></i>
                            Company Policy Agreement
                        </h2>
                        <p class="text-muted">Please review and accept the company policies before proceeding with document upload.</p>
                    </div>

                    <!-- Policy Content Preview -->
                    <div class="policy-preview-section mb-4">
                        <h6 class="mb-3">
                            <i class="fas fa-eye me-2"></i>
                            Policy Content Preview
                        </h6>
                        <div class="policy-content-container">
                            <div class="policy-content-scroll">
                                <div class="policy-section">
                                    <h6 class="policy-section-title">1. COMPANY TERMS & CONDITIONS / EMPLOYMENT AGREEMENT</h6>
                                    <p><strong>1. EMPLOYMENT TERMS</strong></p>
                                    <p>This agreement outlines the terms and conditions of employment between the Company and the Employee.</p>
                                    
                                    <p><strong>2. POSITION AND DUTIES</strong></p>
                                    <p>The Employee will serve in the position of [Position] and perform all duties assigned by the Company.</p>
                                    
                                    <p><strong>3. COMPENSATION</strong></p>
                                    <p>The Employee will receive a salary of [Amount] per [period], subject to applicable deductions and withholdings.</p>
                                    
                                    <p><strong>4. WORK SCHEDULE</strong></p>
                                    <p>The Employee will work [X] hours per week, with schedule to be determined by the Company.</p>
                                    
                                    <p><strong>5. BENEFITS</strong></p>
                                    <p>The Employee is eligible for company benefits as outlined in the Employee Handbook.</p>
                                    
                                    <p><strong>6. CONFIDENTIALITY</strong></p>
                                    <p>The Employee agrees to maintain confidentiality of all company information and trade secrets.</p>
                                    
                                    <p><strong>7. TERMINATION</strong></p>
                                    <p>Either party may terminate this agreement with [X] days written notice.</p>
                                    
                                    <p><strong>8. GOVERNING LAW</strong></p>
                                    <p>This agreement is governed by the laws of [State/Country].</p>
                                </div>

                                <div class="policy-section">
                                    <h6 class="policy-section-title">2. EMPLOYEE HANDBOOK</h6>
                                    <p>Our comprehensive employee handbook covers all aspects of employment including company overview, employment policies, work schedules, leave policies, dress code, workplace conduct, compensation and benefits, safety and security, technology usage, and termination procedures.</p>
                                    
                                    <p><strong>Key Policy Areas:</strong></p>
                                    <ul>
                                        <li>Equal Employment Opportunity</li>
                                        <li>Anti-Harassment Policy</li>
                                        <li>Drug-Free Workplace</li>
                                        <li>Regular Work Hours and Overtime</li>
                                        <li>Vacation, Sick, and Personal Leave</li>
                                        <li>Business Casual Dress Code</li>
                                        <li>Professional Behavior Standards</li>
                                        <li>Health Insurance and Benefits</li>
                                        <li>Workplace Safety Procedures</li>
                                        <li>Computer and Internet Usage</li>
                                    </ul>
                                </div>

                                <div class="policy-section">
                                    <h6 class="policy-section-title">3. CONFIDENTIALITY / NDA AGREEMENT</h6>
                                    <p>This Non-Disclosure Agreement (NDA) is entered into between the Company and the Employee.</p>
                                    
                                    <p><strong>1. CONFIDENTIAL INFORMATION</strong></p>
                                    <p>The Employee acknowledges that they may have access to confidential information including but not limited to:</p>
                                    <ul>
                                        <li>Trade secrets</li>
                                        <li>Customer lists and data</li>
                                        <li>Financial information</li>
                                        <li>Product development plans</li>
                                        <li>Marketing strategies</li>
                                        <li>Employee information</li>
                                    </ul>
                                    
                                    <p><strong>2. NON-DISCLOSURE OBLIGATIONS</strong></p>
                                    <p>The Employee agrees to:</p>
                                    <ul>
                                        <li>Keep all confidential information strictly confidential</li>
                                        <li>Not disclose confidential information to any third party</li>
                                        <li>Use confidential information only for company business</li>
                                        <li>Return all confidential materials upon termination</li>
                                    </ul>
                                </div>

                                <div class="policy-section">
                                    <h6 class="policy-section-title">4. CODE OF CONDUCT</h6>
                                    <p>Our company is committed to maintaining the highest standards of ethical behavior and professional conduct.</p>
                                    
                                    <p><strong>1. ETHICAL STANDARDS</strong></p>
                                    <ul>
                                        <li>Act with honesty and integrity</li>
                                        <li>Treat all individuals with respect and dignity</li>
                                        <li>Avoid conflicts of interest</li>
                                        <li>Maintain confidentiality of company information</li>
                                    </ul>
                                    
                                    <p><strong>2. PROFESSIONAL BEHAVIOR</strong></p>
                                    <ul>
                                        <li>Dress appropriately for the workplace</li>
                                        <li>Use appropriate language and communication</li>
                                        <li>Be punctual and reliable</li>
                                        <li>Take responsibility for your actions</li>
                                    </ul>
                                </div>

                                <div class="policy-section">
                                    <h6 class="policy-section-title">5. HEALTH & SAFETY GUIDELINES</h6>
                                    <p>The safety and well-being of our employees is our top priority.</p>
                                    
                                    <p><strong>1. GENERAL SAFETY RULES</strong></p>
                                    <ul>
                                        <li>Always wear appropriate safety equipment</li>
                                        <li>Report unsafe conditions immediately</li>
                                        <li>Follow all safety procedures and protocols</li>
                                        <li>Attend required safety training sessions</li>
                                    </ul>
                                    
                                    <p><strong>2. EMERGENCY PROCEDURES</strong></p>
                                    <ul>
                                        <li>Know emergency exit routes</li>
                                        <li>Understand fire evacuation procedures</li>
                                        <li>Know location of first aid kits</li>
                                        <li>Report accidents and injuries immediately</li>
                                    </ul>
                                </div>

                                <div class="policy-section">
                                    <h6 class="policy-section-title">6. IT & DATA PRIVACY POLICY</h6>
                                    <p>This policy outlines the acceptable use of company technology and data protection requirements.</p>
                                    
                                    <p><strong>1. COMPUTER USAGE</strong></p>
                                    <ul>
                                        <li>Use company computers for business purposes only</li>
                                        <li>Don't install unauthorized software</li>
                                        <li>Keep passwords secure and confidential</li>
                                        <li>Log out when leaving your workstation</li>
                                    </ul>
                                    
                                    <p><strong>2. DATA PROTECTION</strong></p>
                                    <ul>
                                        <li>Protect sensitive company information</li>
                                        <li>Don't share passwords or access credentials</li>
                                        <li>Use encryption for sensitive data</li>
                                        <li>Report data breaches immediately</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Policy Documents Download -->
                    <div class="policy-documents mb-4">
                        <h5 class="mb-3">Download Complete Policy Handbook:</h5>
                        <div class="policy-item">
                            <i class="fas fa-check-circle text-success me-2"></i>
                            <span>Complete Company Policies & Procedures Handbook</span>
                            <a href="/uploads/policies/company-policies.pdf" target="_blank" class="btn btn-sm btn-outline-primary ms-2">
                                <i class="fas fa-download me-1"></i>Download Complete Handbook
                            </a>
                        </div>
                        <div class="policy-item">
                            <i class="fas fa-info-circle text-info me-2"></i>
                            <span>This comprehensive document includes:</span>
                        </div>
                        <div class="policy-details ms-4">
                            <div class="policy-detail-item">
                                <i class="fas fa-file-contract me-2"></i>
                                <span>Company Terms & Conditions / Employment Agreement</span>
                            </div>
                            <div class="policy-detail-item">
                                <i class="fas fa-book me-2"></i>
                                <span>Employee Handbook (Policies, Dress Code, Leaves, etc.)</span>
                            </div>
                            <div class="policy-detail-item">
                                <i class="fas fa-shield-alt me-2"></i>
                                <span>Confidentiality / NDA Agreement</span>
                            </div>
                            <div class="policy-detail-item">
                                <i class="fas fa-balance-scale me-2"></i>
                                <span>Code of Conduct</span>
                            </div>
                            <div class="policy-detail-item">
                                <i class="fas fa-hard-hat me-2"></i>
                                <span>Health & Safety Guidelines</span>
                            </div>
                            <div class="policy-detail-item">
                                <i class="fas fa-laptop me-2"></i>
                                <span>IT & Data Privacy Policy</span>
                            </div>
                        </div>
                    </div>

                    <!-- Agreement Checkbox -->
                    <div class="agreement-section mb-4">
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="policyAgreement" onchange="toggleNextButton()">
                            <label class="form-check-label" for="policyAgreement">
                                <strong>I hereby consent and agree to the terms and conditions, company policies, and the confidentiality agreement.</strong>
                            </label>
                        </div>
                    </div>

                    <!-- Navigation Buttons -->
                    <div class="d-flex justify-content-between">
                        <button type="button" class="btn btn-secondary" onclick="window.OnboardingCheckerInstance.hideOnboardingForm()">
                            <i class="fas fa-times me-2"></i>Cancel
                        </button>
                        <button type="button" class="btn btn-primary" id="nextToDocuments" onclick="window.OnboardingCheckerInstance.showDocumentsStep()" disabled>
                            <i class="fas fa-arrow-right me-2"></i>Next: Upload Documents
                        </button>
                    </div>
                </div>

                <!-- Step 2: Document Upload -->
                <div id="documentUploadSection" class="document-upload-step" style="display: none;">
                    <div class="text-center mb-4">
                        <h2 class="text-primary">
                            <i class="fas fa-upload me-2"></i>
                            Upload Required Documents
                        </h2>
                        <p class="text-muted">Please upload the required documents to complete your onboarding process.</p>
                    </div>

                    <div class="document-upload-section mb-4">
                        <h6 class="mb-3">
                            <i class="fas fa-upload me-2"></i>
                            Upload Required Documents
                        </h6>
                        <form id="documentUploadForm" enctype="multipart/form-data">
                            <div class="row">
                                <div class="col-md-6">
                                    <div class="mb-3">
                                        <label for="documentType" class="form-label">Document Type *</label>
                                        <select class="form-select" id="documentType" name="documentType" required>
                                            <option value="">Select document type...</option>
                                            <!-- Document types will be loaded dynamically -->
                                        </select>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="mb-3">
                                        <label for="documentFile" class="form-label">File *</label>
                                        <input type="file" class="form-control" id="documentFile" name="file" accept=".pdf,.jpg,.jpeg,.png" required>
                                        <div class="form-text">PDF, JPG, JPEG, PNG files up to 5MB</div>
                                    </div>
                                </div>
                            </div>
                            <div class="mb-3">
                                <label for="documentRemarks" class="form-label">Remarks (Optional)</label>
                                <textarea class="form-control" id="documentRemarks" name="remarks" rows="2" placeholder="Any additional notes about this document..."></textarea>
                            </div>
                            <div class="d-flex justify-content-between">
                                <button type="button" class="btn btn-secondary" onclick="window.OnboardingCheckerInstance.resetUploadForm()">
                                    <i class="fas fa-redo me-2"></i>Reset Form
                                </button>
                                <button type="submit" class="btn btn-primary">
                                    <i class="fas fa-upload me-2"></i>Upload Document
                                </button>
                            </div>
                        </form>
                        
                        <!-- Navigation Buttons -->
                        <div class="d-flex justify-content-between mt-4">
                            <button type="button" class="btn btn-secondary" onclick="window.OnboardingCheckerInstance.showPolicyStep()">
                                <i class="fas fa-arrow-left me-2"></i>Back to Policies
                            </button>
                            <button type="button" class="btn btn-success" onclick="window.OnboardingCheckerInstance.showDocumentsReviewStep()">
                                <i class="fas fa-eye me-2"></i>Review Uploaded Documents
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Step 2: Document Upload -->
                <div id="documentsStep" class="documents-step" style="display: none;">
                    <div class="text-center mb-4">
                        <h2 class="text-primary">
                            <i class="fas fa-file-upload me-2"></i>
                            Pre-Onboarding Documents
                        </h2>
                        <p class="text-muted">Please upload the required documents to complete your onboarding process.</p>
                    </div>

                    <!-- Progress Section -->
                    <div class="mb-4">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <span class="fw-bold">Completion Progress</span>
                            <span id="progressText" class="text-muted">0%</span>
                        </div>
                        <div class="progress-bar">
                            <div id="progressFill" class="progress-fill" style="width: 0%"></div>
                        </div>
                    </div>

                    <!-- Documents Container -->
                    <div id="documentsContainer">
                        <!-- Documents will be dynamically loaded here -->
                    </div>

                    <!-- Completion Message -->
                    <div id="completionMessage" class="completion-message" style="display: none;">
                        <i class="fas fa-check-circle fa-2x mb-3"></i>
                        <h4>All Documents Uploaded!</h4>
                        <p>Your documents have been submitted for review. You will be notified once HR completes the review process.</p>
                    </div>

                    <!-- Loading State -->
                    <div id="loadingState" class="text-center" style="display: none;">
                        <div class="loading-spinner mb-3"></div>
                        <p>Loading documents...</p>
                    </div>

                    <!-- Error State -->
                    <div id="errorState" class="text-center text-danger" style="display: none;">
                        <i class="fas fa-exclamation-triangle fa-2x mb-3"></i>
                        <p id="errorMessage">An error occurred while loading documents.</p>
                        <button class="btn btn-outline-danger" onclick="window.OnboardingCheckerInstance.loadOnboardingDocuments()">
                            <i class="fas fa-redo me-2"></i>Retry
                        </button>
                    </div>

                    <!-- Navigation Buttons -->
                    <div class="d-flex justify-content-between mt-4">
                        <button type="button" class="btn btn-secondary" onclick="window.OnboardingCheckerInstance.showDocumentsStep()">
                            <i class="fas fa-arrow-left me-2"></i>Back to Upload
                        </button>
                        <button type="button" class="btn btn-success" onclick="window.OnboardingCheckerInstance.completeOnboarding()" id="completeOnboardingBtn" style="display: none;">
                            <i class="fas fa-check me-2"></i>Complete Onboarding
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Add styles
        const styles = document.createElement('style');
        styles.textContent = `
            .onboarding-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.8);
                z-index: 9999;
                display: flex;
                justify-content: center;
                align-items: center;
            }

            .onboarding-modal {
                background: white;
                border-radius: 15px;
                padding: 30px;
                max-width: 800px;
                width: 90%;
                max-height: 90vh;
                overflow-y: auto;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            }

            .policy-documents {
                background-color: #f8f9fa;
                border-radius: 10px;
                padding: 20px;
                border: 1px solid #dee2e6;
            }

            .policy-item {
                display: flex;
                align-items: center;
                padding: 10px 0;
                border-bottom: 1px solid #e9ecef;
            }

            .policy-item:last-child {
                border-bottom: none;
            }

            .policy-item span {
                flex: 1;
                margin-left: 10px;
            }

            .agreement-section {
                background-color: #fff3cd;
                border: 1px solid #ffeaa7;
                border-radius: 10px;
                padding: 20px;
            }

            .policy-details {
                margin-top: 15px;
                padding: 15px;
                background-color: #f8f9fa;
                border-radius: 8px;
                border-left: 4px solid #007bff;
            }

            .policy-detail-item {
                display: flex;
                align-items: center;
                padding: 8px 0;
                color: #495057;
            }

            .policy-detail-item i {
                color: #007bff;
                width: 20px;
            }

            .policy-preview-section {
                border: 1px solid #dee2e6;
                border-radius: 10px;
                padding: 20px;
                background-color: #f8f9fa;
            }

            .policy-content-container {
                border: 1px solid #dee2e6;
                border-radius: 8px;
                background-color: white;
                overflow: hidden;
            }

            .policy-content-scroll {
                max-height: 400px;
                overflow-y: auto;
                padding: 20px;
                line-height: 1.6;
            }

            .policy-section {
                margin-bottom: 25px;
                padding-bottom: 20px;
                border-bottom: 1px solid #e9ecef;
            }

            .policy-section:last-child {
                border-bottom: none;
                margin-bottom: 0;
            }

            .policy-section-title {
                color: #007bff;
                font-weight: bold;
                margin-bottom: 15px;
                padding-bottom: 8px;
                border-bottom: 2px solid #007bff;
            }

            .policy-content-scroll h6 {
                font-size: 14px;
                font-weight: bold;
                margin-top: 15px;
                margin-bottom: 8px;
                color: #495057;
            }

            .policy-content-scroll p {
                margin-bottom: 10px;
                color: #495057;
            }

            .policy-content-scroll ul {
                margin-bottom: 15px;
                padding-left: 20px;
            }

            .policy-content-scroll li {
                margin-bottom: 5px;
                color: #495057;
            }

            .policy-content-scroll strong {
                color: #212529;
            }

            .document-upload-section {
                border: 1px solid #dee2e6;
                border-radius: 10px;
                padding: 20px;
                background-color: #f8f9fa;
            }

            .document-upload-section h6 {
                color: #495057;
                border-bottom: 2px solid #007bff;
                padding-bottom: 8px;
            }

            .document-upload-step {
                /* Additional styling for the upload step */
            }

            .document-card {
                border: 2px solid #e9ecef;
                border-radius: 10px;
                padding: 20px;
                margin-bottom: 20px;
                transition: all 0.3s ease;
            }

            .document-card:hover {
                border-color: #007bff;
                box-shadow: 0 5px 15px rgba(0, 123, 255, 0.1);
            }

            .document-card.uploaded {
                border-color: #28a745;
                background-color: #f8fff9;
            }

            .document-card.approved {
                border-color: #28a745;
                background-color: #d4edda;
            }

            .document-card.rejected {
                border-color: #dc3545;
                background-color: #f8d7da;
            }

            .status-badge {
                padding: 5px 12px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: bold;
                text-transform: uppercase;
            }

            .status-pending {
                background-color: #fff3cd;
                color: #856404;
            }

            .status-uploaded {
                background-color: #d1ecf1;
                color: #0c5460;
            }

            .status-approved {
                background-color: #d4edda;
                color: #155724;
            }

            .status-rejected {
                background-color: #f8d7da;
                color: #721c24;
            }

            .upload-area {
                border: 2px dashed #dee2e6;
                border-radius: 10px;
                padding: 30px;
                text-align: center;
                cursor: pointer;
                transition: all 0.3s ease;
            }

            .upload-area:hover {
                border-color: #007bff;
                background-color: #f8f9fa;
            }

            .upload-area.dragover {
                border-color: #007bff;
                background-color: #e3f2fd;
            }

            .progress-bar {
                height: 8px;
                border-radius: 4px;
                background-color: #e9ecef;
                overflow: hidden;
            }

            .progress-fill {
                height: 100%;
                background-color: #007bff;
                transition: width 0.3s ease;
            }

            .btn-close-onboarding {
                position: absolute;
                top: 15px;
                right: 20px;
                background: none;
                border: none;
                font-size: 24px;
                color: #6c757d;
                cursor: pointer;
            }

            .btn-close-onboarding:hover {
                color: #dc3545;
            }

            .completion-message {
                background: linear-gradient(135deg, #28a745, #20c997);
                color: white;
                padding: 20px;
                border-radius: 10px;
                text-align: center;
                margin-top: 20px;
            }

            .loading-spinner {
                display: inline-block;
                width: 20px;
                height: 20px;
                border: 3px solid #f3f3f3;
                border-top: 3px solid #007bff;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }

            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;

        // Add to page
        document.head.appendChild(styles);
        document.body.appendChild(overlay);

        // Prevent scrolling
        document.body.style.overflow = 'hidden';
        
        // Add event listeners for closing
        this.addCloseEventListeners();
        
        // Add form event listener
        const uploadForm = document.getElementById('documentUploadForm');
        if (uploadForm) {
            uploadForm.addEventListener('submit', this.handleDocumentUpload.bind(this));
        }
        
        console.log('🔍 OnboardingChecker: Onboarding form overlay created and displayed');
    }

    hideOnboardingForm() {
        const overlay = document.getElementById('onboardingOverlay');
        if (overlay) {
            overlay.remove();
            document.body.style.overflow = '';
            // Remove event listeners
            this.removeCloseEventListeners();
            console.log('🔍 OnboardingChecker: Onboarding form overlay removed');
        }
    }

    addCloseEventListeners() {
        // Escape key handler
        this.escapeHandler = (event) => {
            if (event.key === 'Escape') {
                this.hideOnboardingForm();
            }
        };
        document.addEventListener('keydown', this.escapeHandler);

        // Click outside modal to close
        this.clickOutsideHandler = (event) => {
            const modal = document.querySelector('.onboarding-modal');
            const overlay = document.getElementById('onboardingOverlay');
            if (event.target === overlay && !modal.contains(event.target)) {
                this.hideOnboardingForm();
            }
        };
        document.addEventListener('click', this.clickOutsideHandler);
    }

    removeCloseEventListeners() {
        if (this.escapeHandler) {
            document.removeEventListener('keydown', this.escapeHandler);
        }
        if (this.clickOutsideHandler) {
            document.removeEventListener('click', this.clickOutsideHandler);
        }
    }

    showPolicyStep() {
        document.getElementById('policyStep').style.display = 'block';
        document.getElementById('documentUploadSection').style.display = 'none';
        document.getElementById('documentsStep').style.display = 'none';
        console.log('🔍 OnboardingChecker: Showing policy step');
    }

    async showDocumentsStep() {
        document.getElementById('policyStep').style.display = 'none';
        document.getElementById('documentsStep').style.display = 'none';
        document.getElementById('documentUploadSection').style.display = 'block';
        
        // Load required documents for the dropdown
        await this.loadRequiredDocuments();
        
        console.log('🔍 OnboardingChecker: Showing document upload step');
    }

    async loadRequiredDocuments() {
        try {
            console.log('🔍 OnboardingChecker: Loading required documents...');
            
            const response = await fetch('/hr/onboarding/required-documents', {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                this.populateDocumentTypes(data.documents);
                console.log('✅ OnboardingChecker: Required documents loaded:', data.documents);
            } else {
                console.error('❌ OnboardingChecker: Failed to load required documents:', response.status);
                // Fallback to default document types
                this.populateDocumentTypes([
                    { document_type: 'Resume/CV' },
                    { document_type: 'Government ID (Passport/Driver License)' },
                    { document_type: 'Educational Certificate' },
                    { document_type: 'Professional License' },
                    { document_type: 'Medical Certificate' },
                    { document_type: 'Background Check' },
                    { document_type: 'Emergency Contact Form' },
                    { document_type: 'Bank Account Details' },
                    { document_type: 'Tax Information' },
                    { document_type: 'Other' }
                ]);
            }
        } catch (error) {
            console.error('❌ OnboardingChecker: Error loading required documents:', error);
            // Fallback to default document types
            this.populateDocumentTypes([
                { document_type: 'Resume/CV' },
                { document_type: 'Government ID (Passport/Driver License)' },
                { document_type: 'Educational Certificate' },
                { document_type: 'Professional License' },
                { document_type: 'Medical Certificate' },
                { document_type: 'Background Check' },
                { document_type: 'Emergency Contact Form' },
                { document_type: 'Bank Account Details' },
                { document_type: 'Tax Information' },
                { document_type: 'Other' }
            ]);
        }
    }

    populateDocumentTypes(documents) {
        const selectElement = document.getElementById('documentType');
        if (!selectElement) {
            console.error('❌ OnboardingChecker: Document type select element not found');
            return;
        }
        
        // Clear existing options except the first one
        selectElement.innerHTML = '<option value="">Select document type...</option>';
        
        // Add document types from backend with importance indicators
        documents.forEach(doc => {
            const option = document.createElement('option');
            option.value = doc.document_type;
            
            // Add importance indicator to the text
            let importanceIndicator = '';
            if (doc.importance_level === 'essential') {
                importanceIndicator = ' 🔴 ESSENTIAL';
            } else if (doc.importance_level === 'important') {
                importanceIndicator = ' 🟡 IMPORTANT';
            }
            
            option.textContent = doc.document_type + importanceIndicator;
            selectElement.appendChild(option);
        });
        
        console.log('✅ OnboardingChecker: Document types populated:', documents.length, 'documents');
    }

    showDocumentsReviewStep() {
        document.getElementById('policyStep').style.display = 'none';
        document.getElementById('documentUploadSection').style.display = 'none';
        document.getElementById('documentsStep').style.display = 'block';
        // Load documents when showing this step
        this.loadOnboardingDocuments();
        console.log('🔍 OnboardingChecker: Showing documents review step');
    }

    async completeOnboarding() {
        try {
            console.log('🔍 OnboardingChecker: Completing onboarding process...');
            
            const response = await fetch('/hr/onboarding/complete', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                console.log('✅ OnboardingChecker: Onboarding completed successfully');
                this.showSuccess('Onboarding completed successfully! You can now access all features.');
                setTimeout(() => {
                    this.hideOnboardingForm();
                    // Reload the page to refresh the user's access
                    window.location.reload();
                }, 2000);
            } else {
                throw new Error('Failed to complete onboarding');
            }
        } catch (error) {
            console.error('❌ OnboardingChecker: Error completing onboarding:', error);
            this.showError('Failed to complete onboarding. Please try again.');
        }
    }

    // Document upload form methods
    resetUploadForm() {
        document.getElementById('documentUploadForm').reset();
        console.log('🔍 OnboardingChecker: Upload form reset');
    }

    async handleDocumentUpload(event) {
        event.preventDefault();
        
        const formData = new FormData();
        const documentType = document.getElementById('documentType').value;
        const file = document.getElementById('documentFile').files[0];
        const remarks = document.getElementById('documentRemarks').value;
        
        if (!documentType || !file) {
            this.showError('Please select both document type and file.');
            return;
        }

        // Validate file size
        if (file.size > 5 * 1024 * 1024) {
            this.showError('File size must be less than 5MB.');
            return;
        }

        // Validate file type
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
        if (!allowedTypes.includes(file.type)) {
            this.showError('Please upload PDF, JPG, or PNG files only.');
            return;
        }

        formData.append('file', file);
        formData.append('documentType', documentType);
        if (remarks) {
            formData.append('remarks', remarks);
        }

        try {
            // Get employee ID first
            const employeeResponse = await fetch('/hr/user-data', {
                method: 'GET',
                credentials: 'include'
            });
            
            if (!employeeResponse.ok) {
                throw new Error('Failed to get employee data');
            }
            
            const employeeData = await employeeResponse.json();
            const employeeId = employeeData.employeeId;

            const response = await fetch(`/hr/onboarding/upload-document`, {
                method: 'POST',
                body: formData,
                credentials: 'include'
            });

            if (response.ok) {
                this.showSuccess('Document uploaded successfully!');
                this.resetUploadForm();
                // Reload documents to show updated status
                await this.loadOnboardingDocuments();
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Upload failed');
            }
        } catch (error) {
            console.error('Error uploading file:', error);
            this.showError('Failed to upload document. Please try again.');
        }
    }

    async initializeDocuments() {
        try {
            console.log('🔍 OnboardingChecker: Initializing pre-onboarding documents...');
            
            const response = await fetch('/hr/onboarding/initialize-new-employee', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                console.error('❌ OnboardingChecker: Failed to initialize documents:', response.status);
                return;
            }
            
            const data = await response.json();
            console.log('✅ OnboardingChecker: Documents initialized:', data);
            
        } catch (error) {
            console.error('❌ OnboardingChecker: Error initializing documents:', error);
        }
    }

    async loadOnboardingDocuments() {
        try {
            console.log('🔍 OnboardingChecker: Loading onboarding documents...');
            
            // Get employee ID first
            const employeeResponse = await fetch('/hr/user-data', {
                method: 'GET',
                credentials: 'include'
            });
            
            if (!employeeResponse.ok) {
                throw new Error('Failed to get employee data');
            }
            
            const employeeData = await employeeResponse.json();
            const employeeId = employeeData.employeeId;
            
            if (!employeeId) {
                this.showError('Employee ID not found');
                return;
            }
            
            this.showLoading();
            
            const response = await fetch(`/hr/onboarding/documents/${employeeId}`, {
                method: 'GET',
                credentials: 'include'
            });
            
            if (response.ok) {
                const data = await response.json();
                this.documents = data.documents || [];
                this.renderDocuments();
                this.updateProgress();
            } else {
                throw new Error('Failed to load documents');
            }
        } catch (error) {
            console.error('❌ OnboardingChecker: Error loading documents:', error);
            this.showError('Failed to load documents. Please try again.');
        }
    }

    renderDocuments() {
        const container = document.getElementById('documentsContainer');
        
        if (!container) {
            console.error('❌ OnboardingChecker: Documents container not found');
            return;
        }
        
        if (this.documents.length === 0) {
            container.innerHTML = `
                <div class="text-center text-muted">
                    <i class="fas fa-inbox fa-3x mb-3"></i>
                    <p>No documents required for your role.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.documents.map(doc => `
            <div class="document-card ${doc.status}" id="doc-${doc.id}">
                <div class="row align-items-center">
                    <div class="col-md-8">
                        <h5 class="mb-2">
                            <i class="fas fa-file-alt me-2"></i>
                            ${doc.document_type}
                        </h5>
                        <div class="mb-2">
                            <span class="status-badge status-${doc.status}">
                                ${doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}
                            </span>
                            ${doc.uploaded_at ? `<small class="text-muted ms-2">Uploaded: ${new Date(doc.uploaded_at).toLocaleDateString()}</small>` : ''}
                        </div>
                        ${doc.remarks ? `<p class="text-muted small mb-0"><strong>Remarks:</strong> ${doc.remarks}</p>` : ''}
                    </div>
                    <div class="col-md-4 text-end">
                        ${this.renderDocumentActions(doc)}
                    </div>
                </div>
                ${doc.status === 'pending' ? this.renderUploadArea(doc) : ''}
            </div>
        `).join('');
    }

    renderDocumentActions(doc) {
        switch (doc.status) {
            case 'pending':
                return `
                    <button class="btn btn-outline-primary btn-sm" onclick="window.OnboardingCheckerInstance.uploadDocument('${doc.document_type}')">
                        <i class="fas fa-upload me-1"></i>Upload
                    </button>
                `;
            case 'uploaded':
                return `
                    <button class="btn btn-outline-info btn-sm" onclick="window.OnboardingCheckerInstance.viewDocument('${doc.file_path}')">
                        <i class="fas fa-eye me-1"></i>View
                    </button>
                `;
            case 'approved':
                return `
                    <span class="text-success">
                        <i class="fas fa-check-circle me-1"></i>Approved
                    </span>
                `;
            case 'rejected':
                return `
                    <button class="btn btn-outline-warning btn-sm" onclick="window.OnboardingCheckerInstance.uploadDocument('${doc.document_type}')">
                        <i class="fas fa-redo me-1"></i>Re-upload
                    </button>
                `;
            default:
                return '';
        }
    }

    renderUploadArea(doc) {
        return `
            <div class="upload-area mt-3" onclick="window.OnboardingCheckerInstance.triggerFileUpload('${doc.document_type}')" 
                 ondrop="window.OnboardingCheckerInstance.handleFileDrop(event, '${doc.document_type}')" 
                 ondragover="window.OnboardingCheckerInstance.handleDragOver(event)" 
                 ondragleave="window.OnboardingCheckerInstance.handleDragLeave(event)">
                <i class="fas fa-cloud-upload-alt fa-2x text-muted mb-2"></i>
                <p class="mb-1">Click to upload or drag and drop</p>
                <p class="text-muted small">PDF, JPG, PNG files up to 5MB</p>
                <input type="file" id="file-${doc.document_type}" 
                       accept=".pdf,.jpg,.jpeg,.png" 
                       style="display: none;" 
                       onchange="window.OnboardingCheckerInstance.handleFileSelect(event, '${doc.document_type}')">
            </div>
        `;
    }

    updateProgress() {
        const total = this.documents.length;
        const completed = this.documents.filter(doc => doc.status === 'approved').length;
        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        
        if (progressFill && progressText) {
            progressFill.style.width = percentage + '%';
            progressText.textContent = percentage + '%';
        }

        // Show completion message and complete button if all documents are approved
        if (completed === total && total > 0) {
            const completionMessage = document.getElementById('completionMessage');
            const completeButton = document.getElementById('completeOnboardingBtn');
            if (completionMessage) {
                completionMessage.style.display = 'block';
            }
            if (completeButton) {
                completeButton.style.display = 'inline-block';
            }
        }
    }

    showLoading() {
        const loadingState = document.getElementById('loadingState');
        const documentsContainer = document.getElementById('documentsContainer');
        const errorState = document.getElementById('errorState');
        
        if (loadingState) loadingState.style.display = 'block';
        if (documentsContainer) documentsContainer.style.display = 'none';
        if (errorState) errorState.style.display = 'none';
    }

    showError(message) {
        const errorMessage = document.getElementById('errorMessage');
        const errorState = document.getElementById('errorState');
        const loadingState = document.getElementById('loadingState');
        const documentsContainer = document.getElementById('documentsContainer');
        
        if (errorMessage) errorMessage.textContent = message;
        if (errorState) errorState.style.display = 'block';
        if (loadingState) loadingState.style.display = 'none';
        if (documentsContainer) documentsContainer.style.display = 'none';
    }

    // File upload methods
    triggerFileUpload(documentType) {
        const fileInput = document.getElementById(`file-${documentType}`);
        if (fileInput) {
            fileInput.click();
        }
    }

    async handleFileSelect(event, documentType) {
        const file = event.target.files[0];
        if (file) {
            await this.uploadFile(file, documentType);
        }
    }

    handleDragOver(event) {
        event.preventDefault();
        event.currentTarget.classList.add('dragover');
    }

    handleDragLeave(event) {
        event.currentTarget.classList.remove('dragover');
    }

    handleFileDrop(event, documentType) {
        event.preventDefault();
        event.currentTarget.classList.remove('dragover');
        
        const files = event.dataTransfer.files;
        if (files.length > 0) {
            this.uploadFile(files[0], documentType);
        }
    }

    async uploadFile(file, documentType) {
        // Validate file
        if (file.size > 5 * 1024 * 1024) {
            alert('File size must be less than 5MB');
            return;
        }

        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
        if (!allowedTypes.includes(file.type)) {
            alert('Please upload PDF, JPG, or PNG files only');
            return;
        }

        // Create FormData
        const formData = new FormData();
        formData.append('file', file);

        try {
            // Get employee ID
            const employeeResponse = await fetch('/hr/user-data', {
                method: 'GET',
                credentials: 'include'
            });
            
            if (!employeeResponse.ok) {
                throw new Error('Failed to get employee data');
            }
            
            const employeeData = await employeeResponse.json();
            const employeeId = employeeData.employeeId;

            const response = await fetch(`/hr/onboarding/upload/${employeeId}/${documentType}`, {
                method: 'POST',
                body: formData,
                credentials: 'include'
            });

            if (response.ok) {
                // Reload documents to show updated status
                await this.loadOnboardingDocuments();
                this.showSuccess('Document uploaded successfully!');
            } else {
                throw new Error('Upload failed');
            }
        } catch (error) {
            console.error('Error uploading file:', error);
            this.showError('Failed to upload document. Please try again.');
        }
    }

    viewDocument(filePath) {
        if (filePath) {
            window.open(`/uploads/onboarding/${filePath}`, '_blank');
        }
    }

    showHRNotification(message) {
        console.log('🔍 OnboardingChecker: Showing HR notification:', message);
        
        // Create notification overlay
        const overlay = document.createElement('div');
        overlay.className = 'onboarding-overlay';
        overlay.id = 'hrNotificationOverlay';
        
        overlay.innerHTML = `
            <div class="onboarding-modal">
                <div class="text-center mb-4">
                    <i class="fas fa-info-circle fa-3x text-info mb-3"></i>
                    <h3 class="text-primary">Documents Submitted</h3>
                    <p class="text-muted">${message}</p>
                </div>
                
                <div class="alert alert-info">
                    <h6><i class="fas fa-clock me-2"></i>Next Steps:</h6>
                    <ul class="mb-0">
                        <li>HR will review your submitted documents</li>
                        <li>You will receive notification once approved</li>
                        <li>Your account will be activated after HR finalization</li>
                    </ul>
                </div>
                
                <div class="d-flex justify-content-center">
                    <button type="button" class="btn btn-primary" onclick="this.parentElement.parentElement.parentElement.remove(); document.body.style.overflow = '';">
                        <i class="fas fa-check me-2"></i>Understood
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';
    }

    showEssentialCompleteNotification(message) {
        console.log('🔍 OnboardingChecker: Showing essential complete notification:', message);
        
        // Create notification overlay
        const overlay = document.createElement('div');
        overlay.className = 'onboarding-overlay';
        overlay.id = 'essentialCompleteOverlay';
        
        overlay.innerHTML = `
            <div class="onboarding-modal">
                <div class="text-center mb-4">
                    <i class="fas fa-check-circle fa-3x text-success mb-3"></i>
                    <h3 class="text-success">Essential Documents Complete!</h3>
                    <p class="text-muted">${message}</p>
                </div>
                
                <div class="alert alert-success">
                    <h6><i class="fas fa-star me-2"></i>Account Activation Ready:</h6>
                    <ul class="mb-0">
                        <li>All essential documents have been approved</li>
                        <li>Your account can now be activated</li>
                        <li>Remaining documents can be completed later</li>
                    </ul>
                </div>
                
                <div class="d-flex justify-content-center">
                    <button type="button" class="btn btn-success" onclick="this.parentElement.parentElement.parentElement.remove(); document.body.style.overflow = '';">
                        <i class="fas fa-check me-2"></i>Great!
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';
    }

    showSuccess(message) {
        // Create a temporary success alert
        const alert = document.createElement('div');
        alert.className = 'alert alert-success alert-dismissible fade show position-fixed';
        alert.style.cssText = 'top: 20px; right: 20px; z-index: 10000; min-width: 300px;';
        alert.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        document.body.appendChild(alert);

        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (alert.parentNode) {
                alert.parentNode.removeChild(alert);
            }
        }, 3000);
    }
}

// Initialize onboarding checker when page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔍 OnboardingChecker: DOM loaded, initializing...');
    // Always try to check onboarding status
    console.log('🔍 OnboardingChecker: Creating checker...');
    window.OnboardingCheckerInstance = new OnboardingChecker();
});

// Global close function
window.closeOnboardingForm = function() {
    if (window.OnboardingCheckerInstance) {
        window.OnboardingCheckerInstance.hideOnboardingForm();
    } else {
        // Fallback: try to remove overlay directly
        const overlay = document.getElementById('onboardingOverlay');
        if (overlay) {
            overlay.remove();
            document.body.style.overflow = '';
        }
    }
};

// Global function to toggle next button based on agreement checkbox
window.toggleNextButton = function() {
    const agreementCheckbox = document.getElementById('policyAgreement');
    const nextButton = document.getElementById('nextToDocuments');
    
    if (agreementCheckbox && nextButton) {
        nextButton.disabled = !agreementCheckbox.checked;
    }
};

// Also check after login (if this script is loaded after login)
if (typeof window !== 'undefined') {
    window.OnboardingChecker = OnboardingChecker;
} 