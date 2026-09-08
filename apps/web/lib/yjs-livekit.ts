import * as Y from "yjs";
import { RoomEvent } from "livekit-client";

/**
 * A separate topic from chat and captions. Binary Yjs updates must never be
 * mistaken for JSON application messages, and a future protocol can coexist
 * without older clients trying to parse it.
 */
export const YJS_DATA_TOPIC = "lor-yjs-v1";

/** The wire format below, not the application's general JSON protocol. */
export const YJS_PROTOCOL_VERSION = 1;

/**
 * LiveKit allows at most roughly 15 KiB of reliable user data. Leave three KiB
 * for LiveKit's own headers and for a deliberately boring, conservative limit.
 */
export const MAX_YJS_PACKET_BYTES = 12 * 1024;

/**
 * A live peer may offer at most two MiB in one state transfer. Snapshots in
 * #124 are the durable path for documents that grow beyond this bounded live
 * hand-off; without this cap a malicious participant could allocate memory in
 * every other browser indefinitely.
 */
export const MAX_YJS_TRANSFER_BYTES = 2 * 1024 * 1024;
export const MAX_YJS_TRANSFER_CHUNKS = 256;
export const MAX_YJS_INFLIGHT_TRANSFERS_PER_PEER = 2;

const MAX_ROOM_KEY_BYTES = 128;
const TRANSFER_ID_BYTES = 12;
const TRANSFER_TTL_MS = 30_000;
const PRUNE_INTERVAL_MS = 5_000;

const STATE_VECTOR = 1;
const UPDATE_CHUNK = 2;

type YjsPacket =
  | { type: typeof STATE_VECTOR; roomKey: Uint8Array<ArrayBuffer>; stateVector: Uint8Array<ArrayBuffer> }
  | {
      type: typeof UPDATE_CHUNK;
      roomKey: Uint8Array<ArrayBuffer>;
      transferId: Uint8Array<ArrayBuffer>;
      index: number;
      count: number;
      totalBytes: number;
      chunk: Uint8Array<ArrayBuffer>;
    };

export interface YjsLiveKitParticipant {
  identity: string;
}

export interface YjsLiveKitRoom {
  localParticipant: YjsLiveKitParticipant & {
    publishData(
      payload: Uint8Array<ArrayBuffer>,
      options: {
        reliable: boolean;
        topic: string;
        destinationIdentities?: string[];
      },
    ): Promise<unknown>;
  };
  on(event: typeof RoomEvent.DataReceived, listener: YjsDataListener): unknown;
  on(event: typeof RoomEvent.Reconnected, listener: () => void): unknown;
  on(
    event: typeof RoomEvent.ParticipantActive,
    listener: (participant: YjsLiveKitParticipant) => void,
  ): unknown;
  off(event: typeof RoomEvent.DataReceived, listener: YjsDataListener): unknown;
  off(event: typeof RoomEvent.Reconnected, listener: () => void): unknown;
  off(
    event: typeof RoomEvent.ParticipantActive,
    listener: (participant: YjsLiveKitParticipant) => void,
  ): unknown;
}

export type YjsDataListener = (
  payload: Uint8Array,
  participant?: YjsLiveKitParticipant,
  kind?: unknown,
  topic?: string,
) => void;

export type YjsTransportError =
  | "local-update-too-large"
  | "state-vector-too-large"
  | "publish-failed";

interface InflightTransfer {
  count: number;
  totalBytes: number;
  chunks: Array<Uint8Array<ArrayBuffer> | undefined>;
  receivedBytes: number;
  updatedAt: number;
}

export interface YjsLiveKitProviderOptions {
  room: YjsLiveKitRoom;
  document: Y.Doc;
  /** The public room code. Packets for another room are inert. */
  roomKey: string;
  onError?: (error: YjsTransportError) => void;
}

/**
 * Small, deliberately transport-only Yjs provider for a LiveKit room.
 *
 * Data packets are best effort even in reliable mode: LiveKit does not buffer a
 * packet for a peer who is disconnected. `requestSync` consequently runs on
 * initial connection and every reconnect, and a peer answers with the diff
 * computed from the requester's state vector. Yjs updates are idempotent, so a
 * duplicate response or an old chunk cannot corrupt the document.
 */
