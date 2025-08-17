import pool from "../../config/connectDB";
import type { IUser } from "./user.interface";

export const createUser = async (user: Partial<IUser>): Promise<IUser> => {
  const sql = `
    INSERT INTO users
      (user_name, last_name, email, password, phone_number, is_active, is_verified, roles)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    RETURNING id, user_name AS "userName", last_name AS "lastName", email, phone_number AS "phoneNumber",
              is_active AS "isActive", is_verified AS "isVerified", roles, created_at AS "createdAt", updated_at AS "updatedAt"
  `;
  const values = [
    user.userName,
    user.lastName,
    user.email,
    user.password,
    user.phoneNumber,
    user.isActive ?? true,
    user.isVerified ?? false,
    user.roles ?? ["user"],
  ];
  const { rows } = await pool.query(sql, values);
  return rows[0];
};

export const findUserByEmail = async (email: string): Promise<IUser | null> => {
  const { rows } = await pool.query(
    `SELECT id, user_name AS "userName", last_name AS "lastName", email, phone_number AS "phoneNumber",
            is_active AS "isActive", is_verified AS "isVerified", roles, created_at AS "createdAt", updated_at AS "updatedAt"
     FROM users WHERE email = $1`,
    [email]
  );
  return rows[0] ?? null;
};

export const findUserById = async (id: number): Promise<IUser | null> => {
  const { rows } = await pool.query(
    `SELECT id, user_name AS "userName", last_name AS "lastName", email, phone_number AS "phoneNumber",
            is_active AS "isActive", is_verified AS "isVerified", roles, created_at AS "createdAt", updated_at AS "updatedAt"
     FROM users WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
};
