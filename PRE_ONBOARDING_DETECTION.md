# Pre-Onboarding Detection System

## Overview

This system detects newly hired employees who need to complete pre-onboarding documents before accessing the main system features. It prevents access for users who haven't submitted required documents and had them verified by HR.

## User Types and Pre-Onboarding Requirements

### 1. **Internal Employees** (Need Pre-Onboarding)
- Regular employees with `employee_id`
- Internal roles like 'admin_staff', 'office_administrator', 'finance_accounting', etc.
- Must complete pre-onboarding documents

### 2. **External Users** (No Pre-Onboarding Required)
- **Developers**: Role name 'developer'
- **Suppliers**: Role name 'supplier'
- **Clients/Vendors**: Role names 'client', 'vendor'
- These users are clients/partners, not employees
- No pre-onboarding required

### 3. **Legacy Employees** (Automatically Completed)
- Existing employees before pre-onboarding system
- Automatically marked as `onboarding_completed = 1`

## How It Works

### 1. **Detection Logic**

The system uses the `onboarding_completed` field in the `users` table to determine if a user needs pre-onboarding:

- **New employees**: `onboarding_completed = 0` (set by `createUserWithOnboardingPending`)
- **Completed employees**: `onboarding_completed = 1` (after HR completes onboarding)
- **Legacy employees**: `onboarding_completed = 1` (updated by migration script)
- **External users**: No pre-onboarding required (based on role name)

### 2. **Detection Process**

The `checkIfUserNeedsPreOnboarding` function performs these checks:

1. **User Authentication**: Verifies user exists and is authenticated
2. **Onboarding Status**: Checks if `onboarding_completed = 1`
3. **Role Check**: Checks if user has an external role (developer, supplier, client, vendor)
4. **Employee Status**: Confirms user has an `employee_id` (internal employee)
5. **Document Existence**: Checks if pre-onboarding documents exist
6. **Document Completion**: Verifies all documents are approved

### 3. **Role-Based Handling**

- **Internal Employees**: Must complete pre-onboarding
- **External Users (Developers/Suppliers)**: No pre-onboarding required (based on role name)
- **Legacy Employees**: Automatically marked as completed

## Implementation

### API Endpoints

#### Check if User Needs Pre-Onboarding
```http
GET /hr/onboarding/check-needs
```

**Response for Internal Employee:**
```json
{
  "needsOnboarding": true,
  "reason": "Pre-onboarding required",
  "employeeId": "2025-1001",
  "totalDocuments": 3,
  "approvedDocuments": 1
}
```

**Response for External User:**
```json
{
  "needsOnboarding": false,
  "reason": "External user - no pre-onboarding required"
}
```

#### Initialize Pre-Onboarding for Legacy Employee
```http
POST /hr/onboarding/initialize-legacy/:employeeId
```

### Middleware Usage

Add the middleware to routes that should be blocked for users needing pre-onboarding:

```javascript
const authMiddleware = require('./departments/hr/middleware/hrAuthMiddleware');

// Block access for users needing pre-onboarding
router.get('/protected-route', 
  authMiddleware.verifySession, 
  authMiddleware.checkPreOnboardingRequired, 
  controllerFunction
);
```

### Database Schema

#### Users Table
```sql
ALTER TABLE users ADD COLUMN onboarding_completed BOOLEAN DEFAULT 0;
```

**Note**: The system uses the existing `role_id` field to link to the `roles` table for determining user types.

#### Pre-Onboarding Documents Table
```sql
CREATE TABLE pre_onboarding_documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  employee_id VARCHAR(20) NOT NULL,
  document_type VARCHAR(100) NOT NULL,
  file_path VARCHAR(500),
  status ENUM('pending', 'uploaded', 'approved', 'rejected') DEFAULT 'pending',
  remarks TEXT,
  reviewed_by INT,
  uploaded_at TIMESTAMP NULL,
  reviewed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (employee_id) REFERENCES employees(employee_id),
  UNIQUE KEY unique_employee_document (employee_id, document_type)
);
```

## Usage Examples

