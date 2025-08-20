import { describe, it, expect } from "vitest";
import { CommentService } from "../src/modules/comment/comment.service";

describe("CommentService", () => {
  it("loads service module", () => {
    expect(CommentService).toBeTruthy();
  });
});
