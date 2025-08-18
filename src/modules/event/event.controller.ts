import type { Request, Response } from "express";
import { EventService } from "./event.service";

export class EventController {
  static async create(req: Request, res: Response) {
    const avitag = (req as any).user?.avitag;
    const result = await EventService.createEvent(avitag, req.body);
    return res.status(result.status || 201).json(result);
  }

  static async getById(req: Request, res: Response) {
    const { eventId } = req.params;
    const result = await EventService.getEventById(eventId || "");
    return res.status(result.status || 200).json(result);
  }

  static async getByCampus(req: Request, res: Response) {
    const { campusTag } = req.params;
    const result = await EventService.getEventsByCampus(campusTag || "");
    return res.status(result.status || 200).json(result);
  }

  static async update(req: Request, res: Response) {
    const { eventId } = req.params;
    const avitag = (req as any).user?.avitag;
    const result = await EventService.updateEvent(
      eventId || "",
      avitag,
      req.body
    );
    return res.status(result.status || 200).json(result);
  }

  static async delete(req: Request, res: Response) {
    const { eventId } = req.params;
    const avitag = (req as any).user?.avitag;
    const result = await EventService.deleteEvent(eventId || "", avitag);
    return res.status(result.status || 200).json(result);
  }
}
