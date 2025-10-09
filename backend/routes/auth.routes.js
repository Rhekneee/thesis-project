const express = require('express');
const { login, logout, getCurrentUser } = require('../controllers/auth.controller');

const router = express.Router();

router.post('/login', login);
router.get('/logout', logout);
router.get('/current-user', getCurrentUser);
router.get('/test', (req, res) => {
    res.json({ message: 'Auth routes are working!' });
});

module.exports = router;
