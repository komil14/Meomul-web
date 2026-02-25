import { useMutation, useQuery } from "@apollo/client/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GET_MY_PRICE_LOCK_QUERY, GET_MY_PRICE_LOCKS_QUERY, LOCK_PRICE_MUTATION } from "@/graphql/hotel.gql";
import { getErrorMessage } from "@/lib/utils/error";
import type {
  GetMyPriceLockQueryData,
  GetMyPriceLockQueryVars,
  LockPriceMutationData,
  LockPriceMutationVars,
  PriceLockDto,
  RoomDetailItem,
} from "@/types/hotel";

const canUsePriceActions = (memberType: string | undefined): boolean =>
  memberType === "USER" || memberType === "AGENT" || memberType === "ADMIN";

interface UseRoomPriceLockInput {
  isHydrated: boolean;
  roomId: string;
  room: RoomDetailItem | undefined;
  memberType: string | undefined;
  activeDeal: RoomDetailItem["lastMinuteDeal"] | null | undefined;
}

interface UseRoomPriceLockResult {
  canLockPrice: boolean;
  canLockCurrentRoom: boolean;
  myPriceLockLoading: boolean;
  myPriceLockError: unknown;
  lockActionError: string | null;
  lockingPrice: boolean;
  activePriceLock: PriceLockDto | null;
  lockRequestPrice: number;
  effectiveNightlyRate: number;
  effectiveNightlyRateSourceLabel: string;
  showBottomLockBar: boolean;
  onLockPrice: () => Promise<void>;
}

export const useRoomPriceLock = ({
  isHydrated,
  roomId,
  room,
  memberType,
  activeDeal,
}: UseRoomPriceLockInput): UseRoomPriceLockResult => {
  const [lockActionError, setLockActionError] = useState<string | null>(null);
  const canLockPrice = canUsePriceActions(memberType);
  const canLockCurrentRoom = Boolean(room && room.roomStatus === "AVAILABLE");
  const priceLockQueryVariables = useMemo<GetMyPriceLockQueryVars>(
    () => ({
      roomId,
    }),
    [roomId],
  );

  const {
    data: myPriceLockData,
    loading: myPriceLockLoading,
    error: myPriceLockError,
  } = useQuery<GetMyPriceLockQueryData, GetMyPriceLockQueryVars>(GET_MY_PRICE_LOCK_QUERY, {
    skip: !isHydrated || !roomId || !canLockPrice,
    variables: priceLockQueryVariables,
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
  });
  const [lockPriceMutation, { loading: lockingPrice }] = useMutation<LockPriceMutationData, LockPriceMutationVars>(LOCK_PRICE_MUTATION);

  useEffect(() => {
    if (!roomId) {
      return;
    }
    setLockActionError(null);
  }, [roomId]);

  const activePriceLock = myPriceLockData?.getMyPriceLock ?? null;
  const lockRequestPrice = activeDeal?.dealPrice ?? room?.basePrice ?? 0;
  const effectiveNightlyRate = activePriceLock?.lockedPrice ?? lockRequestPrice;
  const effectiveNightlyRateSourceLabel = activePriceLock
    ? "Locked price is active for your account."
    : activeDeal
      ? "Last-minute deal is currently active."
      : "Base rate (before taxes/fees).";
  const showBottomLockBar = canLockPrice && canLockCurrentRoom && !myPriceLockLoading && !activePriceLock && !lockingPrice;

  const onLockPrice = useCallback(async (): Promise<void> => {
    if (!canLockPrice || !room) {
      return;
    }

    setLockActionError(null);
    try {
      await lockPriceMutation({
        variables: {
          input: {
            roomId: room._id,
            currentPrice: lockRequestPrice,
          },
        },
        refetchQueries: [
          { query: GET_MY_PRICE_LOCK_QUERY, variables: { roomId: room._id } },
          { query: GET_MY_PRICE_LOCKS_QUERY },
        ],
        awaitRefetchQueries: true,
      });
    } catch (error) {
      setLockActionError(getErrorMessage(error));
    }
  }, [canLockPrice, lockPriceMutation, lockRequestPrice, room]);

  return {
    canLockPrice,
    canLockCurrentRoom,
    myPriceLockLoading,
    myPriceLockError,
    lockActionError,
    lockingPrice,
    activePriceLock,
    lockRequestPrice,
    effectiveNightlyRate,
    effectiveNightlyRateSourceLabel,
    showBottomLockBar,
    onLockPrice,
  };
};