### 1. **Frontend Integration**

Check onboarding status when user logs in:

```javascript
// Check if user needs pre-onboarding
fetch('/hr/onboarding/check-needs')
  .then(response => response.json())
  .then(data => {
    if (data.needsOnboarding) {
      // Redirect to pre-onboarding form
      window.location.href = '/hr/onboarding-form';
    } else {
      // Allow access to main system
      window.location.href = '/dashboard';
    }
  });
```

### 2. **Route Protection**

Protect specific routes from users needing pre-onboarding:

```javascript
// In your route file
router.get('/attendance', 
  authMiddleware.verifySession, 
  authMiddleware.checkPreOnboardingRequired, 
  attendanceController.getAttendance
);
```

### 3. **Legacy Employee Migration**

Run the migration script to update existing employees:

```bash
node backend/update_legacy_employees.js
```

## Configuration

### Required Document Types

Set up document types in the `document_types` table:

```sql
INSERT INTO document_types (document_type, required_for_role_id, is_required) VALUES
('Resume', NULL, TRUE),
('Government ID', NULL, TRUE),
('Medical Certificate', NULL, TRUE),
('Emergency Contact Form', NULL, TRUE);
```

### Role-Specific Documents

```sql
INSERT INTO document_types (document_type, required_for_role_id, is_required) VALUES
('Driver License', (SELECT id FROM roles WHERE name = 'driver'), TRUE),
('Safety Training Certificate', (SELECT id FROM roles WHERE name = 'manufacturing'), TRUE);
```

## Error Handling

### Common Responses

#### Internal Employee Needs Pre-Onboarding
```json
{
  "error": "Pre-onboarding required",
  "message": "Please complete your pre-onboarding documents before accessing this feature",
  "needsOnboarding": true,
  "employeeId": "2025-1001",
  "totalDocuments": 3,
  "approvedDocuments": 1
}
```

#### External User (No Pre-Onboarding Required)
```json
{
  "needsOnboarding": false,
  "reason": "External user - no pre-onboarding required"
}
```

#### User Not Authenticated
```json
{
  "error": "User not authenticated"
}
```

## Best Practices

### 1. **Graceful Degradation**
- Always provide clear error messages
- Redirect users to appropriate forms
- Don't break existing functionality

### 2. **Performance**
- Cache onboarding status in session
- Use database indexes on frequently queried fields
- Minimize database queries

### 3. **Security**
- Verify user permissions before allowing document uploads
- Validate file types and sizes
- Sanitize all user inputs

### 4. **User Experience**
- Provide clear progress indicators
- Show which documents are missing
- Allow users to save progress

## Troubleshooting

### Common Issues

1. **Legacy employees getting blocked**
   - Run the migration script
   - Check if `onboarding_completed` is set to 1

2. **New employees not getting blocked**
   - Verify `createUserWithOnboardingPending` is used
   - Check if `onboarding_completed` is set to 0

3. **External users getting blocked**
   - Ensure external users have the correct role names (developer, supplier, client, vendor)
   - Check the detection logic for external users

4. **Developers/suppliers getting blocked**
   - Verify they have the correct role names in the `roles` table
   - Check if they have `employee_id` (they shouldn't)

### Debug Logging

Enable debug logging by checking console output:
- `🔍 HR Model: checkIfUserNeedsPreOnboarding called`
- `🔍 HR Controller: checkIfUserNeedsPreOnboarding called`
- `🔍 HR Middleware: checkPreOnboardingRequired called`

## Migration Guide

### Step 1: Update Database Schema
```sql
ALTER TABLE users ADD COLUMN onboarding_completed BOOLEAN DEFAULT 0;
```

### Step 2: Run Legacy Employee Update
```bash
node backend/update_legacy_employees.js
```

### Step 3: Update New Employee Creation
Ensure new employees use `createUserWithOnboardingPending` instead of `createUser`.

### Step 4: Add Middleware to Protected Routes
Add `authMiddleware.checkPreOnboardingRequired` to routes that should be blocked.

### Step 5: Update Frontend
Add onboarding status checks to your frontend application. 