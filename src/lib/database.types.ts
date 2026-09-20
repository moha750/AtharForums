// أنواع قاعدة البيانات — مشتقّة يدويًا من supabase/migrations/
// لإعادة التوليد لاحقًا:
//   npx supabase gen types typescript --project-id <id> > src/lib/database.types.ts

export type AppRole = 'member' | 'forum_lead' | 'admin' | 'super_admin'
export type MembershipStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn' | 'removed'
export type MembershipRole = 'member' | 'core' | 'lead'
export type PublishStatus = 'draft' | 'published' | 'archived'
export type EventMode = 'onsite' | 'online' | 'hybrid'
export type RegistrationStatus = 'registered' | 'waitlisted' | 'cancelled'
export type ForumColor = 'teal' | 'sage' | 'ember'

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type SiteSettings = {
  id: boolean
  launch_at: string
  teaser_mode: boolean
  registration_open: boolean
  allowed_email_domains: string[]
  bootstrap_admin_emails: string[]
  site_name_ar: string
  site_name_en: string
  tagline_ar: string
  tagline_en: string
  about_ar: string | null
  about_en: string | null
  contact_email: string | null
  updated_at: string
  updated_by: string | null
}

export type PublicSettings = {
  launch_at: string
  teaser_mode: boolean
  registration_open: boolean
  allowed_email_domains: string[]
  site_name_ar: string
  site_name_en: string
  tagline_ar: string
  tagline_en: string
  about_ar: string | null
  about_en: string | null
  contact_email: string | null
}

export type Profile = {
  id: string
  email: string
  full_name_ar: string | null
  full_name_en: string | null
  employee_no: string | null
  job_title: string | null
  department: string | null
  sector: string | null
  work_location: string | null
  phone: string | null
  avatar_url: string | null
  bio: string | null
  skills: string[]
  interests: string[]
  role: AppRole
  is_active: boolean
  onboarded_at: string | null
  created_at: string
  updated_at: string
}

export type Forum = {
  id: string
  slug: string
  name_ar: string
  name_en: string | null
  tagline_ar: string | null
  tagline_en: string | null
  description_ar: string | null
  description_en: string | null
  mission_ar: string | null
  mission_en: string | null
  icon: string
  color: ForumColor
  cover_url: string | null
  skills: string[]
  capacity: number | null
  auto_approve: boolean
  is_accepting: boolean
  status: PublishStatus
  sort_order: number
  members_count: number
  created_at: string
  updated_at: string
  created_by: string | null
}

export type ForumMembership = {
  id: string
  forum_id: string
  profile_id: string
  role: MembershipRole
  status: MembershipStatus
  motivation: string | null
  relevant_skills: string[]
  applied_at: string
  decided_at: string | null
  decided_by: string | null
  decision_note: string | null
}

export type AtharEvent = {
  id: string
  forum_id: string | null
  slug: string
  title_ar: string
  title_en: string | null
  description_ar: string | null
  description_en: string | null
  cover_url: string | null
  starts_at: string
  ends_at: string | null
  mode: EventMode
  location_ar: string | null
  location_en: string | null
  meeting_url: string | null
  capacity: number | null
  registration_open: boolean
  members_only: boolean
  registrations_count: number
  status: PublishStatus
  created_at: string
  updated_at: string
  created_by: string | null
}

export type EventRegistration = {
  id: string
  event_id: string
  profile_id: string
  status: RegistrationStatus
  attended: boolean
  note: string | null
  created_at: string
}

export type Post = {
  id: string
  forum_id: string | null
  slug: string
  title_ar: string
  title_en: string | null
  excerpt_ar: string | null
  excerpt_en: string | null
  body_ar: string | null
  body_en: string | null
  cover_url: string | null
  status: PublishStatus
  published_at: string | null
  author_id: string | null
  created_at: string
  updated_at: string
}

export type WaitlistSubscriber = {
  id: string
  email: string
  full_name: string | null
  source: string
  interests: string[]
  notified_at: string | null
  created_at: string
}

export type AuditLogRow = {
  id: number
  actor_id: string | null
  action: string
  entity: string
  entity_id: string | null
  meta: Json | null
  created_at: string
}

export type ForumMemberPublic = {
  profile_id: string
  full_name_ar: string | null
  full_name_en: string | null
  job_title: string | null
  avatar_url: string | null
  skills: string[]
  membership_role: MembershipRole
  joined_at: string | null
}

export type PlatformStats = {
  forums: number
  members: number
  events: number
  upcoming_events: number
}

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row
  Insert: Insert
  Update: Update
  Relationships: []
}

export type Database = {
  public: {
    Tables: {
      site_settings: Table<SiteSettings>
      profiles: Table<Profile>
      forums: Table<Forum>
      forum_memberships: Table<ForumMembership>
      events: Table<AtharEvent>
      event_registrations: Table<EventRegistration>
      posts: Table<Post>
      waitlist_subscribers: Table<WaitlistSubscriber>
      audit_log: Table<AuditLogRow>
    }
    Views: { [_ in never]: never }
    Functions: {
      get_public_settings: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      platform_stats: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      forum_members_public: {
        Args: { target_slug: string }
        Returns: ForumMemberPublic[]
      }
      join_waitlist: {
        Args: {
          subscriber_email: string
          subscriber_name?: string | null
          subscriber_source?: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: AppRole
      membership_status: MembershipStatus
      membership_role: MembershipRole
      publish_status: PublishStatus
      event_mode: EventMode
      registration_status: RegistrationStatus
    }
    CompositeTypes: { [_ in never]: never }
  }
}
