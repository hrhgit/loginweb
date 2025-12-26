import type { DisplayEvent, Event } from './models'

export const EVENT_SELECT_FIELDS = [
  'id',
  'title',
  'description',
  'start_time',
  'end_time',
  'registration_start_time',
  'registration_end_time',
  'is_registration_open',
  'submission_start_time',
  'submission_end_time',
  'is_submission_open',
  'location',
  'team_max_size',
  'status',
  'created_by',
  'created_at',
] as const

export const EVENT_SELECT = EVENT_SELECT_FIELDS.join(',')

export const EVENT_DEFAULTS: Event = {
  id: '',
  title: '',
  description: null,
  start_time: null,
  end_time: null,
  registration_start_time: null,
  registration_end_time: null,
  is_registration_open: false,
  submission_start_time: null,
  submission_end_time: null,
  is_submission_open: false,
  location: null,
  team_max_size: 0,
  status: null,
  created_by: null,
  created_at: '',
}

export const withEventDefaults = (event: Partial<Event> & { is_demo?: boolean }): DisplayEvent => ({
  ...EVENT_DEFAULTS,
  ...event,
})
