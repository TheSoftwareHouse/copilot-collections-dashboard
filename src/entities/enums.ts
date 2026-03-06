export enum ApiMode {
  ORGANISATION = "organisation",
  ENTERPRISE = "enterprise",
}

export enum JobType {
  SEAT_SYNC = "seat_sync",
  USAGE_COLLECTION = "usage_collection",
  MONTH_RECOLLECTION = "month_recollection",
  TEAM_CARRY_FORWARD = "team_carry_forward",
}

export enum JobStatus {
  SUCCESS = "success",
  FAILURE = "failure",
  RUNNING = "running",
}

export enum SeatStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
}

export enum UserRole {
  ADMIN = "admin",
  USER = "user",
}
