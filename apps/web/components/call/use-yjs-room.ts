"use client";

import { useEffect } from "react";
import { useRoomContext } from "@livekit/components-react";
import * as Y from "yjs";
import {
  YjsLiveKitProvider,
  type YjsLiveKitRoom,
} from "@/lib/yjs-livekit";

/**
 * The one shared Canvas document for one call. No editor renders in #123, but
 * making ownership explicit now keeps the later whiteboard and notes from
 * accidentally starting two Yjs documents in the same room.
 */
export function YjsRoomLifecycle({ roomKey }: { roomKey: string }) {
  const room = useRoomContext();

  useEffect(() => {
    const document = new Y.Doc();
    const provider = new YjsLiveKitProvider({
      room: room as unknown as YjsLiveKitRoom,
      document,
      roomKey,
    });
    return () => {
      provider.destroy();
      document.destroy();
    };
  }, [room, roomKey]);

  return null;
}
