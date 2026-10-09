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
export type ContactTopic = 'inquiry' | 'suggestion' | 'technical' | 'other'
export type ContactStatus = 'new' | 'read' | 'archived'

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

// ── الإحصاءات ──────────────────────────────────────────────────────────────

export type AnalyticsDevice = 'desktop' | 'mobile' | 'tablet' | 'bot' | 'unknown'
export type AnalyticsKind = 'pageview' | 'engagement' | 'conversion'

export type AnalyticsKpis = {
  visitors: number
  visits: number
  pageviews: number
  bounces?: number
  bounce_rate: number
  avg_duration_s: number
  views_per_visit?: number
  returning?: number
  returning_rate?: number
  identified?: number
  conversions: number
  conversion_rate?: number
  bots?: number
}

export type AnalyticsOverview = {
  current: AnalyticsKpis
  previous: AnalyticsKpis
}

export type AnalyticsPoint = {
  bucket: string
  visitors: number
  visits: number
  pageviews: number
  conversions: number
}

export type AnalyticsRow = {
  label: string
  visits: number
  pageviews: number
  visitors: number
  share: number
}

export type AnalyticsRealtime = {
  active_visitors: number
  views_last_hour: number
  top_now: Array<{ path: string; views: number }>
  minutes: Array<{ minute: string; views: number }>
}

export type AnalyticsFunnels = {
  overall: Array<{ name: string; completions: number; visits: number }>
  teaser: { views: number; signups: number; rate: number }
  forums: Array<{
    slug: string
    name_ar: string
    name_en: string | null
    views: number
    requests: number
  }>
  events: Array<{
    slug: string
    title_ar: string
    title_en: string | null
    views: number
    registrations: number
  }>
  login: { views: number; requested: number; rate: number }
}

export type AnalyticsPerson = {
  profile_id: string
  full_name: string
  email: string
  visits: number
  pageviews: number
  last_seen: string
}

export type AnalyticsPersonEvent = {
  occurred_at: string
  path: string
  page_type: string
  locale: string | null
  device: string
  duration_ms: number | null
}



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
  qr_custom_codes: boolean
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

