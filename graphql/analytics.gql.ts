import { gql } from "@apollo/client";

export const TRACK_ANALYTICS_EVENT_MUTATION = gql`
  mutation TrackAnalyticsEvent($input: TrackAnalyticsEventInput!) {
    trackAnalyticsEvent(input: $input)
  }
`;

export const TRACK_ANALYTICS_EVENT_MUTATION_TEXT = `
  mutation TrackAnalyticsEvent($input: TrackAnalyticsEventInput!) {
    trackAnalyticsEvent(input: $input)
  }
`;
