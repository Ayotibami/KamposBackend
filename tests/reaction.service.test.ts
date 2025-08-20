import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ReactionService } from "../src/modules/reaction/reaction.service";

// Mock dependent modules used inside ReactionService
vi.mock("../src/modules/gist/gist.model", () => ({
  findGistById: vi.fn(),
}));
vi.mock("../src/modules/comment/comment.model", () => ({
  findCommentById: vi.fn(),
}));
vi.mock("../src/modules/profile/profile.model", () => ({
  findProfileByAvitag: vi.fn(),
}));
vi.mock("../src/modules/notification/notification.service", () => ({
  NotificationService: {
    createNotification: vi.fn(),
  },
}));
vi.mock("../src/modules/reaction/reaction.model", () => ({
  findReactionsByEntity: vi.fn(),
  createReaction: vi.fn(),
}));

// Import mocks' types to control behavior
import * as gistRepo from "../src/modules/gist/gist.model";
import * as commentRepo from "../src/modules/comment/comment.model";
import * as profileRepo from "../src/modules/profile/profile.model";
import * as notificationService from "../src/modules/notification/notification.service";
import * as reactionRepo from "../src/modules/reaction/reaction.model";
import { ApiError } from "../src/utils/responseHandler";

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ReactionService.createReaction", () => {
  it("forbids reacting to unapproved gist by non-owner non-admin", async () => {
    // Arrange: target is a GIST, unapproved, actor not owner and not admin
    (gistRepo.findGistById as any).mockResolvedValue({
      avitag: "owner-123",
      gistApproval: false,
    });
    (profileRepo.findProfileByAvitag as any).mockResolvedValue({
      avitag: "actor-456",
      profileType: "STUDENT",
    });

    // Act + Assert
    await expect(
      ReactionService.createReaction("actor-456", {
        entityType: "GIST",
        entityId: "gist-1",
        type: "LIKE",
      })
    ).rejects.toBeInstanceOf(ApiError);
  });

  it("creates reaction and notifies target when actor != target", async () => {
    (gistRepo.findGistById as any).mockResolvedValue({
      avitag: "target-123",
      gistApproval: true,
    });
    (reactionRepo.findReactionsByEntity as any).mockResolvedValue([]);
    (reactionRepo.createReaction as any).mockResolvedValue({
      reactionId: "rx-1",
      avitag: "actor-456",
      type: "LIKE",
    });
    (profileRepo.findProfileByAvitag as any).mockResolvedValue({
      avitag: "actor-456",
      displayName: "Alice",
    });

    const res = await ReactionService.createReaction("actor-456", {
      entityType: "GIST",
      entityId: "gist-1",
      type: "LIKE",
    });

    expect(res.success).toBe(true);
    expect(notificationService.NotificationService.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        avitag: "target-123",
        referenceId: "rx-1",
      })
    );
  });
});
