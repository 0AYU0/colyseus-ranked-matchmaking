import { Room, Client } from "colyseus.js";

export function requestJoinOptions (this: Client, i: number) {
    return { requestNumber: i };
}

export function onJoin(this: Room) {
    console.log(this.sessionId, "joined.");
}

export function onMessage(this: Room, message: any) {
    console.log(this.sessionId, "received:", message);
}

export function onLeave(this: Room) {
    console.log(this.sessionId, "left.");
}

export function onError(this: Room, err: any) {
    console.log(this.sessionId, "!! ERROR !!", err.message);
}

export function onStateChange(this: Room, state: any) {
    console.log(this.sessionId, "new state:", state);
}