export class YjsLiveKitProvider {
  private readonly room: YjsLiveKitRoom;
  private readonly document: Y.Doc;
  private readonly roomKey: Uint8Array<ArrayBuffer>;
  private readonly onError?: (error: YjsTransportError) => void;
  private readonly remoteOrigin = Symbol("livekit-yjs-remote-update");
  private readonly inflight = new Map<string, InflightTransfer>();
  private readonly pruneTimer: ReturnType<typeof setInterval>;
  private sendQueue: Promise<void> = Promise.resolve();
  private destroyed = false;

  constructor({ room, document, roomKey, onError }: YjsLiveKitProviderOptions) {
    const encodedRoomKey = new TextEncoder().encode(roomKey);
    if (encodedRoomKey.byteLength === 0 || encodedRoomKey.byteLength > MAX_ROOM_KEY_BYTES) {
      throw new Error("A Yjs room key must contain between 1 and 128 UTF-8 bytes.");
    }

    this.room = room;
    this.document = document;
    this.roomKey = encodedRoomKey;
    this.onError = onError;
    this.document.on("update", this.onDocumentUpdate);
    this.room.on(RoomEvent.DataReceived, this.onData);
    this.room.on(RoomEvent.Reconnected, this.onReconnected);
    this.room.on(RoomEvent.ParticipantActive, this.onParticipantActive);
    this.pruneTimer = setInterval(() => this.pruneInflight(), PRUNE_INTERVAL_MS);
  }

  /** Ask connected peers only for the operations this document does not have. */
  requestSync(destinationIdentities?: string[]): Promise<void> {
    if (this.destroyed) return Promise.resolve();

    const packet = encodeStateVectorPacket(
      this.roomKey,
      Y.encodeStateVector(this.document),
    );
    if (!packet) {
      this.onError?.("state-vector-too-large");
      return Promise.resolve();
    }

    return this.publish([packet], destinationIdentities);
  }

  /** Lets a caller wait for all queued publish operations in a deterministic test. */
  whenIdle(): Promise<void> {
    return this.sendQueue;
  }

