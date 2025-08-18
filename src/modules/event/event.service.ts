import { ApiError, ApiSuccess } from "../../utils/responseHandler";
import * as eventRepo from "./event.model";
import * as profileRepo from "../profile/profile.model";
import type { IEvent } from "./event.interface";

export class EventService {
  static async createEvent(avitag: string, eventData: Partial<IEvent>) {
    if (!eventData.hostAviTags?.includes(avitag)) {
      throw ApiError.forbidden("You must be a host to create this event");
    }
    for (const hostAviTag of eventData.hostAviTags!) {
      const profile = await profileRepo.findProfileByAvitag(hostAviTag);
      if (!profile)
        throw ApiError.notFound(`Profile with avitag ${hostAviTag} not found`);
    }
    const event = await eventRepo.createEvent(eventData);
    return ApiSuccess.created("Event created", event);
  }

  static async getEventById(eventId: string) {
    const event = await eventRepo.findEventById(eventId);
    if (!event) throw ApiError.notFound("Event not found");
    return ApiSuccess.ok("Event fetched", event);
  }

  static async getEventsByCampus(campusTag: string) {
    const events = await eventRepo.findEventsByCampus(campusTag);
    return ApiSuccess.ok("Events fetched", events);
  }

  static async updateEvent(
    eventId: string,
    avitag: string,
    updates: Partial<IEvent>
  ) {
    const event = await eventRepo.findEventById(eventId);
    if (!event) throw ApiError.notFound("Event not found");
    if (!event.hostAviTags.includes(avitag))
      throw ApiError.forbidden("Not authorized to update this event");
    if (updates.hostAviTags) {
      for (const hostAviTag of updates.hostAviTags) {
        const profile = await profileRepo.findProfileByAvitag(hostAviTag);
        if (!profile)
          throw ApiError.notFound(
            `Profile with avitag ${hostAviTag} not found`
          );
      }
    }
    const updated = await eventRepo.updateEventById(eventId, updates);
    if (!updated) throw ApiError.notFound("Event not found");
    return ApiSuccess.ok("Event updated", updated);
  }

  static async deleteEvent(eventId: string, avitag: string) {
    const event = await eventRepo.findEventById(eventId);
    if (!event) throw ApiError.notFound("Event not found");
    if (!event.hostAviTags.includes(avitag))
      throw ApiError.forbidden("Not authorized to delete this event");
    await eventRepo.deleteEventById(eventId);
    return ApiSuccess.ok("Event deleted");
  }
}