export type Banner = {
  id: string
  image_url: string
  image_alt_ar: string | null
  image_alt_en: string | null
  /** اختياريّ: البانر قد يكون صورة وحدها بلا طبقة نصّ. */
  title_ar: string | null
  title_en: string | null
  body_ar: string | null
  body_en: string | null
  cta_label_ar: string | null
  cta_label_en: string | null
  cta_href: string | null
  status: PublishStatus
  starts_at: string | null
  ends_at: string | null
  sort_order: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export type Faq = {
  id: string
  slug: string
  question_ar: string
  question_en: string | null
  answer_ar: string
  answer_en: string | null
  status: PublishStatus
  is_featured: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

/** مناصب المجلس مرتّبةً من الأعلى — ترتيب enum في القاعدة هو ترتيب العرض. */
export type BoardRank = 'general_manager' | 'chair' | 'member'

export type BoardMember = {
  id: string
  name_ar: string
  name_en: string | null
  rank: BoardRank
  /** صيغة بديلة للمسمّى (المؤنّث مثلًا). فارغةً يُعرض المسمّى المعتمد للمنصب. */
  position_ar: string | null
  position_en: string | null
  /** الدور في المبادرة بجملة قصيرة. */
  role_ar: string | null
  role_en: string | null
  photo_url: string | null
  sort_order: number
  is_featured: boolean
  status: PublishStatus
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

export type ContactMessage = {
  id: string
  /** فارغ حين يرسل زائر غير مسجَّل الدخول. */
  profile_id: string | null
  full_name: string
  email: string
  topic: ContactTopic
  body: string
  locale: 'ar' | 'en'
  status: ContactStatus
  handled_by: string | null
  handled_at: string | null
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

// ── الباركود الديناميكي (0019_qr.sql) ─────────────────────────────────────

export type AppPermission = 'use_qr_generator' | 'oversee_qr' | 'qr_org_account'
export type QrKind = 'link' | 'file'
export type QrShareAccess = 'read' | 'edit'
export type QrAccess = 'owner' | QrShareAccess
export type QrLinkAccess = QrAccess | 'oversee'
export type QrDevice = 'mobile' | 'tablet' | 'desktop' | 'unknown'
export type QrEventKind =
  | 'target'
  | 'file'
  | 'title'
  | 'active'
  | 'spec'
  | 'delete'
  | 'owner'
  | 'schedule'
  | 'campaign'
export type QrAlertStatus = 'pending' | 'sent' | 'failed' | 'off'

export type ProfilePermission = {
  profile_id: string
  permission: AppPermission
  granted_by: string | null
  granted_at: string
}

export type QrLink = {
  id: string
  code: string
  title: string
  kind: QrKind
  target_url: string
  file_path: string | null
  spec: Json
  owner_id: string
  campaign_id: string | null
  active: boolean
  scan_count: number
  created_at: string
  updated_at: string
}

export type QrLinkListItem = Omit<QrLink, 'spec'> & { access: QrAccess }

export type QrCampaign = {
  id: string
  name: string
  note: string | null
  owner_id: string
  created_at: string
  updated_at: string
}

export type QrCampaignListItem = QrCampaign & { access: QrAccess; links: number; scans: number }

export type QrScan = {
  id: number
  link_id: string
  scanned_at: string
  visitor: string | null
  referrer: string | null
  device: QrDevice
  is_bot: boolean
}

export type QrSchedule = {
  id: string
  link_id: string
  target_url: string
  starts_at: string | null
  ends_at: string | null
  note: string | null
  created_at: string
}

export type QrLinkEvent = {
  id: number
  link_id: string
  actor_id: string | null
  kind: QrEventKind
  old_value: string | null
  new_value: string | null
  at: string
}

export type QrLinkShare = {
  link_id: string
  user_id: string
  access: QrShareAccess
  granted_by: string | null
  created_at: string
}

export type QrCampaignShare = {
  campaign_id: string
  user_id: string
  access: QrShareAccess
  granted_by: string | null
  created_at: string
}

export type QrAlertOutbox = {
  id: number
  event_id: number
  link_id: string
  status: QrAlertStatus
  attempts: number
  error: string | null
  claimed_at: string | null
  created_at: string
  sent_at: string | null
}

export type QrPerson = { id: string; name: string }

export type QrStats = {
  total: number
  bots: number
  capped: boolean
  cap: number
  bucket: 'day' | 'week'
  from: string
  to: string
  series: Array<{ d: string; n: number }>
  devices: Partial<Record<QrDevice, number>>
  hours: number[]
  heatmap: number[][]
  first: string | null
  last: string | null
  week: { current: number; previous: number }
}

export type QrOverseeLink = {
  id: string
  code: string
  title: string
  kind: QrKind
  target_url: string
  active: boolean
  scan_count: number
  owner_id: string
  owner_name: string
  campaign_id: string | null
  created_at: string
  updated_at: string
}

export type QrOverseeEvent = {
  id: number
  link_id: string
  link_title: string | null
  link_code: string | null
  actor_id: string | null
  actor_name: string | null
  kind: QrEventKind
  old_value: string | null
  new_value: string | null
  at: string
  alert_status: QrAlertStatus | null
  alert_error: string | null
}

export type QrAlertClaim = {
  outbox_id: number
  link_id: string
  link_code: string | null
  link_title: string | null
  kind: 'target' | 'schedule'
  old_value: string | null
  new_value: string | null
  actor_name: string | null
  at: string
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
      banners: Table<Banner>
      faqs: Table<Faq>
      board_members: Table<BoardMember>
      waitlist_subscribers: Table<WaitlistSubscriber>
      contact_messages: Table<ContactMessage>
      audit_log: Table<AuditLogRow>
      profile_permissions: Table<ProfilePermission>
      qr_links: Table<QrLink>
      qr_campaigns: Table<QrCampaign>
      qr_scans: Table<QrScan>
      qr_schedules: Table<QrSchedule>
      qr_link_events: Table<QrLinkEvent>
      qr_link_shares: Table<QrLinkShare>
      qr_campaign_shares: Table<QrCampaignShare>
      qr_alert_outbox: Table<QrAlertOutbox>
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
      submit_contact_message: {
        Args: {
          sender_name: string | null
          sender_email: string | null
          message_topic: string
          message_body: string
          message_locale?: string
        }
        Returns: undefined
      }
      join_waitlist: {
        Args: {
          subscriber_email: string
          subscriber_name?: string | null
          subscriber_source?: string
        }
        Returns: undefined
      }
      analytics_overview: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      analytics_timeseries: {
        Args: { p_from: string; p_to: string; p_bucket?: string }
        Returns: AnalyticsPoint[]
      }
      analytics_breakdown: {
        Args: { p_from: string; p_to: string; p_dimension: string; p_limit?: number }
        Returns: AnalyticsRow[]
      }
      analytics_realtime: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      analytics_funnels: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      analytics_people: {
        Args: { p_from: string; p_to: string; p_limit?: number }
        Returns: AnalyticsPerson[]
      }
      analytics_person: {
        Args: { p_profile_id: string; p_from: string; p_to: string; p_limit?: number }
        Returns: AnalyticsPersonEvent[]
      }
      analytics_prune: {
        Args: { p_retain_days?: number }
        Returns: Json
      }
      qr_link_access: { Args: { p_link: string }; Returns: QrLinkAccess | null }
      campaign_access: { Args: { p_campaign: string }; Returns: QrAccess | null }
      qr_custom_codes_enabled: { Args: Record<PropertyKey, never>; Returns: boolean }
      qr_code_taken: { Args: { p_code: string }; Returns: boolean }
      qr_share_candidates: { Args: Record<PropertyKey, never>; Returns: QrPerson[] }
      qr_generator_holders: { Args: Record<PropertyKey, never>; Returns: QrPerson[] }
      qr_people: { Args: { p_ids: string[] }; Returns: QrPerson[] }
      qr_my_links: { Args: Record<PropertyKey, never>; Returns: QrLinkListItem[] }
      qr_my_campaigns: { Args: Record<PropertyKey, never>; Returns: QrCampaignListItem[] }
      qr_issue_upload_ticket: { Args: { p_mime: string; p_bytes: number }; Returns: string }
      qr_link_stats: {
        Args: { p_link: string; p_from?: string | null; p_to?: string | null }
        Returns: Json
      }
      qr_oversee_links: { Args: Record<PropertyKey, never>; Returns: QrOverseeLink[] }
      qr_trash_sweep: { Args: { p_limit?: number }; Returns: string[] }
      qr_oversee_events: { Args: { p_limit?: number }; Returns: QrOverseeEvent[] }
      qr_oversee_set_active: { Args: { p_link: string; p_active: boolean }; Returns: undefined }
      qr_oversee_delete: { Args: { p_link: string }; Returns: string | null }
      qr_oversee_transfer: { Args: { p_link: string; p_owner: string }; Returns: undefined }
      qr_file_of: { Args: { p_code: string }; Returns: string | null }
      qr_resolve: {
        Args: {
          p_secret: string
          p_code: string
          p_visitor?: string | null
          p_referrer?: string | null
          p_device?: string
          p_is_bot?: boolean
        }
        Returns: string | null
      }
      qr_alerts_claim: { Args: { p_secret: string; p_limit?: number }; Returns: QrAlertClaim[] }
      qr_alerts_recipients: { Args: { p_secret: string }; Returns: string[] }
      qr_alerts_mark: {
        Args: { p_secret: string; p_id: number; p_status: string; p_error?: string | null }
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
