export type MemberType = "USER" | "AGENT" | "ADMIN" | "ADMIN_OPERATOR";

export type MemberAuthType = "EMAIL" | "PHONE" | "GOOGLE" | "KAKAO" | "NAVER";

export interface AuthMember {
  _id: string;
  accessToken: string;
  memberNick: string;
  memberType: MemberType;
  memberStatus: string;
  memberAuthType: MemberAuthType;
  memberPhone: string;
  memberFullName?: string | null;
  memberImage?: string | null;
}

export type SessionMember = Omit<AuthMember, "accessToken">;

export interface LoginMemberInput {
  memberNick: string;
  memberPassword: string;
}

export interface SignupMemberInput {
  memberNick: string;
  memberPassword: string;
  memberPhone: string;
  memberFullName?: string;
  memberType: MemberType;
  memberAuthType: MemberAuthType;
}

export interface AuthMemberMutationData {
  loginMember?: AuthMember;
  signupMember?: AuthMember;
}

export interface LoginMemberMutationVars {
  input: LoginMemberInput;
}

export interface SignupMemberMutationVars {
  input: SignupMemberInput;
}

export interface CheckAuthQueryData {
  checkAuth: string;
}

export interface RefreshTokenMutationData {
  refreshToken: AuthMember;
}

export interface LogoutMutationData {
  logout: {
    success: boolean;
    message: string;
  };
}
