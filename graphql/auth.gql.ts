import { gql } from "@apollo/client";

export const LOGIN_MEMBER_MUTATION = gql`
  mutation LoginMember($input: LoginInput!) {
    loginMember(input: $input) {
      _id
      accessToken
      memberNick
      memberType
      memberStatus
      memberAuthType
      memberPhone
      memberFullName
      memberImage
    }
  }
`;

export const SIGNUP_MEMBER_MUTATION = gql`
  mutation SignupMember($input: MemberInput!) {
    signupMember(input: $input) {
      _id
      accessToken
      memberNick
      memberType
      memberStatus
      memberAuthType
      memberPhone
      memberFullName
      memberImage
    }
  }
`;

export const CHECK_AUTH_QUERY = gql`
  query CheckAuth {
    checkAuth
  }
`;