  /** Detach from LiveKit and the document; the caller owns document disposal. */
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    clearInterval(this.pruneTimer);
    this.document.off("update", this.onDocumentUpdate);
    this.room.off(RoomEvent.DataReceived, this.onData);
    this.room.off(RoomEvent.Reconnected, this.onReconnected);
    this.room.off(RoomEvent.ParticipantActive, this.onParticipantActive);
    this.inflight.clear();
  }

  private readonly onDocumentUpdate = (
    update: Uint8Array,
    origin: unknown,
  ) => {
    // Applying a remote update emits the same document event. Its origin is an
    // object identity, not a field on the wire, so a peer cannot forge it.
    if (this.destroyed || origin === this.remoteOrigin) return;

    const packets = encodeUpdatePackets(this.roomKey, update);
    if (!packets) {
      this.onError?.("local-update-too-large");
      return;
    }
    void this.publish(packets);
  };

  private readonly onData: YjsDataListener = (
    payload,
    participant,
    _kind,
    topic,
  ) => {
    if (this.destroyed || topic !== YJS_DATA_TOPIC || !participant) return;

    const packet = decodePacket(payload);
    if (!packet || !sameBytes(packet.roomKey, this.roomKey)) return;

    if (packet.type === STATE_VECTOR) {
      let update: Uint8Array;
      try {
        update = Y.encodeStateAsUpdate(this.document, packet.stateVector);
      } catch {
        // The bytes were shaped like our envelope but not like a Yjs state
        // vector. A participant is still never allowed to interrupt the call.
        return;
      }
      const packets = encodeUpdatePackets(this.roomKey, update);
      if (!packets) {
        this.onError?.("local-update-too-large");
        return;
      }
      void this.publish(packets, [participant.identity]);
      return;
    }

    const update = this.collectChunk(participant.identity, packet);
    if (!update) return;

    // Yjs defines binary updates as commutative, associative, and idempotent.
    // We still tag the origin so this provider does not send it straight back.
    try {
      Y.applyUpdate(this.document, update, this.remoteOrigin);
    } catch {
      // A syntactically valid transport packet can still contain a corrupt Yjs
      // update. It is data from a peer, not an exception for the call screen.
    }
  };

  private readonly onReconnected = () => {
    void this.requestSync();
  };

  private readonly onParticipantActive = (participant: YjsLiveKitParticipant) => {
    // This is the LiveKit lifecycle point that explicitly means the peer is
    // ready to receive data. Sending during React's first render raced the
    // initial data transport and could make an unrelated chat packet vanish.
    // The newly active peer asks an existing peer for its missing state.
    if (participant.identity !== this.room.localParticipant.identity) {
      void this.requestSync([participant.identity]);
    }
  };

  private publish(
    packets: Uint8Array<ArrayBuffer>[],
    destinationIdentities?: string[],
  ): Promise<void> {
    const queued = this.sendQueue
      .catch(() => undefined)
      .then(async () => {
        for (const packet of packets) {
          if (this.destroyed) return;
          await this.room.localParticipant.publishData(packet, {
            reliable: true,
            topic: YJS_DATA_TOPIC,
            destinationIdentities,
          });
        }
      });

    this.sendQueue = queued.catch(() => undefined);
    return queued.catch(() => {
      this.onError?.("publish-failed");
    });
  }

  private collectChunk(
    identity: string,
    packet: Extract<YjsPacket, { type: typeof UPDATE_CHUNK }>,
  ): Uint8Array<ArrayBuffer> | null {
    this.pruneInflight();
    const key = `${identity}:${toHex(packet.transferId)}`;
    let transfer = this.inflight.get(key);

    if (!transfer) {
      this.limitInflightFor(identity);
      transfer = {
        count: packet.count,
        totalBytes: packet.totalBytes,
        chunks: new Array(packet.count),
        receivedBytes: 0,
        updatedAt: Date.now(),
      };
      this.inflight.set(key, transfer);
    }

    // Reusing a transfer id with a different shape is malformed. Drop its
    // assembly rather than combining two documents under the same key.
    if (transfer.count !== packet.count || transfer.totalBytes !== packet.totalBytes) {
      this.inflight.delete(key);
      return null;
    }

    transfer.updatedAt = Date.now();
    if (!transfer.chunks[packet.index]) {
      transfer.chunks[packet.index] = packet.chunk;
      transfer.receivedBytes += packet.chunk.byteLength;
    }

    if (transfer.receivedBytes < transfer.totalBytes) return null;
    this.inflight.delete(key);
    if (transfer.receivedBytes !== transfer.totalBytes) return null;

    const update = new Uint8Array(transfer.totalBytes);
    let offset = 0;
    for (const chunk of transfer.chunks) {
      if (!chunk) return null;
      update.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return update;
  }

  private limitInflightFor(identity: string) {
    const own = [...this.inflight.entries()]
      .filter(([key]) => key.startsWith(`${identity}:`))
      .sort(([, a], [, b]) => a.updatedAt - b.updatedAt);
    while (own.length >= MAX_YJS_INFLIGHT_TRANSFERS_PER_PEER) {
      const [oldest] = own.shift()!;
      this.inflight.delete(oldest);
    }
  }

  private pruneInflight() {
    const oldestAllowed = Date.now() - TRANSFER_TTL_MS;
    for (const [key, transfer] of this.inflight) {
      if (transfer.updatedAt < oldestAllowed) this.inflight.delete(key);
    }
  }
}

function encodeStateVectorPacket(
  roomKey: Uint8Array<ArrayBuffer>,
  stateVector: Uint8Array,
): Uint8Array<ArrayBuffer> | null {
  const headerBytes = 3 + roomKey.byteLength;
  if (stateVector.byteLength === 0 || headerBytes + stateVector.byteLength > MAX_YJS_PACKET_BYTES) {
    return null;
  }

  const packet = new Uint8Array(headerBytes + stateVector.byteLength);
  packet[0] = YJS_PROTOCOL_VERSION;
  packet[1] = STATE_VECTOR;
  packet[2] = roomKey.byteLength;
  packet.set(roomKey, 3);
  packet.set(stateVector, headerBytes);
  return packet;
}

