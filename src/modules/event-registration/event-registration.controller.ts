import type { Request, Response } from "express";
import { EventRegistrationService } from "./event-registration.service";

export class EventRegistrationController {
  static async create(req: Request, res: Response) {
    const avitag = (req as any).user?.avitag;
    const { eventId } = req.body;
    const result = await EventRegistrationService.createRegistration(
      avitag,
      eventId
    );
    return res.status(result.status || 201).json(result);
  }

  static async getByEvent(req: Request, res: Response) {
    const { eventId } = req.params;
    const result = await EventRegistrationService.getRegistrationsByEvent(
      eventId || ""
    );
    return res.status(result.status || 200).json(result);
  }

  static async getByStudent(req: Request, res: Response) {
    const avitag = (req as any).user?.avitag;
    const result = await EventRegistrationService.getRegistrationsByStudent(
      avitag
    );
    return res.status(result.status || 200).json(result);
  }

  static async delete(req: Request, res: Response) {
    const { id } = req.params;
    const avitag = (req as any).user?.avitag;
    const result = await EventRegistrationService.deleteRegistration(
      Number(id),
      avitag
    );
    return res.status(result.status || 200).json(result);
  }
}
