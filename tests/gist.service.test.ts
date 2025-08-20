import { describe, it, expect } from "vitest";
import { GistService } from "../src/modules/gist/gist.service";

describe("GistService", () => {
  it("loads service module", () => {
    expect(GistService).toBeTruthy();
  });
});
