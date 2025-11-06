// const mysql = require('mysql2/promise');
// const dotenv = require('dotenv');

// dotenv.config();

// const db = mysql.createPool({
//     host: process.env.DB_HOST,
//     user: process.env.DB_USER,
//     password: process.env.DB_PASSWORD || '',
//     database: process.env.DB_NAME,
//     port: process.env.DB_PORT || 3306,
//     waitForConnections: true,
//     connectionLimit: 10,
//     queueLimit: 0,
//     multipleStatements: true
// });

// // ✅ Test Connection (Promise-based)
// (async () => {
//     try {
//         const connection = await db.getConnection();
//         console.log(`✅ Connected to MySQL at host: ${process.env.DB_HOST}`);
//         connection.release();
//     } catch (err) {
//         console.error('❌ MySQL Connection Error:', err.message);
//     }
// })();


// module.exports = db;
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

let dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  multipleStatements: true
};

// ✅ Use JAWSDB_URL if available (on Heroku)
if (process.env.JAWSDB_URL) {
  dbConfig = process.env.JAWSDB_URL;
  console.log("🌐 Using Heroku JAWSDB configuration");
}

const db = mysql.createPool(dbConfig);

(async () => {
  try {
    const connection = await db.getConnection();
    console.log(`✅ Connected to MySQL at host: ${process.env.DB_HOST || 'JAWSDB'}`);
    connection.release();
  } catch (err) {
    console.error('❌ MySQL Connection Error:', err.message);
  }
})();

module.exports = db;
