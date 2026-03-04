import { gql } from "@apollo/client";

const MEMBER_FIELDS = gql`
  fragment MemberFields on MemberDto {
    _id
    memberType
    memberStatus
    memberPhone
    memberNick
    memberFullName
    memberImage
    memberAddress
    memberDesc
    subscriptionTier
    subscriptionExpiry
    memberPoints
    memberFollowers
    memberFollowings
    memberViews
    memberLikes
    memberRank
    createdAt
  }
`;

export const GET_MEMBER_QUERY = gql`
  query GetMember {
    getMember {
      ...MemberFields
    }
  }
  ${MEMBER_FIELDS}
`;

export const UPDATE_MEMBER_MUTATION = gql`
  mutation UpdateMember($input: MemberUpdate!) {
    updateMember(input: $input) {
      ...MemberFields
    }
  }
  ${MEMBER_FIELDS}
`;

export const GET_SUBSCRIPTION_STATUS_QUERY = gql`
  query GetSubscriptionStatus {
    getSubscriptionStatus {
      tier
      active
      expiresAt
      daysRemaining
    }
  }
`;

export const REQUEST_SUBSCRIPTION_MUTATION = gql`
  mutation RequestSubscription($requestedTier: SubscriptionTier!) {
    requestSubscription(requestedTier: $requestedTier) {
      message
      success
    }
  }
`;

export const CANCEL_SUBSCRIPTION_MUTATION = gql`
  mutation CancelSubscription {
    cancelSubscription {
      message
      success
    }
  }
`;

// ─── Admin mutations ───────────────────────────────────────────────────────────

export const APPROVE_SUBSCRIPTION_MUTATION = gql`
  mutation ApproveSubscription(
    $memberId: String!
    $tier: SubscriptionTier!
    $durationDays: Int!
  ) {
    approveSubscription(
      memberId: $memberId
      tier: $tier
      durationDays: $durationDays
    ) {
      _id
      memberNick
      subscriptionTier
      subscriptionExpiry
    }
  }
`;

export const DENY_SUBSCRIPTION_MUTATION = gql`
  mutation DenySubscription($memberId: String!, $reason: String) {
    denySubscription(memberId: $memberId, reason: $reason) {
      message
      success
    }
  }
`;

// ─── Admin queries ─────────────────────────────────────────────────────────────

export const GET_ALL_MEMBERS_BY_ADMIN_QUERY = gql`
  query GetAllMembersByAdmin($input: PaginationInput!) {
    getAllMembersByAdmin(input: $input) {
      list {
        ...MemberFields
      }
      metaCounter {
        total
      }
      typeCounts {
        USER
        AGENT
        ADMIN
        ADMIN_OPERATOR
      }
    }
  }
  ${MEMBER_FIELDS}
`;

export const GET_MEMBER_BY_ADMIN_QUERY = gql`
  query GetMemberByAdmin($memberId: String!) {
    getMemberByAdmin(memberId: $memberId) {
      ...MemberFields
    }
  }
  ${MEMBER_FIELDS}
`;

export const UPDATE_MEMBER_BY_ADMIN_MUTATION = gql`
  mutation UpdateMemberByAdmin($input: MemberUpdate!) {
    updateMemberByAdmin(input: $input) {
      ...MemberFields
    }
  }
  ${MEMBER_FIELDS}
`;

export const DELETE_MEMBER_BY_ADMIN_MUTATION = gql`
  mutation DeleteMemberByAdmin($memberId: String!) {
    deleteMemberByAdmin(memberId: $memberId) {
      _id
      memberNick
      memberStatus
    }
  }
`;
