"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllCampuses = getAllCampuses;
exports.getAllMajors = getAllMajors;
const db_1 = require("../../config/db");
async function getAllCampuses() {
    const { rows } = await db_1.pool.query('SELECT campus_tag, campus_name FROM campus ORDER BY campus_name ASC');
    return rows;
}
async function getAllMajors() {
    const { rows } = await db_1.pool.query('SELECT major_tag, major_name FROM major ORDER BY major_name ASC');
    return rows;
}
