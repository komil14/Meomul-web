import { gql } from "@apollo/client";

export const GET_HOTELS_QUERY = gql`
  query GetHotels($input: PaginationInput!, $search: HotelSearchInput) {
    getHotels(input: $input, search: $search) {
      list {
        _id
        hotelTitle
        hotelLocation
        hotelType
        hotelRating
        hotelLikes
        hotelImages
      }
      metaCounter {
        total
      }
    }
  }
`;

export const GET_HOTEL_QUERY = gql`
  query GetHotel($hotelId: String!) {
    getHotel(hotelId: $hotelId) {
      _id
      memberId
      hotelTitle
      hotelLocation
      hotelType
      hotelStatus
      verificationStatus
      badgeLevel
      hotelRating
      hotelRank
      hotelReviews
      hotelViews
      hotelLikes
      warningStrikes
      safeStayCertified
      ageRestriction
      maxPetWeight
      hotelImages
      hotelVideos
      hotelDesc
      starRating
      checkInTime
      checkOutTime
      suitableFor
      petsAllowed
      smokingAllowed
      cancellationPolicy
      flexibleCheckIn {
        enabled
        times
        fee
      }
      flexibleCheckOut {
        enabled
        times
        fee
      }
      detailedLocation {
        address
        city
        district
        dong
        nearestSubway
        subwayExit
        subwayLines
        walkingDistance
        coordinates {
          lat
          lng
        }
      }
      amenities {
        wifi
        wifiSpeed
        parking
        parkingFee
        breakfast
        breakfastIncluded
        roomService
        gym
        pool
        workspace
        familyRoom
        kidsFriendly
        wheelchairAccessible
        elevator
        accessibleBathroom
        visualAlarms
        serviceAnimalsAllowed
        airportShuttle
        evCharging
        playground
        meetingRoom
        privateBath
        restaurant
        spa
        coupleRoom
        romanticView
      }
      safetyFeatures {
        fireSafety
        securityCameras
        frontDesk24h
        roomSafe
        femaleOnlyFloors
        wellLitParking
      }
      verificationDocs {
        businessLicense
        touristLicense
        propertyOwnership
      }
      strikeHistory {
        date
        reason
        bookingId
      }
      lastInspectionDate
      createdAt
      updatedAt
      deletedAt
    }
  }
`;

export const GET_ROOM_QUERY = gql`
  query GetRoom($roomId: String!) {
    getRoom(roomId: $roomId) {
      _id
      roomName
      roomType
      roomStatus
      basePrice
      availableRooms
      roomImages
    }
  }
`;

export const GET_ROOMS_BY_HOTEL_QUERY = gql`
  query GetRoomsByHotel($hotelId: String!, $input: PaginationInput!) {
    getRoomsByHotel(hotelId: $hotelId, input: $input) {
      list {
        _id
        roomName
        roomType
        basePrice
        availableRooms
        roomImages
        roomStatus
      }
      metaCounter {
        total
      }
    }
  }
`;

export const GET_AGENT_HOTELS_QUERY = gql`
  query GetAgentHotels($input: PaginationInput!) {
    getAgentHotels(input: $input) {
      list {
        _id
        hotelTitle
        hotelLocation
        hotelType
        hotelRating
        hotelLikes
        hotelImages
      }
      metaCounter {
        total
      }
    }
  }
`;

export const GET_DASHBOARD_STATS_QUERY = gql`
  query GetDashboardStats {
    getDashboardStats {
      totalMembers
      totalHotels
      totalBookings
      totalRevenue
      pendingHotels
      pendingBookings
      newBookingsToday
      todayRevenue
    }
  }
`;

export const GET_HOTEL_REVIEWS_QUERY = gql`
  query GetHotelReviews($hotelId: String!, $input: PaginationInput!) {
    getHotelReviews(hotelId: $hotelId, input: $input) {
      list {
        _id
        reviewerId
        bookingId
        hotelId
        overallRating
        cleanlinessRating
        locationRating
        serviceRating
        amenitiesRating
        valueRating
        reviewTitle
        reviewText
        guestPhotos
        helpfulCount
        reviewStatus
        verifiedStay
        stayDate
        createdAt
        hotelResponse {
          responseText
          respondedBy
          respondedAt
        }
      }
      metaCounter {
        total
      }
    }
  }
`;

export const GET_SIMILAR_HOTELS_QUERY = gql`
  query GetSimilarHotels($hotelId: String!, $limit: Int) {
    getSimilarHotels(hotelId: $hotelId, limit: $limit) {
      _id
      hotelTitle
      hotelLocation
      hotelType
      hotelRating
      hotelLikes
      hotelImages
    }
  }
`;

export const GET_TRENDING_BY_LOCATION_QUERY = gql`
  query GetTrendingByLocation($location: HotelLocation!, $limit: Int) {
    getTrendingByLocation(location: $location, limit: $limit) {
      _id
      hotelTitle
      hotelLocation
      hotelType
      hotelRating
      hotelLikes
      hotelImages
    }
  }
`;

export const GET_RECOMMENDED_HOTELS_QUERY = gql`
  query GetRecommendedHotels($limit: Int) {
    getRecommendedHotels(limit: $limit) {
      _id
      hotelTitle
      hotelLocation
      hotelType
      hotelRating
      hotelLikes
      hotelImages
    }
  }
`;

export const HAS_LIKED_QUERY = gql`
  query HasLiked($likeRefId: String!, $likeGroup: LikeGroup!) {
    hasLiked(likeRefId: $likeRefId, likeGroup: $likeGroup)
  }
`;

export const TOGGLE_LIKE_MUTATION = gql`
  mutation ToggleLike($input: LikeInput!) {
    toggleLike(input: $input) {
      liked
      likeCount
    }
  }
`;

export const MARK_HELPFUL_MUTATION = gql`
  mutation MarkHelpful($reviewId: String!) {
    markHelpful(reviewId: $reviewId) {
      _id
      helpfulCount
    }
  }
`;

export const GET_PRICE_CALENDAR_QUERY = gql`
  query GetPriceCalendar($input: PriceCalendarInput!) {
    getPriceCalendar(input: $input) {
      averagePrice
      savings
      cheapestDate {
        date
        price
      }
      mostExpensiveDate {
        date
        price
      }
      calendar {
        date
        price
        isWeekend
        demandLevel
        localEvent
        availableRooms
      }
    }
  }
`;

export const GET_MY_PRICE_LOCK_QUERY = gql`
  query GetMyPriceLock($roomId: String!) {
    getMyPriceLock(roomId: $roomId) {
      _id
      roomId
      lockedPrice
      expiresAt
      createdAt
    }
  }
`;

export const LOCK_PRICE_MUTATION = gql`
  mutation LockPrice($input: CreatePriceLockInput!) {
    lockPrice(input: $input) {
      _id
      roomId
      lockedPrice
      expiresAt
      createdAt
    }
  }
`;

export const CANCEL_PRICE_LOCK_MUTATION = gql`
  mutation CancelPriceLock($priceLockId: String!) {
    cancelPriceLock(priceLockId: $priceLockId)
  }
`;
