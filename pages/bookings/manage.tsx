import { useMutation, useQuery } from "@apollo/client/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ErrorNotice } from "@/components/ui/error-notice";
import {
  CANCEL_BOOKING_BY_OPERATOR_MUTATION,
  GET_AGENT_BOOKINGS_QUERY,
  GET_ALL_BOOKINGS_ADMIN_QUERY,
  UPDATE_BOOKING_STATUS_MUTATION,
  UPDATE_PAYMENT_STATUS_MUTATION,
} from "@/graphql/booking.gql";
import { GET_AGENT_HOTELS_QUERY, GET_HOTELS_QUERY } from "@/graphql/hotel.gql";
import { usePaginationQueryState } from "@/lib/hooks/use-pagination-query-state";
import { getSessionMember } from "@/lib/auth/session";
import { type SupportedLocale } from "@/lib/i18n/config";
import { useI18n } from "@/lib/i18n/provider";
import {
  formatBookingDate,
  formatNightsLabel,
  getBookingStatusLabel,
  getPaymentStatusLabel,
} from "@/lib/bookings/booking-i18n";
import {
  confirmAction,
  confirmDanger,
  errorAlert,
  infoAlert,
  successAlert,
} from "@/lib/ui/alerts";
import { getErrorMessage } from "@/lib/utils/error";
import { formatNumber } from "@/lib/utils/format";
import type {
  BookingListItem,
  BookingStatus,
  CancelBookingByOperatorMutationData,
  CancelBookingByOperatorMutationVars,
  GetAgentBookingsQueryData,
  GetAgentBookingsQueryVars,
  GetAllBookingsAdminQueryData,
  GetAllBookingsAdminQueryVars,
  PaginationInput,
  PaymentStatus,
  UpdateBookingStatusMutationData,
  UpdateBookingStatusMutationVars,
  UpdatePaymentStatusMutationData,
  UpdatePaymentStatusMutationVars,
} from "@/types/booking";
import type {
  GetAgentHotelsQueryData,
  GetAgentHotelsQueryVars,
  GetHotelsQueryData,
  GetHotelsQueryVars,
  HotelListItem,
} from "@/types/hotel";
import type { NextPageWithAuth } from "@/types/page";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  SquarePen,
  Search,
  X,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_LIMIT = 15;
const HOTEL_LIST_LIMIT = 100;
const BOOKING_STATUSES: BookingStatus[] = [
  "PENDING",
  "CONFIRMED",
  "CHECKED_IN",
  "CHECKED_OUT",
  "CANCELLED",
  "NO_SHOW",
];
const PAYMENT_UPDATE_OPTIONS: PaymentStatus[] = [
  "PENDING",
  "PARTIAL",
  "PAID",
  "FAILED",
];

const STATUS_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  PENDING: ["CONFIRMED"],
  CONFIRMED: ["CHECKED_IN", "NO_SHOW"],
  CHECKED_IN: ["CHECKED_OUT"],
  CHECKED_OUT: [],
  CANCELLED: [],
  NO_SHOW: [],
};

// ─── Style Maps ───────────────────────────────────────────────────────────────

const BOOKING_STATUS_STYLE: Record<BookingStatus, { cls: string }> = {
  PENDING: {
    cls: "bg-amber-50 text-amber-700 border border-amber-200",
  },
  CONFIRMED: {
    cls: "bg-sky-50 text-sky-700 border border-sky-200",
  },
  CHECKED_IN: {
    cls: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  },
  CHECKED_OUT: {
    cls: "bg-slate-100 text-slate-600 border border-slate-200",
  },
  CANCELLED: {
    cls: "bg-rose-50 text-rose-600 border border-rose-200",
  },
  NO_SHOW: {
    cls: "bg-orange-50 text-orange-600 border border-orange-200",
  },
};

const PAYMENT_STATUS_STYLE: Record<PaymentStatus, { dot: string }> = {
  PENDING: { dot: "bg-amber-400" },
  PARTIAL: { dot: "bg-blue-400" },
  PAID: { dot: "bg-emerald-400" },
  FAILED: { dot: "bg-rose-400" },
  REFUNDED: { dot: "bg-slate-300" },
};

const NEXT_ACTION_CLASS: Record<Exclude<BookingStatus, "CHECKED_OUT" | "CANCELLED" | "NO_SHOW">, string> = {
  PENDING: "bg-sky-500 text-white hover:bg-sky-600",
  CONFIRMED: "bg-emerald-500 text-white hover:bg-emerald-600",
  CHECKED_IN: "bg-slate-700 text-white hover:bg-slate-800",
};

