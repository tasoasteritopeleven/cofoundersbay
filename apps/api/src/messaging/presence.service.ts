import { Injectable } from '@nestjs/common';

@Injectable()
export class PresenceService {
  private readonly online = new Set<string>();

  setOnline(userId: string) {
    this.online.add(userId);
  }

  setOffline(userId: string) {
    this.online.delete(userId);
  }

  isOnline(userId: string): boolean {
    return this.online.has(userId);
  }
}

