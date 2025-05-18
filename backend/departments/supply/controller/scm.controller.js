const SCMModel = require('../model/scm.model');
const { sendSupplierAccountNotification } = require('../../../utils/emailService');

const SCMController = {
    // Get all suppliers
    getAllSuppliers: async (req, res) => {
        try {
            const suppliers = await SCMModel.getAllSuppliers();
            res.json(suppliers);
        } catch (error) {
            console.error('Error fetching suppliers:', error);
            res.status(500).json({ error: 'Failed to fetch suppliers.' });
        }
    },

    addSupplier: async (req, res) => {
        try {
            const {
                supplier_name,
                contact_name,
                contact_email,
                contact_phone,
                address,
                city,
                postal_code,
                country,
                account_number,
                payment_terms
            } = req.body;

            // Basic validation
            if (!supplier_name || !contact_name || !contact_email || !contact_phone || 
                !address || !city || !postal_code || !country || !account_number || !payment_terms) {
                return res.status(400).json({ error: 'All fields are required.' });
            }

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(contact_email)) {
                return res.status(400).json({ error: 'Invalid email format.' });
            }

            // Validate phone number (11 digits)
            if (!/^\d{11}$/.test(contact_phone)) {
                return res.status(400).json({ error: 'Phone number must be exactly 11 digits.' });
            }

            // Insert supplier and create accounts
            const { supplierId, userId } = await SCMModel.addSupplier({
                supplier_name,
                contact_name,
                contact_email,
                contact_phone,
                address,
                city,
                postal_code,
                country,
                account_number,
                payment_terms,
                status: 'active'
            });

            // Send supplier account email (do not block response if it fails)
            sendSupplierAccountNotification(
                contact_email,
                supplier_name,
                'default123',
                'https://mdb-construction-25b433e6e5d5.herokuapp.com/'
            ).catch(err => console.error('Failed to send supplier account email:', err));

            res.status(201).json({ 
                message: 'Supplier and accounts created successfully.',
                supplierId,
                userId,
                defaultPassword: 'default123' // Include this so the frontend can show it
            });
        } catch (error) {
            console.error('Error adding supplier:', error);
            if (error.code === 'ER_DUP_ENTRY') {
                if (error.message.includes('username')) {
                    res.status(400).json({ error: 'A supplier with this name already exists.' });
                } else if (error.message.includes('email')) {
                    res.status(400).json({ error: 'A supplier with this email already exists.' });
                } else {
                    res.status(400).json({ error: 'Duplicate entry found.' });
                }
            } else {
                res.status(500).json({ error: 'Failed to add supplier.' });
            }
        }
    },

    updateSupplier: async (req, res) => {
        try {
            const {
                supplier_id,
                supplier_name,
                contact_name,
                contact_email,
                contact_phone,
                address,
                city,
                postal_code,
                country,
                account_number,
                payment_terms,
                status
            } = req.body;

            if (!supplier_id || !supplier_name || !contact_name || !contact_email || !contact_phone || !address || !city || !postal_code || !country || !account_number || !payment_terms) {
                return res.status(400).json({ error: 'All fields are required.' });
            }

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(contact_email)) {
                return res.status(400).json({ error: 'Invalid email format.' });
            }

            if (!/^\d{11}$/.test(contact_phone)) {
                return res.status(400).json({ error: 'Phone number must be exactly 11 digits.' });
            }

            await SCMModel.updateSupplier(supplier_id, {
                supplier_name,
                contact_name,
                contact_email,
                contact_phone,
                address,
                city,
                postal_code,
                country,
                account_number,
                payment_terms,
                status: status || 'active'
            });

            res.json({ message: 'Supplier updated successfully.' });
        } catch (error) {
            console.error('Error updating supplier:', error);
            res.status(500).json({ error: 'Failed to update supplier.' });
        }
    },

    addPurchaseRequest: async (req, res) => {
        try {
            const { request_date, department, material_type, quantity, unit, justification } = req.body;
            // Restrict to logistics department
            if (!req.session || !req.session.user || req.session.user.role_name !== 'logistics') {
                return res.status(403).json({ error: 'Forbidden: Logistics access required.' });
            }
            // Use session username for requested_by
            const requested_by = req.session.user.username;
            if (!request_date || !department || !material_type || !quantity || !unit || !justification) {
                return res.status(400).json({ error: 'All fields are required.' });
            }
            const insertId = await SCMModel.addPurchaseRequest({
                request_date,
                requested_by,
                department,
                material_type,
                quantity,
                unit,
                justification,
                status: 'Pending'
            });
            res.status(201).json({ message: 'Purchase request created successfully.', request_id: insertId });
        } catch (error) {
            console.error('Error creating purchase request:', error);
            res.status(500).json({ error: 'Failed to create purchase request.' });
        }
    }
};

module.exports = SCMController;
