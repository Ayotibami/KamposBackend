import request from "supertest";
import app from "../src/app";
import { describe, it, expect } from "bun:test";

describe("GET /", () => {
  it("responds with Hello World!", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.text).toBe("Hello World!");
  });
});
