import type { Request } from "express";
import type { UploadedFile } from "express-fileupload";
import type { AuthenticatedUser } from "../modules/user/user.interface";

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      files?: {
        image?: UploadedFile | UploadedFile[];
        [key: string]: UploadedFile | UploadedFile[] | undefined;
      };
    }
  }
}
