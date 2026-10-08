const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../standups.db');
const db = new sqlite3.Database(dbPath);

// Initialize DB
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS user_commitments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_name TEXT NOT NULL,
            date TEXT NOT NULL,
            commitments TEXT NOT NULL
        )
    `);
});

/**
 * Save commitments for a user from today's standup
 * @param {string} userName
 * @param {Array<string>} commitments 
 */
function saveCommitments(userName, commitments) {
    return new Promise((resolve, reject) => {
        const date = new Date().toISOString().split('T')[0];
        const commitmentsJson = JSON.stringify(commitments);
        
        db.run(
            `INSERT INTO user_commitments (user_name, date, commitments) VALUES (?, ?, ?)`,
            [userName, date, commitmentsJson],
            function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            }
        );
    });
}

/**
 * Get the most recent commitments for a user
 * @param {string} userName
 * @returns {Promise<Array<string>>}
 */
function getPreviousCommitments(userName) {
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT commitments FROM user_commitments WHERE user_name = ? ORDER BY date DESC LIMIT 1`,
            [userName],
            (err, row) => {
                if (err) {
                    reject(err);
                } else if (row) {
                    try {
                        resolve(JSON.parse(row.commitments));
                    } catch (e) {
                        resolve([]);
                    }
                } else {
                    resolve([]);
                }
            }
        );
    });
}

module.exports = {
    saveCommitments,
    getPreviousCommitments
};
