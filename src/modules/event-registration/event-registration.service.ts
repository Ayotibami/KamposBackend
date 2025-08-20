import { ApiError, ApiSuccess } from "../../utils/responseHandler";
import * as eventRegistrationRepo from "./event-registration.model";
import * as eventRepo from "../event/event.model";
import * as profileRepo from "../profile/profile.model";
import type { IEventRegistration } from "./event-registration.interface";

export class EventRegistrationService {
  static async createRegistration(avitag: string, eventId: string) {
    const event = await eventRepo.findEventById(eventId);
    if (!event) throw ApiError.notFound("Event not found");
    const profile = await profileRepo.findProfileByAvitag(avitag);
    if (!profile || profile.profile_type !== "STUDENT")
      throw ApiError.forbidden("Only students can register for events");
    const existing = await eventRegistrationRepo.findRegistrationsByEventId(
      eventId
    );
    if (existing.some((reg) => reg.studentAviTag === avitag)) {
      throw ApiError.badRequest("Already registered for this event");
    }
    const registration = await eventRegistrationRepo.createEventRegistration({
      eventId,
      studentAviTag: avitag,
    });
    return ApiSuccess.created("Registration created", registration);
  }

  static async getRegistrationsByEvent(eventId: string) {
    const event = await eventRepo.findEventById(eventId);
    if (!event) throw ApiError.notFound("Event not found");
    const registrations =
      await eventRegistrationRepo.findRegistrationsByEventId(eventId);
    return ApiSuccess.ok("Registrations fetched", registrations);
  }

  static async getRegistrationsByStudent(avitag: string) {
    const profile = await profileRepo.findProfileByAvitag(avitag);
    if (!profile) throw ApiError.notFound("Profile not found");
    const registrations =
      await eventRegistrationRepo.findRegistrationsByStudent(avitag);
    return ApiSuccess.ok("Registrations fetched", registrations);
  }

  static async deleteRegistration(id: number, avitag: string) {
    const registration = await eventRegistrationRepo.findRegistrationById(id);
    if (!registration) throw ApiError.notFound("Registration not found");
    if (registration.studentAviTag !== avitag)
      throw ApiError.forbidden("Not authorized to delete this registration");
    await eventRegistrationRepo.deleteRegistrationById(id);
    return ApiSuccess.ok("Registration deleted");
  }
}
