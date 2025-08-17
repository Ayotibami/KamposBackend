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
            password, is_active AS "isActive", is_verified AS "isVerified", roles, created_at AS "createdAt", updated_at AS "updatedAt"
     FROM users WHERE email = $1`,
    [email]
  );
  return rows[0] ?? null;
};

export const findUserById = async (id: number): Promise<IUser | null> => {
  const { rows } = await pool.query(
    `SELECT id, user_name AS "userName", last_name AS "lastName", email, phone_number AS "phoneNumber",
            password, is_active AS "isActive", is_verified AS "isVerified", roles, created_at AS "createdAt", updated_at AS "updatedAt"
     FROM users WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
};

export const updateUserById = async (id: number, updates: Partial<IUser>): Promise<IUser | null> => {
  const setClauses: string[] = [];
  const values: any[] = [];
  let idx = 1;

  const mapKeyToColumn = (key: string) => {
    switch (key) {
      case "userName":
        return "user_name";
      case "lastName":
        return "last_name";
      case "phoneNumber":
        return "phone_number";
      case "isActive":
        return "is_active";
      case "isVerified":
        return "is_verified";
      case "password":
        return "password";
      case "roles":
        return "roles";
      default:
        return key;
    }
  };

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined || key === "id" || key === "createdAt" || key === "updatedAt") continue;
    const column = mapKeyToColumn(key);
    setClauses.push(`${column} = $${idx++}`);
    values.push(value);
  }

  if (setClauses.length === 0) {
    return findUserById(id);
  }

  // always update updated_at
  setClauses.push(`updated_at = now()`);

  const sql = `
    UPDATE users
    SET ${setClauses.join(", ")}
    WHERE id = $${idx}
    RETURNING id, user_name AS "userName", last_name AS "lastName", email, phone_number AS "phoneNumber",
              is_active AS "isActive", is_verified AS "isVerified", roles, created_at AS "createdAt", updated_at AS "updatedAt"
  `;
  values.push(id);

  const { rows } = await pool.query(sql, values);
  return rows[0] ?? null;
};
