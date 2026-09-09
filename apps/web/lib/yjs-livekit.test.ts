import { afterEach, describe, expect, it } from "vitest";
import { RoomEvent } from "livekit-client";
import * as Y from "yjs";
import {
  MAX_YJS_PACKET_BYTES,
  YJS_DATA_TOPIC,
  YjsLiveKitProvider,
  type YjsDataListener,
  type YjsLiveKitRoom,
} from "./yjs-livekit";

interface SentPacket {
  payload: Uint8Array<ArrayBuffer>;
  destinationIdentities?: string[];
}

class FakeRoom {
  readonly sent: SentPacket[] = [];
  readonly localParticipant = {
    identity: "local",
    publishData: async (
      payload: Uint8Array<ArrayBuffer>,
      options: { destinationIdentities?: string[] },
    ) => {
      this.sent.push({ payload, destinationIdentities: options.destinationIdentities });
    },
  };
  private readonly listeners = new Map<string, Set<(...args: never[]) => void>>();

  on(_event: string, listener: (...args: never[]) => void) {
    const listeners = this.listeners.get(_event) ?? new Set();
    listeners.add(listener);
    this.listeners.set(_event, listeners);
  }

  off(_event: string, listener: (...args: never[]) => void) {
    this.listeners.get(_event)?.delete(listener);
  }

  receive(payload: Uint8Array, identity = "peer", topic = YJS_DATA_TOPIC) {
    for (const listener of this.listeners.get(RoomEvent.DataReceived) ?? []) {
      (listener as unknown as YjsDataListener)(payload, { identity }, undefined, topic);
    }
  }

  reconnect() {
    for (const listener of this.listeners.get(RoomEvent.Reconnected) ?? []) listener();
  }

  activate(identity = "peer") {
    for (const listener of this.listeners.get(RoomEvent.ParticipantActive) ?? []) {
      (listener as unknown as (participant: { identity: string }) => void)({ identity });
    }
  }
}

const providers: YjsLiveKitProvider[] = [];

function createProvider(room: FakeRoom, document: Y.Doc, roomKey = "canvas-room") {
  const provider = new YjsLiveKitProvider({
    room: room as unknown as YjsLiveKitRoom,
    document,
    roomKey,
  });
  providers.push(provider);
  return provider;
}

async function deliver(
  sender: FakeRoom,
  receiver: FakeRoom,
  identity = "peer",
) {
  for (const packet of sender.sent.splice(0)) receiver.receive(packet.payload, identity);
  await Promise.resolve();
}

function stateVectorPacket(roomKey: string, body: Uint8Array) {
  const room = new TextEncoder().encode(roomKey);
  return new Uint8Array([1, 1, room.byteLength, ...room, ...body]);
}

function updatePacket(roomKey: string, body: Uint8Array) {
  const room = new TextEncoder().encode(roomKey);
  return new Uint8Array([
    1,
    2,
    room.byteLength,
    ...room,
    ...new Uint8Array(12),
    0,
    1, // one chunk
    0,
    0, // index zero
    0,
    0,
    0,
    body.byteLength,
    ...body,
  ]);
}

afterEach(() => {
  for (const provider of providers.splice(0)) provider.destroy();
});