const STATUS_FILTER_STYLE: Record<BookingStatus | "ALL", { dot: string }> = {
  ALL: { dot: "" },
  PENDING: { dot: "bg-amber-400" },
  CONFIRMED: { dot: "bg-sky-400" },
  CHECKED_IN: { dot: "bg-emerald-400" },
  CHECKED_OUT: { dot: "bg-slate-400" },
  CANCELLED: { dot: "bg-rose-400" },
  NO_SHOW: { dot: "bg-orange-400" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const parseEvidencePhotos = (value: string): string[] =>
  value
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

const nightsBetween = (checkIn: string, checkOut: string): number =>
  Math.round(
    (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86_400_000,
  );

// ─── Types ────────────────────────────────────────────────────────────────────

interface OptimisticPatch {
  bookingStatus?: BookingStatus;
  paymentStatus?: PaymentStatus;
  paidAmount?: number;
}

type ModalState = {
  type: "status" | "payment" | "cancel";
  bookingId: string;
} | null;

interface BookingManagementCopy {
  operations: string;
  title: string;
  newBooking: string;
  allHotels: string;
  noHotels: string;
  searchCode: string;
  allStatuses: string;
  hotelsOverview: string;
  noHotelsFound: string;
  viewBookings: string;
  code: string;
  guestRoom: string;
  hotel: string;
  dates: string;
  amount: string;
  status: string;
  actions: string;
  noBookingsFound: string;
  selectHotelPrompt: string;
  adjustFiltersPrompt: string;
  guestFallback: string;
  hotelFallback: string;
  paid: string;
  pageSummary: string;
  totalSuffix: string;
  updateBookingStatus: string;
  current: string;
  advanceTo: string;
  noFurtherTransitions: string;
  updatePayment: string;
  paymentStatus: string;
  paidAmount: string;
  totalAmount: string;
  updatePaymentButton: string;
  updating: string;
  cancelBooking: string;
  irreversibleCancelWarning: string;
  cancellationReason: string;
  chars: string;
  minShort: string;
  describeCancellationReason: string;
  evidenceUrls: string;
  optionalOnePerLine: string;
  cancelling: string;
  cancelBookingButton: string;
  noChangeTitle: string;
  statusAlreadyBody: string;
  updateStatusTitle: string;
  updateStatusConfirm: string;
  statusUpdatedTitle: string;
  statusUpdatedBody: string;
  useCancellationFlowTitle: string;
  useCancellationFlowBody: string;
  invalidAmountTitle: string;
  invalidAmountBody: string;
  paymentUnchangedBody: string;
  updatePaymentTitle: string;
  updatePaymentConfirm: string;
  paymentUpdatedTitle: string;
  paymentUpdatedBody: string;
  updateFailedTitle: string;
  notCancellableTitle: string;
  notCancellableBody: string;
  invalidReasonTitle: string;
  invalidReasonBody: string;
  cancelConfirmTitle: string;
  cancelConfirmText: string;
  cancelConfirmWarning: string;
  cancelConfirmButton: string;
  cancelledTitle: string;
  cancelledBody: string;
  cancellationFailedTitle: string;
  confirmAction: string;
  checkInAction: string;
  checkOutAction: string;
  payAction: string;
  cancelAction: string;
  createdOn: string;
  moreActions: string;
}

const BOOKING_MANAGEMENT_COPY: Record<SupportedLocale, BookingManagementCopy> = {
  en: {
    operations: "Operations",
    title: "Booking Management",
    newBooking: "New Booking",
    allHotels: "All Hotels",
    noHotels: "No hotels",
    searchCode: "Search code…",
    allStatuses: "All",
    hotelsOverview: "Hotels Overview",
    noHotelsFound: "No hotels found.",
    viewBookings: "View bookings",
    code: "Code",
    guestRoom: "Guest / Room",
    hotel: "Hotel",
    dates: "Dates",
    amount: "Amount",
    status: "Status",
    actions: "Actions",
    noBookingsFound: "No bookings found",
    selectHotelPrompt: "Select a hotel to view bookings",
    adjustFiltersPrompt: "Try adjusting the status filter or search",
    guestFallback: "Guest",
    hotelFallback: "Hotel",
    paid: "Paid",
    pageSummary: "Page",
    totalSuffix: "total",
    updateBookingStatus: "Update Booking Status",
    current: "Current",
    advanceTo: "Advance to",
    noFurtherTransitions: "No further status transitions available.",
    updatePayment: "Update Payment",
    paymentStatus: "Payment Status",
    paidAmount: "Paid Amount (₩)",
    totalAmount: "Total",
    updatePaymentButton: "Update Payment",
    updating: "Updating…",
    cancelBooking: "Cancel Booking",
    irreversibleCancelWarning:
      "This action is irreversible. Only cancel for approved cases following operator cancellation policy.",
    cancellationReason: "Cancellation Reason",
    chars: "chars",
    minShort: "min 5",
    describeCancellationReason: "Describe the reason for cancellation…",
    evidenceUrls: "Evidence URLs",
    optionalOnePerLine: "optional, one per line",
    cancelling: "Cancelling…",
    cancelBookingButton: "Cancel Booking",
    noChangeTitle: "No change",
    statusAlreadyBody: "Status is already {{status}}.",
    updateStatusTitle: "Update status for {{code}}?",
    updateStatusConfirm: "Update status",
    statusUpdatedTitle: "Status updated",
    statusUpdatedBody: "{{code}} is now {{status}}.",
    useCancellationFlowTitle: "Use cancellation flow",
    useCancellationFlowBody: "Use the cancel action to mark as refunded.",
    invalidAmountTitle: "Invalid amount",
    invalidAmountBody: "Paid amount must be a non-negative integer.",
    paymentUnchangedBody: "Payment values are unchanged.",
    updatePaymentTitle: "Update payment for {{code}}?",
    updatePaymentConfirm: "Update payment",
    paymentUpdatedTitle: "Payment updated",
    paymentUpdatedBody: "Payment updated for {{code}}.",
    updateFailedTitle: "Update failed",
    notCancellableTitle: "Not cancellable",
    notCancellableBody: "Only pending or confirmed bookings can be cancelled.",
    invalidReasonTitle: "Invalid reason",
    invalidReasonBody: "Cancellation reason must be 5–500 characters.",
    cancelConfirmTitle: "Cancel booking {{code}}?",
    cancelConfirmText:
      "This sets booking status to cancelled and follows operator cancellation policy.",
    cancelConfirmWarning: "Only use this for approved cancellation cases.",
    cancelConfirmButton: "Yes, cancel booking",
    cancelledTitle: "Cancelled",
    cancelledBody: "Booking {{code}} has been cancelled.",
    cancellationFailedTitle: "Cancellation failed",
    confirmAction: "Confirm →",
    checkInAction: "Check-in →",
    checkOutAction: "Check-out →",
    payAction: "₩ Pay",
    cancelAction: "Cancel",
    createdOn: "Created {{date}}",
    moreActions: "More actions",
  },
  ko: {
    operations: "운영",
    title: "예약 관리",
    newBooking: "새 예약",
    allHotels: "전체 호텔",
    noHotels: "호텔 없음",
    searchCode: "예약 코드 검색…",
    allStatuses: "전체",
    hotelsOverview: "호텔 개요",
    noHotelsFound: "호텔이 없습니다.",
    viewBookings: "예약 보기",
    code: "코드",
    guestRoom: "투숙객 / 객실",
    hotel: "호텔",
    dates: "일정",
    amount: "금액",
    status: "상태",
    actions: "작업",
    noBookingsFound: "예약이 없습니다",
    selectHotelPrompt: "예약을 보려면 호텔을 선택하세요",
    adjustFiltersPrompt: "상태 필터나 검색 조건을 조정해 보세요",
    guestFallback: "투숙객",
    hotelFallback: "호텔",
    paid: "결제됨",
    pageSummary: "페이지",
    totalSuffix: "전체",
    updateBookingStatus: "예약 상태 변경",
    current: "현재",
    advanceTo: "다음 상태",
    noFurtherTransitions: "이후 진행 가능한 상태 변경이 없습니다.",
    updatePayment: "결제 정보 수정",
    paymentStatus: "결제 상태",
    paidAmount: "결제 금액 (₩)",
    totalAmount: "총액",
    updatePaymentButton: "결제 정보 수정",
    updating: "수정 중…",
    cancelBooking: "예약 취소",
    irreversibleCancelWarning:
      "이 작업은 되돌릴 수 없습니다. 운영 취소 정책에 따라 승인된 경우에만 취소하세요.",
    cancellationReason: "취소 사유",
    chars: "자",
    minShort: "최소 5자",
    describeCancellationReason: "취소 사유를 입력하세요…",
    evidenceUrls: "증빙 URL",
    optionalOnePerLine: "선택 사항, 한 줄에 하나씩",
    cancelling: "취소 중…",
    cancelBookingButton: "예약 취소",
    noChangeTitle: "변경 사항 없음",
    statusAlreadyBody: "상태가 이미 {{status}}입니다.",
    updateStatusTitle: "{{code}} 상태를 변경할까요?",
    updateStatusConfirm: "상태 변경",
    statusUpdatedTitle: "상태가 변경되었습니다",
    statusUpdatedBody: "{{code}} 예약이 이제 {{status}} 상태입니다.",
    useCancellationFlowTitle: "취소 절차를 사용하세요",
    useCancellationFlowBody: "환불 처리에는 취소 작업을 사용하세요.",
    invalidAmountTitle: "잘못된 금액",
    invalidAmountBody: "결제 금액은 0 이상의 정수여야 합니다.",
    paymentUnchangedBody: "결제 정보가 변경되지 않았습니다.",
    updatePaymentTitle: "{{code}} 결제 정보를 수정할까요?",
    updatePaymentConfirm: "결제 수정",
    paymentUpdatedTitle: "결제 정보가 수정되었습니다",
    paymentUpdatedBody: "{{code}} 예약의 결제 정보가 수정되었습니다.",
    updateFailedTitle: "수정 실패",
    notCancellableTitle: "취소할 수 없음",
    notCancellableBody: "대기 중 또는 확정된 예약만 취소할 수 있습니다.",
    invalidReasonTitle: "유효하지 않은 사유",
    invalidReasonBody: "취소 사유는 5자 이상 500자 이하여야 합니다.",
    cancelConfirmTitle: "{{code}} 예약을 취소할까요?",
    cancelConfirmText:
      "예약 상태가 취소됨으로 변경되며 운영 취소 정책이 적용됩니다.",
    cancelConfirmWarning: "승인된 취소 건에만 사용하세요.",
    cancelConfirmButton: "예약 취소",
    cancelledTitle: "취소 완료",
    cancelledBody: "{{code}} 예약이 취소되었습니다.",
    cancellationFailedTitle: "취소 실패",
    confirmAction: "확정 →",
    checkInAction: "체크인 →",
    checkOutAction: "체크아웃 →",
    payAction: "₩ 결제",
    cancelAction: "취소",
    createdOn: "{{date}} 생성",
    moreActions: "추가 작업",
  },
  ru: {
    operations: "Операции",
    title: "Управление бронированиями",
    newBooking: "Новое бронирование",
    allHotels: "Все отели",
    noHotels: "Нет отелей",
    searchCode: "Поиск по коду…",
    allStatuses: "Все",
    hotelsOverview: "Обзор отелей",
    noHotelsFound: "Отели не найдены.",
    viewBookings: "Открыть бронирования",
    code: "Код",
    guestRoom: "Гость / Номер",
    hotel: "Отель",
    dates: "Даты",
    amount: "Сумма",
    status: "Статус",
    actions: "Действия",
    noBookingsFound: "Бронирования не найдены",
    selectHotelPrompt: "Выберите отель, чтобы увидеть бронирования",
    adjustFiltersPrompt: "Попробуйте изменить фильтр статуса или поиск",
    guestFallback: "Гость",
    hotelFallback: "Отель",
    paid: "Оплачено",
    pageSummary: "Страница",
    totalSuffix: "всего",
    updateBookingStatus: "Изменить статус бронирования",
    current: "Текущий",
    advanceTo: "Перевести в",
    noFurtherTransitions: "Дальнейшие переходы статуса недоступны.",
    updatePayment: "Изменить оплату",
    paymentStatus: "Статус оплаты",
    paidAmount: "Оплаченная сумма (₩)",
    totalAmount: "Итого",
    updatePaymentButton: "Обновить оплату",
    updating: "Обновление…",
    cancelBooking: "Отменить бронирование",
    irreversibleCancelWarning:
      "Это действие необратимо. Отменяйте только в утвержденных случаях по правилам оператора.",
    cancellationReason: "Причина отмены",
    chars: "симв.",
    minShort: "мин. 5",
    describeCancellationReason: "Опишите причину отмены…",
    evidenceUrls: "Ссылки на подтверждения",
    optionalOnePerLine: "необязательно, по одной в строке",
    cancelling: "Отмена…",
    cancelBookingButton: "Отменить бронирование",
    noChangeTitle: "Без изменений",
    statusAlreadyBody: "Статус уже {{status}}.",
    updateStatusTitle: "Обновить статус для {{code}}?",
    updateStatusConfirm: "Обновить статус",
    statusUpdatedTitle: "Статус обновлен",
    statusUpdatedBody: "{{code}} теперь имеет статус {{status}}.",
    useCancellationFlowTitle: "Используйте сценарий отмены",
    useCancellationFlowBody:
      "Чтобы отметить возврат, используйте действие отмены.",
    invalidAmountTitle: "Неверная сумма",
    invalidAmountBody: "Оплаченная сумма должна быть целым числом не меньше нуля.",
    paymentUnchangedBody: "Параметры оплаты не изменились.",
    updatePaymentTitle: "Обновить оплату для {{code}}?",
    updatePaymentConfirm: "Обновить оплату",
    paymentUpdatedTitle: "Оплата обновлена",
    paymentUpdatedBody: "Оплата для {{code}} обновлена.",
    updateFailedTitle: "Не удалось обновить",
    notCancellableTitle: "Нельзя отменить",
    notCancellableBody:
      "Отменять можно только бронирования со статусом ожидания или подтверждения.",
    invalidReasonTitle: "Неверная причина",
    invalidReasonBody: "Причина отмены должна содержать 5–500 символов.",
    cancelConfirmTitle: "Отменить бронирование {{code}}?",
    cancelConfirmText:
      "Статус бронирования изменится на отменено по правилам отмены оператора.",
    cancelConfirmWarning:
      "Используйте это только для согласованных случаев отмены.",
    cancelConfirmButton: "Да, отменить",
    cancelledTitle: "Бронирование отменено",
    cancelledBody: "Бронирование {{code}} отменено.",
    cancellationFailedTitle: "Не удалось отменить",
    confirmAction: "Подтвердить →",
    checkInAction: "Заселить →",
    checkOutAction: "Выселить →",
    payAction: "₩ Оплата",
    cancelAction: "Отмена",
    createdOn: "Создано {{date}}",
    moreActions: "Еще действия",
  },
  uz: {
    operations: "Operatsiyalar",
    title: "Bronlarni boshqarish",
    newBooking: "Yangi bron",
    allHotels: "Barcha mehmonxonalar",
    noHotels: "Mehmonxona yo'q",
    searchCode: "Kod bo'yicha qidirish…",
    allStatuses: "Barchasi",
    hotelsOverview: "Mehmonxonalar ko'rinishi",
    noHotelsFound: "Mehmonxonalar topilmadi.",
    viewBookings: "Bronlarni ko'rish",
    code: "Kod",
    guestRoom: "Mehmon / Xona",
    hotel: "Mehmonxona",
    dates: "Sanalar",
    amount: "Summa",
    status: "Holat",
    actions: "Amallar",
    noBookingsFound: "Bronlar topilmadi",
    selectHotelPrompt: "Bronlarni ko'rish uchun mehmonxona tanlang",
    adjustFiltersPrompt: "Holat filtrini yoki qidiruvni o'zgartirib ko'ring",
    guestFallback: "Mehmon",
    hotelFallback: "Mehmonxona",
    paid: "To'langan",
    pageSummary: "Sahifa",
    totalSuffix: "jami",
    updateBookingStatus: "Bron holatini yangilash",
    current: "Joriy",
    advanceTo: "Keyingi holat",
    noFurtherTransitions: "Boshqa holatga o'tish imkoniyati yo'q.",
    updatePayment: "To'lovni yangilash",
    paymentStatus: "To'lov holati",
    paidAmount: "To'langan summa (₩)",
    totalAmount: "Jami",
    updatePaymentButton: "To'lovni yangilash",
    updating: "Yangilanmoqda…",
    cancelBooking: "Bronni bekor qilish",
    irreversibleCancelWarning:
      "Bu amalni ortga qaytarib bo'lmaydi. Faqat tasdiqlangan holatlarda operator qoidasi bo'yicha bekor qiling.",
    cancellationReason: "Bekor qilish sababi",
    chars: "belgi",
    minShort: "kamida 5",
    describeCancellationReason: "Bekor qilish sababini yozing…",
    evidenceUrls: "Dalil URLlari",
    optionalOnePerLine: "ixtiyoriy, har qatorda bittadan",
    cancelling: "Bekor qilinmoqda…",
    cancelBookingButton: "Bronni bekor qilish",
    noChangeTitle: "O'zgarish yo'q",
    statusAlreadyBody: "Holat allaqachon {{status}}.",
    updateStatusTitle: "{{code}} uchun holat yangilansinmi?",
    updateStatusConfirm: "Holatni yangilash",
    statusUpdatedTitle: "Holat yangilandi",
    statusUpdatedBody: "{{code}} endi {{status}} holatida.",
    useCancellationFlowTitle: "Bekor qilish oqimini ishlating",
    useCancellationFlowBody:
      "Pulni qaytarildi deb belgilash uchun bekor qilish amalidan foydalaning.",
    invalidAmountTitle: "Noto'g'ri summa",
    invalidAmountBody: "To'langan summa 0 yoki undan katta butun son bo'lishi kerak.",
    paymentUnchangedBody: "To'lov qiymatlari o'zgarmagan.",
    updatePaymentTitle: "{{code}} uchun to'lov yangilansinmi?",
    updatePaymentConfirm: "To'lovni yangilash",
    paymentUpdatedTitle: "To'lov yangilandi",
    paymentUpdatedBody: "{{code}} uchun to'lov yangilandi.",
    updateFailedTitle: "Yangilash muvaffaqiyatsiz",
    notCancellableTitle: "Bekor qilib bo'lmaydi",
    notCancellableBody:
      "Faqat kutilayotgan yoki tasdiqlangan bronlarni bekor qilish mumkin.",
    invalidReasonTitle: "Noto'g'ri sabab",
    invalidReasonBody: "Bekor qilish sababi 5–500 belgi oralig'ida bo'lishi kerak.",
    cancelConfirmTitle: "{{code}} bronini bekor qilasizmi?",
    cancelConfirmText:
      "Bron holati bekor qilindi holatiga o'tadi va operator bekor qilish siyosati qo'llanadi.",
    cancelConfirmWarning:
      "Buni faqat tasdiqlangan bekor qilish holatlarida ishlating.",
    cancelConfirmButton: "Ha, bekor qilish",
    cancelledTitle: "Bekor qilindi",
    cancelledBody: "{{code}} broni bekor qilindi.",
    cancellationFailedTitle: "Bekor qilish muvaffaqiyatsiz",
    confirmAction: "Tasdiqlash →",
    checkInAction: "Check-in →",
    checkOutAction: "Check-out →",
    payAction: "₩ To'lov",
    cancelAction: "Bekor qilish",
    createdOn: "{{date}} yaratildi",
    moreActions: "Ko'proq amallar",
  },
};

const getBookingManagementCopy = (
  locale: SupportedLocale,
): BookingManagementCopy => BOOKING_MANAGEMENT_COPY[locale];

const getNextActionLabel = (
  locale: SupportedLocale,
  status: BookingStatus,
): string | null => {
  const copy = getBookingManagementCopy(locale);
  switch (status) {
    case "PENDING":
      return copy.confirmAction;
    case "CONFIRMED":
      return copy.checkInAction;
    case "CHECKED_IN":
      return copy.checkOutAction;
    default:
      return null;
  }
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function BookingStatusBadge({
  status,
  locale,
}: {
  status: BookingStatus;
  locale: SupportedLocale;
}) {
  const s = BOOKING_STATUS_STYLE[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${s.cls}`}
    >
      {getBookingStatusLabel(locale, status)}
    </span>
  );
}

function PaymentStatusBadge({
  status,
  locale,
}: {
  status: PaymentStatus;
  locale: SupportedLocale;
}) {
  const s = PAYMENT_STATUS_STYLE[status];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
      <span className={`h-2 w-2 flex-shrink-0 rounded-full ${s.dot}`} />
      {getPaymentStatusLabel(locale, status)}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const StaffBookingManagementPage: NextPageWithAuth = () => {
  const { locale } = useI18n();
  const copy = getBookingManagementCopy(locale);
  const member = useMemo(() => getSessionMember(), []);
  const memberType = member?.memberType;
  const isAgent = memberType === "AGENT";
  const isAdmin = memberType === "ADMIN" || memberType === "ADMIN_OPERATOR";
  const canAccess = isAgent || isAdmin;

  const { page, statusFilter, getParam, pushQuery } =
    usePaginationQueryState<BookingStatus>({
      pathname: "/bookings/manage",
      statusValues: BOOKING_STATUSES,
    });
  const hotelIdFromQuery = getParam("hotelId");

  // ─── Modal / draft state ──────────────────────────────────────────────────

  const [activeModal, setActiveModal] = useState<ModalState>(null);
  const [statusDraft, setStatusDraft] = useState<BookingStatus | null>(null);
  const [paymentStatusDraft, setPaymentStatusDraft] =
    useState<PaymentStatus | null>(null);
  const [paidAmountDraft, setPaidAmountDraft] = useState<string>("");
  const [cancelReasonDraft, setCancelReasonDraft] = useState<string>("");
  const [cancelEvidenceDraft, setCancelEvidenceDraft] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  // Admin-specific filters
  const [adminHotelFilter, setAdminHotelFilter] = useState<string>("ALL");
  const [codeSearch, setCodeSearch] = useState<string>("");

  // Optimistic patches
  const [optimisticPatches, setOptimisticPatches] = useState<
    Record<string, OptimisticPatch>
  >({});

  // ─── Optimistic patch helpers (same logic as before) ──────────────────────

  const replacePatch = (bookingId: string, patch?: OptimisticPatch) => {
    setOptimisticPatches((prev) => {
      const next = { ...prev };
      if (!patch || Object.keys(patch).length === 0) {
        delete next[bookingId];
      } else {
        next[bookingId] = patch;
      }
      return next;
    });
  };

  const applyPatch = (bookingId: string, patch: OptimisticPatch) => {
    setOptimisticPatches((prev) => ({
      ...prev,
      [bookingId]: { ...prev[bookingId], ...patch },
    }));
  };

  const clearPatchFields = (
    bookingId: string,
    fields: Array<keyof OptimisticPatch>,
  ) => {
    setOptimisticPatches((prev) => {
      const existing = prev[bookingId];
      if (!existing) return prev;
      const nextPatch: OptimisticPatch = { ...existing };
      fields.forEach((f) => delete nextPatch[f]);
      const next = { ...prev };
      if (Object.keys(nextPatch).length === 0) delete next[bookingId];
      else next[bookingId] = nextPatch;
      return next;
    });
  };

  // ─── Hotel list inputs ────────────────────────────────────────────────────

  const hotelListInput = useMemo<GetAgentHotelsQueryVars["input"]>(
    () => ({
      page: 1,
      limit: HOTEL_LIST_LIMIT,
      sort: "createdAt",
      direction: -1,
    }),
    [],
  );

  // ─── Hotel queries ────────────────────────────────────────────────────────

  const {
    data: agentHotelsData,
    loading: agentHotelsLoading,
    error: agentHotelsError,
  } = useQuery<GetAgentHotelsQueryData, GetAgentHotelsQueryVars>(
    GET_AGENT_HOTELS_QUERY,
    {
      skip: !isAgent,
      variables: { input: hotelListInput },
      fetchPolicy: "cache-and-network",
      nextFetchPolicy: "cache-and-network",
    },
  );

  const {
    data: publicHotelsData,
    loading: publicHotelsLoading,
    error: publicHotelsError,
  } = useQuery<GetHotelsQueryData, GetHotelsQueryVars>(GET_HOTELS_QUERY, {
    skip: !isAdmin,
    variables: { input: hotelListInput },
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-and-network",
  });

  const availableHotels = useMemo<HotelListItem[]>(
    () =>
      isAgent
        ? (agentHotelsData?.getAgentHotels.list ?? [])
        : (publicHotelsData?.getHotels.list ?? []),
    [agentHotelsData, isAgent, publicHotelsData],
  );

  const hotelsMap = useMemo<Map<string, HotelListItem>>(() => {
    const map = new Map<string, HotelListItem>();
    for (const h of availableHotels) map.set(h._id, h);
    return map;
  }, [availableHotels]);

  // Agent: selected hotel from URL param; "ALL" shows cross-hotel summary
  const selectedHotelId = isAgent ? hotelIdFromQuery || "ALL" : "";

  useEffect(() => {
    if (!isAgent || hotelIdFromQuery) return;
    // Default to "ALL" — no auto-redirect needed
  }, [hotelIdFromQuery, isAgent]);

  // ─── Booking queries ──────────────────────────────────────────────────────

  const bookingInput = useMemo<PaginationInput>(
    () => ({ page, limit: PAGE_LIMIT, sort: "createdAt", direction: -1 }),
    [page],
  );

  const {
    data: agentBookingsData,
    loading: agentBookingsLoading,
    error: agentBookingsError,
    refetch: refetchAgentBookings,
  } = useQuery<GetAgentBookingsQueryData, GetAgentBookingsQueryVars>(
    GET_AGENT_BOOKINGS_QUERY,
    {
      skip: !isAgent || !selectedHotelId || selectedHotelId === "ALL",
      variables: { hotelId: selectedHotelId, input: bookingInput },
      fetchPolicy: "cache-and-network",
      nextFetchPolicy: "cache-and-network",
    },
  );

  const {
    data: adminBookingsData,
    loading: adminBookingsLoading,
    error: adminBookingsError,
    refetch: refetchAdminBookings,
  } = useQuery<GetAllBookingsAdminQueryData, GetAllBookingsAdminQueryVars>(
    GET_ALL_BOOKINGS_ADMIN_QUERY,
    {
      skip: !isAdmin,
      variables: {
        input: bookingInput,
        statusFilter: statusFilter === "ALL" ? undefined : statusFilter,
      },
      fetchPolicy: "cache-and-network",
      nextFetchPolicy: "cache-and-network",
    },
  );

  const refetchBookings = isAdmin ? refetchAdminBookings : refetchAgentBookings;

  // ─── Mutations ────────────────────────────────────────────────────────────

  const [updateBookingStatus] = useMutation<
    UpdateBookingStatusMutationData,
    UpdateBookingStatusMutationVars
  >(UPDATE_BOOKING_STATUS_MUTATION, {
    refetchQueries: ["getAgentBookings", "getAllBookingsAdmin"],
  });

  const [updatePaymentStatus] = useMutation<
    UpdatePaymentStatusMutationData,
    UpdatePaymentStatusMutationVars
  >(UPDATE_PAYMENT_STATUS_MUTATION, {
    refetchQueries: ["getAgentBookings", "getAllBookingsAdmin"],
  });

  const [cancelBookingByOperator] = useMutation<
    CancelBookingByOperatorMutationData,
    CancelBookingByOperatorMutationVars
  >(CANCEL_BOOKING_BY_OPERATOR_MUTATION, {
    refetchQueries: ["getAgentBookings", "getAllBookingsAdmin"],
  });

  // ─── Derived data ─────────────────────────────────────────────────────────

  const sourceBookings: BookingListItem[] = isAdmin
    ? (adminBookingsData?.getAllBookingsAdmin.list ?? [])
    : (agentBookingsData?.getAgentBookings.list ?? []);

  const mergedBookings = sourceBookings.map((b) => {
    const patch = optimisticPatches[b._id];
    return patch ? { ...b, ...patch } : b;
  });

  const visibleBookings = useMemo(() => {
    let list = mergedBookings;
    // Agent: server filters by status already. Admin: server also filters by status.
    // Agent: additionally client-filter from URL statusFilter on top of server data
    if (isAgent && statusFilter !== "ALL") {
      list = list.filter((b) => b.bookingStatus === statusFilter);
    }
    // Admin: client-side hotel filter
    if (isAdmin && adminHotelFilter !== "ALL") {
      list = list.filter((b) => b.hotelId === adminHotelFilter);
    }
    // Booking code search
    if (codeSearch.trim()) {
      const q = codeSearch.trim().toUpperCase();
      list = list.filter((b) => b.bookingCode.toUpperCase().includes(q));
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    mergedBookings,
    statusFilter,
    isAgent,
    isAdmin,
    adminHotelFilter,
    codeSearch,
  ]);

  const total = isAdmin
    ? (adminBookingsData?.getAllBookingsAdmin.metaCounter.total ?? 0)
    : (agentBookingsData?.getAgentBookings.metaCounter.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));

  const bookingsLoading = isAdmin ? adminBookingsLoading : agentBookingsLoading;
  const bookingsError = isAdmin ? adminBookingsError : agentBookingsError;
  const hotelsLoading = isAgent ? agentHotelsLoading : publicHotelsLoading;
  const hotelsError = agentHotelsError ?? publicHotelsError;

  const activeBooking = activeModal
    ? (mergedBookings.find((b) => b._id === activeModal.bookingId) ?? null)
    : null;

  // ─── Modal helpers ────────────────────────────────────────────────────────

  const openModal = (
    type: "status" | "payment" | "cancel",
    bookingId: string,
  ) => {
    const b = mergedBookings.find((x) => x._id === bookingId);
    if (!b) return;
    if (type === "status") {
      setStatusDraft(null); // user selects in modal
    } else if (type === "payment") {
      setPaymentStatusDraft(b.paymentStatus);
      setPaidAmountDraft(String(b.paidAmount));
    } else {
      setCancelReasonDraft("");
      setCancelEvidenceDraft("");
    }
    setActiveModal({ type, bookingId });
  };

  const closeModal = () => {
    setActiveModal(null);
    setStatusDraft(null);
    setPaymentStatusDraft(null);
    setPaidAmountDraft("");
    setCancelReasonDraft("");
    setCancelEvidenceDraft("");
  };

  // ─── Handlers ────────────────────────────────────────────────────────────

  const handleStatusUpdate = async (
    booking: BookingListItem,
    nextStatus: BookingStatus,
  ) => {
    const nextStatusLabel = getBookingStatusLabel(locale, nextStatus);
    if (nextStatus === booking.bookingStatus) {
      await infoAlert(
        copy.noChangeTitle,
        copy.statusAlreadyBody.replace("{{status}}", nextStatusLabel),
      );
      return;
    }
    const confirmed = await confirmAction({
      title: copy.updateStatusTitle.replace("{{code}}", booking.bookingCode),
      text: `${getBookingStatusLabel(locale, booking.bookingStatus)} → ${nextStatusLabel}`,
      confirmText: copy.updateStatusConfirm,
    });
    if (!confirmed) return;

    const previousPatch = optimisticPatches[booking._id];
    applyPatch(booking._id, { bookingStatus: nextStatus });
    setSubmitting(true);
    try {
      await updateBookingStatus({
        variables: { bookingId: booking._id, status: nextStatus },
      });
      await refetchBookings();
      clearPatchFields(booking._id, ["bookingStatus"]);
      closeModal();
      await successAlert(
        copy.statusUpdatedTitle,
        copy.statusUpdatedBody
          .replace("{{code}}", booking.bookingCode)
          .replace("{{status}}", nextStatusLabel),
      );
    } catch (err) {
      replacePatch(booking._id, previousPatch);
      await errorAlert(copy.updateFailedTitle, getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handlePaymentUpdate = async (booking: BookingListItem) => {
    const nextPaymentStatus = paymentStatusDraft ?? booking.paymentStatus;
    if (nextPaymentStatus === "REFUNDED") {
      await infoAlert(
        copy.useCancellationFlowTitle,
        copy.useCancellationFlowBody,
      );
      return;
    }
    const nextPaidAmount = Number(paidAmountDraft);
    if (!Number.isInteger(nextPaidAmount) || nextPaidAmount < 0) {
      await errorAlert(copy.invalidAmountTitle, copy.invalidAmountBody);
      return;
    }
    if (
      nextPaymentStatus === booking.paymentStatus &&
      nextPaidAmount === booking.paidAmount
    ) {
      await infoAlert(copy.noChangeTitle, copy.paymentUnchangedBody);
      return;
    }

    const confirmed = await confirmAction({
      title: copy.updatePaymentTitle.replace("{{code}}", booking.bookingCode),
      text: `${copy.paymentStatus}: ${getPaymentStatusLabel(locale, booking.paymentStatus)} → ${getPaymentStatusLabel(locale, nextPaymentStatus)}\n${copy.paid}: ₩${formatNumber(booking.paidAmount)} → ₩${formatNumber(nextPaidAmount)}`,
      confirmText: copy.updatePaymentConfirm,
    });
    if (!confirmed) return;

    const previousPatch = optimisticPatches[booking._id];
    applyPatch(booking._id, {
      paymentStatus: nextPaymentStatus,
      paidAmount: nextPaidAmount,
    });
    setSubmitting(true);
    try {
      await updatePaymentStatus({
        variables: {
          bookingId: booking._id,
          paymentStatus: nextPaymentStatus,
          paidAmount: nextPaidAmount,
        },
      });
      await refetchBookings();
      clearPatchFields(booking._id, ["paymentStatus", "paidAmount"]);
      closeModal();
      await successAlert(
        copy.paymentUpdatedTitle,
        copy.paymentUpdatedBody.replace("{{code}}", booking.bookingCode),
      );
    } catch (err) {
      replacePatch(booking._id, previousPatch);
      await errorAlert(copy.updateFailedTitle, getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleOperatorCancel = async (booking: BookingListItem) => {
    if (
      booking.bookingStatus !== "PENDING" &&
      booking.bookingStatus !== "CONFIRMED"
    ) {
      await infoAlert(copy.notCancellableTitle, copy.notCancellableBody);
      return;
    }
    const reason = cancelReasonDraft.trim();
    if (reason.length < 5 || reason.length > 500) {
      await errorAlert(copy.invalidReasonTitle, copy.invalidReasonBody);
      return;
    }
    const confirmed = await confirmDanger({
      title: copy.cancelConfirmTitle.replace("{{code}}", booking.bookingCode),
      text: copy.cancelConfirmText,
      warningText: copy.cancelConfirmWarning,
      confirmText: copy.cancelConfirmButton,
    });
    if (!confirmed) return;

    const evidencePhotos = parseEvidencePhotos(cancelEvidenceDraft);
    const previousPatch = optimisticPatches[booking._id];
    applyPatch(booking._id, { bookingStatus: "CANCELLED" });
    setSubmitting(true);
    try {
      await cancelBookingByOperator({
        variables: {
          bookingId: booking._id,
          reason,
          evidencePhotos:
            evidencePhotos.length > 0 ? evidencePhotos : undefined,
        },
      });
      await refetchBookings();
      clearPatchFields(booking._id, ["bookingStatus"]);
      closeModal();
      await successAlert(
        copy.cancelledTitle,
        copy.cancelledBody.replace("{{code}}", booking.bookingCode),
      );
    } catch (err) {
      replacePatch(booking._id, previousPatch);
      await errorAlert(copy.cancellationFailedTitle, getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const pushManageQuery = (next: {
    hotelId?: string;
    status?: BookingStatus | "ALL";
    page?: number;
  }) => {
    pushQuery({
      page: next.page,
      status: next.status,
      extra: isAgent ? { hotelId: next.hotelId ?? selectedHotelId } : undefined,
    });
  };

  // ─── JSX ──────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes modalSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes rowFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>

      {/* ── Action Modals ── */}
      {activeModal && activeBooking && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
            onClick={closeModal}
          />
          <div
            className="fixed inset-x-4 bottom-0 z-50 flex flex-col rounded-t-3xl bg-white shadow-2xl sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[440px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl"
            style={{
              animation: "modalSlideUp 0.25s cubic-bezier(0.16,1,0.3,1) both",
            }}
          >
            {/* Modal drag handle (mobile) */}
            <div className="flex justify-center pt-3 sm:hidden">
              <div className="h-1 w-10 rounded-full bg-slate-200" />
            </div>

            {/* ── Status Modal ── */}
            {activeModal.type === "status" && (
              <div className="p-6">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                      {copy.updateBookingStatus}
                    </p>
                    <p className="mt-1 font-semibold text-slate-900">
                      {activeBooking.bookingCode}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="mb-4 flex items-center gap-2">
                  <span className="text-sm text-slate-500">{copy.current}:</span>
                  <BookingStatusBadge
                    status={activeBooking.bookingStatus}
                    locale={locale}
                  />
                </div>

                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
                  {copy.advanceTo}
                </p>
                <div className="space-y-2">
                  {STATUS_TRANSITIONS[activeBooking.bookingStatus].length ===
                  0 ? (
                    <p className="text-sm text-slate-500">
                      {copy.noFurtherTransitions}
                    </p>
                  ) : (
                    STATUS_TRANSITIONS[activeBooking.bookingStatus].map(
                      (nextStatus) => {
                        const style = BOOKING_STATUS_STYLE[nextStatus];
                        return (
                          <button
                            key={nextStatus}
                            type="button"
                            disabled={submitting}
                            onClick={() =>
                              void handleStatusUpdate(activeBooking, nextStatus)
                            }
                            className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-sm font-semibold transition disabled:opacity-50 ${style.cls}`}
                          >
                            <span>{getBookingStatusLabel(locale, nextStatus)}</span>
                            <span className="text-xs opacity-70">→</span>
                          </button>
                        );
                      },
                    )
                  )}
                </div>
              </div>
            )}

            {/* ── Payment Modal ── */}
            {activeModal.type === "payment" && (
              <div className="p-6">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                      {copy.updatePayment}
                    </p>
                    <p className="mt-1 font-semibold text-slate-900">
                      {activeBooking.bookingCode}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                      {copy.paymentStatus}
                    </label>
                    <select
                      value={paymentStatusDraft ?? activeBooking.paymentStatus}
                      onChange={(e) =>
                        setPaymentStatusDraft(e.target.value as PaymentStatus)
                      }
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none ring-sky-400 transition focus:ring-2"
                    >
                      {(PAYMENT_UPDATE_OPTIONS.includes(
                        activeBooking.paymentStatus,
                      )
                        ? PAYMENT_UPDATE_OPTIONS
                        : [
                            activeBooking.paymentStatus,
                            ...PAYMENT_UPDATE_OPTIONS,
                          ]
                      ).map((s) => (
                        <option key={s} value={s}>
                          {getPaymentStatusLabel(locale, s)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                      {copy.paidAmount}
                    </label>
                    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 transition focus-within:border-slate-300 focus-within:bg-white">
                      <span className="text-sm font-semibold text-slate-400">
                        ₩
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={paidAmountDraft}
                        onChange={(e) =>
                          setPaidAmountDraft(
                            e.target.value.replace(/[^\d]/g, ""),
                          )
                        }
                        className="flex-1 bg-transparent text-sm font-medium text-slate-900 outline-none"
                        placeholder="0"
                      />
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      {copy.totalAmount}: ₩{formatNumber(activeBooking.totalPrice)}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void handlePaymentUpdate(activeBooking)}
                  className="mt-5 w-full rounded-2xl bg-slate-900 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50"
                >
                  {submitting ? copy.updating : copy.updatePaymentButton}
                </button>
              </div>
            )}

            {/* ── Cancel Modal ── */}
            {activeModal.type === "cancel" && (
              <div className="p-6">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                      {copy.cancelBooking}
                    </p>
                    <p className="mt-1 font-semibold text-slate-900">
                      {activeBooking.bookingCode}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
                  <AlertTriangle
                    size={15}
                    className="mt-0.5 flex-shrink-0 text-rose-500"
                  />
                  <p className="text-sm text-rose-700">
                    {copy.irreversibleCancelWarning}
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                      {copy.cancellationReason}{" "}
                      <span className="font-normal text-slate-400">
                        ({cancelReasonDraft.length}/500 {copy.chars}, {copy.minShort})
                      </span>
                    </label>
                    <textarea
                      value={cancelReasonDraft}
                      onChange={(e) => setCancelReasonDraft(e.target.value)}
                      rows={3}
                      maxLength={500}
                      placeholder={copy.describeCancellationReason}
                      className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none ring-sky-400 transition focus:border-slate-300 focus:bg-white focus:ring-2"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                      {copy.evidenceUrls}{" "}
                      <span className="font-normal text-slate-400">
                        ({copy.optionalOnePerLine})
                      </span>
                    </label>
                    <textarea
                      value={cancelEvidenceDraft}
                      onChange={(e) => setCancelEvidenceDraft(e.target.value)}
                      rows={2}
                      placeholder="https://example.com/evidence.jpg"
                      className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none ring-sky-400 transition focus:border-slate-300 focus:bg-white focus:ring-2"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  disabled={submitting || cancelReasonDraft.trim().length < 5}
                  onClick={() => void handleOperatorCancel(activeBooking)}
                  className="mt-5 w-full rounded-2xl bg-rose-600 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
                >
                  {submitting ? copy.cancelling : copy.cancelBookingButton}
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Page ── */}
      <main className="space-y-5">
        {/* Header */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              {copy.operations}
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">
              {copy.title}
            </h1>
          </div>
          <Link
            href="/bookings/new"
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <SquarePen size={14} className="text-slate-500" />
            {copy.newBooking}
          </Link>
        </header>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Agent: hotel selector */}
          {isAgent &&
            (hotelsLoading ? (
              <div className="h-9 w-48 animate-pulse rounded-xl bg-slate-100" />
            ) : (
              <select
                value={selectedHotelId}
                onChange={(e) =>
                  pushManageQuery({ hotelId: e.target.value, page: 1 })
                }
                disabled={availableHotels.length === 0}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm outline-none ring-sky-400 transition focus:ring-2"
              >
                <option value="ALL">{copy.allHotels}</option>
                {availableHotels.length === 0 && (
                  <option value="">{copy.noHotels}</option>
                )}
                {availableHotels.map((h) => (
                  <option key={h._id} value={h._id}>
                    {h.hotelTitle}
                  </option>
                ))}
              </select>
            ))}

          {/* Admin: hotel filter (client-side) */}
          {isAdmin && (
            <select
              value={adminHotelFilter}
              onChange={(e) => {
                setAdminHotelFilter(e.target.value);
              }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm outline-none ring-sky-400 transition focus:ring-2"
            >
              <option value="ALL">{copy.allHotels}</option>
              {availableHotels.map((h) => (
                <option key={h._id} value={h._id}>
                  {h.hotelTitle}
                </option>
              ))}
            </select>
          )}

          {/* Booking code search */}
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm transition focus-within:border-slate-300">
            <Search size={13} className="flex-shrink-0 text-slate-400" />
            <input
              value={codeSearch}
              onChange={(e) => setCodeSearch(e.target.value)}
              placeholder={copy.searchCode}
              className="w-28 bg-transparent text-xs text-slate-900 placeholder-slate-400 outline-none"
            />
            {codeSearch && (
              <button
                type="button"
                onClick={() => setCodeSearch("")}
                className="flex-shrink-0 text-slate-400 transition hover:text-slate-600"
              >
                <X size={11} />
              </button>
            )}
          </div>

          {/* Status filter pills */}
          <div className="flex flex-wrap gap-1.5">
            {(["ALL", ...BOOKING_STATUSES] as const).map((s) => {
              const isSelected = statusFilter === s;
              const dot =
                s !== "ALL" ? STATUS_FILTER_STYLE[s as BookingStatus].dot : "";
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() =>
                    pushManageQuery({
                      status: s as BookingStatus | "ALL",
                      page: 1,
                    })
                  }
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    isSelected
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {dot && (
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        isSelected ? "bg-white/70" : dot
                      }`}
                    />
                  )}
                  {s === "ALL"
                    ? copy.allStatuses
                    : getBookingStatusLabel(locale, s as BookingStatus)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Errors */}
        {hotelsError && <ErrorNotice message={getErrorMessage(hotelsError)} />}
        {bookingsError && (
          <ErrorNotice message={getErrorMessage(bookingsError)} />
        )}

        {/* Agent "All Hotels" summary view */}
        {isAgent && selectedHotelId === "ALL" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              {copy.hotelsOverview}
            </p>
            {hotelsLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-16 animate-pulse rounded-xl bg-slate-100"
                  />
                ))}
              </div>
            ) : availableHotels.length === 0 ? (
              <p className="text-sm text-slate-400">{copy.noHotelsFound}</p>
            ) : (
              <div className="space-y-3">
                {availableHotels.map((h) => (
                  <div
                    key={h._id}
                    className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {h.hotelTitle}
                      </p>
                      <p className="text-xs text-slate-500">
                        {h.hotelLocation} · {h.hotelType}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        pushManageQuery({ hotelId: h._id, page: 1 })
                      }
                      className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400"
                    >
                      {copy.viewBookings} →
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Booking table */}
        {(!isAgent || selectedHotelId !== "ALL") && (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80">
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      {copy.code}
                    </th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      {copy.guestRoom}
                    </th>
                    {isAdmin && (
                      <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        {copy.hotel}
                      </th>
                    )}
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      {copy.dates}
                    </th>
                    <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      {copy.amount}
                    </th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      {copy.status}
                    </th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      {copy.actions}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {/* Loading skeletons */}
                  {bookingsLoading &&
                    sourceBookings.length === 0 &&
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: isAdmin ? 7 : 6 }).map(
                          (__, j) => (
                            <td key={j} className="px-5 py-4">
                              <div className="h-3.5 w-full animate-pulse rounded-full bg-slate-100" />
                            </td>
                          ),
                        )}
                      </tr>
                    ))}

                  {/* Empty state row */}
                  {!bookingsLoading &&
                    !bookingsError &&
                    visibleBookings.length === 0 && (
                      <tr>
                        <td
                          colSpan={isAdmin ? 7 : 6}
                          className="px-5 py-16 text-center"
                        >
                          <p className="font-semibold text-slate-700">
                            {copy.noBookingsFound}
                          </p>
                          <p className="mt-1 text-sm text-slate-400">
                            {!selectedHotelId && isAgent
                              ? copy.selectHotelPrompt
                              : copy.adjustFiltersPrompt}
                          </p>
                        </td>
                      </tr>
                    )}

                  {/* Booking rows */}
                  {visibleBookings.map((b, i) => {
                    const guestName =
                      b.rooms[0]?.guestName ||
                      `${copy.guestFallback} ···${b.guestId.slice(-6).toUpperCase()}`;
                    const roomSummary = b.rooms
                      .map((r) => `${r.quantity}× ${r.roomType}`)
                      .join(", ");
                    const nights = nightsBetween(b.checkInDate, b.checkOutDate);
                    const hotelName =
                      hotelsMap.get(b.hotelId)?.hotelTitle ??
                      `${copy.hotelFallback} ···${b.hotelId.slice(-4)}`;
                    const nextActionLabel = getNextActionLabel(
                      locale,
                      b.bookingStatus,
                    );
                    const nextActionClass =
                      b.bookingStatus === "PENDING" ||
                      b.bookingStatus === "CONFIRMED" ||
                      b.bookingStatus === "CHECKED_IN"
                        ? NEXT_ACTION_CLASS[b.bookingStatus]
                        : null;
                    const paymentLocked =
                      b.bookingStatus === "CANCELLED" ||
                      b.bookingStatus === "NO_SHOW";
                    const canCancel =
                      b.bookingStatus === "PENDING" ||
                      b.bookingStatus === "CONFIRMED";

                    return (
                      <tr
                        key={b._id}
                        className="group transition hover:bg-slate-50/50"
                        style={{
                          animation: "rowFadeIn 0.2s ease-out both",
                          animationDelay: `${i * 20}ms`,
                        }}
                      >
                        {/* Code */}
                        <td className="px-5 py-3.5">
                          {memberType !== "ADMIN_OPERATOR" ? (
                            <Link
                              href={`/bookings/${b._id}`}
                              className="font-mono text-xs font-semibold text-sky-600 hover:underline"
                            >
                              {b.bookingCode}
                            </Link>
                          ) : (
                            <span className="font-mono text-xs font-semibold text-slate-700">
                              {b.bookingCode}
                            </span>
                          )}
                          <p className="mt-0.5 text-[10px] text-slate-400">
                            {copy.createdOn.replace(
                              "{{date}}",
                              formatBookingDate(locale, b.createdAt),
                            )}
                          </p>
                        </td>

                        {/* Guest / Room */}
                        <td className="px-5 py-3.5">
                          <p className="text-sm font-medium text-slate-900">
                            {guestName}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-400">
                            {roomSummary}
                          </p>
                        </td>

                        {/* Hotel (admin only) */}
                        {isAdmin && (
                          <td className="px-5 py-3.5">
                            <p className="text-sm text-slate-700">
                              {hotelName}
                            </p>
                          </td>
                        )}

                        {/* Dates */}
                        <td className="px-5 py-3.5">
                          <p className="text-sm text-slate-700">
                            {formatBookingDate(locale, b.checkInDate, "full")} →{" "}
                            {formatBookingDate(locale, b.checkOutDate, "full")}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-400">
                            {formatNightsLabel(locale, nights)}
                          </p>
                        </td>

                        {/* Amount */}
                        <td className="px-5 py-3.5 text-right">
                          <p className="text-sm font-semibold text-slate-900">
                            ₩{formatNumber(b.totalPrice)}
                          </p>
                          <div className="mt-0.5 flex items-center justify-end gap-1">
                            <PaymentStatusBadge
                              status={b.paymentStatus}
                              locale={locale}
                            />
                          </div>
                          {b.paidAmount > 0 && (
                            <p className="text-[10px] text-slate-400">
                              {copy.paid}: ₩{formatNumber(b.paidAmount)}
                            </p>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-5 py-3.5">
                          <BookingStatusBadge
                            status={b.bookingStatus}
                            locale={locale}
                          />
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-3.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {/* Status advance */}
                            {nextActionLabel && nextActionClass && (
                              <button
                                type="button"
                                onClick={() => openModal("status", b._id)}
                                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${nextActionClass}`}
                              >
                                {nextActionLabel}
                              </button>
                            )}
                            {/* No-show (for CONFIRMED with no next action button) */}
                            {b.bookingStatus === "CONFIRMED" && (
                              <button
                                type="button"
                                onClick={() => openModal("status", b._id)}
                                className="rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-600 transition hover:bg-orange-100"
                                aria-label={copy.moreActions}
                              >
                                ⋯
                              </button>
                            )}
                            {/* Payment */}
                            {!paymentLocked && (
                              <button
                                type="button"
                                onClick={() => openModal("payment", b._id)}
                                className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                              >
                                {copy.payAction}
                              </button>
                            )}
                            {/* Cancel */}
                            {canCancel && (
                              <button
                                type="button"
                                onClick={() => openModal("cancel", b._id)}
                                className="rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-semibold text-rose-500 transition hover:bg-rose-50"
                              >
                                {copy.cancelAction}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
                <p className="text-xs text-slate-500">
                  {copy.pageSummary}{" "}
                  <span className="font-semibold text-slate-700">{page}</span> /{" "}
                  <span className="font-semibold text-slate-700">
                    {totalPages}
                  </span>{" "}
                  · {formatNumber(total)} {copy.totalSuffix}
                </p>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => pushManageQuery({ page: page - 1 })}
                    className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => pushManageQuery({ page: page + 1 })}
                    className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </>
  );
};

StaffBookingManagementPage.auth = {
  roles: ["AGENT", "ADMIN", "ADMIN_OPERATOR"],
};

export default StaffBookingManagementPage;
