export interface IEvent {
  eventId?: string; // UUID
  title: string;
  hostAviTags: string[];
  location: string;
  description: string;
  eventDate: string;
  createdAt?: string;
  updatedAt?: string;
}
