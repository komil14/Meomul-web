import { memo } from "react";
import { LiveInterestFab } from "@/components/rooms/live-interest-fab";
import { useRoomLiveViewers } from "@/lib/hooks/use-room-live-viewers";

interface LiveInterestFabContainerProps {
  roomId: string;
  availableRooms: number;
}

export const LiveInterestFabContainer = memo(function LiveInterestFabContainer({
  roomId,
  availableRooms,
}: LiveInterestFabContainerProps) {
  const { viewerCount, connected } = useRoomLiveViewers({ roomId });

  return <LiveInterestFab viewerCount={viewerCount} connected={connected} availableRooms={availableRooms} />;
});
