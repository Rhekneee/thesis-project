const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    multipleStatements: true
});

// ✅ Test Connection (Promise-based)
(async () => {
    try {
        const connection = await db.getConnection();
<<<<<<< HEAD
<<<<<<< HEAD
        console.log(`✅ Connected to MySQL at host: ${process.env.DB_HOST}`);
=======
        console.log('✅ Connected to Laragon MySQL!');
>>>>>>> 85f9240 (Initial commit)
=======
        console.log('✅ Connected to Laragon MySQL!');
>>>>>>> aa1bb20 (Initial commit)
        connection.release();
    } catch (err) {
        console.error('❌ MySQL Connection Error:', err.message);
    }
})();

<<<<<<< HEAD
<<<<<<< HEAD

=======
>>>>>>> 85f9240 (Initial commit)
=======
>>>>>>> aa1bb20 (Initial commit)
module.exports = db;
