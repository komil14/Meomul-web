import { gql } from "@apollo/client";

const CHAT_MESSAGE_FIELDS = gql`
  fragment ChatMessageFields on MessageDto {
    senderId
    senderType
    messageType
    content
    imageUrl
    fileUrl
    read
    timestamp
  }
`;

const CHAT_FIELDS = gql`
  fragment ChatFields on ChatDto {
    _id
    guestId
    hotelId
    bookingId
    chatScope
    supportTopic
    sourcePath
    assignedAgentId
    chatStatus
    unreadGuestMessages
    unreadAgentMessages
    lastMessageAt
    createdAt
    updatedAt
    messages {
      ...ChatMessageFields
    }
  }
  ${CHAT_MESSAGE_FIELDS}
`;

export const GET_MY_CHATS_QUERY = gql`
  query GetMyChats($input: PaginationInput!) {
    getMyChats(input: $input) {
      list {
        ...ChatFields
      }
      metaCounter {
        total
      }
    }
  }
  ${CHAT_FIELDS}
`;

export const GET_HOTEL_CHATS_QUERY = gql`
  query GetHotelChats(
    $hotelId: String!
    $input: PaginationInput!
    $statusFilter: ChatStatus
  ) {
    getHotelChats(
      hotelId: $hotelId
      input: $input
      statusFilter: $statusFilter
    ) {
      list {
        ...ChatFields
      }
      metaCounter {
        total
      }
    }
  }
  ${CHAT_FIELDS}
`;

export const GET_CHAT_QUERY = gql`
  query GetChat($chatId: String!) {
    getChat(chatId: $chatId) {
      ...ChatFields
    }
  }
  ${CHAT_FIELDS}
`;

export const GET_MY_UNREAD_CHAT_COUNT_QUERY = gql`
  query GetMyUnreadChatCount {
    getMyUnreadChatCount
  }
`;

export const START_CHAT_MUTATION = gql`
  mutation StartChat($input: StartChatInput!) {
    startChat(input: $input) {
      ...ChatFields
    }
  }
  ${CHAT_FIELDS}
`;

export const START_SUPPORT_CHAT_MUTATION = gql`
  mutation StartSupportChat($input: StartSupportChatInput!) {
    startSupportChat(input: $input) {
      ...ChatFields
    }
  }
  ${CHAT_FIELDS}
`;

export const SEND_MESSAGE_MUTATION = gql`
  mutation SendMessage($input: SendMessageInput!) {
    sendMessage(input: $input) {
      ...ChatFields
    }
  }
  ${CHAT_FIELDS}
`;

export const MARK_CHAT_MESSAGES_AS_READ_MUTATION = gql`
  mutation MarkChatMessagesAsRead($chatId: String!) {
    markChatMessagesAsRead(chatId: $chatId) {
      ...ChatFields
    }
  }
  ${CHAT_FIELDS}
`;

export const CLAIM_CHAT_MUTATION = gql`
  mutation ClaimChat($input: ClaimChatInput!) {
    claimChat(input: $input) {
      ...ChatFields
    }
  }
  ${CHAT_FIELDS}
`;

export const CLOSE_CHAT_MUTATION = gql`
  mutation CloseChat($chatId: String!) {
    closeChat(chatId: $chatId) {
      ...ChatFields
    }
  }
  ${CHAT_FIELDS}
`;

// ─── Admin queries ─────────────────────────────────────────────────────────────

// Lightweight fragment for list views — excludes messages array for performance
const CHAT_LIST_FIELDS = gql`
  fragment ChatListFields on ChatDto {
    _id
    guestId
    hotelId
    bookingId
    chatScope
    supportTopic
    sourcePath
    assignedAgentId
    chatStatus
    unreadGuestMessages
    unreadAgentMessages
    lastMessageAt
    createdAt
    updatedAt
  }
`;

export const GET_ALL_CHATS_ADMIN_QUERY = gql`
  query GetAllChatsAdmin($input: PaginationInput!, $statusFilter: ChatStatus) {
    getAllChatsAdmin(input: $input, statusFilter: $statusFilter) {
      list {
        ...ChatListFields
      }
      metaCounter {
        total
      }
    }
  }
  ${CHAT_LIST_FIELDS}
`;

export const REASSIGN_CHAT_MUTATION = gql`
  mutation ReassignChat($chatId: String!, $newAgentId: String!) {
    reassignChat(chatId: $chatId, newAgentId: $newAgentId) {
      ...ChatListFields
    }
  }
  ${CHAT_LIST_FIELDS}
`;
