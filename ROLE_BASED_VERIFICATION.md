# Role-Based Pre-Onboarding Verification System

## Overview

This system implements role-based boundaries for pre-onboarding verification, ensuring that the appropriate department verifies documents based on the user's role.

## Verification Boundaries

### 1. **Internal Employees** (HR Verification)
**Verified by**: HR Admin (`office_administrator` role - ID: ?)
**Required documents**:
- Resume
- Government ID
- Medical Certificate
- Emergency Contact Form
- Employment Contract

### 2. **Developers** (CRM Verification)
**Verified by**: CRM Admin (`sales_marketing_head` role - ID: ?)
**Required documents**:
- Portfolio/Work Samples
- Technical Certificates
- Developer Agreement
- Tax Identification
- Business License (if freelance)

### 3. **Suppliers** (Supply Chain Verification)
**Verified by**: Supply Chain Manager (`logistics` role - ID: ?)
**Required documents**:
- Business License
- Tax Certificates
- Supplier Agreement
- Insurance Certificates
- Quality Certifications

## Role ID Mapping

Based on your system:
- **Developer Role ID**: 25
- **Supplier Role ID**: 27
- **HR Admin Role ID**: ? (office_administrator)
- **CRM Admin Role ID**: ? (sales_marketing_head)
- **Supply Chain Role ID**: ? (logistics)

## API Endpoints

### Check Verification Permissions
```http
GET /hr/onboarding/verify-permissions/:targetUserId
```

**Response**:
```json
{
  "canVerify": true,
  "verifierRole": "office_administrator",
  "currentUserId": 123,
  "targetUserId": 456
}
```

### Get Required Documents for Role
```http
GET /hr/onboarding/required-documents/:roleId
```

**Response**:
```json
{
  "roleId": 25,
  "documents": [
    {
      "id": 1,
      "document_type": "Portfolio",
      "required_for_role_id": 25,
      "is_required": true
    },
    {
      "id": 2,
      "document_type": "Technical Certificates",
      "required_for_role_id": 25,
      "is_required": true
    }
  ],
  "count": 2
}
```

### Initialize Pre-Onboarding for User
```http
POST /hr/onboarding/initialize-user/:userId
```

**Response**:
```json
{
  "success": true,
  "message": "Initialized 3 pre-onboarding documents",
  "roleName": "developer",
  "roleId": 25,
  "documents": [...]
}
```

## Database Setup

### Required Document Types by Role

```sql
-- Developer documents (Role ID: 25)
INSERT INTO document_types (document_type, required_for_role_id, is_required) VALUES
('Portfolio/Work Samples', 25, TRUE),
('Technical Certificates', 25, TRUE),
('Developer Agreement', 25, TRUE),
('Tax Identification', 25, TRUE),
('Business License', 25, FALSE);

-- Supplier documents (Role ID: 27)
INSERT INTO document_types (document_type, required_for_role_id, is_required) VALUES
('Business License', 27, TRUE),
('Tax Certificates', 27, TRUE),
('Supplier Agreement', 27, TRUE),
('Insurance Certificates', 27, TRUE),
('Quality Certifications', 27, FALSE);

-- Internal employee documents (all other roles)
INSERT INTO document_types (document_type, required_for_role_id, is_required) VALUES
('Resume', NULL, TRUE),
('Government ID', NULL, TRUE),
('Medical Certificate', NULL, TRUE),
('Emergency Contact Form', NULL, TRUE),
('Employment Contract', NULL, TRUE);
```

## Verification Process Flow

### 1. **User Registration**
1. User registers with specific role
2. System determines required documents based on role
3. Pre-onboarding documents are initialized

### 2. **Document Submission**
1. User uploads required documents
2. Documents are marked as 'uploaded' status
3. System notifies appropriate verifier

### 3. **Document Verification**
1. **HR Admin** verifies internal employees
2. **CRM Admin** verifies developers
3. **Supply Chain Manager** verifies suppliers
4. Documents are marked as 'approved' or 'rejected'

### 4. **Access Grant**
1. All documents approved = onboarding completed
2. User gains full system access
3. `onboarding_completed` set to 1

## Implementation Example

### Frontend Integration

```javascript
// Check if current user can verify target user
async function checkVerificationPermissions(targetUserId) {
    const response = await fetch(`/hr/onboarding/verify-permissions/${targetUserId}`);
    const data = await response.json();
    
    if (data.canVerify) {
        console.log(`Can verify user. Required role: ${data.verifierRole}`);
        // Show verification interface
    } else {
        console.log('Cannot verify this user - insufficient permissions');
        // Hide verification interface
    }
}

// Get required documents for a role
async function getRequiredDocuments(roleId) {
    const response = await fetch(`/hr/onboarding/required-documents/${roleId}`);
    const data = await response.json();
    
    console.log(`Required documents for role ${roleId}:`, data.documents);
    return data.documents;
}

// Initialize pre-onboarding for a user
async function initializePreOnboarding(userId) {
    const response = await fetch(`/hr/onboarding/initialize-user/${userId}`, {
        method: 'POST'
    });
    const data = await response.json();
    
    if (data.success) {
        console.log(`Initialized ${data.documents.length} documents for ${data.roleName}`);
    }
}
```

## Security Considerations

### 1. **Permission Checks**
- Always verify current user has appropriate role
- Check permissions before allowing document review
- Log all verification activities

### 2. **Data Validation**
- Validate file types and sizes
- Sanitize all user inputs
- Verify document authenticity

### 3. **Audit Trail**
- Track who verified which documents
- Maintain verification timestamps
- Store verification remarks

## Error Handling

### Common Scenarios

#### Insufficient Permissions
```json
{
  "error": "Insufficient permissions to verify this user",
  "requiredRole": "office_administrator",
  "currentRole": "developer"
}
```

#### No Required Documents
```json
{
  "message": "No required documents for this role",
  "roleName": "developer",
  "roleId": 25
}
```

#### User Not Found
```json
{
  "error": "User not found",
  "userId": 999
}
```

## Configuration

### Role-Based Document Requirements

You can customize the required documents for each role by updating the `document_types` table:

```sql
-- Add new document type for developers
INSERT INTO document_types (document_type, required_for_role_id, is_required) 
VALUES ('Code Samples', 25, TRUE);

-- Add new document type for suppliers
INSERT INTO document_types (document_type, required_for_role_id, is_required) 
VALUES ('ISO Certification', 27, FALSE);
```

### Verification Role Mapping

Update the verification boundaries in the model:

```javascript
const verificationMap = {
    // Add new roles here
    'new_role': 'verifier_role',
    'another_role': 'another_verifier'
};
```

This system ensures that each department handles their own user verification while maintaining proper security boundaries. 