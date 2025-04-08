const express = require('express');
<<<<<<< HEAD
<<<<<<< HEAD
const { login, logout, getCurrentUser } = require('../controllers/auth.controller');
=======
const { login, logout } = require('../controllers/auth.controller');
>>>>>>> 85f9240 (Initial commit)
=======
const { login, logout } = require('../controllers/auth.controller');
>>>>>>> aa1bb20 (Initial commit)

const router = express.Router();

router.post('/login', login);
router.get('/logout', logout);
<<<<<<< HEAD
<<<<<<< HEAD
router.get('/current-user', getCurrentUser);
router.get('/test', (req, res) => {
    res.json({ message: 'Auth routes are working!' });
});
=======
>>>>>>> 85f9240 (Initial commit)
=======
>>>>>>> aa1bb20 (Initial commit)

module.exports = router;
