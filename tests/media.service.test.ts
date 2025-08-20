import { describe, it, expect } from "vitest";
import { MediaService } from "../src/modules/media/media.service";

describe("MediaService", () => {
  it("loads service module", () => {
    expect(MediaService).toBeTruthy();
  });
});
