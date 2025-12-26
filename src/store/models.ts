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
  is_admin: boolean
}

export type UserContacts = {
  user_id: string
  phone: string | null
  qq: string | null
  updated_at: string | null
}
