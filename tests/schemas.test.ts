import { describe, it, expect } from "vitest";
import { z } from "zod";

// Import schema classes from modules
import { GistSchemas } from "../src/modules/gist/gist.schema";
import { CommentSchemas } from "../src/modules/comment/comment.schema";
import { MediaSchemas } from "../src/modules/media/media.schema";
import { ReactionSchemas } from "../src/modules/reaction/reaction.schema";
import { EventSchemas } from "../src/modules/event/event.schema";
import { EventRegistrationSchemas } from "../src/modules/event-registration/event-registration.schema";
import { ReportSchemas } from "../src/modules/report/report.schema";
import { ViewSchemas } from "../src/modules/view/view.schema";
import { AuthSchemas } from "../src/modules/auth/auth.schema";
import { userSchema } from "../src/modules/user/user.schema";

const isZodSchema = (schema: any): schema is z.ZodTypeAny =>
  !!schema && typeof schema.parse === "function" && typeof schema.safeParse === "function";

const expectZod = (schema: any, name: string) => {
  expect(isZodSchema(schema)).toBe(true);
};

describe("Schema exports exist and are Zod schemas", () => {
  it("GistSchemas exports", () => {
    expectZod(GistSchemas.createGist, "GistSchemas.createGist");
    expectZod(GistSchemas.updateGist, "GistSchemas.updateGist");
  });

  it("CommentSchemas exports", () => {
    expectZod(CommentSchemas.createComment, "CommentSchemas.createComment");
  });

  it("MediaSchemas exports", () => {
    expectZod(MediaSchemas.uploadMedia, "MediaSchemas.uploadMedia");
  });

  it("ReactionSchemas exports", () => {
    expectZod(ReactionSchemas.createReaction, "ReactionSchemas.createReaction");
  });

  it("EventSchemas exports", () => {
    expectZod(EventSchemas.createEvent, "EventSchemas.createEvent");
    expectZod(EventSchemas.updateEvent, "EventSchemas.updateEvent");
  });

  it("EventRegistrationSchemas exports", () => {
    expectZod(EventRegistrationSchemas.createRegistration, "EventRegistrationSchemas.createRegistration");
  });

  it("ReportSchemas exports", () => {
    expectZod(ReportSchemas.createReport, "ReportSchemas.createReport");
    expectZod(ReportSchemas.updateReport, "ReportSchemas.updateReport");
  });

  it("ViewSchemas exports", () => {
    expectZod(ViewSchemas.createView, "ViewSchemas.createView");
  });

  it("AuthSchemas exports", () => {
    expectZod(AuthSchemas.register, "AuthSchemas.register");
    expectZod(AuthSchemas.login, "AuthSchemas.login");
  });

  it("userSchema export", () => {
    expectZod(userSchema, "userSchema");
  });
});
