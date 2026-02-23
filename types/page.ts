import type { NextPage } from "next";
import type { MemberType } from "@/types/auth";

export interface AuthRequirement {
  guestOnly?: boolean;
  roles?: MemberType[];
}

export type NextPageWithAuth<P = Record<string, never>, IP = P> = NextPage<P, IP> & {
  auth?: AuthRequirement;
};
