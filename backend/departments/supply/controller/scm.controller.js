const SCMModel = require('../model/scm.model');

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
    }
};

module.exports = SCMController;
