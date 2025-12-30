export type AuthView = 'sign_in' | 'sign_up'
export type EventStatus = 'draft' | 'published' | 'ended' | string

export type Event = {
  id: string
  title: string
  description: string | null
  start_time: string | null
  end_time: string | null
  registration_start_time: string | null
  registration_end_time: string | null
  is_registration_open: boolean | null
  submission_start_time: string | null
  submission_end_time: string | null
  is_submission_open: boolean | null
  location: string | null
  team_max_size: number | null
  status: EventStatus | null
  created_by: string | null
  created_at: string
}

export type DisplayEvent = Event & {
  is_demo?: boolean
}

export type Profile = {
  id: string
  username: string | null
  avatar_url: string | null
  roles: string[] | null
}

export type UserContacts = {
  user_id: string
  phone: string | null
  qq: string | null
  updated_at: string | null
}

export type TeamLobbyTeam = {
  id: string
  event_id: string
  leader_id: string
  name: string
  leader_qq: string
  intro: string
  needs: string[]
  extra: string
  members: number
  is_closed?: boolean
  created_at: string
}

export type TeamMemberProfile = {
  id: string
  username: string | null
  avatar_url: string | null
  roles: string[] | null
}

export type TeamMember = {
  id: string
  team_id: string
  user_id: string
  joined_at: string
  profile: TeamMemberProfile | null
}

export type TeamJoinRequest = {
  id: string
  team_id: string
  user_id: string
  status: string
  message: string | null
  created_at: string
  updated_at: string | null
}

export type TeamJoinRequestProfile = {
  id: string
  username: string | null
  avatar_url: string | null
  roles: string[] | null
}

export type TeamJoinRequestRecord = TeamJoinRequest & {
  profile: TeamJoinRequestProfile | null
}

export type TeamInvite = {
  id: string
  team_id: string
  user_id: string
  invited_by: string | null
  message: string | null
  status: string
  created_at: string
  updated_at: string | null
}

export type TeamSeekerProfile = {
  id: string
  username: string | null
  avatar_url: string | null
  roles: string[] | null
}

export type TeamSeeker = {
  id: string
  event_id: string
  user_id: string
  intro: string
  qq: string
  roles: string[]
  created_at: string
  updated_at: string | null
  profile: TeamSeekerProfile | null
}

export type MyTeamEntry = {
  teamId: string
  teamName: string
  role: 'leader' | 'member'
  memberCount: number
  status: 'active' | 'pending'
  eventId: string
  createdAt: string
}

export type MyTeamRequest = {
  id: string
  teamId: string
  teamName: string
  status: 'pending' | 'approved' | 'rejected'
  message: string | null
  createdAt: string
}

export type MyTeamInvite = {
  id: string
  teamId: string
  teamName: string
  invitedByName: string | null
  status: 'pending' | 'accepted' | 'rejected'
  message: string | null
  createdAt: string
}

export type Submission = {
  id: string
  event_id: string
  team_id: string
  submitted_by: string
  project_name: string
  intro: string
  cover_path: string
  video_link: string | null
  link_mode: 'link' | 'file'
  submission_url: string | null
  submission_storage_path: string | null
  submission_password: string | null
  created_at: string
  updated_at: string
}

export type SubmissionWithTeam = Submission & {
  team: {
    id: string
    name: string
  } | null
}

// Judge Invitation System Types

export type EventJudge = {
  id: string
  event_id: string
  user_id: string
  created_at: string
  updated_at: string
}

export type JudgeWithProfile = EventJudge & {
  profile: {
    id: string
    username: string | null
    avatar_url: string | null
    roles: string[] | null
  }
}

export type JudgePermission = {
  isJudge: boolean
  isEventAdmin: boolean
  canAccessJudgeWorkspace: boolean
  canManageJudges: boolean
}

export type JudgeSubmissionView = {
  id: string
  project_name: string
  intro: string
  cover_path: string
  video_link: string | null
  submission_url: string | null
  submission_storage_path: string | null
  submission_password: string | null
  team_name: string
  created_at: string
  updated_at: string
}

export type UserSearchResult = {
  id: string
  username: string
  avatar_url: string | null
  roles: string[] | null
  isAlreadyJudge?: boolean
}

// Judge Error Types

export const JudgeErrorCode = {
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  ALREADY_JUDGE: 'ALREADY_JUDGE',
  EVENT_NOT_FOUND: 'EVENT_NOT_FOUND',
  INVALID_OPERATION: 'INVALID_OPERATION'
} as const

export type JudgeErrorCode = typeof JudgeErrorCode[keyof typeof JudgeErrorCode]

export interface JudgeError {
  code: JudgeErrorCode
  message: string
  details?: any
}

// Judge API Interface Types

export interface SearchUsersParams {
  query: string
  eventId: string
  limit?: number
}

export interface InviteJudgeParams {
  eventId: string
  userId: string
}

export interface RemoveJudgeParams {
  eventId: string
  userId: string
}

export interface GetJudgesParams {
  eventId: string
}
