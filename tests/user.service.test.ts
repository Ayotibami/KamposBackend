import { describe, it, expect } from "vitest";
import UserService from "../src/modules/user/user.service";

describe("UserService", () => {
  it("loads service module", () => {
    expect(UserService).toBeTruthy();
  });
});
