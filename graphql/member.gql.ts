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
