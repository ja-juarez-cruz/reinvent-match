// Subset of the AWS Events API schema (https://api.awsevents.com/v1/openapi.json) used by Re:Match.

export interface EventAddress {
  city?: string;
}

export interface AwsEvent {
  eventId: string;
  name: string;
  eventType: string;
  startDate: string;
  endDate: string;
  isOnline: boolean;
  timezone?: string;
  timezoneAbbreviation?: string;
  timeFormat?: string;
  address?: EventAddress;
  supportedLanguageCodes?: string[];
  authenticationRequired: boolean;
}

export type SeatAvailability = "available" | "limited" | "veryLimited" | "unavailable" | "walkUp";

export interface SessionTime {
  /** Calendar date, e.g. "2025-12-02". */
  date?: string;
  /** Local start time, e.g. "16:00". */
  time?: string;
  /** Length in minutes, e.g. "60". */
  length?: string;
  timezone?: string;
}

export interface Speaker {
  name?: string;
}

export interface Session {
  sessionId: string;
  title: string;
  abbreviation?: string;
  abstract?: string;
  type?: string;
  level?: string;
  venue?: string;
  room?: string;
  isAllDaySession?: boolean;
  isReservable?: boolean;
  seatAvailability?: SeatAvailability;
  sessionTime?: SessionTime;
  speakers?: Speaker[];
  tracks?: string[];
  topics?: string[];
  industries?: string[];
  areasOfInterest?: string[];
  roles?: string[];
  services?: string[];
  segments?: string[];
  features?: string[];
  customerPersonas?: string[];
  experiences?: string[];
  additionalActivities?: string[];
  focusAreas?: string[];
}

export interface ListEventsResponse {
  items: AwsEvent[];
}

export interface ListSessionsResponse {
  items: Session[];
  totalCount: number;
  nextToken?: string;
}

export interface PersonalTime {
  personalTimeId: string;
  startDateTime: string;
  endDateTime: string;
  title: string;
  description: string;
  location?: string;
}

export interface Schedule {
  reserved: string[];
  favorites: string[];
  personalTime: PersonalTime[];
}

/** Why one session in a bulk request was refused. Unknown values must be treated as a generic refusal. */
export type BulkFailureCode =
  | "sessionNotReservable"
  | "scheduleConflict"
  | "alreadyScheduled"
  | "sessionFull"
  | "insufficientAccess"
  | "timePassed"
  | "alreadyFavorited"
  | "notFavorited"
  | "other"
  | (string & {});

export interface BulkFailure {
  sessionId: string;
  code: BulkFailureCode;
  /** Already-scheduled sessions that overlap this one, on a time clash. */
  conflictsWith?: string[];
}

export interface BulkResult {
  successful: string[];
  failed: BulkFailure[];
}