describe("Yjs over the LiveKit data channel", () => {
  it("syncs a fresh peer using a state vector and never echoes the received update", async () => {
    const firstRoom = new FakeRoom();
    const firstDocument = new Y.Doc();
    const first = createProvider(firstRoom, firstDocument);
    firstDocument.getText("transport-text").insert(0, "قرار: deploy على production");
    await first.whenIdle();
    firstRoom.sent.splice(0); // local edits are already in the first document

    const secondRoom = new FakeRoom();
    const secondDocument = new Y.Doc();
    const second = createProvider(secondRoom, secondDocument);
    secondRoom.activate("first");
    await second.whenIdle();

    // A new participant asks for the operations it lacks. The existing one
    // replies only to that identity, then the received update stays remote.
    await deliver(secondRoom, firstRoom, "second");
    await first.whenIdle();
    expect(firstRoom.sent).toHaveLength(1);
    expect(firstRoom.sent.every((packet) => packet.destinationIdentities?.[0] === "second")).toBe(true);

    await deliver(firstRoom, secondRoom, "first");
    await second.whenIdle();
    expect(secondDocument.getText("transport-text").toString()).toBe("قرار: deploy على production");
    expect(secondRoom.sent).toHaveLength(0);
  });

  it("converges when two fresh participants make a local edit before exchange", async () => {
    const firstRoom = new FakeRoom();
    const firstDocument = new Y.Doc();
    const first = createProvider(firstRoom, firstDocument);
    const secondRoom = new FakeRoom();
    const secondDocument = new Y.Doc();
    const second = createProvider(secondRoom, secondDocument);
    await Promise.all([first.whenIdle(), second.whenIdle()]);

    firstDocument.getText("transport-text").insert(0, "من الأول");
    secondDocument.getText("transport-text").insert(0, " + from second");
    await Promise.all([first.whenIdle(), second.whenIdle()]);

    firstRoom.activate("second");
    secondRoom.activate("first");
    for (let round = 0; round < 4; round += 1) {
      const firstPackets = firstRoom.sent.splice(0);
      const secondPackets = secondRoom.sent.splice(0);
      for (const packet of firstPackets) secondRoom.receive(packet.payload, "first");
      for (const packet of secondPackets) firstRoom.receive(packet.payload, "second");
      await Promise.all([first.whenIdle(), second.whenIdle()]);
    }

    expect(firstDocument.toJSON()).toEqual(secondDocument.toJSON());
    expect(firstDocument.getText("transport-text").toString()).toContain("من الأول");
    expect(firstDocument.getText("transport-text").toString()).toContain("from second");
  });

  it("splits a large update, tolerates duplicate chunks, and restores the exact mixed text", async () => {
    const senderRoom = new FakeRoom();
    const senderDocument = new Y.Doc();
    const sender = createProvider(senderRoom, senderDocument);
    await sender.whenIdle();

    const expected = `ابدأ بـ deploy ثم ${"ملاحظة ".repeat(5_000)}finish`;
    senderDocument.getText("transport-text").insert(0, expected);
    await sender.whenIdle();
    expect(senderRoom.sent.length).toBeGreaterThan(1);
    expect(senderRoom.sent.every((packet) => packet.payload.byteLength <= MAX_YJS_PACKET_BYTES)).toBe(true);

    const receiverRoom = new FakeRoom();
    const receiverDocument = new Y.Doc();
    createProvider(receiverRoom, receiverDocument);
    const packets = senderRoom.sent.splice(0);
    for (const packet of packets) receiverRoom.receive(packet.payload);
    // A reliable channel preserves order, but re-applying one packet proves the
    // assembly and Yjs update path do not turn duplication into corruption.
    const duplicate = packets[0];
    if (duplicate) receiverRoom.receive(duplicate.payload);
    expect(receiverDocument.getText("transport-text").toString()).toBe(expected);
  });

  it("drops malformed, oversized, and wrong-room packets without changing the document", () => {
    const room = new FakeRoom();
    const document = new Y.Doc();
    createProvider(room, document);
    const before = Y.encodeStateAsUpdate(document);

    room.receive(new Uint8Array(MAX_YJS_PACKET_BYTES + 1));
    room.receive(new Uint8Array([255, 1, 1, 120]));
    room.receive(stateVectorPacket("other", new Uint8Array([1])));
    expect(() => room.receive(stateVectorPacket("canvas-room", new Uint8Array([255])))).not.toThrow();
    expect(() => room.receive(updatePacket("canvas-room", new Uint8Array([255])))).not.toThrow();

    expect(Y.encodeStateAsUpdate(document)).toEqual(before);
  });

  it("asks peers for state again after a reconnect", async () => {
    const room = new FakeRoom();
    const document = new Y.Doc();
    const provider = createProvider(room, document);
    await provider.whenIdle();

    room.reconnect();
    await provider.whenIdle();
    expect(room.sent).toHaveLength(1);
    expect(room.sent[0].destinationIdentities).toBeUndefined();
  });

  it("tears listeners and queued sync down with the call", async () => {
    const room = new FakeRoom();
    const document = new Y.Doc();
    const provider = createProvider(room, document);
    await provider.whenIdle();

    provider.destroy();
    document.getText("transport-text").insert(0, "لن تُرسل");
    room.reconnect();
    await provider.whenIdle();

    expect(room.sent).toHaveLength(0);
  });
});
