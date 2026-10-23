/**
 * Server-authoritative room membership.
 * Membership is keyed by server-assigned guestId, never by client claims alone.
 */
export class RoomRegistry {
  /** roomId → set of guestIds */
  private readonly rooms = new Map<string, Set<string>>();
  /** guestId → set of roomIds */
  private readonly membership = new Map<string, Set<string>>();
  /** guestId → socketId */
  private readonly sockets = new Map<string, string>();
  /** socketId → guestId */
  private readonly bySocket = new Map<string, string>();

  bindSocket(guestId: string, socketId: string): void {
    const previousSocket = this.sockets.get(guestId);
    if (previousSocket) this.bySocket.delete(previousSocket);
    this.sockets.set(guestId, socketId);
    this.bySocket.set(socketId, guestId);
  }

  getGuestIdForSocket(socketId: string): string | undefined {
    return this.bySocket.get(socketId);
  }

  getSocketIdForGuest(guestId: string): string | undefined {
    return this.sockets.get(guestId);
  }

  join(roomId: string, guestId: string): { alreadyMember: boolean; members: string[] } {
    let room = this.rooms.get(roomId);
    if (!room) {
      room = new Set();
      this.rooms.set(roomId, room);
    }
    const alreadyMember = room.has(guestId);
    room.add(guestId);

    let roomsForGuest = this.membership.get(guestId);
    if (!roomsForGuest) {
      roomsForGuest = new Set();
      this.membership.set(guestId, roomsForGuest);
    }
    roomsForGuest.add(roomId);

    return { alreadyMember, members: [...room] };
  }

  leave(roomId: string, guestId: string): string[] {
    const room = this.rooms.get(roomId);
    if (room) {
      room.delete(guestId);
      if (room.size === 0) this.rooms.delete(roomId);
    }
    this.membership.get(guestId)?.delete(roomId);
    return room ? [...room] : [];
  }

  leaveAll(guestId: string): Array<{ roomId: string; remaining: string[] }> {
    const rooms = [...(this.membership.get(guestId) ?? [])];
    const result: Array<{ roomId: string; remaining: string[] }> = [];
    for (const roomId of rooms) {
      result.push({ roomId, remaining: this.leave(roomId, guestId) });
    }
    this.membership.delete(guestId);
    return result;
  }

  isMember(roomId: string, guestId: string): boolean {
    return this.rooms.get(roomId)?.has(guestId) ?? false;
  }

  /** Both must be members of the same room before signaling is forwarded. */
  canSignal(roomId: string, fromGuestId: string, toGuestId: string): boolean {
    if (fromGuestId === toGuestId) return false;
    return this.isMember(roomId, fromGuestId) && this.isMember(roomId, toGuestId);
  }

  unbindSocket(socketId: string): string | undefined {
    const guestId = this.bySocket.get(socketId);
    if (!guestId) return undefined;
    this.bySocket.delete(socketId);
    if (this.sockets.get(guestId) === socketId) {
      this.sockets.delete(guestId);
    }
    return guestId;
  }
}