function encodeUpdatePackets(
  roomKey: Uint8Array<ArrayBuffer>,
  update: Uint8Array,
): Uint8Array<ArrayBuffer>[] | null {
  if (update.byteLength === 0 || update.byteLength > MAX_YJS_TRANSFER_BYTES) return null;

  const headerBytes = 3 + roomKey.byteLength + TRANSFER_ID_BYTES + 2 + 2 + 4;
  const chunkCapacity = MAX_YJS_PACKET_BYTES - headerBytes;
  const count = Math.ceil(update.byteLength / chunkCapacity);
  if (count > MAX_YJS_TRANSFER_CHUNKS) return null;

  const transferId = new Uint8Array(TRANSFER_ID_BYTES);
  crypto.getRandomValues(transferId);
  const packets: Uint8Array<ArrayBuffer>[] = [];

  for (let index = 0; index < count; index += 1) {
    const start = index * chunkCapacity;
    const chunk = update.slice(start, Math.min(start + chunkCapacity, update.byteLength));
    const packet = new Uint8Array(headerBytes + chunk.byteLength);
    packet[0] = YJS_PROTOCOL_VERSION;
    packet[1] = UPDATE_CHUNK;
    packet[2] = roomKey.byteLength;
    packet.set(roomKey, 3);
    let offset = 3 + roomKey.byteLength;
    packet.set(transferId, offset);
    offset += TRANSFER_ID_BYTES;
    writeUint16(packet, offset, count);
    offset += 2;
    writeUint16(packet, offset, index);
    offset += 2;
    writeUint32(packet, offset, update.byteLength);
    offset += 4;
    packet.set(chunk, offset);
    packets.push(packet);
  }

  return packets;
}

function decodePacket(payload: Uint8Array): YjsPacket | null {
  if (payload.byteLength > MAX_YJS_PACKET_BYTES || payload.byteLength < 4) return null;
  if (payload[0] !== YJS_PROTOCOL_VERSION) return null;
  const roomKeyLength = payload[2];
  const roomEnd = 3 + roomKeyLength;
  if (roomKeyLength === 0 || roomKeyLength > MAX_ROOM_KEY_BYTES || roomEnd > payload.byteLength) {
    return null;
  }
  const roomKey = payload.slice(3, roomEnd);

  if (payload[1] === STATE_VECTOR) {
    const stateVector = payload.slice(roomEnd);
    return stateVector.byteLength > 0 ? { type: STATE_VECTOR, roomKey, stateVector } : null;
  }

  if (payload[1] !== UPDATE_CHUNK) return null;
  const metadataEnd = roomEnd + TRANSFER_ID_BYTES + 2 + 2 + 4;
  if (metadataEnd >= payload.byteLength) return null;
  const transferId = payload.slice(roomEnd, roomEnd + TRANSFER_ID_BYTES);
  const count = readUint16(payload, roomEnd + TRANSFER_ID_BYTES);
  const index = readUint16(payload, roomEnd + TRANSFER_ID_BYTES + 2);
  const totalBytes = readUint32(payload, roomEnd + TRANSFER_ID_BYTES + 4);
  const chunk = payload.slice(metadataEnd);

  if (
    count === 0 ||
    count > MAX_YJS_TRANSFER_CHUNKS ||
    index >= count ||
    totalBytes === 0 ||
    totalBytes > MAX_YJS_TRANSFER_BYTES ||
    chunk.byteLength === 0
  ) {
    return null;
  }

  return { type: UPDATE_CHUNK, roomKey, transferId, index, count, totalBytes, chunk };
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  return left.every((value, index) => value === right[index]);
}

function writeUint16(target: Uint8Array, offset: number, value: number) {
  target[offset] = value >>> 8;
  target[offset + 1] = value & 0xff;
}

function writeUint32(target: Uint8Array, offset: number, value: number) {
  target[offset] = value >>> 24;
  target[offset + 1] = (value >>> 16) & 0xff;
  target[offset + 2] = (value >>> 8) & 0xff;
  target[offset + 3] = value & 0xff;
}

function readUint16(source: Uint8Array, offset: number): number {
  return (source[offset] << 8) | source[offset + 1];
}

function readUint32(source: Uint8Array, offset: number): number {
  return (
    source[offset] * 2 ** 24 +
    (source[offset + 1] << 16) +
    (source[offset + 2] << 8) +
    source[offset + 3]
  );
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
