export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      account_age_declarations: {
        Row: {
          created_at: string
          declared_age_band: string
          declared_birth_month: string | null
          promoted_to_adult_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          declared_age_band: string
          declared_birth_month?: string | null
          promoted_to_adult_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          declared_age_band?: string
          declared_birth_month?: string | null
          promoted_to_adult_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_age_declarations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      account_deletion_guardian_notices: {
        Row: {
          created_at: string
          guardian_user_id: string
          id: string
          request_id: string
          teen_user_id: string
        }
        Insert: {
          created_at?: string
          guardian_user_id: string
          id?: string
          request_id: string
          teen_user_id: string
        }
        Update: {
          created_at?: string
          guardian_user_id?: string
          id?: string
          request_id?: string
          teen_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_deletion_guardian_notices_guardian_user_id_fkey"
            columns: ["guardian_user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "account_deletion_guardian_notices_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "account_deletion_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_deletion_guardian_notices_teen_user_id_fkey"
            columns: ["teen_user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      account_deletion_requests: {
        Row: {
          anon_ids: Json
          attempts: number
          cancelled_at: string | null
          completed_at: string | null
          depot_paths: Json
          held_reason: string | null
          id: string
          initiated_by: string
          last_error: string | null
          population: string
          requested_at: string
          scheduled_for: string
          started_at: string | null
          status: string
          steps: Json
          subject_id: string
        }
        Insert: {
          anon_ids?: Json
          attempts?: number
          cancelled_at?: string | null
          completed_at?: string | null
          depot_paths?: Json
          held_reason?: string | null
          id?: string
          initiated_by: string
          last_error?: string | null
          population: string
          requested_at?: string
          scheduled_for: string
          started_at?: string | null
          status?: string
          steps?: Json
          subject_id: string
        }
        Update: {
          anon_ids?: Json
          attempts?: number
          cancelled_at?: string | null
          completed_at?: string | null
          depot_paths?: Json
          held_reason?: string | null
          id?: string
          initiated_by?: string
          last_error?: string | null
          population?: string
          requested_at?: string
          scheduled_for?: string
          started_at?: string | null
          status?: string
          steps?: Json
          subject_id?: string
        }
        Relationships: []
      }
      account_safety_origins: {
        Row: {
          created_at: string
          under13_origin: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          under13_origin?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          under13_origin?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_safety_origins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      achievement_share_initiations: {
        Row: {
          achievement_kind: string
          created_at: string
          handoff: string
          id: string
        }
        Insert: {
          achievement_kind: string
          created_at?: string
          handoff: string
          id?: string
        }
        Update: {
          achievement_kind?: string
          created_at?: string
          handoff?: string
          id?: string
        }
        Relationships: []
      }
      admin_permissions: {
        Row: {
          granted_at: string
          granted_by: string | null
          permission: string
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          permission: string
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          permission?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_permissions_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "admin_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      adventures: {
        Row: {
          age_tier: string
          course_id: string
          created_at: string
          description: Json
          eligibility_max_age: number | null
          eligibility_min_age: number | null
          id: string
          narrative_arc: string | null
          pathway_stage: string | null
          position: number
          slug: string
          status: string
          theme: string
          title: Json
        }
        Insert: {
          age_tier?: string
          course_id: string
          created_at?: string
          description?: Json
          eligibility_max_age?: number | null
          eligibility_min_age?: number | null
          id?: string
          narrative_arc?: string | null
          pathway_stage?: string | null
          position: number
          slug: string
          status?: string
          theme: string
          title?: Json
        }
        Update: {
          age_tier?: string
          course_id?: string
          created_at?: string
          description?: Json
          eligibility_max_age?: number | null
          eligibility_min_age?: number | null
          id?: string
          narrative_arc?: string | null
          pathway_stage?: string | null
          position?: number
          slug?: string
          status?: string
          theme?: string
          title?: Json
        }
        Relationships: [
          {
            foreignKeyName: "adventures_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adventures_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "dataintel_lessons_sync"
            referencedColumns: ["course_id"]
          },
        ]
      }
      age_correction_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          from_age_band: string
          id: string
          reason_code: string | null
          requested_age_band: string
          requested_birth_month: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          from_age_band: string
          id?: string
          reason_code?: string | null
          requested_age_band: string
          requested_birth_month?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          from_age_band?: string
          id?: string
          reason_code?: string | null
          requested_age_band?: string
          requested_birth_month?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "age_correction_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "age_correction_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      allowance_rules: {
        Row: {
          active: boolean
          amount: number
          anchor_day: number
          created_at: string
          frequency: string
          id: string
          kid_user_id: string
          next_run_at: string
          parent_user_id: string | null
        }
        Insert: {
          active?: boolean
          amount: number
          anchor_day: number
          created_at?: string
          frequency: string
          id?: string
          kid_user_id: string
          next_run_at: string
          parent_user_id?: string | null
        }
        Update: {
          active?: boolean
          amount?: number
          anchor_day?: number
          created_at?: string
          frequency?: string
          id?: string
          kid_user_id?: string
          next_run_at?: string
          parent_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "allowance_rules_kid_user_id_fkey"
            columns: ["kid_user_id"]
            isOneToOne: true
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "allowance_rules_parent_user_id_fkey"
            columns: ["parent_user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      analytics_consents: {
        Row: {
          granted_at: string
          granted_by: string | null
          id: number
          kid_user_id: string
          revoked_at: string | null
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          id?: never
          kid_user_id: string
          revoked_at?: string | null
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          id?: never
          kid_user_id?: string
          revoked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_consents_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "analytics_consents_kid_user_id_fkey"
            columns: ["kid_user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      analytics_ip_exclusions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          label: string
          network: unknown
          reason: string | null
          revoked_at: string | null
          revoked_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          label: string
          network: unknown
          reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          network?: unknown
          reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_ip_exclusions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "analytics_ip_exclusions_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      analytics_staff_ip_sightings: {
        Row: {
          address: unknown
          first_seen_at: string
          hits: number
          last_seen_at: string
          user_id: string
        }
        Insert: {
          address: unknown
          first_seen_at?: string
          hits?: number
          last_seen_at?: string
          user_id: string
        }
        Update: {
          address?: unknown
          first_seen_at?: string
          hits?: number
          last_seen_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analytics_staff_ip_sightings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      anon_visitors: {
        Row: {
          anon_id: string
          converted_at: string | null
          converted_user_id: string | null
          device: string | null
          first_seen_at: string
          landing_route: string | null
          last_seen_at: string
          locale: string | null
          referrer_class: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          anon_id: string
          converted_at?: string | null
          converted_user_id?: string | null
          device?: string | null
          first_seen_at?: string
          landing_route?: string | null
          last_seen_at?: string
          locale?: string | null
          referrer_class?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          anon_id?: string
          converted_at?: string | null
          converted_user_id?: string | null
          device?: string | null
          first_seen_at?: string
          landing_route?: string | null
          last_seen_at?: string
          locale?: string | null
          referrer_class?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "anon_visitors_converted_user_id_fkey"
            columns: ["converted_user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          detail: Json
          id: number
          subject: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          detail?: Json
          id?: never
          subject?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          detail?: Json
          id?: never
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      avatars: {
        Row: {
          options: Json
          seed: string
          updated_at: string
          user_id: string
        }
        Insert: {
          options?: Json
          seed?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          options?: Json
          seed?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "avatars_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      badge_shares: {
        Row: {
          achievement_kind: string
          achievement_label: string
          age_band: string | null
          created_at: string
          created_by: string
          expires_at: string
          first_name: string
          id: string
          image_bucket: string
          image_ext: string
          image_hash: string
          image_url: string
          kid_user_id: string
          revoked_at: string | null
          token: string
        }
        Insert: {
          achievement_kind: string
          achievement_label: string
          age_band?: string | null
          created_at?: string
          created_by: string
          expires_at?: string
          first_name: string
          id?: string
          image_bucket: string
          image_ext: string
          image_hash: string
          image_url: string
          kid_user_id: string
          revoked_at?: string | null
          token: string
        }
        Update: {
          achievement_kind?: string
          achievement_label?: string
          age_band?: string | null
          created_at?: string
          created_by?: string
          expires_at?: string
          first_name?: string
          id?: string
          image_bucket?: string
          image_ext?: string
          image_hash?: string
          image_url?: string
          kid_user_id?: string
          revoked_at?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "badge_shares_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "badge_shares_kid_user_id_fkey"
            columns: ["kid_user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      banking_accounts: {
        Row: {
          card_design: string
          frozen: boolean
          frozen_at: string | null
          frozen_by: string | null
          kid_user_id: string
          nickname: string
          opened_at: string
          opened_by: string | null
        }
        Insert: {
          card_design?: string
          frozen?: boolean
          frozen_at?: string | null
          frozen_by?: string | null
          kid_user_id: string
          nickname?: string
          opened_at?: string
          opened_by?: string | null
        }
        Update: {
          card_design?: string
          frozen?: boolean
          frozen_at?: string | null
          frozen_by?: string | null
          kid_user_id?: string
          nickname?: string
          opened_at?: string
          opened_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "banking_accounts_frozen_by_fkey"
            columns: ["frozen_by"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "banking_accounts_kid_user_id_fkey"
            columns: ["kid_user_id"]
            isOneToOne: true
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "banking_accounts_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      chore_streak_days: {
        Row: {
          completions: number
          kid_user_id: string
          legacy: boolean
          local_date: string
          updated_at: string
        }
        Insert: {
          completions?: number
          kid_user_id: string
          legacy?: boolean
          local_date: string
          updated_at?: string
        }
        Update: {
          completions?: number
          kid_user_id?: string
          legacy?: boolean
          local_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chore_streak_days_kid_user_id_fkey"
            columns: ["kid_user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      chore_streak_pauses: {
        Row: {
          cancelled_at: string | null
          changed_by: string | null
          created_at: string
          created_by: string | null
          ends_on: string
          id: string
          kid_user_id: string
          starts_on: string
        }
        Insert: {
          cancelled_at?: string | null
          changed_by?: string | null
          created_at?: string
          created_by?: string | null
          ends_on: string
          id?: string
          kid_user_id: string
          starts_on: string
        }
        Update: {
          cancelled_at?: string | null
          changed_by?: string | null
          created_at?: string
          created_by?: string | null
          ends_on?: string
          id?: string
          kid_user_id?: string
          starts_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "chore_streak_pauses_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "chore_streak_pauses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "chore_streak_pauses_kid_user_id_fkey"
            columns: ["kid_user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      content_defect_escapes: {
        Row: {
          defect_kind: string
          gate_id: string
          id: string
          lesson_id: string
          reported_at: string
          reported_by: string | null
        }
        Insert: {
          defect_kind: string
          gate_id: string
          id?: string
          lesson_id: string
          reported_at?: string
          reported_by?: string | null
        }
        Update: {
          defect_kind?: string
          gate_id?: string
          id?: string
          lesson_id?: string
          reported_at?: string
          reported_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_defect_escapes_gate_id_fkey"
            columns: ["gate_id"]
            isOneToOne: false
            referencedRelation: "forge_release_gates"
            referencedColumns: ["gate_id"]
          },
          {
            foreignKeyName: "content_defect_escapes_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      content_retro_checks: {
        Row: {
          action: string
          audit_log_id: number
          closed_at: string | null
          closing_verified_at: string | null
          course_id: string | null
          due_at: string
          id: number
          justification: string | null
          lesson_id: string | null
          locale: string | null
          occurred_at: string
        }
        Insert: {
          action: string
          audit_log_id: number
          closed_at?: string | null
          closing_verified_at?: string | null
          course_id?: string | null
          due_at: string
          id?: never
          justification?: string | null
          lesson_id?: string | null
          locale?: string | null
          occurred_at: string
        }
        Update: {
          action?: string
          audit_log_id?: number
          closed_at?: string | null
          closing_verified_at?: string | null
          course_id?: string | null
          due_at?: string
          id?: never
          justification?: string | null
          lesson_id?: string | null
          locale?: string | null
          occurred_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_retro_checks_audit_log_id_fkey"
            columns: ["audit_log_id"]
            isOneToOne: true
            referencedRelation: "audit_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      coop_goal_guardian_consents: {
        Row: {
          enabled: boolean
          guardian_id: string
          kid_user_id: string
          updated_at: string
        }
        Insert: {
          enabled: boolean
          guardian_id: string
          kid_user_id: string
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          guardian_id?: string
          kid_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coop_goal_guardian_consents_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "coop_goal_guardian_consents_kid_user_id_fkey"
            columns: ["kid_user_id"]
            isOneToOne: true
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      coop_goal_members: {
        Row: {
          end_reason: string | null
          ended_at: string | null
          goal_id: string
          invited_at: string
          invited_by: string | null
          joined_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          end_reason?: string | null
          ended_at?: string | null
          goal_id: string
          invited_at?: string
          invited_by?: string | null
          joined_at?: string | null
          status: string
          user_id: string
        }
        Update: {
          end_reason?: string | null
          ended_at?: string | null
          goal_id?: string
          invited_at?: string
          invited_by?: string | null
          joined_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coop_goal_members_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "coop_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coop_goal_members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "coop_goal_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      coop_goals: {
        Row: {
          closed_at: string | null
          closed_reason: string | null
          created_by: string | null
          ends_at: string
          id: string
          kind: string
          starts_at: string
          status: string
          target: number
        }
        Insert: {
          closed_at?: string | null
          closed_reason?: string | null
          created_by?: string | null
          ends_at: string
          id?: string
          kind?: string
          starts_at?: string
          status?: string
          target: number
        }
        Update: {
          closed_at?: string | null
          closed_reason?: string | null
          created_by?: string | null
          ends_at?: string
          id?: string
          kind?: string
          starts_at?: string
          status?: string
          target?: number
        }
        Relationships: [
          {
            foreignKeyName: "coop_goals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      course_assembly_incidents: {
        Row: {
          course_id: string
          first_seen_at: string
          last_seen_at: string
          occurrence_count: number
        }
        Insert: {
          course_id: string
          first_seen_at?: string
          last_seen_at?: string
          occurrence_count?: number
        }
        Update: {
          course_id?: string
          first_seen_at?: string
          last_seen_at?: string
          occurrence_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "course_assembly_incidents_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: true
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_assembly_incidents_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: true
            referencedRelation: "dataintel_lessons_sync"
            referencedColumns: ["course_id"]
          },
        ]
      }
      course_chapter_early_access: {
        Row: {
          adventure_id: string
          confirmed_at: string
          course_id: string
          pathway_stage: string
          prerequisite_kcs: string[]
          user_id: string
        }
        Insert: {
          adventure_id: string
          confirmed_at?: string
          course_id: string
          pathway_stage: string
          prerequisite_kcs: string[]
          user_id: string
        }
        Update: {
          adventure_id?: string
          confirmed_at?: string
          course_id?: string
          pathway_stage?: string
          prerequisite_kcs?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_chapter_early_access_adventure_id_fkey"
            columns: ["adventure_id"]
            isOneToOne: false
            referencedRelation: "adventures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_chapter_early_access_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_chapter_early_access_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "dataintel_lessons_sync"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "course_chapter_early_access_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      course_pathway_badges: {
        Row: {
          award_key: string
          basis: string
          course_id: string
          earned_at: string
          pathway_stage: string | null
          recorded_at: string
          user_id: string
        }
        Insert: {
          award_key: string
          basis: string
          course_id: string
          earned_at: string
          pathway_stage?: string | null
          recorded_at?: string
          user_id: string
        }
        Update: {
          award_key?: string
          basis?: string
          course_id?: string
          earned_at?: string
          pathway_stage?: string | null
          recorded_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_pathway_badges_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_pathway_badges_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "dataintel_lessons_sync"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "course_pathway_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      course_pathway_placements: {
        Row: {
          course_id: string
          created_at: string
          credited_topics: number
          method: string
          pathway_stage: string
          start_topic_id: string | null
          user_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          credited_topics?: number
          method: string
          pathway_stage: string
          start_topic_id?: string | null
          user_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          credited_topics?: number
          method?: string
          pathway_stage?: string
          start_topic_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_pathway_placements_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_pathway_placements_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "dataintel_lessons_sync"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "course_pathway_placements_start_topic_id_fkey"
            columns: ["start_topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_pathway_placements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      course_placements: {
        Row: {
          claimed_level: string
          course_id: string
          created_at: string
          education_level: string
          method: string
          quiz_answers: Json
          start_lesson_id: string | null
          start_topic_id: string | null
          user_id: string
        }
        Insert: {
          claimed_level: string
          course_id: string
          created_at?: string
          education_level: string
          method: string
          quiz_answers?: Json
          start_lesson_id?: string | null
          start_topic_id?: string | null
          user_id: string
        }
        Update: {
          claimed_level?: string
          course_id?: string
          created_at?: string
          education_level?: string
          method?: string
          quiz_answers?: Json
          start_lesson_id?: string | null
          start_topic_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_placements_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_placements_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "dataintel_lessons_sync"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "course_placements_start_lesson_id_fkey"
            columns: ["start_lesson_id"]
            isOneToOne: false
            referencedRelation: "dataintel_lessons_sync"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "course_placements_start_lesson_id_fkey"
            columns: ["start_lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_placements_start_topic_id_fkey"
            columns: ["start_topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_placements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      course_release_verifications: {
        Row: {
          checks: Json
          content_watermark: string | null
          course_id: string
          verified_at: string
        }
        Insert: {
          checks?: Json
          content_watermark?: string | null
          course_id: string
          verified_at?: string
        }
        Update: {
          checks?: Json
          content_watermark?: string | null
          course_id?: string
          verified_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_release_verifications_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: true
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_release_verifications_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: true
            referencedRelation: "dataintel_lessons_sync"
            referencedColumns: ["course_id"]
          },
        ]
      }
      course_topic_mastery_credits: {
        Row: {
          accepted_at: string
          course_id: string
          kc_keys: string[]
          p_known: Json
          topic_id: string
          user_id: string
        }
        Insert: {
          accepted_at?: string
          course_id: string
          kc_keys: string[]
          p_known?: Json
          topic_id: string
          user_id: string
        }
        Update: {
          accepted_at?: string
          course_id?: string
          kc_keys?: string[]
          p_known?: Json
          topic_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_topic_mastery_credits_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_topic_mastery_credits_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "dataintel_lessons_sync"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "course_topic_mastery_credits_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_topic_mastery_credits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      course_topic_mastery_declines: {
        Row: {
          course_id: string
          declined_at: string
          kc_keys: string[]
          topic_id: string
          user_id: string
        }
        Insert: {
          course_id: string
          declined_at?: string
          kc_keys: string[]
          topic_id: string
          user_id: string
        }
        Update: {
          course_id?: string
          declined_at?: string
          kc_keys?: string[]
          topic_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_topic_mastery_declines_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_topic_mastery_declines_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "dataintel_lessons_sync"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "course_topic_mastery_declines_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_topic_mastery_declines_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      courses: {
        Row: {
          badge_asset: string | null
          created_at: string
          description: Json
          id: string
          in_progress: boolean
          position: number
          requires: Json
          slug: string
          status: string
          subject: string
          title: Json
        }
        Insert: {
          badge_asset?: string | null
          created_at?: string
          description?: Json
          id?: string
          in_progress?: boolean
          position?: number
          requires?: Json
          slug: string
          status?: string
          subject?: string
          title?: Json
        }
        Update: {
          badge_asset?: string | null
          created_at?: string
          description?: Json
          id?: string
          in_progress?: boolean
          position?: number
          requires?: Json
          slug?: string
          status?: string
          subject?: string
          title?: Json
        }
        Relationships: []
      }
      data_practice_consents: {
        Row: {
          disclosure_version: number
          granted_at: string
          granted_by: string | null
          grantor_kind: string
          id: string
          practice_key: string
          revoked_at: string | null
          revoked_by: string | null
          subject_user_id: string
        }
        Insert: {
          disclosure_version: number
          granted_at?: string
          granted_by?: string | null
          grantor_kind: string
          id?: string
          practice_key: string
          revoked_at?: string | null
          revoked_by?: string | null
          subject_user_id: string
        }
        Update: {
          disclosure_version?: number
          granted_at?: string
          granted_by?: string | null
          grantor_kind?: string
          id?: string
          practice_key?: string
          revoked_at?: string | null
          revoked_by?: string | null
          subject_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_practice_consents_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "data_practice_consents_practice_key_fkey"
            columns: ["practice_key"]
            isOneToOne: false
            referencedRelation: "data_practices"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "data_practice_consents_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "data_practice_consents_subject_user_id_fkey"
            columns: ["subject_user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      data_practices: {
        Row: {
          consent_source: string
          created_at: string
          disclosure_version: number
          introduced_by: string
          key: string
          kind: string
          requirement: string
          summary: string
          teen_self_consent: boolean
        }
        Insert: {
          consent_source: string
          created_at?: string
          disclosure_version?: number
          introduced_by: string
          key: string
          kind: string
          requirement: string
          summary: string
          teen_self_consent: boolean
        }
        Update: {
          consent_source?: string
          created_at?: string
          disclosure_version?: number
          introduced_by?: string
          key?: string
          kind?: string
          requirement?: string
          summary?: string
          teen_self_consent?: boolean
        }
        Relationships: []
      }
      dataintel_sync_state: {
        Row: {
          last_event_id: number | null
          last_synced_at: string
          rows_synced: number | null
          table_name: string
          updated_at: string
        }
        Insert: {
          last_event_id?: number | null
          last_synced_at?: string
          rows_synced?: number | null
          table_name: string
          updated_at?: string
        }
        Update: {
          last_event_id?: number | null
          last_synced_at?: string
          rows_synced?: number | null
          table_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_logs: {
        Row: {
          created_at: string
          detail: Json
          id: string
          locale: string | null
          message_id: string | null
          status: string
          subject: string
          template_type: string
          to_address: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          detail?: Json
          id?: string
          locale?: string | null
          message_id?: string | null
          status?: string
          subject: string
          template_type?: string
          to_address: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          detail?: Json
          id?: string
          locale?: string | null
          message_id?: string | null
          status?: string
          subject?: string
          template_type?: string
          to_address?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      family_autonomy_changes: {
        Row: {
          actor_kind: string
          actor_user_id: string | null
          created_at: string
          from_level: number
          from_limit: number
          id: string
          kid_user_id: string
          reason: string | null
          reason_code: string | null
          request_id: string | null
          to_level: number
          to_limit: number
        }
        Insert: {
          actor_kind: string
          actor_user_id?: string | null
          created_at?: string
          from_level: number
          from_limit: number
          id?: string
          kid_user_id: string
          reason?: string | null
          reason_code?: string | null
          request_id?: string | null
          to_level: number
          to_limit: number
        }
        Update: {
          actor_kind?: string
          actor_user_id?: string | null
          created_at?: string
          from_level?: number
          from_limit?: number
          id?: string
          kid_user_id?: string
          reason?: string | null
          reason_code?: string | null
          request_id?: string | null
          to_level?: number
          to_limit?: number
        }
        Relationships: [
          {
            foreignKeyName: "family_autonomy_changes_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "family_autonomy_changes_kid_user_id_fkey"
            columns: ["kid_user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "family_autonomy_changes_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "family_autonomy_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      family_autonomy_eligibility_log: {
        Row: {
          first_eligible_at: string
          kid_user_id: string
          level: number
        }
        Insert: {
          first_eligible_at?: string
          kid_user_id: string
          level: number
        }
        Update: {
          first_eligible_at?: string
          kid_user_id?: string
          level?: number
        }
        Relationships: [
          {
            foreignKeyName: "family_autonomy_eligibility_log_kid_user_id_fkey"
            columns: ["kid_user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      family_autonomy_levels: {
        Row: {
          kid_user_id: string
          level: number
          level_since: string
          preapproved_limit: number
          updated_at: string
        }
        Insert: {
          kid_user_id: string
          level?: number
          level_since?: string
          preapproved_limit?: number
          updated_at?: string
        }
        Update: {
          kid_user_id?: string
          level?: number
          level_since?: string
          preapproved_limit?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_autonomy_levels_kid_user_id_fkey"
            columns: ["kid_user_id"]
            isOneToOne: true
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      family_autonomy_requests: {
        Row: {
          child_note: string | null
          created_at: string
          decided_at: string | null
          decision_id: string | null
          id: string
          kid_user_id: string
          requested_level: number
          status: string
        }
        Insert: {
          child_note?: string | null
          created_at?: string
          decided_at?: string | null
          decision_id?: string | null
          id?: string
          kid_user_id: string
          requested_level: number
          status?: string
        }
        Update: {
          child_note?: string | null
          created_at?: string
          decided_at?: string | null
          decision_id?: string | null
          id?: string
          kid_user_id?: string
          requested_level?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_autonomy_requests_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "family_decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_autonomy_requests_kid_user_id_fkey"
            columns: ["kid_user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      family_decision_reflections: {
        Row: {
          created_at: string
          decision_id: string
          reflection: string
        }
        Insert: {
          created_at?: string
          decision_id: string
          reflection: string
        }
        Update: {
          created_at?: string
          decision_id?: string
          reflection?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_decision_reflections_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: true
            referencedRelation: "family_decisions"
            referencedColumns: ["id"]
          },
        ]
      }
      family_decisions: {
        Row: {
          actor_kind: string
          actor_user_id: string | null
          created_at: string
          id: string
          kid_user_id: string
          legacy: boolean
          level_request_id: string | null
          outcome: string
          prior_status: string
          reason: string | null
          reason_code: string | null
          redemption_id: string | null
          reviews_decision_id: string | null
          revisit_on: string | null
          subject: string
          task_id: string | null
        }
        Insert: {
          actor_kind: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          kid_user_id: string
          legacy?: boolean
          level_request_id?: string | null
          outcome: string
          prior_status: string
          reason?: string | null
          reason_code?: string | null
          redemption_id?: string | null
          reviews_decision_id?: string | null
          revisit_on?: string | null
          subject: string
          task_id?: string | null
        }
        Update: {
          actor_kind?: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          kid_user_id?: string
          legacy?: boolean
          level_request_id?: string | null
          outcome?: string
          prior_status?: string
          reason?: string | null
          reason_code?: string | null
          redemption_id?: string | null
          reviews_decision_id?: string | null
          revisit_on?: string | null
          subject?: string
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "family_decisions_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "family_decisions_kid_user_id_fkey"
            columns: ["kid_user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "family_decisions_level_request_id_fkey"
            columns: ["level_request_id"]
            isOneToOne: false
            referencedRelation: "family_autonomy_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_decisions_redemption_id_fkey"
            columns: ["redemption_id"]
            isOneToOne: false
            referencedRelation: "redemptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_decisions_reviews_decision_id_fkey"
            columns: ["reviews_decision_id"]
            isOneToOne: false
            referencedRelation: "family_decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_decisions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      family_denial_reason_scores: {
        Row: {
          actionable: boolean
          decision_id: string
          scored_at: string
          scored_by: string | null
        }
        Insert: {
          actionable: boolean
          decision_id: string
          scored_at?: string
          scored_by?: string | null
        }
        Update: {
          actionable?: boolean
          decision_id?: string
          scored_at?: string
          scored_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "family_denial_reason_scores_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: true
            referencedRelation: "family_decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_denial_reason_scores_scored_by_fkey"
            columns: ["scored_by"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      family_money_events: {
        Row: {
          amount: number | null
          bucket: string | null
          created_at: string
          default_save: number | null
          default_share: number | null
          default_spend: number | null
          event: string
          followed_default: boolean | null
          goal_id: string | null
          hours_since_allowance: number | null
          hours_since_earned: number | null
          id: number
          save_amount: number | null
          share_amount: number | null
          source: string | null
          spend_amount: number | null
          user_id: string
        }
        Insert: {
          amount?: number | null
          bucket?: string | null
          created_at?: string
          default_save?: number | null
          default_share?: number | null
          default_spend?: number | null
          event: string
          followed_default?: boolean | null
          goal_id?: string | null
          hours_since_allowance?: number | null
          hours_since_earned?: number | null
          id?: never
          save_amount?: number | null
          share_amount?: number | null
          source?: string | null
          spend_amount?: number | null
          user_id: string
        }
        Update: {
          amount?: number | null
          bucket?: string | null
          created_at?: string
          default_save?: number | null
          default_share?: number | null
          default_spend?: number | null
          event?: string
          followed_default?: boolean | null
          goal_id?: string | null
          hours_since_allowance?: number | null
          hours_since_earned?: number | null
          id?: never
          save_amount?: number | null
          share_amount?: number | null
          source?: string | null
          spend_amount?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_money_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      family_research_consents: {
        Row: {
          disclosure_version: number
          granted_at: string
          granted_by: string | null
          grantor_kind: string
          id: string
          revoked_at: string | null
          revoked_by: string | null
          subject_user_id: string
        }
        Insert: {
          disclosure_version: number
          granted_at?: string
          granted_by?: string | null
          grantor_kind: string
          id?: string
          revoked_at?: string | null
          revoked_by?: string | null
          subject_user_id: string
        }
        Update: {
          disclosure_version?: number
          granted_at?: string
          granted_by?: string | null
          grantor_kind?: string
          id?: string
          revoked_at?: string | null
          revoked_by?: string | null
          subject_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_research_consents_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "family_research_consents_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "family_research_consents_subject_user_id_fkey"
            columns: ["subject_user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      family_research_participants: {
        Row: {
          enrolled_at: string
          research_id: string
          subject_user_id: string
        }
        Insert: {
          enrolled_at?: string
          research_id?: string
          subject_user_id: string
        }
        Update: {
          enrolled_at?: string
          research_id?: string
          subject_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_research_participants_subject_user_id_fkey"
            columns: ["subject_user_id"]
            isOneToOne: true
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      family_research_snapshots: {
        Row: {
          age_years: number | null
          autonomy_level: number
          bridge_entries: number
          chores_approved: number
          coins_given: number
          coins_received: number
          coins_spent: number
          coins_to_save: number
          goals_reached: number
          next_goals_set: number
          period: string
          practised_days: number
          recorded_at: string
          register: string | null
          research_id: string
          rewards_asked: number
          rewards_not_yet: number
          split_changed: boolean
          tenure_months: number
        }
        Insert: {
          age_years?: number | null
          autonomy_level: number
          bridge_entries: number
          chores_approved: number
          coins_given: number
          coins_received: number
          coins_spent: number
          coins_to_save: number
          goals_reached: number
          next_goals_set: number
          period: string
          practised_days: number
          recorded_at?: string
          register?: string | null
          research_id: string
          rewards_asked: number
          rewards_not_yet: number
          split_changed: boolean
          tenure_months: number
        }
        Update: {
          age_years?: number | null
          autonomy_level?: number
          bridge_entries?: number
          chores_approved?: number
          coins_given?: number
          coins_received?: number
          coins_spent?: number
          coins_to_save?: number
          goals_reached?: number
          next_goals_set?: number
          period?: string
          practised_days?: number
          recorded_at?: string
          register?: string | null
          research_id?: string
          rewards_asked?: number
          rewards_not_yet?: number
          split_changed?: boolean
          tenure_months?: number
        }
        Relationships: [
          {
            foreignKeyName: "family_research_snapshots_research_id_fkey"
            columns: ["research_id"]
            isOneToOne: false
            referencedRelation: "family_research_participants"
            referencedColumns: ["research_id"]
          },
        ]
      }
      family_retention_runs: {
        Row: {
          evidence_cleared: number | null
          evidence_failed: number | null
          id: number
          ran_at: string
          removed: Json
        }
        Insert: {
          evidence_cleared?: number | null
          evidence_failed?: number | null
          id?: never
          ran_at?: string
          removed: Json
        }
        Update: {
          evidence_cleared?: number | null
          evidence_failed?: number | null
          id?: never
          ran_at?: string
          removed?: Json
        }
        Relationships: []
      }
      family_state_audit: {
        Row: {
          actor_user_id: string | null
          created_at: string
          db_role: string
          from_state: string | null
          id: number
          request_role: string | null
          row_id: string
          table_name: string
          to_state: string | null
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          db_role: string
          from_state?: string | null
          id?: never
          request_role?: string | null
          row_id: string
          table_name: string
          to_state?: string | null
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          db_role?: string
          from_state?: string | null
          id?: never
          request_role?: string | null
          row_id?: string
          table_name?: string
          to_state?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "family_state_audit_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      family_talk_nudges: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          created_at: string
          decision_id: string | null
          denials: number | null
          id: string
          kid_user_id: string
          origin: string
          status: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          decision_id?: string | null
          denials?: number | null
          id?: string
          kid_user_id: string
          origin: string
          status?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          decision_id?: string | null
          denials?: number | null
          id?: string
          kid_user_id?: string
          origin?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_talk_nudges_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "family_talk_nudges_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "family_decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_talk_nudges_kid_user_id_fkey"
            columns: ["kid_user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          followed_id: string
          follower_id: string
        }
        Insert: {
          created_at?: string
          followed_id: string
          follower_id: string
        }
        Update: {
          created_at?: string
          followed_id?: string
          follower_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_followed_id_fkey"
            columns: ["followed_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      forge_release_gates: {
        Row: {
          added_at: string
          description: string
          gate_id: string
          gate_number: number | null
          owner_role: string
          spec_refs: string[]
        }
        Insert: {
          added_at?: string
          description: string
          gate_id: string
          gate_number?: number | null
          owner_role?: string
          spec_refs?: string[]
        }
        Update: {
          added_at?: string
          description?: string
          gate_id?: string
          gate_number?: number | null
          owner_role?: string
          spec_refs?: string[]
        }
        Relationships: []
      }
      forge_v2_manifest_gates: {
        Row: {
          added_at: string
          gate_id: string
        }
        Insert: {
          added_at?: string
          gate_id: string
        }
        Update: {
          added_at?: string
          gate_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forge_v2_manifest_gates_gate_id_fkey"
            columns: ["gate_id"]
            isOneToOne: true
            referencedRelation: "forge_release_gates"
            referencedColumns: ["gate_id"]
          },
        ]
      }
      game_catalog: {
        Row: {
          content_pack_version: number
          game_id: string
          min_band: string
          status: string
          updated_at: string
        }
        Insert: {
          content_pack_version?: number
          game_id: string
          min_band?: string
          status?: string
          updated_at?: string
        }
        Update: {
          content_pack_version?: number
          game_id?: string
          min_band?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      game_progress: {
        Row: {
          best_finish_ms: number
          best_lap_ms: number
          character: string
          game_id: string
          last_played_at: string
          runs: number
          speed_class: string
          track_id: string
          user_id: string
        }
        Insert: {
          best_finish_ms: number
          best_lap_ms: number
          character: string
          game_id: string
          last_played_at?: string
          runs?: number
          speed_class: string
          track_id: string
          user_id: string
        }
        Update: {
          best_finish_ms?: number
          best_lap_ms?: number
          character?: string
          game_id?: string
          last_played_at?: string
          runs?: number
          speed_class?: string
          track_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_progress_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "game_catalog"
            referencedColumns: ["game_id"]
          },
          {
            foreignKeyName: "game_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      game_runs: {
        Row: {
          ai_cost_usd: number
          ai_line_at: string | null
          best_lap_ms: number
          character: string
          created_at: string
          finish_ms: number
          game_id: string
          id: string
          kart_body: string
          lap_ms: number[]
          lens: string
          metrics: Json
          mode: string
          new_best: boolean
          rank: number
          reflection: string | null
          run_key: string
          session_id: string
          speed_class: string
          track_id: string
          user_id: string
          verification: string
        }
        Insert: {
          ai_cost_usd?: number
          ai_line_at?: string | null
          best_lap_ms: number
          character: string
          created_at?: string
          finish_ms: number
          game_id: string
          id?: string
          kart_body: string
          lap_ms: number[]
          lens: string
          metrics?: Json
          mode: string
          new_best?: boolean
          rank: number
          reflection?: string | null
          run_key: string
          session_id: string
          speed_class: string
          track_id: string
          user_id: string
          verification?: string
        }
        Update: {
          ai_cost_usd?: number
          ai_line_at?: string | null
          best_lap_ms?: number
          character?: string
          created_at?: string
          finish_ms?: number
          game_id?: string
          id?: string
          kart_body?: string
          lap_ms?: number[]
          lens?: string
          metrics?: Json
          mode?: string
          new_best?: boolean
          rank?: number
          reflection?: string | null
          run_key?: string
          session_id?: string
          speed_class?: string
          track_id?: string
          user_id?: string
          verification?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_runs_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "game_catalog"
            referencedColumns: ["game_id"]
          },
          {
            foreignKeyName: "game_runs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "game_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_runs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      game_saves: {
        Row: {
          game_id: string
          revision: number
          save: Json
          schema_version: number
          updated_at: string
          user_id: string
        }
        Insert: {
          game_id: string
          revision?: number
          save: Json
          schema_version?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          game_id?: string
          revision?: number
          save?: Json
          schema_version?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_saves_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "game_catalog"
            referencedColumns: ["game_id"]
          },
          {
            foreignKeyName: "game_saves_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      game_sessions: {
        Row: {
          active_seconds: number
          band: string
          client_build: string | null
          close_reason: string | null
          ended_at: string | null
          expires_at: string
          game_id: string
          id: string
          last_active_at: string
          last_heartbeat_at: string
          locale: string
          max_minutes: number
          mentor: string | null
          session_ref: string
          started_at: string
          user_id: string
        }
        Insert: {
          active_seconds?: number
          band: string
          client_build?: string | null
          close_reason?: string | null
          ended_at?: string | null
          expires_at: string
          game_id: string
          id?: string
          last_active_at?: string
          last_heartbeat_at?: string
          locale: string
          max_minutes?: number
          mentor?: string | null
          session_ref: string
          started_at?: string
          user_id: string
        }
        Update: {
          active_seconds?: number
          band?: string
          client_build?: string | null
          close_reason?: string | null
          ended_at?: string | null
          expires_at?: string
          game_id?: string
          id?: string
          last_active_at?: string
          last_heartbeat_at?: string
          locale?: string
          max_minutes?: number
          mentor?: string | null
          session_ref?: string
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_sessions_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "game_catalog"
            referencedColumns: ["game_id"]
          },
          {
            foreignKeyName: "game_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      gate_effectiveness_reviews: {
        Row: {
          escape_id: string
          gate_change_ref: string | null
          gate_id: string
          id: string
          opened_at: string
          outcome: string | null
          owner_role: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          escape_id: string
          gate_change_ref?: string | null
          gate_id: string
          id?: string
          opened_at?: string
          outcome?: string | null
          owner_role: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          escape_id?: string
          gate_change_ref?: string | null
          gate_id?: string
          id?: string
          opened_at?: string
          outcome?: string | null
          owner_role?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "gate_effectiveness_reviews_escape_id_fkey"
            columns: ["escape_id"]
            isOneToOne: true
            referencedRelation: "content_defect_escapes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gate_effectiveness_reviews_gate_id_fkey"
            columns: ["gate_id"]
            isOneToOne: false
            referencedRelation: "forge_release_gates"
            referencedColumns: ["gate_id"]
          },
          {
            foreignKeyName: "gate_effectiveness_reviews_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      generation_heartbeat_snapshots: {
        Row: {
          active_slots: number
          cached_tokens: number
          completed_slots: number
          created_at: string
          failed_slots: number
          id: number
          images_billed: number
          images_generated: number
          images_inherited: number
          run_id: string
          skipped_slots: number
          stage_breakdown: Json
          tokens_used: number
          usd_used: number
        }
        Insert: {
          active_slots?: number
          cached_tokens?: number
          completed_slots?: number
          created_at?: string
          failed_slots?: number
          id?: never
          images_billed?: number
          images_generated?: number
          images_inherited?: number
          run_id: string
          skipped_slots?: number
          stage_breakdown?: Json
          tokens_used?: number
          usd_used?: number
        }
        Update: {
          active_slots?: number
          cached_tokens?: number
          completed_slots?: number
          created_at?: string
          failed_slots?: number
          id?: never
          images_billed?: number
          images_generated?: number
          images_inherited?: number
          run_id?: string
          skipped_slots?: number
          stage_breakdown?: Json
          tokens_used?: number
          usd_used?: number
        }
        Relationships: []
      }
      generation_runs: {
        Row: {
          cached_tokens: number
          course_slug: string
          created_at: string
          images_billed: number
          images_generated: number
          params: Json
          register: string
          run_id: string
          summary: Json
          tokens_used: number
          track_id: string | null
          updated_at: string
          usd_used: number
        }
        Insert: {
          cached_tokens?: number
          course_slug: string
          created_at?: string
          images_billed?: number
          images_generated?: number
          params?: Json
          register?: string
          run_id: string
          summary?: Json
          tokens_used?: number
          track_id?: string | null
          updated_at?: string
          usd_used?: number
        }
        Update: {
          cached_tokens?: number
          course_slug?: string
          created_at?: string
          images_billed?: number
          images_generated?: number
          params?: Json
          register?: string
          run_id?: string
          summary?: Json
          tokens_used?: number
          track_id?: string | null
          updated_at?: string
          usd_used?: number
        }
        Relationships: []
      }
      generation_runs_live: {
        Row: {
          active_slots: number
          cached_tokens: number
          completed_slots: number
          course_slug: string
          failed_slots: number
          images_billed: number
          images_generated: number
          images_inherited: number
          register: string
          run_id: string
          skipped_slots: number
          stage_breakdown: Json
          started_at: string
          tokens_used: number
          total_slots: number
          track_id: string | null
          updated_at: string
          usd_used: number
        }
        Insert: {
          active_slots?: number
          cached_tokens?: number
          completed_slots?: number
          course_slug: string
          failed_slots?: number
          images_billed?: number
          images_generated?: number
          images_inherited?: number
          register?: string
          run_id: string
          skipped_slots?: number
          stage_breakdown?: Json
          started_at?: string
          tokens_used?: number
          total_slots?: number
          track_id?: string | null
          updated_at?: string
          usd_used?: number
        }
        Update: {
          active_slots?: number
          cached_tokens?: number
          completed_slots?: number
          course_slug?: string
          failed_slots?: number
          images_billed?: number
          images_generated?: number
          images_inherited?: number
          register?: string
          run_id?: string
          skipped_slots?: number
          stage_breakdown?: Json
          started_at?: string
          tokens_used?: number
          total_slots?: number
          track_id?: string | null
          updated_at?: string
          usd_used?: number
        }
        Relationships: []
      }
      generation_slots: {
        Row: {
          dropped_segments: number
          duration_ms: number | null
          early_stopped: boolean
          error: string | null
          failed_from: string | null
          images_billed: number
          images_generated: number
          images_inherited: number
          review_cycles: number | null
          rubric: Json | null
          run_id: string
          salvaged: boolean
          slot_id: string
          state: string
          updated_at: string
        }
        Insert: {
          dropped_segments?: number
          duration_ms?: number | null
          early_stopped?: boolean
          error?: string | null
          failed_from?: string | null
          images_billed?: number
          images_generated?: number
          images_inherited?: number
          review_cycles?: number | null
          rubric?: Json | null
          run_id: string
          salvaged?: boolean
          slot_id: string
          state: string
          updated_at?: string
        }
        Update: {
          dropped_segments?: number
          duration_ms?: number | null
          early_stopped?: boolean
          error?: string | null
          failed_from?: string | null
          images_billed?: number
          images_generated?: number
          images_inherited?: number
          review_cycles?: number | null
          rubric?: Json | null
          run_id?: string
          salvaged?: boolean
          slot_id?: string
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "generation_slots_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "generation_runs"
            referencedColumns: ["run_id"]
          },
        ]
      }
      generation_tracks: {
        Row: {
          budget_usd: number | null
          course_slug: string
          created_at: string
          halted: string | null
          report: Json
          track_id: string
          updated_at: string
        }
        Insert: {
          budget_usd?: number | null
          course_slug: string
          created_at?: string
          halted?: string | null
          report?: Json
          track_id: string
          updated_at?: string
        }
        Update: {
          budget_usd?: number | null
          course_slug?: string
          created_at?: string
          halted?: string | null
          report?: Json
          track_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      goal_next_steps: {
        Row: {
          decided_at: string | null
          goal_id: string
          holder_user_id: string
          next_goal_id: string | null
          prompted_at: string | null
          reached_at: string
          state: string
        }
        Insert: {
          decided_at?: string | null
          goal_id: string
          holder_user_id: string
          next_goal_id?: string | null
          prompted_at?: string | null
          reached_at: string
          state?: string
        }
        Update: {
          decided_at?: string | null
          goal_id?: string
          holder_user_id?: string
          next_goal_id?: string | null
          prompted_at?: string | null
          reached_at?: string
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_next_steps_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: true
            referencedRelation: "savings_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_next_steps_holder_user_id_fkey"
            columns: ["holder_user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "goal_next_steps_next_goal_id_fkey"
            columns: ["next_goal_id"]
            isOneToOne: false
            referencedRelation: "savings_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      guardian_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          kid_user_id: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          kid_user_id: string
          token: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          kid_user_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "guardian_invites_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "guardian_invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "guardian_invites_kid_user_id_fkey"
            columns: ["kid_user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      guardian_links: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          invite_id: string | null
          kid_user_id: string
          parent_user_id: string
          revoked_at: string | null
          revoked_by: string | null
          verification_status: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          invite_id?: string | null
          kid_user_id: string
          parent_user_id: string
          revoked_at?: string | null
          revoked_by?: string | null
          verification_status?: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          invite_id?: string | null
          kid_user_id?: string
          parent_user_id?: string
          revoked_at?: string | null
          revoked_by?: string | null
          verification_status?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guardian_links_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "guardian_links_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "guardian_invites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guardian_links_kid_user_id_fkey"
            columns: ["kid_user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "guardian_links_parent_user_id_fkey"
            columns: ["parent_user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "guardian_links_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      insights_daily_activity: {
        Row: {
          day: string
          device: string
          event: string
          events: number
          locale: string
          role: string
          route_class: string
          sessions: number
          total_value: number | null
          users: number
        }
        Insert: {
          day: string
          device?: string
          event: string
          events: number
          locale?: string
          role: string
          route_class?: string
          sessions: number
          total_value?: number | null
          users: number
        }
        Update: {
          day?: string
          device?: string
          event?: string
          events?: number
          locale?: string
          role?: string
          route_class?: string
          sessions?: number
          total_value?: number | null
          users?: number
        }
        Relationships: []
      }
      insights_daily_users: {
        Row: {
          day: string
          role: string
          sessions: number
          users: number
        }
        Insert: {
          day: string
          role: string
          sessions: number
          users: number
        }
        Update: {
          day?: string
          role?: string
          sessions?: number
          users?: number
        }
        Relationships: []
      }
      insights_maintenance_log: {
        Row: {
          id: number
          job: string
          ran_at: string
          removed: number
          retain_days: number | null
        }
        Insert: {
          id?: never
          job: string
          ran_at?: string
          removed?: number
          retain_days?: number | null
        }
        Update: {
          id?: never
          job?: string
          ran_at?: string
          removed?: number
          retain_days?: number | null
        }
        Relationships: []
      }
      kc: {
        Row: {
          created_at: string
          id: string
          key: string
          objective: Json
          p_g: number
          p_l0: number
          p_s: number
          p_t: number
          skill_key: string | null
          status: string
          strand: string
          tier_min: number
          title: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          objective: Json
          p_g?: number
          p_l0?: number
          p_s?: number
          p_t?: number
          skill_key?: string | null
          status?: string
          strand: string
          tier_min?: number
          title: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          objective?: Json
          p_g?: number
          p_l0?: number
          p_s?: number
          p_t?: number
          skill_key?: string | null
          status?: string
          strand?: string
          tier_min?: number
          title?: Json
          updated_at?: string
        }
        Relationships: []
      }
      kc_attempt: {
        Row: {
          correct: boolean
          created_at: string
          id: string
          kc_id: string
          misconception_id: string | null
          p_known_after: number
          p_known_before: number
          receipt_key: string | null
          review_tier: string | null
          score: number | null
          segment_id: string | null
          session_id: string | null
          source: string
          strategy: string | null
          user_id: string
        }
        Insert: {
          correct: boolean
          created_at?: string
          id?: string
          kc_id: string
          misconception_id?: string | null
          p_known_after: number
          p_known_before: number
          receipt_key?: string | null
          review_tier?: string | null
          score?: number | null
          segment_id?: string | null
          session_id?: string | null
          source: string
          strategy?: string | null
          user_id: string
        }
        Update: {
          correct?: boolean
          created_at?: string
          id?: string
          kc_id?: string
          misconception_id?: string | null
          p_known_after?: number
          p_known_before?: number
          receipt_key?: string | null
          review_tier?: string | null
          score?: number | null
          segment_id?: string | null
          session_id?: string | null
          source?: string
          strategy?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kc_attempt_kc_id_fkey"
            columns: ["kc_id"]
            isOneToOne: false
            referencedRelation: "kc"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kc_attempt_misconception_id_fkey"
            columns: ["misconception_id"]
            isOneToOne: false
            referencedRelation: "misconception"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kc_attempt_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "tutor_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kc_attempt_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "tutor_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kc_attempt_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      kc_edge: {
        Row: {
          dependent_kc_id: string
          prerequisite_kc_id: string
        }
        Insert: {
          dependent_kc_id: string
          prerequisite_kc_id: string
        }
        Update: {
          dependent_kc_id?: string
          prerequisite_kc_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kc_edge_dependent_kc_id_fkey"
            columns: ["dependent_kc_id"]
            isOneToOne: false
            referencedRelation: "kc"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kc_edge_prerequisite_kc_id_fkey"
            columns: ["prerequisite_kc_id"]
            isOneToOne: false
            referencedRelation: "kc"
            referencedColumns: ["id"]
          },
        ]
      }
      kid_task_streaks: {
        Row: {
          current_streak_days: number
          kid_user_id: string
          last_completed_date: string | null
          longest_streak_days: number
          updated_at: string
        }
        Insert: {
          current_streak_days?: number
          kid_user_id: string
          last_completed_date?: string | null
          longest_streak_days?: number
          updated_at?: string
        }
        Update: {
          current_streak_days?: number
          kid_user_id?: string
          last_completed_date?: string | null
          longest_streak_days?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kid_task_streaks_kid_user_id_fkey"
            columns: ["kid_user_id"]
            isOneToOne: true
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      learner_decision_journal: {
        Row: {
          choice_id: string
          choice_text: string
          course_id: string
          decision_point: string
          first_choice_id: string
          first_choice_text: string
          first_recorded_at: string
          id: string
          lesson_id: string
          locale: string
          outcome_text: string | null
          recorded_at: string
          segment_id: string
          segment_type: string
          situation_text: string
          times_decided: number
          topic_id: string
          user_id: string
        }
        Insert: {
          choice_id: string
          choice_text: string
          course_id: string
          decision_point: string
          first_choice_id: string
          first_choice_text: string
          first_recorded_at?: string
          id?: string
          lesson_id: string
          locale: string
          outcome_text?: string | null
          recorded_at?: string
          segment_id: string
          segment_type: string
          situation_text: string
          times_decided?: number
          topic_id: string
          user_id: string
        }
        Update: {
          choice_id?: string
          choice_text?: string
          course_id?: string
          decision_point?: string
          first_choice_id?: string
          first_choice_text?: string
          first_recorded_at?: string
          id?: string
          lesson_id?: string
          locale?: string
          outcome_text?: string | null
          recorded_at?: string
          segment_id?: string
          segment_type?: string
          situation_text?: string
          times_decided?: number
          topic_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learner_decision_journal_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learner_decision_journal_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "dataintel_lessons_sync"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "learner_decision_journal_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "dataintel_lessons_sync"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "learner_decision_journal_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learner_decision_journal_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learner_decision_journal_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      learner_decision_resurfacings: {
        Row: {
          entry_id: string
          lesson_id: string
          resurfaced_at: string
          user_id: string
        }
        Insert: {
          entry_id: string
          lesson_id: string
          resurfaced_at?: string
          user_id: string
        }
        Update: {
          entry_id?: string
          lesson_id?: string
          resurfaced_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learner_decision_resurfacings_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "learner_decision_journal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learner_decision_resurfacings_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "dataintel_lessons_sync"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "learner_decision_resurfacings_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learner_decision_resurfacings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      learner_disposition_profile: {
        Row: {
          adaptation_history: Json
          behavior_sessions: number
          disengagement_rate: number | null
          explanation: string
          help_style: string
          hint_rate: number | null
          last_session_at: string | null
          left_rate: number | null
          misaligned_rate: number | null
          persistence: string
          persona_rapport: Json
          se_first_pass: number
          se_prompts: number
          sessions_observed: number
          spoken_answer_ms: number | null
          tell_rate: number | null
          typed_answer_ms: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          adaptation_history?: Json
          behavior_sessions?: number
          disengagement_rate?: number | null
          explanation?: string
          help_style?: string
          hint_rate?: number | null
          last_session_at?: string | null
          left_rate?: number | null
          misaligned_rate?: number | null
          persistence?: string
          persona_rapport?: Json
          se_first_pass?: number
          se_prompts?: number
          sessions_observed?: number
          spoken_answer_ms?: number | null
          tell_rate?: number | null
          typed_answer_ms?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          adaptation_history?: Json
          behavior_sessions?: number
          disengagement_rate?: number | null
          explanation?: string
          help_style?: string
          hint_rate?: number | null
          last_session_at?: string | null
          left_rate?: number | null
          misaligned_rate?: number | null
          persistence?: string
          persona_rapport?: Json
          se_first_pass?: number
          se_prompts?: number
          sessions_observed?: number
          spoken_answer_ms?: number | null
          tell_rate?: number | null
          typed_answer_ms?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learner_disposition_profile_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      learner_kc_mastery: {
        Row: {
          attempts: number
          correct: number
          kc_id: string
          last_attempt_at: string | null
          p_known: number
          params_override: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          correct?: number
          kc_id: string
          last_attempt_at?: string | null
          p_known: number
          params_override?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          correct?: number
          kc_id?: string
          last_attempt_at?: string | null
          p_known?: number
          params_override?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learner_kc_mastery_kc_id_fkey"
            columns: ["kc_id"]
            isOneToOne: false
            referencedRelation: "kc"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learner_kc_mastery_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      learner_memory: {
        Row: {
          content: string
          store: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          store: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          store?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learner_memory_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      learner_memory_ledger: {
        Row: {
          actor: string
          after_hash: string
          before_hash: string | null
          created_at: string
          id: string
          session_id: string | null
          store: string
          user_id: string
        }
        Insert: {
          actor: string
          after_hash: string
          before_hash?: string | null
          created_at?: string
          id?: string
          session_id?: string | null
          store: string
          user_id: string
        }
        Update: {
          actor?: string
          after_hash?: string
          before_hash?: string | null
          created_at?: string
          id?: string
          session_id?: string | null
          store?: string
          user_id?: string
        }
        Relationships: []
      }
      learner_memory_proposals: {
        Row: {
          after_hash: string
          before_hash: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          expected_before: string | null
          id: string
          proposed: string
          session_id: string | null
          status: string
          store: string
          user_id: string
        }
        Insert: {
          after_hash: string
          before_hash?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          expected_before?: string | null
          id?: string
          proposed: string
          session_id?: string | null
          status?: string
          store?: string
          user_id: string
        }
        Update: {
          after_hash?: string
          before_hash?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          expected_before?: string | null
          id?: string
          proposed?: string
          session_id?: string | null
          status?: string
          store?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learner_memory_proposals_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "learner_memory_proposals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      learner_misconception: {
        Row: {
          evidence_count: number
          last_seen_at: string
          misconception_id: string
          resolved_at: string | null
          user_id: string
        }
        Insert: {
          evidence_count?: number
          last_seen_at?: string
          misconception_id: string
          resolved_at?: string | null
          user_id: string
        }
        Update: {
          evidence_count?: number
          last_seen_at?: string
          misconception_id?: string
          resolved_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learner_misconception_misconception_id_fkey"
            columns: ["misconception_id"]
            isOneToOne: false
            referencedRelation: "misconception"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learner_misconception_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      learner_play_limits: {
        Row: {
          max_session_minutes: number
          max_sessions_per_day: number
          set_by: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          max_session_minutes?: number
          max_sessions_per_day?: number
          set_by?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          max_session_minutes?: number
          max_sessions_per_day?: number
          set_by?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learner_play_limits_set_by_fkey"
            columns: ["set_by"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "learner_play_limits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      learner_register_history: {
        Row: {
          first_seen_at: string
          graduation_acknowledged_at: string | null
          register: string
          user_id: string
        }
        Insert: {
          first_seen_at?: string
          graduation_acknowledged_at?: string | null
          register: string
          user_id: string
        }
        Update: {
          first_seen_at?: string
          graduation_acknowledged_at?: string | null
          register?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learner_register_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      learning_bridge_prompts: {
        Row: {
          action: string
          audience: string
          closed_at: string | null
          closed_by: string | null
          course_id: string
          created_at: string
          expires_at: string
          id: string
          kc_id: string
          learner_id: string
          lesson_id: string | null
          result_goal_id: string | null
          result_self_goal_id: string | null
          result_task_id: string | null
          status: string
          topic_id: string
        }
        Insert: {
          action: string
          audience: string
          closed_at?: string | null
          closed_by?: string | null
          course_id: string
          created_at?: string
          expires_at: string
          id?: string
          kc_id: string
          learner_id: string
          lesson_id?: string | null
          result_goal_id?: string | null
          result_self_goal_id?: string | null
          result_task_id?: string | null
          status?: string
          topic_id: string
        }
        Update: {
          action?: string
          audience?: string
          closed_at?: string | null
          closed_by?: string | null
          course_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          kc_id?: string
          learner_id?: string
          lesson_id?: string | null
          result_goal_id?: string | null
          result_self_goal_id?: string | null
          result_task_id?: string | null
          status?: string
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_bridge_prompts_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "learning_bridge_prompts_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_bridge_prompts_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "dataintel_lessons_sync"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "learning_bridge_prompts_kc_id_fkey"
            columns: ["kc_id"]
            isOneToOne: false
            referencedRelation: "kc"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_bridge_prompts_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "learning_bridge_prompts_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "dataintel_lessons_sync"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "learning_bridge_prompts_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_bridge_prompts_result_goal_id_fkey"
            columns: ["result_goal_id"]
            isOneToOne: false
            referencedRelation: "savings_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_bridge_prompts_result_self_goal_id_fkey"
            columns: ["result_self_goal_id"]
            isOneToOne: false
            referencedRelation: "savings_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_bridge_prompts_result_task_id_fkey"
            columns: ["result_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_bridge_prompts_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_events: {
        Row: {
          anon_id: string | null
          client_event_id: string | null
          course_id: string | null
          created_at: string
          device: string | null
          event: string
          event_version: number
          experiment_id: string | null
          experiment_variant: string | null
          id: number
          lesson_id: string | null
          locale: string | null
          occurred_at: string | null
          ordinal: number | null
          referrer_class: string | null
          role: string
          route_class: string | null
          segment_id: string | null
          session_id: string | null
          user_id: string | null
          value: number | null
        }
        Insert: {
          anon_id?: string | null
          client_event_id?: string | null
          course_id?: string | null
          created_at?: string
          device?: string | null
          event: string
          event_version?: number
          experiment_id?: string | null
          experiment_variant?: string | null
          id?: never
          lesson_id?: string | null
          locale?: string | null
          occurred_at?: string | null
          ordinal?: number | null
          referrer_class?: string | null
          role: string
          route_class?: string | null
          segment_id?: string | null
          session_id?: string | null
          user_id?: string | null
          value?: number | null
        }
        Update: {
          anon_id?: string | null
          client_event_id?: string | null
          course_id?: string | null
          created_at?: string
          device?: string | null
          event?: string
          event_version?: number
          experiment_id?: string | null
          experiment_variant?: string | null
          id?: never
          lesson_id?: string | null
          locale?: string | null
          occurred_at?: string | null
          ordinal?: number | null
          referrer_class?: string | null
          role?: string
          route_class?: string | null
          segment_id?: string | null
          session_id?: string | null
          user_id?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "learning_events_anon_id_fkey"
            columns: ["anon_id"]
            isOneToOne: false
            referencedRelation: "anon_visitors"
            referencedColumns: ["anon_id"]
          },
          {
            foreignKeyName: "learning_events_anon_id_fkey"
            columns: ["anon_id"]
            isOneToOne: false
            referencedRelation: "dataintel_anon_conversions_sync"
            referencedColumns: ["anon_id"]
          },
          {
            foreignKeyName: "learning_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      learning_pace_preferences: {
        Row: {
          chosen_at: string
          daily_lesson_goal: number
          updated_at: string
          user_id: string
        }
        Insert: {
          chosen_at?: string
          daily_lesson_goal: number
          updated_at?: string
          user_id: string
        }
        Update: {
          chosen_at?: string
          daily_lesson_goal?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_pace_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      learning_practice_days: {
        Row: {
          local_date: string
          recorded_at: string
          user_id: string
        }
        Insert: {
          local_date: string
          recorded_at?: string
          user_id: string
        }
        Update: {
          local_date?: string
          recorded_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_practice_days_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      learning_retention_release_baseline: {
        Row: {
          correct: number
          kc_id: string
          kc_key: string
          learners: number
          period_end: string
          period_start: string
          recorded_at: string
          release_id: string
          window_days: number
        }
        Insert: {
          correct: number
          kc_id: string
          kc_key: string
          learners: number
          period_end: string
          period_start: string
          recorded_at?: string
          release_id: string
          window_days: number
        }
        Update: {
          correct?: number
          kc_id?: string
          kc_key?: string
          learners?: number
          period_end?: string
          period_start?: string
          recorded_at?: string
          release_id?: string
          window_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "learning_retention_release_baseline_kc_id_fkey"
            columns: ["kc_id"]
            isOneToOne: false
            referencedRelation: "kc"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_stats: {
        Row: {
          day_lessons_passed: number
          days_practiced: number
          last_active_date: string | null
          lessons_completed: number
          longest_streak: number
          minutes_learned: number
          rest_days_used: number
          streak_days: number
          updated_at: string
          user_id: string
          xp_points: number
        }
        Insert: {
          day_lessons_passed?: number
          days_practiced?: number
          last_active_date?: string | null
          lessons_completed?: number
          longest_streak?: number
          minutes_learned?: number
          rest_days_used?: number
          streak_days?: number
          updated_at?: string
          user_id: string
          xp_points?: number
        }
        Update: {
          day_lessons_passed?: number
          days_practiced?: number
          last_active_date?: string | null
          lessons_completed?: number
          longest_streak?: number
          minutes_learned?: number
          rest_days_used?: number
          streak_days?: number
          updated_at?: string
          user_id?: string
          xp_points?: number
        }
        Relationships: [
          {
            foreignKeyName: "learning_stats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      learning_streak_pauses: {
        Row: {
          cancelled_at: string | null
          created_at: string
          ends_on: string
          id: string
          learner_id: string
          set_by: string | null
          starts_on: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          ends_on: string
          id?: string
          learner_id: string
          set_by?: string | null
          starts_on: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          ends_on?: string
          id?: string
          learner_id?: string
          set_by?: string | null
          starts_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_streak_pauses_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "learning_streak_pauses_set_by_fkey"
            columns: ["set_by"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      legacy_consent_subjects: {
        Row: {
          age_class: string
          marked_at: string
          released_at: string | null
          user_id: string
        }
        Insert: {
          age_class: string
          marked_at?: string
          released_at?: string | null
          user_id: string
        }
        Update: {
          age_class?: string
          marked_at?: string
          released_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "legacy_consent_subjects_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      legacy_kc_credits: {
        Row: {
          basis: string
          completed_at: string | null
          credited_at: string
          kc_id: string
          lessons_total: number
          map_version: number
          source_course_slug: string
          source_stage: string
          source_topic_id: string
          source_topic_path: string
          user_id: string
        }
        Insert: {
          basis: string
          completed_at?: string | null
          credited_at?: string
          kc_id: string
          lessons_total: number
          map_version: number
          source_course_slug: string
          source_stage: string
          source_topic_id: string
          source_topic_path: string
          user_id: string
        }
        Update: {
          basis?: string
          completed_at?: string | null
          credited_at?: string
          kc_id?: string
          lessons_total?: number
          map_version?: number
          source_course_slug?: string
          source_stage?: string
          source_topic_id?: string
          source_topic_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "legacy_kc_credits_kc_id_fkey"
            columns: ["kc_id"]
            isOneToOne: false
            referencedRelation: "kc"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legacy_kc_credits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      lesson_completion_receipts: {
        Row: {
          lesson_id: string
          result: Json
          run_id: string
          user_id: string
        }
        Insert: {
          lesson_id: string
          result: Json
          run_id: string
          user_id: string
        }
        Update: {
          lesson_id?: string
          result?: Json
          run_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_completion_receipts_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "dataintel_lessons_sync"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "lesson_completion_receipts_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_completion_receipts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      lesson_document_version_current: {
        Row: {
          activated_at: string
          activated_by: string | null
          document_version_id: string
          lesson_id: string
          locale: string
        }
        Insert: {
          activated_at?: string
          activated_by?: string | null
          document_version_id: string
          lesson_id: string
          locale: string
        }
        Update: {
          activated_at?: string
          activated_by?: string | null
          document_version_id?: string
          lesson_id?: string
          locale?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_document_version_current_activated_by_fkey"
            columns: ["activated_by"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "lesson_document_version_current_document_version_id_fkey"
            columns: ["document_version_id"]
            isOneToOne: false
            referencedRelation: "lesson_document_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_document_version_current_identity_fkey"
            columns: ["document_version_id", "lesson_id", "locale"]
            isOneToOne: false
            referencedRelation: "lesson_document_versions"
            referencedColumns: ["id", "lesson_id", "locale"]
          },
          {
            foreignKeyName: "lesson_document_version_current_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "dataintel_lessons_sync"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "lesson_document_version_current_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_document_versions: {
        Row: {
          answer_keys: Json
          audio: Json
          created_at: string
          created_by: string | null
          document: Json
          id: string
          lesson_id: string
          locale: string
          schema_version: number
          version_id: string
        }
        Insert: {
          answer_keys?: Json
          audio?: Json
          created_at?: string
          created_by?: string | null
          document: Json
          id?: string
          lesson_id: string
          locale: string
          schema_version: number
          version_id: string
        }
        Update: {
          answer_keys?: Json
          audio?: Json
          created_at?: string
          created_by?: string | null
          document?: Json
          id?: string
          lesson_id?: string
          locale?: string
          schema_version?: number
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_document_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "lesson_document_versions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "dataintel_lessons_sync"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "lesson_document_versions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_documents: {
        Row: {
          answer_keys: Json
          audio: Json
          document: Json
          illustration_style_version: string | null
          lesson_id: string
          locale: string
          schema_version: number
          updated_at: string
        }
        Insert: {
          answer_keys?: Json
          audio?: Json
          document: Json
          illustration_style_version?: string | null
          lesson_id: string
          locale: string
          schema_version?: number
          updated_at?: string
        }
        Update: {
          answer_keys?: Json
          audio?: Json
          document?: Json
          illustration_style_version?: string | null
          lesson_id?: string
          locale?: string
          schema_version?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_documents_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "dataintel_lessons_sync"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "lesson_documents_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_grade_receipts: {
        Row: {
          client_attempt: number
          lesson_id: string
          run_id: string
          segment_id: string
          user_id: string
          verdict: Json
        }
        Insert: {
          client_attempt: number
          lesson_id: string
          run_id: string
          segment_id: string
          user_id: string
          verdict: Json
        }
        Update: {
          client_attempt?: number
          lesson_id?: string
          run_id?: string
          segment_id?: string
          user_id?: string
          verdict?: Json
        }
        Relationships: [
          {
            foreignKeyName: "lesson_grade_receipts_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "dataintel_lessons_sync"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "lesson_grade_receipts_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_grade_receipts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      lesson_pedagogical_reviews: {
        Row: {
          author_id: string | null
          author_source: string
          checks: Json
          content_fingerprint: string | null
          document_version_id: string | null
          finding_count: number
          forge_items: Json
          id: string
          lesson_id: string
          recorded_at: string
          result: string
          reviewer_id: string | null
          seq: number
          subject_kind: string
        }
        Insert: {
          author_id?: string | null
          author_source: string
          checks: Json
          content_fingerprint?: string | null
          document_version_id?: string | null
          finding_count: number
          forge_items?: Json
          id?: string
          lesson_id: string
          recorded_at?: string
          result: string
          reviewer_id?: string | null
          seq?: never
          subject_kind: string
        }
        Update: {
          author_id?: string | null
          author_source?: string
          checks?: Json
          content_fingerprint?: string | null
          document_version_id?: string | null
          finding_count?: number
          forge_items?: Json
          id?: string
          lesson_id?: string
          recorded_at?: string
          result?: string
          reviewer_id?: string | null
          seq?: never
          subject_kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_pedagogical_reviews_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "lesson_pedagogical_reviews_document_version_id_fkey"
            columns: ["document_version_id"]
            isOneToOne: false
            referencedRelation: "lesson_document_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_pedagogical_reviews_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "dataintel_lessons_sync"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "lesson_pedagogical_reviews_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_pedagogical_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      lesson_progress: {
        Row: {
          attempts: number
          best_score: number
          completed_at: string | null
          lesson_id: string
          passed: boolean
          updated_at: string
          user_id: string
          xp_earned: number
        }
        Insert: {
          attempts?: number
          best_score?: number
          completed_at?: string | null
          lesson_id: string
          passed?: boolean
          updated_at?: string
          user_id: string
          xp_earned?: number
        }
        Update: {
          attempts?: number
          best_score?: number
          completed_at?: string | null
          lesson_id?: string
          passed?: boolean
          updated_at?: string
          user_id?: string
          xp_earned?: number
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "dataintel_lessons_sync"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      lesson_segment_attempts: {
        Row: {
          attempt_number: number
          course_id: string | null
          created_at: string
          diagnostic_code: string | null
          document_updated_at: string | null
          hints_used: number
          id: string
          lesson_id: string
          run_id: string | null
          score: number
          segment_id: string
          skill_key: string | null
          time_spent_seconds: number | null
          topic_id: string | null
          user_id: string
        }
        Insert: {
          attempt_number: number
          course_id?: string | null
          created_at?: string
          diagnostic_code?: string | null
          document_updated_at?: string | null
          hints_used?: number
          id?: string
          lesson_id: string
          run_id?: string | null
          score: number
          segment_id: string
          skill_key?: string | null
          time_spent_seconds?: number | null
          topic_id?: string | null
          user_id: string
        }
        Update: {
          attempt_number?: number
          course_id?: string | null
          created_at?: string
          diagnostic_code?: string | null
          document_updated_at?: string | null
          hints_used?: number
          id?: string
          lesson_id?: string
          run_id?: string | null
          score?: number
          segment_id?: string
          skill_key?: string | null
          time_spent_seconds?: number | null
          topic_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_segment_attempts_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "dataintel_lessons_sync"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "lesson_segment_attempts_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_segment_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      lesson_stage3_review_items: {
        Row: {
          created_at: string
          document_version_id: string | null
          flag_text: string
          gate: number
          id: string
          lesson_id: string
          locale: string | null
          resolution: string | null
          resolution_note: string | null
          review_id: string | null
          run_id: string | null
        }
        Insert: {
          created_at?: string
          document_version_id?: string | null
          flag_text: string
          gate: number
          id?: string
          lesson_id: string
          locale?: string | null
          resolution?: string | null
          resolution_note?: string | null
          review_id?: string | null
          run_id?: string | null
        }
        Update: {
          created_at?: string
          document_version_id?: string | null
          flag_text?: string
          gate?: number
          id?: string
          lesson_id?: string
          locale?: string | null
          resolution?: string | null
          resolution_note?: string | null
          review_id?: string | null
          run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lesson_stage3_review_items_document_version_id_fkey"
            columns: ["document_version_id"]
            isOneToOne: false
            referencedRelation: "lesson_document_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_stage3_review_items_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "dataintel_lessons_sync"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "lesson_stage3_review_items_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_stage3_review_items_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "lesson_pedagogical_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_v2_attempt_nonces: {
        Row: {
          consumed_at: string | null
          created_at: string
          document_version_id: string
          expires_at: string
          jti: string
          run_id: string
          segment_id: string
          user_id: string
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          document_version_id: string
          expires_at: string
          jti: string
          run_id: string
          segment_id: string
          user_id: string
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          document_version_id?: string
          expires_at?: string
          jti?: string
          run_id?: string
          segment_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_v2_attempt_nonces_document_version_id_fkey"
            columns: ["document_version_id"]
            isOneToOne: false
            referencedRelation: "lesson_document_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_v2_attempt_nonces_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "lesson_v2_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_v2_attempt_nonces_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      lesson_v2_first_unaided_stages: {
        Row: {
          created_at: string
          document_version_id: string
          fading_group_id: string
          receipt_jti: string
          stage: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_version_id: string
          fading_group_id: string
          receipt_jti: string
          stage: string
          user_id: string
        }
        Update: {
          created_at?: string
          document_version_id?: string
          fading_group_id?: string
          receipt_jti?: string
          stage?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_v2_first_unaided_stages_document_version_id_fkey"
            columns: ["document_version_id"]
            isOneToOne: false
            referencedRelation: "lesson_document_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_v2_first_unaided_stages_receipt_jti_fkey"
            columns: ["receipt_jti"]
            isOneToOne: true
            referencedRelation: "lesson_v2_grade_receipts"
            referencedColumns: ["jti"]
          },
          {
            foreignKeyName: "lesson_v2_first_unaided_stages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      lesson_v2_grade_receipts: {
        Row: {
          created_at: string
          document_version_id: string
          jti: string
          run_id: string
          segment_id: string
          time_spent_seconds: number | null
          user_id: string
          verdict: Json
        }
        Insert: {
          created_at?: string
          document_version_id: string
          jti: string
          run_id: string
          segment_id: string
          time_spent_seconds?: number | null
          user_id: string
          verdict: Json
        }
        Update: {
          created_at?: string
          document_version_id?: string
          jti?: string
          run_id?: string
          segment_id?: string
          time_spent_seconds?: number | null
          user_id?: string
          verdict?: Json
        }
        Relationships: [
          {
            foreignKeyName: "lesson_v2_grade_receipts_document_version_id_fkey"
            columns: ["document_version_id"]
            isOneToOne: false
            referencedRelation: "lesson_document_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_v2_grade_receipts_jti_fkey"
            columns: ["jti"]
            isOneToOne: true
            referencedRelation: "lesson_v2_attempt_nonces"
            referencedColumns: ["jti"]
          },
          {
            foreignKeyName: "lesson_v2_grade_receipts_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "lesson_v2_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_v2_grade_receipts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      lesson_v2_runs: {
        Row: {
          approach_id: string | null
          completed_at: string | null
          cpa_entry_stage: string | null
          document_version_id: string
          expires_at: string
          id: string
          lesson_id: string
          locale: string
          started_at: string
          user_id: string
        }
        Insert: {
          approach_id?: string | null
          completed_at?: string | null
          cpa_entry_stage?: string | null
          document_version_id: string
          expires_at: string
          id?: string
          lesson_id: string
          locale: string
          started_at?: string
          user_id: string
        }
        Update: {
          approach_id?: string | null
          completed_at?: string | null
          cpa_entry_stage?: string | null
          document_version_id?: string
          expires_at?: string
          id?: string
          lesson_id?: string
          locale?: string
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_v2_runs_document_version_id_fkey"
            columns: ["document_version_id"]
            isOneToOne: false
            referencedRelation: "lesson_document_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_v2_runs_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "dataintel_lessons_sync"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "lesson_v2_runs_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_v2_runs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "lesson_v2_runs_version_identity_fkey"
            columns: ["document_version_id", "lesson_id", "locale"]
            isOneToOne: false
            referencedRelation: "lesson_document_versions"
            referencedColumns: ["id", "lesson_id", "locale"]
          },
        ]
      }
      lesson_v2_segment_views: {
        Row: {
          created_at: string
          document_version_id: string
          run_id: string
          segment_id: string
          time_spent_seconds: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          document_version_id: string
          run_id: string
          segment_id: string
          time_spent_seconds?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          document_version_id?: string
          run_id?: string
          segment_id?: string
          time_spent_seconds?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_v2_segment_views_document_version_id_fkey"
            columns: ["document_version_id"]
            isOneToOne: false
            referencedRelation: "lesson_document_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_v2_segment_views_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "lesson_v2_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_v2_segment_views_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      lesson_version_activation_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          document_sha256: string
          document_version_id: string
          id: string
          lesson_id: string
          locale: string
          manifest_sha256: string
          run_id: string | null
          status: string
          version_id: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          document_sha256: string
          document_version_id: string
          id?: string
          lesson_id: string
          locale: string
          manifest_sha256: string
          run_id?: string | null
          status?: string
          version_id: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          document_sha256?: string
          document_version_id?: string
          id?: string
          lesson_id?: string
          locale?: string
          manifest_sha256?: string
          run_id?: string | null
          status?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_version_activation_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "lesson_version_activation_requests_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "dataintel_lessons_sync"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "lesson_version_activation_requests_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_version_activation_requests_version_fkey"
            columns: ["document_version_id", "lesson_id", "locale"]
            isOneToOne: false
            referencedRelation: "lesson_document_versions"
            referencedColumns: ["id", "lesson_id", "locale"]
          },
        ]
      }
      lessons: {
        Row: {
          cast: Json
          created_at: string
          difficulty: number
          estimated_minutes: number
          id: string
          optional_enrichment: boolean
          position: number
          slug: string
          status: string
          title: Json
          topic_id: string
          xp_total: number
        }
        Insert: {
          cast?: Json
          created_at?: string
          difficulty?: number
          estimated_minutes?: number
          id?: string
          optional_enrichment?: boolean
          position: number
          slug: string
          status?: string
          title?: Json
          topic_id: string
          xp_total?: number
        }
        Update: {
          cast?: Json
          created_at?: string
          difficulty?: number
          estimated_minutes?: number
          id?: string
          optional_enrichment?: boolean
          position?: number
          slug?: string
          status?: string
          title?: Json
          topic_id?: string
          xp_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "lessons_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      memory_card: {
        Row: {
          difficulty: number
          due_at: string
          kc_id: string
          lapses: number
          last_review_at: string | null
          reps: number
          stability: number
          state: string
          user_id: string
        }
        Insert: {
          difficulty?: number
          due_at?: string
          kc_id: string
          lapses?: number
          last_review_at?: string | null
          reps?: number
          stability?: number
          state?: string
          user_id: string
        }
        Update: {
          difficulty?: number
          due_at?: string
          kc_id?: string
          lapses?: number
          last_review_at?: string | null
          reps?: number
          stability?: number
          state?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memory_card_kc_id_fkey"
            columns: ["kc_id"]
            isOneToOne: false
            referencedRelation: "kc"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memory_card_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      mentor_age_calibrations: {
        Row: {
          created_at: string
          tier: number
          user_id: string
        }
        Insert: {
          created_at?: string
          tier: number
          user_id: string
        }
        Update: {
          created_at?: string
          tier?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentor_age_calibrations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      mentor_judge_calibration: {
        Row: {
          author_model: string | null
          created_at: string
          failure_reasons: string[]
          id: string
          inter_rater_agreement: number
          inter_rater_kappa: number
          items: number
          judge_id: string
          judge_model: string
          judge_prompt_hash: string
          kind: string
          length_bias_gap: number | null
          min_items_per_question: number
          min_items_per_stratum: number
          min_per_label: number
          note: string
          raters: number
          recorded_by: string
          same_family: boolean
          scope: string[]
          seed_set_hash: string
          seed_set_version: string
          threshold_agreement: number
          threshold_inter_rater: number
          threshold_inter_rater_kappa: number
          threshold_judge_kappa: number
          threshold_length_gap: number
          verdict: string
          verifies_calibration_id: string | null
        }
        Insert: {
          author_model?: string | null
          created_at?: string
          failure_reasons?: string[]
          id?: string
          inter_rater_agreement: number
          inter_rater_kappa: number
          items: number
          judge_id: string
          judge_model: string
          judge_prompt_hash: string
          kind: string
          length_bias_gap?: number | null
          min_items_per_question: number
          min_items_per_stratum: number
          min_per_label: number
          note: string
          raters: number
          recorded_by: string
          same_family: boolean
          scope?: string[]
          seed_set_hash: string
          seed_set_version: string
          threshold_agreement: number
          threshold_inter_rater: number
          threshold_inter_rater_kappa: number
          threshold_judge_kappa: number
          threshold_length_gap: number
          verdict: string
          verifies_calibration_id?: string | null
        }
        Update: {
          author_model?: string | null
          created_at?: string
          failure_reasons?: string[]
          id?: string
          inter_rater_agreement?: number
          inter_rater_kappa?: number
          items?: number
          judge_id?: string
          judge_model?: string
          judge_prompt_hash?: string
          kind?: string
          length_bias_gap?: number | null
          min_items_per_question?: number
          min_items_per_stratum?: number
          min_per_label?: number
          note?: string
          raters?: number
          recorded_by?: string
          same_family?: boolean
          scope?: string[]
          seed_set_hash?: string
          seed_set_version?: string
          threshold_agreement?: number
          threshold_inter_rater?: number
          threshold_inter_rater_kappa?: number
          threshold_judge_kappa?: number
          threshold_length_gap?: number
          verdict?: string
          verifies_calibration_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mentor_judge_calibration_verifies_calibration_id_fkey"
            columns: ["verifies_calibration_id"]
            isOneToOne: false
            referencedRelation: "mentor_judge_calibration"
            referencedColumns: ["id"]
          },
        ]
      }
      mentor_judge_calibration_stratum: {
        Row: {
          agreement: number
          calibration_id: string
          items: number
          panel_fail: number
          panel_pass: number
          passed: boolean
          question: string
          question_kappa: number
          stratum: string
        }
        Insert: {
          agreement: number
          calibration_id: string
          items: number
          panel_fail: number
          panel_pass: number
          passed: boolean
          question: string
          question_kappa: number
          stratum: string
        }
        Update: {
          agreement?: number
          calibration_id?: string
          items?: number
          panel_fail?: number
          panel_pass?: number
          passed?: boolean
          question?: string
          question_kappa?: number
          stratum?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentor_judge_calibration_stratum_calibration_id_fkey"
            columns: ["calibration_id"]
            isOneToOne: false
            referencedRelation: "mentor_judge_calibration"
            referencedColumns: ["id"]
          },
        ]
      }
      mentor_quality_flag: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          dedup_key: string
          evidence: Json
          id: string
          kind: string
          last_seen_at: string
          metric_value: number | null
          opened_at: string
          owner_role: string
          requirement: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          scope: string
          seen_count: number
          severity: string
          signal_id: string
          status: string
          threshold: number | null
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          dedup_key: string
          evidence?: Json
          id?: string
          kind: string
          last_seen_at?: string
          metric_value?: number | null
          opened_at?: string
          owner_role: string
          requirement: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          scope: string
          seen_count?: number
          severity: string
          signal_id: string
          status?: string
          threshold?: number | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          dedup_key?: string
          evidence?: Json
          id?: string
          kind?: string
          last_seen_at?: string
          metric_value?: number | null
          opened_at?: string
          owner_role?: string
          requirement?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          scope?: string
          seen_count?: number
          severity?: string
          signal_id?: string
          status?: string
          threshold?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mentor_quality_flag_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "mentor_quality_flag_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      mentor_quality_owner: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          owner_role: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          owner_role: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          owner_role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentor_quality_owner_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "mentor_quality_owner_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      mentor_quality_review: {
        Row: {
          id: string
          note: string | null
          open_flags: number
          owner_role: string
          reviewed_at: string
          reviewer_id: string | null
          snapshot_id: string | null
          week_start: string
        }
        Insert: {
          id?: string
          note?: string | null
          open_flags: number
          owner_role: string
          reviewed_at?: string
          reviewer_id?: string | null
          snapshot_id?: string | null
          week_start: string
        }
        Update: {
          id?: string
          note?: string | null
          open_flags?: number
          owner_role?: string
          reviewed_at?: string
          reviewer_id?: string | null
          snapshot_id?: string | null
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentor_quality_review_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "mentor_quality_review_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "mentor_quality_snapshot"
            referencedColumns: ["id"]
          },
        ]
      }
      mentor_quality_snapshot: {
        Row: {
          computed_at: string
          created_at: string
          id: string
          rubric_hash: string
          run_id: string | null
          schema_version: string
          signals: Json
          window_days: number
        }
        Insert: {
          computed_at: string
          created_at?: string
          id?: string
          rubric_hash: string
          run_id?: string | null
          schema_version: string
          signals: Json
          window_days: number
        }
        Update: {
          computed_at?: string
          created_at?: string
          id?: string
          rubric_hash?: string
          run_id?: string | null
          schema_version?: string
          signals?: Json
          window_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "mentor_quality_snapshot_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "tutor_evaluation_run"
            referencedColumns: ["id"]
          },
        ]
      }
      misconception: {
        Row: {
          code: string
          created_at: string
          description: Json
          distractor_patterns: Json
          id: string
          kc_id: string
          remediation_hint: Json
        }
        Insert: {
          code: string
          created_at?: string
          description: Json
          distractor_patterns?: Json
          id?: string
          kc_id: string
          remediation_hint: Json
        }
        Update: {
          code?: string
          created_at?: string
          description?: Json
          distractor_patterns?: Json
          id?: string
          kc_id?: string
          remediation_hint?: Json
        }
        Relationships: [
          {
            foreignKeyName: "misconception_kc_id_fkey"
            columns: ["kc_id"]
            isOneToOne: false
            referencedRelation: "kc"
            referencedColumns: ["id"]
          },
        ]
      }
      money_bridge_progress: {
        Row: {
          done_at: string
          holder_user_id: string
          milestone: string
          step: number
        }
        Insert: {
          done_at?: string
          holder_user_id: string
          milestone: string
          step: number
        }
        Update: {
          done_at?: string
          holder_user_id?: string
          milestone?: string
          step?: number
        }
        Relationships: [
          {
            foreignKeyName: "money_bridge_progress_holder_user_id_fkey"
            columns: ["holder_user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      onboarding_responses: {
        Row: {
          account_offer_choice: string
          completed_at: string
          discovery_channel: string | null
          user_id: string
        }
        Insert: {
          account_offer_choice: string
          completed_at?: string
          discovery_channel?: string | null
          user_id: string
        }
        Update: {
          account_offer_choice?: string
          completed_at?: string
          discovery_channel?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_responses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      parent_coaching_deliveries: {
        Row: {
          delivered_at: string
          dismissed_at: string | null
          id: string
          opened_at: string | null
          period: string
          tip_id: string
          tutor_user_id: string
        }
        Insert: {
          delivered_at?: string
          dismissed_at?: string | null
          id?: string
          opened_at?: string | null
          period: string
          tip_id: string
          tutor_user_id: string
        }
        Update: {
          delivered_at?: string
          dismissed_at?: string | null
          id?: string
          opened_at?: string | null
          period?: string
          tip_id?: string
          tutor_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_coaching_deliveries_tutor_user_id_fkey"
            columns: ["tutor_user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      parent_verifications: {
        Row: {
          birth_date: string | null
          checks: Json
          created_at: string
          given_names: string | null
          id: string
          method: string
          status: string
          surnames: string | null
          user_id: string
          verified_at: string
        }
        Insert: {
          birth_date?: string | null
          checks?: Json
          created_at?: string
          given_names?: string | null
          id?: string
          method?: string
          status?: string
          surnames?: string | null
          user_id: string
          verified_at?: string
        }
        Update: {
          birth_date?: string | null
          checks?: Json
          created_at?: string
          given_names?: string | null
          id?: string
          method?: string
          status?: string
          surnames?: string | null
          user_id?: string
          verified_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_verifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      pending_credits: {
        Row: {
          allocated: boolean
          amount: number
          created_at: string
          id: string
          kid_user_id: string
          source: string
          source_ref: string | null
        }
        Insert: {
          allocated?: boolean
          amount: number
          created_at?: string
          id?: string
          kid_user_id: string
          source: string
          source_ref?: string | null
        }
        Update: {
          allocated?: boolean
          amount?: number
          created_at?: string
          id?: string
          kid_user_id?: string
          source?: string
          source_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pending_credits_kid_user_id_fkey"
            columns: ["kid_user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      personal_rewards: {
        Row: {
          archived_at: string | null
          cost: number
          created_at: string
          holder_user_id: string
          id: string
          status: string
          title: string
        }
        Insert: {
          archived_at?: string | null
          cost: number
          created_at?: string
          holder_user_id: string
          id?: string
          status?: string
          title: string
        }
        Update: {
          archived_at?: string | null
          cost?: number
          created_at?: string
          holder_user_id?: string
          id?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "personal_rewards_holder_user_id_fkey"
            columns: ["holder_user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      picture_assets: {
        Row: {
          bytes: number | null
          created_at: string
          file_id: string
          id: string
          model: string
          prompt: string
          prompt_hash: string
          url: string
        }
        Insert: {
          bytes?: number | null
          created_at?: string
          file_id: string
          id?: string
          model: string
          prompt: string
          prompt_hash: string
          url: string
        }
        Update: {
          bytes?: number | null
          created_at?: string
          file_id?: string
          id?: string
          model?: string
          prompt?: string
          prompt_hash?: string
          url?: string
        }
        Relationships: []
      }
      placement_credits: {
        Row: {
          course_id: string
          created_at: string
          lesson_id: string
          topic_id: string
          user_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          lesson_id: string
          topic_id: string
          user_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          lesson_id?: string
          topic_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "placement_credits_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placement_credits_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "dataintel_lessons_sync"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "placement_credits_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "dataintel_lessons_sync"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "placement_credits_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placement_credits_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placement_credits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      practice_difficulty_band_log: {
        Row: {
          changed_at: string
          changed_by: string
          id: number
          lesson_id: string | null
          next: Json
          previous: Json | null
          rationale: string
          review_id: string | null
        }
        Insert: {
          changed_at?: string
          changed_by: string
          id?: never
          lesson_id?: string | null
          next: Json
          previous?: Json | null
          rationale: string
          review_id?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string
          id?: never
          lesson_id?: string | null
          next?: Json
          previous?: Json | null
          rationale?: string
          review_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "practice_difficulty_band_log_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "dataintel_lessons_sync"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "practice_difficulty_band_log_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_difficulty_bands: {
        Row: {
          id: string
          lesson_id: string | null
          lower_pct: number
          min_sample: number
          rationale: string
          set_at: string
          set_by: string | null
          upper_pct: number
        }
        Insert: {
          id?: string
          lesson_id?: string | null
          lower_pct: number
          min_sample: number
          rationale: string
          set_at?: string
          set_by?: string | null
          upper_pct: number
        }
        Update: {
          id?: string
          lesson_id?: string | null
          lower_pct?: number
          min_sample?: number
          rationale?: string
          set_at?: string
          set_by?: string | null
          upper_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "practice_difficulty_bands_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: true
            referencedRelation: "dataintel_lessons_sync"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "practice_difficulty_bands_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: true
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_difficulty_reviews: {
        Row: {
          decision: string | null
          decision_note: string | null
          direction: string
          evidence: Json
          id: string
          lesson_id: string
          opened_at: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          window_days: number
        }
        Insert: {
          decision?: string | null
          decision_note?: string | null
          direction: string
          evidence: Json
          id?: string
          lesson_id: string
          opened_at?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          window_days: number
        }
        Update: {
          decision?: string | null
          decision_note?: string | null
          direction?: string
          evidence?: Json
          id?: string
          lesson_id?: string
          opened_at?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          window_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "practice_difficulty_reviews_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "dataintel_lessons_sync"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "practice_difficulty_reviews_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_safety_reviews: {
        Row: {
          display_name_flags: string[]
          reviewed_at: string
          rules_version: number
          user_id: string
          username_flags: string[]
        }
        Insert: {
          display_name_flags?: string[]
          reviewed_at?: string
          rules_version: number
          user_id: string
          username_flags?: string[]
        }
        Update: {
          display_name_flags?: string[]
          reviewed_at?: string
          rules_version?: number
          user_id?: string
          username_flags?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "profile_safety_reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      profiles: {
        Row: {
          birth_date: string | null
          cover: Json
          created_at: string
          display_name: string
          locale: string
          suspended_at: string | null
          theme: string
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          birth_date?: string | null
          cover?: Json
          created_at?: string
          display_name?: string
          locale?: string
          suspended_at?: string | null
          theme?: string
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          birth_date?: string | null
          cover?: Json
          created_at?: string
          display_name?: string
          locale?: string
          suspended_at?: string | null
          theme?: string
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      redemption_catalog: {
        Row: {
          active: boolean
          cost: number
          created_at: string
          id: string
          parent_user_id: string
          title: string
        }
        Insert: {
          active?: boolean
          cost: number
          created_at?: string
          id?: string
          parent_user_id: string
          title: string
        }
        Update: {
          active?: boolean
          cost?: number
          created_at?: string
          id?: string
          parent_user_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "redemption_catalog_parent_user_id_fkey"
            columns: ["parent_user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      redemptions: {
        Row: {
          catalog_id: string
          child_note: string | null
          child_reason_kind: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_id: string | null
          fulfilled_at: string | null
          fulfilled_by: string | null
          id: string
          kid_user_id: string
          status: string
        }
        Insert: {
          catalog_id: string
          child_note?: string | null
          child_reason_kind?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_id?: string | null
          fulfilled_at?: string | null
          fulfilled_by?: string | null
          id?: string
          kid_user_id: string
          status?: string
        }
        Update: {
          catalog_id?: string
          child_note?: string | null
          child_reason_kind?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_id?: string | null
          fulfilled_at?: string | null
          fulfilled_by?: string | null
          id?: string
          kid_user_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "redemptions_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "redemption_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redemptions_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "redemptions_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "family_decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redemptions_fulfilled_by_fkey"
            columns: ["fulfilled_by"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "redemptions_kid_user_id_fkey"
            columns: ["kid_user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      release_audit_results: {
        Row: {
          audit_kind: string
          finding_count: number
          id: string
          note: string | null
          recorded_at: string
          release_id: string
          result: string
          reviewer_id: string | null
        }
        Insert: {
          audit_kind: string
          finding_count: number
          id?: string
          note?: string | null
          recorded_at?: string
          release_id: string
          result: string
          reviewer_id?: string | null
        }
        Update: {
          audit_kind?: string
          finding_count?: number
          id?: string
          note?: string | null
          recorded_at?: string
          release_id?: string
          result?: string
          reviewer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "release_audit_results_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      sagas: {
        Row: {
          adventure_id: string
          created_at: string
          description: Json
          icon: string
          id: string
          position: number
          slug: string
          status: string
          title: Json
        }
        Insert: {
          adventure_id: string
          created_at?: string
          description?: Json
          icon?: string
          id?: string
          position: number
          slug: string
          status?: string
          title?: Json
        }
        Update: {
          adventure_id?: string
          created_at?: string
          description?: Json
          icon?: string
          id?: string
          position?: number
          slug?: string
          status?: string
          title?: Json
        }
        Relationships: [
          {
            foreignKeyName: "sagas_adventure_id_fkey"
            columns: ["adventure_id"]
            isOneToOne: false
            referencedRelation: "adventures"
            referencedColumns: ["id"]
          },
        ]
      }
      savings_bonus_explanations: {
        Row: {
          attempts: number
          completed_at: string | null
          first_shown_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          first_shown_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          first_shown_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "savings_bonus_explanations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      savings_bonus_rules: {
        Row: {
          active: boolean
          created_at: string
          kid_user_id: string
          next_run_at: string
          parent_user_id: string | null
          rate_bp: number
          reframed_from_rate_bp: number | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          kid_user_id: string
          next_run_at: string
          parent_user_id?: string | null
          rate_bp: number
          reframed_from_rate_bp?: number | null
        }
        Update: {
          active?: boolean
          created_at?: string
          kid_user_id?: string
          next_run_at?: string
          parent_user_id?: string | null
          rate_bp?: number
          reframed_from_rate_bp?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "savings_bonus_rules_kid_user_id_fkey"
            columns: ["kid_user_id"]
            isOneToOne: true
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "savings_bonus_rules_parent_user_id_fkey"
            columns: ["parent_user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      savings_goals: {
        Row: {
          created_at: string
          follows_goal_id: string | null
          icon: string
          id: string
          kid_user_id: string
          reached_at: string | null
          status: string
          target: number
          title: string
        }
        Insert: {
          created_at?: string
          follows_goal_id?: string | null
          icon?: string
          id?: string
          kid_user_id: string
          reached_at?: string | null
          status?: string
          target: number
          title: string
        }
        Update: {
          created_at?: string
          follows_goal_id?: string | null
          icon?: string
          id?: string
          kid_user_id?: string
          reached_at?: string | null
          status?: string
          target?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "savings_goals_follows_goal_id_fkey"
            columns: ["follows_goal_id"]
            isOneToOne: false
            referencedRelation: "savings_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "savings_goals_kid_user_id_fkey"
            columns: ["kid_user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      schema_migrations: {
        Row: {
          applied_at: string
          checksum: string
          filename: string
        }
        Insert: {
          applied_at?: string
          checksum: string
          filename: string
        }
        Update: {
          applied_at?: string
          checksum?: string
          filename?: string
        }
        Relationships: []
      }
      share_destinations: {
        Row: {
          archived_at: string | null
          chosen_by: string
          created_at: string
          created_by: string | null
          holder_user_id: string
          id: string
          kind: string
          status: string
          title: string
        }
        Insert: {
          archived_at?: string | null
          chosen_by: string
          created_at?: string
          created_by?: string | null
          holder_user_id: string
          id?: string
          kind: string
          status?: string
          title: string
        }
        Update: {
          archived_at?: string | null
          chosen_by?: string
          created_at?: string
          created_by?: string | null
          holder_user_id?: string
          id?: string
          kind?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "share_destinations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "share_destinations_holder_user_id_fkey"
            columns: ["holder_user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      share_gifts: {
        Row: {
          amount: number
          destination_id: string
          holder_user_id: string
          id: string
          note: string | null
          pledged_at: string
          settled_at: string | null
          settled_by: string | null
          status: string
        }
        Insert: {
          amount: number
          destination_id: string
          holder_user_id: string
          id?: string
          note?: string | null
          pledged_at?: string
          settled_at?: string | null
          settled_by?: string | null
          status?: string
        }
        Update: {
          amount?: number
          destination_id?: string
          holder_user_id?: string
          id?: string
          note?: string | null
          pledged_at?: string
          settled_at?: string | null
          settled_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "share_gifts_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "share_destinations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "share_gifts_holder_user_id_fkey"
            columns: ["holder_user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "share_gifts_settled_by_fkey"
            columns: ["settled_by"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      social_connection_requests: {
        Row: {
          decided_at: string | null
          decided_by: string | null
          id: string
          kid_user_id: string
          requested_at: string
          requester_id: string
          status: string
        }
        Insert: {
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          kid_user_id: string
          requested_at?: string
          requester_id: string
          status?: string
        }
        Update: {
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          kid_user_id?: string
          requested_at?: string
          requester_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_connection_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "social_connection_requests_kid_user_id_fkey"
            columns: ["kid_user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "social_connection_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      social_consent_requests: {
        Row: {
          decided_at: string | null
          id: string
          requested_at: string
          requester_id: string
          status: string
          subject_id: string
        }
        Insert: {
          decided_at?: string | null
          id?: string
          requested_at?: string
          requester_id: string
          status?: string
          subject_id: string
        }
        Update: {
          decided_at?: string | null
          id?: string
          requested_at?: string
          requester_id?: string
          status?: string
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_consent_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "social_consent_requests_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      social_protection_counters: {
        Row: {
          day: string
          event: string
          n: number
          related: boolean
          subject_tier: string
          viewer_tier: string
        }
        Insert: {
          day: string
          event: string
          n?: number
          related: boolean
          subject_tier: string
          viewer_tier: string
        }
        Update: {
          day?: string
          event?: string
          n?: number
          related?: boolean
          subject_tier?: string
          viewer_tier?: string
        }
        Relationships: []
      }
      social_reports: {
        Row: {
          category: string
          created_at: string
          id: string
          note: string | null
          reporter_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          subject_id: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          note?: string | null
          reporter_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          subject_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          note?: string | null
          reporter_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "social_reports_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "social_reports_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      social_review_cases: {
        Row: {
          first_seen_at: string
          last_seen_at: string
          origin: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          subject_id: string
        }
        Insert: {
          first_seen_at?: string
          last_seen_at?: string
          origin: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          subject_id: string
        }
        Update: {
          first_seen_at?: string
          last_seen_at?: string
          origin?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_review_cases_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "social_review_cases_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: true
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      social_safety_notices: {
        Row: {
          created_at: string
          guardian_id: string
          id: string
          kid_user_id: string
          kind: string
          read_at: string | null
          report_id: string | null
          subject_id: string
        }
        Insert: {
          created_at?: string
          guardian_id: string
          id?: string
          kid_user_id: string
          kind: string
          read_at?: string | null
          report_id?: string | null
          subject_id: string
        }
        Update: {
          created_at?: string
          guardian_id?: string
          id?: string
          kid_user_id?: string
          kind?: string
          read_at?: string | null
          report_id?: string | null
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_safety_notices_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "social_safety_notices_kid_user_id_fkey"
            columns: ["kid_user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "social_safety_notices_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "social_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_safety_notices_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      speech_assets: {
        Row: {
          bytes: number | null
          created_at: string
          duration_ms: number | null
          file_id: string
          id: string
          language_type: string
          model: string
          mp3_bitrate_kbps: number
          speech_hash: string
          text: string
          url: string
          voice: string
        }
        Insert: {
          bytes?: number | null
          created_at?: string
          duration_ms?: number | null
          file_id: string
          id?: string
          language_type: string
          model: string
          mp3_bitrate_kbps: number
          speech_hash: string
          text: string
          url: string
          voice: string
        }
        Update: {
          bytes?: number | null
          created_at?: string
          duration_ms?: number | null
          file_id?: string
          id?: string
          language_type?: string
          model?: string
          mp3_bitrate_kbps?: number
          speech_hash?: string
          text?: string
          url?: string
          voice?: string
        }
        Relationships: []
      }
      spend_limits: {
        Row: {
          active: boolean
          cap: number
          created_at: string
          kid_user_id: string
          parent_user_id: string | null
          period: string
        }
        Insert: {
          active?: boolean
          cap: number
          created_at?: string
          kid_user_id: string
          parent_user_id?: string | null
          period: string
        }
        Update: {
          active?: boolean
          cap?: number
          created_at?: string
          kid_user_id?: string
          parent_user_id?: string | null
          period?: string
        }
        Relationships: [
          {
            foreignKeyName: "spend_limits_kid_user_id_fkey"
            columns: ["kid_user_id"]
            isOneToOne: true
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "spend_limits_parent_user_id_fkey"
            columns: ["parent_user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      staff_access_reviews: {
        Row: {
          grant_key: string
          id: string
          kind: string
          note: string | null
          outcome: string
          reviewed_at: string
          reviewed_by: string
          subject_user_id: string
        }
        Insert: {
          grant_key: string
          id?: string
          kind: string
          note?: string | null
          outcome: string
          reviewed_at?: string
          reviewed_by: string
          subject_user_id: string
        }
        Update: {
          grant_key?: string
          id?: string
          kind?: string
          note?: string | null
          outcome?: string
          reviewed_at?: string
          reviewed_by?: string
          subject_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_access_reviews_subject_user_id_fkey"
            columns: ["subject_user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      staff_insight_checks: {
        Row: {
          checked_at: string
          id: number
          insight: string
          outcome: string
          source: string
        }
        Insert: {
          checked_at?: string
          id?: never
          insight: string
          outcome: string
          source: string
        }
        Update: {
          checked_at?: string
          id?: never
          insight?: string
          outcome?: string
          source?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          allocated: boolean
          assigned_by: string
          assigned_to: string
          cancel_reason: string | null
          child_note: string | null
          completed_on: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_id: string | null
          due_at: string | null
          evidence_bucket: string | null
          evidence_ext: string | null
          evidence_hash: string | null
          evidence_uploaded_at: string | null
          id: string
          kind: string
          recurrence: string
          requires_evidence: boolean
          reward_coins: number
          status: string
          title: string
        }
        Insert: {
          allocated?: boolean
          assigned_by: string
          assigned_to: string
          cancel_reason?: string | null
          child_note?: string | null
          completed_on?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_id?: string | null
          due_at?: string | null
          evidence_bucket?: string | null
          evidence_ext?: string | null
          evidence_hash?: string | null
          evidence_uploaded_at?: string | null
          id?: string
          kind?: string
          recurrence?: string
          requires_evidence?: boolean
          reward_coins: number
          status?: string
          title: string
        }
        Update: {
          allocated?: boolean
          assigned_by?: string
          assigned_to?: string
          cancel_reason?: string | null
          child_note?: string | null
          completed_on?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_id?: string | null
          due_at?: string | null
          evidence_bucket?: string | null
          evidence_ext?: string | null
          evidence_hash?: string | null
          evidence_uploaded_at?: string | null
          id?: string
          kind?: string
          recurrence?: string
          requires_evidence?: boolean
          reward_coins?: number
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "tasks_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "tasks_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "family_decisions"
            referencedColumns: ["id"]
          },
        ]
      }
      teen_analytics_preferences: {
        Row: {
          disclosure_version: number
          enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          disclosure_version: number
          enabled: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          disclosure_version?: number
          enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teen_analytics_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      teen_profile_discoverability: {
        Row: {
          discoverable: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          discoverable: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          discoverable?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teen_profile_discoverability_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      topic_knowledge_components: {
        Row: {
          created_at: string
          is_primary: boolean
          kc_id: string
          map_version: number
          role: string
          topic_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          is_primary?: boolean
          kc_id: string
          map_version: number
          role: string
          topic_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          is_primary?: boolean
          kc_id?: string
          map_version?: number
          role?: string
          topic_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "topic_knowledge_components_kc_id_fkey"
            columns: ["kc_id"]
            isOneToOne: false
            referencedRelation: "kc"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topic_knowledge_components_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      topics: {
        Row: {
          concept_md: string
          created_at: string
          id: string
          key_vocabulary: Json
          kind: string
          learning_objective: Json
          placement_probe: Json | null
          position: number
          prerequisites: Json
          prior_knowledge: string
          review_of: Json
          saga_id: string
          slug: string
          status: string
          title: Json
        }
        Insert: {
          concept_md?: string
          created_at?: string
          id?: string
          key_vocabulary?: Json
          kind?: string
          learning_objective?: Json
          placement_probe?: Json | null
          position: number
          prerequisites?: Json
          prior_knowledge?: string
          review_of?: Json
          saga_id: string
          slug: string
          status?: string
          title?: Json
        }
        Update: {
          concept_md?: string
          created_at?: string
          id?: string
          key_vocabulary?: Json
          kind?: string
          learning_objective?: Json
          placement_probe?: Json | null
          position?: number
          prerequisites?: Json
          prior_knowledge?: string
          review_of?: Json
          saga_id?: string
          slug?: string
          status?: string
          title?: Json
        }
        Relationships: [
          {
            foreignKeyName: "topics_saga_id_fkey"
            columns: ["saga_id"]
            isOneToOne: false
            referencedRelation: "sagas"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_alliance_renegotiation: {
        Row: {
          at_turn: number
          character: string
          created_at: string
          id: string
          improved: boolean | null
          mode: string
          observation: number
          outcome: string
          session_id: string | null
        }
        Insert: {
          at_turn: number
          character: string
          created_at?: string
          id?: string
          improved?: boolean | null
          mode: string
          observation: number
          outcome: string
          session_id?: string | null
        }
        Update: {
          at_turn?: number
          character?: string
          created_at?: string
          id?: string
          improved?: boolean | null
          mode?: string
          observation?: number
          outcome?: string
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tutor_alliance_renegotiation_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "tutor_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_content_judge_calibration: {
        Row: {
          agreement_sensitive: number
          agreement_standard: number
          created_at: string
          id: string
          inter_rater_agreement: number
          items_sensitive: number
          items_standard: number
          judge_model: string
          judge_prompt_hash: string
          min_items_per_category: number
          note: string
          raters: number
          recorded_by: string
          seed_set_hash: string
          seed_set_version: string
          threshold_agreement: number
          threshold_inter_rater: number
          verdict: string
        }
        Insert: {
          agreement_sensitive: number
          agreement_standard: number
          created_at?: string
          id?: string
          inter_rater_agreement: number
          items_sensitive: number
          items_standard: number
          judge_model: string
          judge_prompt_hash: string
          min_items_per_category: number
          note: string
          raters: number
          recorded_by: string
          seed_set_hash: string
          seed_set_version: string
          threshold_agreement: number
          threshold_inter_rater: number
          verdict: string
        }
        Update: {
          agreement_sensitive?: number
          agreement_standard?: number
          created_at?: string
          id?: string
          inter_rater_agreement?: number
          items_sensitive?: number
          items_standard?: number
          judge_model?: string
          judge_prompt_hash?: string
          min_items_per_category?: number
          note?: string
          raters?: number
          recorded_by?: string
          seed_set_hash?: string
          seed_set_version?: string
          threshold_agreement?: number
          threshold_inter_rater?: number
          verdict?: string
        }
        Relationships: []
      }
      tutor_content_ladder_events: {
        Row: {
          created_at: string
          id: string
          kc_id: string | null
          locale: string
          outcome: string
          reason: string | null
          risk_category: string | null
          route: string
          skill_key: string | null
          tier: number
        }
        Insert: {
          created_at?: string
          id?: string
          kc_id?: string | null
          locale: string
          outcome: string
          reason?: string | null
          risk_category?: string | null
          route: string
          skill_key?: string | null
          tier: number
        }
        Update: {
          created_at?: string
          id?: string
          kc_id?: string | null
          locale?: string
          outcome?: string
          reason?: string | null
          risk_category?: string | null
          route?: string
          skill_key?: string | null
          tier?: number
        }
        Relationships: []
      }
      tutor_dialogue_calibration: {
        Row: {
          assignment: string
          band: string
          budget_caught: number | null
          budget_delivered: number | null
          character: string
          controlling_caught: number
          controlling_delivered: number
          created_at: string
          experiment_id: string | null
          hint_requests: number
          id: string
          ladder_rungs: number
          pacing_offers: number
          self_naming_caught: number | null
          self_naming_delivered: number | null
          session_id: string | null
          tell_delivered: number | null
          tell_requests: number
          tell_withdrawn: number | null
          unilateral_style_changes: number
          variant: string
        }
        Insert: {
          assignment: string
          band: string
          budget_caught?: number | null
          budget_delivered?: number | null
          character: string
          controlling_caught: number
          controlling_delivered: number
          created_at?: string
          experiment_id?: string | null
          hint_requests: number
          id?: string
          ladder_rungs: number
          pacing_offers: number
          self_naming_caught?: number | null
          self_naming_delivered?: number | null
          session_id?: string | null
          tell_delivered?: number | null
          tell_requests: number
          tell_withdrawn?: number | null
          unilateral_style_changes: number
          variant: string
        }
        Update: {
          assignment?: string
          band?: string
          budget_caught?: number | null
          budget_delivered?: number | null
          character?: string
          controlling_caught?: number
          controlling_delivered?: number
          created_at?: string
          experiment_id?: string | null
          hint_requests?: number
          id?: string
          ladder_rungs?: number
          pacing_offers?: number
          self_naming_caught?: number | null
          self_naming_delivered?: number | null
          session_id?: string | null
          tell_delivered?: number | null
          tell_requests?: number
          tell_withdrawn?: number | null
          unilateral_style_changes?: number
          variant?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_dialogue_calibration_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "tutor_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_evaluation_run: {
        Row: {
          backlog_before: number | null
          created_at: string
          failed: number
          finished_at: string | null
          flags_opened: number
          flags_refreshed: number
          id: string
          rubric_hash: string
          scored: number
          signals_breached: number
          signals_unavailable: number
          started_at: string
          status: string
          trigger: string
        }
        Insert: {
          backlog_before?: number | null
          created_at?: string
          failed: number
          finished_at?: string | null
          flags_opened?: number
          flags_refreshed?: number
          id?: string
          rubric_hash: string
          scored: number
          signals_breached?: number
          signals_unavailable?: number
          started_at: string
          status: string
          trigger: string
        }
        Update: {
          backlog_before?: number | null
          created_at?: string
          failed?: number
          finished_at?: string | null
          flags_opened?: number
          flags_refreshed?: number
          id?: string
          rubric_hash?: string
          scored?: number
          signals_breached?: number
          signals_unavailable?: number
          started_at?: string
          status?: string
          trigger?: string
        }
        Relationships: []
      }
      tutor_live_content_log: {
        Row: {
          calibration_id: string | null
          created_at: string
          elevated: boolean
          id: string
          judge_model: string
          judge_prompt_hash: string
          locale: string
          review_issue: string | null
          review_verdict: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          risk_category: string
          risk_signals: string[]
          sample_rate: number
          sampled: boolean
          segment_id: string | null
          segment_type: string
          tier: number
        }
        Insert: {
          calibration_id?: string | null
          created_at?: string
          elevated: boolean
          id?: string
          judge_model: string
          judge_prompt_hash: string
          locale: string
          review_issue?: string | null
          review_verdict?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk_category: string
          risk_signals?: string[]
          sample_rate: number
          sampled: boolean
          segment_id?: string | null
          segment_type: string
          tier: number
        }
        Update: {
          calibration_id?: string | null
          created_at?: string
          elevated?: boolean
          id?: string
          judge_model?: string
          judge_prompt_hash?: string
          locale?: string
          review_issue?: string | null
          review_verdict?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk_category?: string
          risk_signals?: string[]
          sample_rate?: number
          sampled?: boolean
          segment_id?: string | null
          segment_type?: string
          tier?: number
        }
        Relationships: [
          {
            foreignKeyName: "tutor_live_content_log_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "tutor_live_content_log_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "tutor_segments"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_live_sampling_credit: {
        Row: {
          credit: number
          risk_category: string
          updated_at: string
        }
        Insert: {
          credit?: number
          risk_category: string
          updated_at?: string
        }
        Update: {
          credit?: number
          risk_category?: string
          updated_at?: string
        }
        Relationships: []
      }
      tutor_notebook_entries: {
        Row: {
          id: string
          kept_at: string
          session_id: string | null
          turn_seq: number | null
          user_id: string
          whiteboard: Json
        }
        Insert: {
          id?: string
          kept_at?: string
          session_id?: string | null
          turn_seq?: number | null
          user_id: string
          whiteboard: Json
        }
        Update: {
          id?: string
          kept_at?: string
          session_id?: string | null
          turn_seq?: number | null
          user_id?: string
          whiteboard?: Json
        }
        Relationships: [
          {
            foreignKeyName: "tutor_notebook_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      tutor_packs: {
        Row: {
          content_hash: string | null
          created_at: string
          demand_pattern: string | null
          id: string
          kc_key: string | null
          locale: string
          pack: Json
          pack_version: number
          released_at: string | null
          released_by: string | null
          risk_category: string
          skill_key: string
          source: string
          status: string
          tier: number
          updated_at: string
          validated_at: string | null
        }
        Insert: {
          content_hash?: string | null
          created_at?: string
          demand_pattern?: string | null
          id?: string
          kc_key?: string | null
          locale: string
          pack: Json
          pack_version?: number
          released_at?: string | null
          released_by?: string | null
          risk_category?: string
          skill_key: string
          source?: string
          status?: string
          tier: number
          updated_at?: string
          validated_at?: string | null
        }
        Update: {
          content_hash?: string | null
          created_at?: string
          demand_pattern?: string | null
          id?: string
          kc_key?: string | null
          locale?: string
          pack?: Json
          pack_version?: number
          released_at?: string | null
          released_by?: string | null
          risk_category?: string
          skill_key?: string
          source?: string
          status?: string
          tier?: number
          updated_at?: string
          validated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tutor_packs_released_by_fkey"
            columns: ["released_by"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      tutor_placement_safety_flags: {
        Row: {
          category: string
          course_id: string | null
          created_at: string
          id: string
          severity: string
          user_id: string
        }
        Insert: {
          category: string
          course_id?: string | null
          created_at?: string
          id?: string
          severity: string
          user_id: string
        }
        Update: {
          category?: string
          course_id?: string | null
          created_at?: string
          id?: string
          severity?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_placement_safety_flags_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_placement_safety_flags_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "dataintel_lessons_sync"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "tutor_placement_safety_flags_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      tutor_plans: {
        Row: {
          content: Json
          session_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content: Json
          session_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: Json
          session_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_plans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      tutor_preferences: {
        Row: {
          adaptations: string[]
          backdrop: string
          character: string
          companion: string | null
          diorama: string
          nickname: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          adaptations?: string[]
          backdrop?: string
          character?: string
          companion?: string | null
          diorama?: string
          nickname?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          adaptations?: string[]
          backdrop?: string
          character?: string
          companion?: string | null
          diorama?: string
          nickname?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      tutor_review_routing: {
        Row: {
          at_turn: number
          budget_state: string
          character: string
          created_at: string
          failures: number
          id: string
          kc_id: string
          mode: string
          ms_until_wrap: number
          observation: number
          outcome: string
          p_after: number
          p_before: number
          planned: boolean
          queued_before: number
          reason: string
          reexposures_before: number
          rule_version: string
          session_id: string | null
          source: string
          successes: number
          tier: string
          turns_remaining: number
        }
        Insert: {
          at_turn: number
          budget_state: string
          character: string
          created_at?: string
          failures: number
          id?: string
          kc_id: string
          mode: string
          ms_until_wrap: number
          observation: number
          outcome: string
          p_after: number
          p_before: number
          planned: boolean
          queued_before: number
          reason: string
          reexposures_before: number
          rule_version: string
          session_id?: string | null
          source: string
          successes: number
          tier: string
          turns_remaining: number
        }
        Update: {
          at_turn?: number
          budget_state?: string
          character?: string
          created_at?: string
          failures?: number
          id?: string
          kc_id?: string
          mode?: string
          ms_until_wrap?: number
          observation?: number
          outcome?: string
          p_after?: number
          p_before?: number
          planned?: boolean
          queued_before?: number
          reason?: string
          reexposures_before?: number
          rule_version?: string
          session_id?: string | null
          source?: string
          successes?: number
          tier?: string
          turns_remaining?: number
        }
        Relationships: [
          {
            foreignKeyName: "tutor_review_routing_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "tutor_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_safety_flags: {
        Row: {
          category: string
          created_at: string
          handled: string
          id: string
          session_id: string
          severity: string
          turn_seq: number | null
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          handled: string
          id?: string
          session_id: string
          severity: string
          turn_seq?: number | null
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          handled?: string
          id?: string
          session_id?: string
          severity?: string
          turn_seq?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_safety_flags_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "tutor_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_safety_flags_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      tutor_segments: {
        Row: {
          answer: Json | null
          attempts: number
          created_at: string
          id: string
          key_verified: boolean
          lesson_id: string | null
          origin: string
          payload: Json
          provenance: Json
          review_status: string | null
          score: number | null
          segment_type: string
          seq: number
          session_id: string
          voice_checked_at: string | null
          xp_awarded: number
        }
        Insert: {
          answer?: Json | null
          attempts?: number
          created_at?: string
          id?: string
          key_verified?: boolean
          lesson_id?: string | null
          origin: string
          payload: Json
          provenance?: Json
          review_status?: string | null
          score?: number | null
          segment_type: string
          seq: number
          session_id: string
          voice_checked_at?: string | null
          xp_awarded?: number
        }
        Update: {
          answer?: Json | null
          attempts?: number
          created_at?: string
          id?: string
          key_verified?: boolean
          lesson_id?: string | null
          origin?: string
          payload?: Json
          provenance?: Json
          review_status?: string | null
          score?: number | null
          segment_type?: string
          seq?: number
          session_id?: string
          voice_checked_at?: string | null
          xp_awarded?: number
        }
        Relationships: [
          {
            foreignKeyName: "tutor_segments_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "dataintel_lessons_sync"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "tutor_segments_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_segments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "tutor_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_self_explanation_event: {
        Row: {
          character: string
          created_at: string
          family: string
          first_quality: string | null
          followup_quality: string | null
          id: string
          mode: string
          observation: number
          outcome: string
          session_id: string | null
          source: string
          variant: string
        }
        Insert: {
          character: string
          created_at?: string
          family: string
          first_quality?: string | null
          followup_quality?: string | null
          id?: string
          mode: string
          observation: number
          outcome: string
          session_id?: string | null
          source: string
          variant: string
        }
        Update: {
          character?: string
          created_at?: string
          family?: string
          first_quality?: string | null
          followup_quality?: string | null
          id?: string
          mode?: string
          observation?: number
          outcome?: string
          session_id?: string | null
          source?: string
          variant?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_self_explanation_event_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "tutor_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_session_alliance: {
        Row: {
          adaptation_accepts: number
          adaptation_declines: number
          adaptation_offers: number
          bond_generic_turns: number
          bond_proxy: string | null
          bond_proxy_at: string | null
          bond_specific_turns: number
          character: string
          continuity: string | null
          continuity_move: string
          created_at: string
          goal_agreement: string
          goal_settled_at_turn: number | null
          id: string
          learner_turns: number
          mode: string
          self_explanation_mode: string | null
          self_explanation_prompts: number | null
          session_id: string | null
        }
        Insert: {
          adaptation_accepts: number
          adaptation_declines: number
          adaptation_offers: number
          bond_generic_turns: number
          bond_proxy?: string | null
          bond_proxy_at?: string | null
          bond_specific_turns: number
          character: string
          continuity?: string | null
          continuity_move: string
          created_at?: string
          goal_agreement: string
          goal_settled_at_turn?: number | null
          id?: string
          learner_turns: number
          mode: string
          self_explanation_mode?: string | null
          self_explanation_prompts?: number | null
          session_id?: string | null
        }
        Update: {
          adaptation_accepts?: number
          adaptation_declines?: number
          adaptation_offers?: number
          bond_generic_turns?: number
          bond_proxy?: string | null
          bond_proxy_at?: string | null
          bond_specific_turns?: number
          character?: string
          continuity?: string | null
          continuity_move?: string
          created_at?: string
          goal_agreement?: string
          goal_settled_at_turn?: number | null
          id?: string
          learner_turns?: number
          mode?: string
          self_explanation_mode?: string | null
          self_explanation_prompts?: number | null
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tutor_session_alliance_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "tutor_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_session_end_signal: {
        Row: {
          character: string
          confirmed: boolean | null
          created_at: string
          elapsed_ms: number
          id: string
          latency_sd_baseline: number
          latency_sd_window: number
          mode: string
          observation: number
          outcome: string
          remaining_ms: number
          session_id: string | null
          surprise_rate_baseline: number
          surprise_rate_window: number
        }
        Insert: {
          character: string
          confirmed?: boolean | null
          created_at?: string
          elapsed_ms: number
          id?: string
          latency_sd_baseline: number
          latency_sd_window: number
          mode: string
          observation: number
          outcome: string
          remaining_ms: number
          session_id?: string | null
          surprise_rate_baseline: number
          surprise_rate_window: number
        }
        Update: {
          character?: string
          confirmed?: boolean | null
          created_at?: string
          elapsed_ms?: number
          id?: string
          latency_sd_baseline?: number
          latency_sd_window?: number
          mode?: string
          observation?: number
          outcome?: string
          remaining_ms?: number
          session_id?: string | null
          surprise_rate_baseline?: number
          surprise_rate_window?: number
        }
        Relationships: [
          {
            foreignKeyName: "tutor_session_end_signal_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "tutor_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_sessions: {
        Row: {
          canary_arm: string | null
          canary_proposal_id: string | null
          character: string
          close_reason: string | null
          closing_script: string | null
          companion: string | null
          consent_id: string | null
          cost_usd: number
          course_id: string | null
          diorama: string
          end_signal_evaluated: boolean | null
          ended_at: string | null
          evaluation_rubric_hash: string | null
          id: string
          intent: string
          locale: string
          opening: string | null
          purge_after: string
          segment_count: number
          skill_key: string | null
          started_at: string
          summary: Json | null
          telemetry_action_turns: number | null
          telemetry_evaluated_turns: number | null
          telemetry_mode: string | null
          tier: number
          topic_id: string | null
          turn_count: number
          user_id: string
          voice_used: boolean
          xp_awarded: number
        }
        Insert: {
          canary_arm?: string | null
          canary_proposal_id?: string | null
          character: string
          close_reason?: string | null
          closing_script?: string | null
          companion?: string | null
          consent_id?: string | null
          cost_usd?: number
          course_id?: string | null
          diorama: string
          end_signal_evaluated?: boolean | null
          ended_at?: string | null
          evaluation_rubric_hash?: string | null
          id?: string
          intent: string
          locale: string
          opening?: string | null
          purge_after?: string
          segment_count?: number
          skill_key?: string | null
          started_at?: string
          summary?: Json | null
          telemetry_action_turns?: number | null
          telemetry_evaluated_turns?: number | null
          telemetry_mode?: string | null
          tier: number
          topic_id?: string | null
          turn_count?: number
          user_id: string
          voice_used?: boolean
          xp_awarded?: number
        }
        Update: {
          canary_arm?: string | null
          canary_proposal_id?: string | null
          character?: string
          close_reason?: string | null
          closing_script?: string | null
          companion?: string | null
          consent_id?: string | null
          cost_usd?: number
          course_id?: string | null
          diorama?: string
          end_signal_evaluated?: boolean | null
          ended_at?: string | null
          evaluation_rubric_hash?: string | null
          id?: string
          intent?: string
          locale?: string
          opening?: string | null
          purge_after?: string
          segment_count?: number
          skill_key?: string | null
          started_at?: string
          summary?: Json | null
          telemetry_action_turns?: number | null
          telemetry_evaluated_turns?: number | null
          telemetry_mode?: string | null
          tier?: number
          topic_id?: string | null
          turn_count?: number
          user_id?: string
          voice_used?: boolean
          xp_awarded?: number
        }
        Relationships: [
          {
            foreignKeyName: "tutor_sessions_consent_id_fkey"
            columns: ["consent_id"]
            isOneToOne: false
            referencedRelation: "tutor_voice_consent"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_sessions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_sessions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "dataintel_lessons_sync"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "tutor_sessions_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      tutor_telemetry_firing: {
        Row: {
          channels: number
          character: string
          created_at: string
          fast_known_miss: number
          hedging: number
          hint_abuse: number
          id: string
          latency_shift: number
          mode: string
          observation: number
          off_topic: number
          outcome: string
          rapid_response: number
          repair_offered: boolean | null
          repeated_answer: number
          session_id: string | null
          verbosity_drop: number
        }
        Insert: {
          channels: number
          character: string
          created_at?: string
          fast_known_miss: number
          hedging: number
          hint_abuse: number
          id?: string
          latency_shift: number
          mode: string
          observation: number
          off_topic: number
          outcome: string
          rapid_response: number
          repair_offered?: boolean | null
          repeated_answer: number
          session_id?: string | null
          verbosity_drop: number
        }
        Update: {
          channels?: number
          character?: string
          created_at?: string
          fast_known_miss?: number
          hedging?: number
          hint_abuse?: number
          id?: string
          latency_shift?: number
          mode?: string
          observation?: number
          off_topic?: number
          outcome?: string
          rapid_response?: number
          repair_offered?: boolean | null
          repeated_answer?: number
          session_id?: string | null
          verbosity_drop?: number
        }
        Relationships: [
          {
            foreignKeyName: "tutor_telemetry_firing_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "tutor_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_trajectory_step: {
        Row: {
          created_at: string
          difficulty: number
          event_kind: string
          evidence_discounted: string | null
          evidence_observations: number | null
          evidence_required: number | null
          evidence_rule: string | null
          id: string
          kc_id: string | null
          kc_mode: string | null
          mastery_revoked: boolean
          misconception_code: string | null
          p_known: number | null
          scaffolding: number
          session_id: string | null
          skill_name: string | null
          strategy: string
          strategy_before: string
          turn_seq: number
          user_id: string
        }
        Insert: {
          created_at?: string
          difficulty: number
          event_kind: string
          evidence_discounted?: string | null
          evidence_observations?: number | null
          evidence_required?: number | null
          evidence_rule?: string | null
          id?: string
          kc_id?: string | null
          kc_mode?: string | null
          mastery_revoked?: boolean
          misconception_code?: string | null
          p_known?: number | null
          scaffolding: number
          session_id?: string | null
          skill_name?: string | null
          strategy: string
          strategy_before: string
          turn_seq: number
          user_id: string
        }
        Update: {
          created_at?: string
          difficulty?: number
          event_kind?: string
          evidence_discounted?: string | null
          evidence_observations?: number | null
          evidence_required?: number | null
          evidence_rule?: string | null
          id?: string
          kc_id?: string | null
          kc_mode?: string | null
          mastery_revoked?: boolean
          misconception_code?: string | null
          p_known?: number | null
          scaffolding?: number
          session_id?: string | null
          skill_name?: string | null
          strategy?: string
          strategy_before?: string
          turn_seq?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_trajectory_step_kc_id_fkey"
            columns: ["kc_id"]
            isOneToOne: false
            referencedRelation: "kc"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_trajectory_step_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "tutor_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_trajectory_step_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      tutor_transcript_score: {
        Row: {
          character: string
          created_at: string
          criterion: string
          denominator: number
          id: string
          locale: string
          numerator: number
          outcome: string
          rubric_hash: string
          rubric_version: string
          scorer: string
          session_ended_at: string
          session_id: string | null
          tier: number
        }
        Insert: {
          character: string
          created_at?: string
          criterion: string
          denominator: number
          id?: string
          locale: string
          numerator: number
          outcome: string
          rubric_hash: string
          rubric_version: string
          scorer: string
          session_ended_at: string
          session_id?: string | null
          tier: number
        }
        Update: {
          character?: string
          created_at?: string
          criterion?: string
          denominator?: number
          id?: string
          locale?: string
          numerator?: number
          outcome?: string
          rubric_hash?: string
          rubric_version?: string
          scorer?: string
          session_ended_at?: string
          session_id?: string | null
          tier?: number
        }
        Relationships: [
          {
            foreignKeyName: "tutor_transcript_score_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "tutor_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_turn_honesty: {
        Row: {
          character: string
          created_at: string
          false_affirmation_caught: boolean
          false_affirmation_delivered: boolean
          hint_level: string | null
          id: string
          praise: string | null
          reveal_key_match: boolean | null
          reveal_phrase: boolean
          reveal_sanctioned: boolean
          reveal_self_answered: boolean
          sequence_kind: string
          session_id: string | null
          turn_seq: number
          verdict_context: string | null
        }
        Insert: {
          character: string
          created_at?: string
          false_affirmation_caught?: boolean
          false_affirmation_delivered?: boolean
          hint_level?: string | null
          id?: string
          praise?: string | null
          reveal_key_match?: boolean | null
          reveal_phrase?: boolean
          reveal_sanctioned?: boolean
          reveal_self_answered?: boolean
          sequence_kind: string
          session_id?: string | null
          turn_seq: number
          verdict_context?: string | null
        }
        Update: {
          character?: string
          created_at?: string
          false_affirmation_caught?: boolean
          false_affirmation_delivered?: boolean
          hint_level?: string | null
          id?: string
          praise?: string | null
          reveal_key_match?: boolean | null
          reveal_phrase?: boolean
          reveal_sanctioned?: boolean
          reveal_self_answered?: boolean
          sequence_kind?: string
          session_id?: string | null
          turn_seq?: number
          verdict_context?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tutor_turn_honesty_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "tutor_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_turns: {
        Row: {
          action: string | null
          audio_path: string | null
          created_at: string
          demonstrate: Json | null
          emotion: string | null
          id: string
          moderation: Json
          point_at: number | null
          roleplay_scene: string | null
          seq: number
          session_id: string
          source: string
          speaker: string
          text: string
          text_tsv: unknown
          whiteboard: Json | null
        }
        Insert: {
          action?: string | null
          audio_path?: string | null
          created_at?: string
          demonstrate?: Json | null
          emotion?: string | null
          id?: string
          moderation?: Json
          point_at?: number | null
          roleplay_scene?: string | null
          seq: number
          session_id: string
          source?: string
          speaker: string
          text: string
          text_tsv?: unknown
          whiteboard?: Json | null
        }
        Update: {
          action?: string | null
          audio_path?: string | null
          created_at?: string
          demonstrate?: Json | null
          emotion?: string | null
          id?: string
          moderation?: Json
          point_at?: number | null
          roleplay_scene?: string | null
          seq?: number
          session_id?: string
          source?: string
          speaker?: string
          text?: string
          text_tsv?: unknown
          whiteboard?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "tutor_turns_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "tutor_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_voice_consent: {
        Row: {
          consent_text: string
          granted_at: string
          granted_by: string | null
          id: string
          locale: string
          revoked_at: string | null
          revoked_by: string | null
          scope: string
          user_id: string
        }
        Insert: {
          consent_text: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          locale: string
          revoked_at?: string | null
          revoked_by?: string | null
          scope?: string
          user_id: string
        }
        Update: {
          consent_text?: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          locale?: string
          revoked_at?: string | null
          revoked_by?: string | null
          scope?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_voice_consent_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "tutor_voice_consent_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "tutor_voice_consent_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_roles: {
        Row: {
          granted_at: string
          granted_by: string | null
          role: string
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          role: string
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      wallet_guardian_actions: {
        Row: {
          actor_user_id: string | null
          amount: number
          bucket: string
          created_at: string
          goal_id: string | null
          id: string
          kid_user_id: string
          kind: string
          reason: string
        }
        Insert: {
          actor_user_id?: string | null
          amount: number
          bucket: string
          created_at?: string
          goal_id?: string | null
          id?: string
          kid_user_id: string
          kind: string
          reason: string
        }
        Update: {
          actor_user_id?: string | null
          amount?: number
          bucket?: string
          created_at?: string
          goal_id?: string | null
          id?: string
          kid_user_id?: string
          kind?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_guardian_actions_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "wallet_guardian_actions_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "savings_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_guardian_actions_kid_user_id_fkey"
            columns: ["kid_user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      wallet_ledger: {
        Row: {
          amount: number
          bucket: string
          created_at: string
          created_by: string | null
          goal_id: string | null
          guardian_action_id: string | null
          id: number
          kid_user_id: string
          reason: string
          redemption_id: string | null
          self_action_id: string | null
          share_gift_id: string | null
          task_id: string | null
        }
        Insert: {
          amount: number
          bucket: string
          created_at?: string
          created_by?: string | null
          goal_id?: string | null
          guardian_action_id?: string | null
          id?: never
          kid_user_id: string
          reason: string
          redemption_id?: string | null
          self_action_id?: string | null
          share_gift_id?: string | null
          task_id?: string | null
        }
        Update: {
          amount?: number
          bucket?: string
          created_at?: string
          created_by?: string | null
          goal_id?: string | null
          guardian_action_id?: string | null
          id?: never
          kid_user_id?: string
          reason?: string
          redemption_id?: string | null
          self_action_id?: string | null
          share_gift_id?: string | null
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wallet_ledger_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "wallet_ledger_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "savings_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_ledger_guardian_action_id_fkey"
            columns: ["guardian_action_id"]
            isOneToOne: false
            referencedRelation: "wallet_guardian_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_ledger_kid_user_id_fkey"
            columns: ["kid_user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "wallet_ledger_redemption_id_fkey"
            columns: ["redemption_id"]
            isOneToOne: false
            referencedRelation: "redemptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_ledger_self_action_id_fkey"
            columns: ["self_action_id"]
            isOneToOne: false
            referencedRelation: "wallet_self_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_ledger_share_gift_id_fkey"
            columns: ["share_gift_id"]
            isOneToOne: false
            referencedRelation: "share_gifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_ledger_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_self_actions: {
        Row: {
          amount: number
          created_at: string
          destination: string | null
          goal_id: string | null
          holder_user_id: string
          id: string
          kind: string
          personal_reward_id: string | null
          save_amount: number
          share_amount: number
          source: string | null
          spend_amount: number
        }
        Insert: {
          amount: number
          created_at?: string
          destination?: string | null
          goal_id?: string | null
          holder_user_id: string
          id?: string
          kind: string
          personal_reward_id?: string | null
          save_amount?: number
          share_amount?: number
          source?: string | null
          spend_amount?: number
        }
        Update: {
          amount?: number
          created_at?: string
          destination?: string | null
          goal_id?: string | null
          holder_user_id?: string
          id?: string
          kind?: string
          personal_reward_id?: string | null
          save_amount?: number
          share_amount?: number
          source?: string | null
          spend_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "wallet_self_actions_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "savings_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_self_actions_holder_user_id_fkey"
            columns: ["holder_user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "wallet_self_actions_personal_reward_id_fkey"
            columns: ["personal_reward_id"]
            isOneToOne: false
            referencedRelation: "personal_rewards"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_split_preferences: {
        Row: {
          holder_user_id: string
          save_pct: number
          share_pct: number
          spend_pct: number
          updated_at: string
        }
        Insert: {
          holder_user_id: string
          save_pct: number
          share_pct: number
          spend_pct: number
          updated_at?: string
        }
        Update: {
          holder_user_id?: string
          save_pct?: number
          share_pct?: number
          spend_pct?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_split_preferences_holder_user_id_fkey"
            columns: ["holder_user_id"]
            isOneToOne: true
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Views: {
      dataintel_anon_conversions_sync: {
        Row: {
          anon_id: string | null
          converted_at: string | null
          user_id: string | null
        }
        Insert: {
          anon_id?: string | null
          converted_at?: string | null
          user_id?: string | null
        }
        Update: {
          anon_id?: string | null
          converted_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "anon_visitors_converted_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      dataintel_attempts_sync: {
        Row: {
          attempt_id: string | null
          attempt_number: number | null
          course_id: string | null
          created_at: string | null
          diagnostic_code: string | null
          document_updated_at: string | null
          hints_used: number | null
          lesson_id: string | null
          score: number | null
          segment_id: string | null
          skill_key: string | null
          time_spent_seconds: number | null
          topic_id: string | null
          user_id: string | null
        }
        Insert: {
          attempt_id?: string | null
          attempt_number?: number | null
          course_id?: string | null
          created_at?: string | null
          diagnostic_code?: string | null
          document_updated_at?: string | null
          hints_used?: number | null
          lesson_id?: string | null
          score?: number | null
          segment_id?: string | null
          skill_key?: string | null
          time_spent_seconds?: number | null
          topic_id?: string | null
          user_id?: string | null
        }
        Update: {
          attempt_id?: string | null
          attempt_number?: number | null
          course_id?: string | null
          created_at?: string | null
          diagnostic_code?: string | null
          document_updated_at?: string | null
          hints_used?: number | null
          lesson_id?: string | null
          score?: number | null
          segment_id?: string | null
          skill_key?: string | null
          time_spent_seconds?: number | null
          topic_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lesson_segment_attempts_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "dataintel_lessons_sync"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "lesson_segment_attempts_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_segment_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      dataintel_events_sync: {
        Row: {
          anon_id: string | null
          client_event_id: string | null
          course_id: string | null
          created_at: string | null
          device: string | null
          event: string | null
          event_id: number | null
          event_version: number | null
          experiment_id: string | null
          experiment_variant: string | null
          lesson_id: string | null
          locale: string | null
          occurred_at: string | null
          ordinal: number | null
          referrer_class: string | null
          role: string | null
          route_class: string | null
          segment_id: string | null
          session_id: string | null
          user_id: string | null
          value: number | null
        }
        Insert: {
          anon_id?: string | null
          client_event_id?: string | null
          course_id?: string | null
          created_at?: string | null
          device?: string | null
          event?: string | null
          event_id?: number | null
          event_version?: number | null
          experiment_id?: string | null
          experiment_variant?: string | null
          lesson_id?: string | null
          locale?: string | null
          occurred_at?: string | null
          ordinal?: number | null
          referrer_class?: string | null
          role?: string | null
          route_class?: string | null
          segment_id?: string | null
          session_id?: string | null
          user_id?: string | null
          value?: number | null
        }
        Update: {
          anon_id?: string | null
          client_event_id?: string | null
          course_id?: string | null
          created_at?: string | null
          device?: string | null
          event?: string | null
          event_id?: number | null
          event_version?: number | null
          experiment_id?: string | null
          experiment_variant?: string | null
          lesson_id?: string | null
          locale?: string | null
          occurred_at?: string | null
          ordinal?: number | null
          referrer_class?: string | null
          role?: string | null
          route_class?: string | null
          segment_id?: string | null
          session_id?: string | null
          user_id?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "learning_events_anon_id_fkey"
            columns: ["anon_id"]
            isOneToOne: false
            referencedRelation: "anon_visitors"
            referencedColumns: ["anon_id"]
          },
          {
            foreignKeyName: "learning_events_anon_id_fkey"
            columns: ["anon_id"]
            isOneToOne: false
            referencedRelation: "dataintel_anon_conversions_sync"
            referencedColumns: ["anon_id"]
          },
          {
            foreignKeyName: "learning_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      dataintel_lessons_sync: {
        Row: {
          course_id: string | null
          course_slug: string | null
          course_title_en: string | null
          course_title_es: string | null
          course_title_pt: string | null
          lesson_id: string | null
          segment_count: number | null
          slug: string | null
          title_en: string | null
          title_es: string | null
          title_pt: string | null
        }
        Relationships: []
      }
      dataintel_sessions_sync: {
        Row: {
          device: string | null
          duration_sec: number | null
          ended_at: string | null
          events_count: number | null
          lessons_started: number | null
          locale: string | null
          referrer_class: string | null
          session_id: string | null
          started_at: string | null
          surfaces: number | null
          user_id: string | null
        }
        Relationships: []
      }
      dataintel_users_sync: {
        Row: {
          created_at: string | null
          is_staff: boolean | null
          lessons_completed: number | null
          locale: string | null
          longest_streak: number | null
          minutes_learned: number | null
          role: string | null
          streak_days: number | null
          user_id: string | null
          xp_points: number | null
        }
        Relationships: []
      }
      insights_activation_funnel: {
        Row: {
          step: string | null
          step_order: number | null
          users: number | null
        }
        Relationships: []
      }
      insights_anon_acquisition: {
        Row: {
          avg_days_to_convert: number | null
          converted: number | null
          device: string | null
          first_seen_day: string | null
          landing_route: string | null
          locale: string | null
          referrer_class: string | null
          utm_campaign: string | null
          utm_source: string | null
          visitors: number | null
        }
        Relationships: []
      }
      insights_audience_daily: {
        Row: {
          day: string | null
          events: number | null
          role: string | null
          sessions: number | null
          surfaces: number | null
          users: number | null
          visitors: number | null
        }
        Relationships: []
      }
      insights_cohort_retention: {
        Row: {
          cohort_size: number | null
          cohort_week: string | null
          users: number | null
          week_offset: number | null
        }
        Relationships: []
      }
      insights_engagement: {
        Row: {
          active_days_30d: number | null
          engagement_score: number | null
          lessons_completed: number | null
          longest_streak: number | null
          sessions_30d: number | null
          streak_days: number | null
          user_id: string | null
          xp_points: number | null
        }
        Relationships: [
          {
            foreignKeyName: "learning_stats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      insights_family_engagement: {
        Row: {
          first_guardian_link_at: string | null
          guardians: number | null
          kid_user_id: string | null
          last_task_at: string | null
          tasks_approved: number | null
          tasks_created: number | null
        }
        Relationships: [
          {
            foreignKeyName: "guardian_links_kid_user_id_fkey"
            columns: ["kid_user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      insights_feature_adoption: {
        Row: {
          events: number | null
          first_at: string | null
          last_at: string | null
          role: string | null
          route_class: string | null
          sessions: number | null
          users: number | null
        }
        Relationships: []
      }
      insights_learning_velocity: {
        Row: {
          avg_attempts: number | null
          avg_score: number | null
          first_completion_at: string | null
          last_completion_at: string | null
          lessons_passed: number | null
          lessons_per_week: number | null
          longest_streak: number | null
          streak_days: number | null
          user_id: string | null
          xp_points: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      insights_lesson_dropoff: {
        Row: {
          abandon_rate: number | null
          abandons: number | null
          avg_seconds_before_abandon: number | null
          completions: number | null
          lesson_id: string | null
          lesson_slug: string | null
          starts: number | null
        }
        Relationships: []
      }
      insights_registrations_daily: {
        Row: {
          day: string | null
          registrations: number | null
          role: string | null
        }
        Relationships: []
      }
      insights_segment_calibration: {
        Row: {
          attempts: number | null
          avg_attempts_per_learner: number | null
          avg_score: number | null
          first_try_avg_score: number | null
          hint_rate: number | null
          last_attempt_at: string | null
          learners: number | null
          lesson_id: string | null
          lesson_slug: string | null
          lesson_title: Json | null
          segment_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lesson_segment_attempts_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "dataintel_lessons_sync"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "lesson_segment_attempts_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      insights_session_depth: {
        Row: {
          device: string | null
          events: number | null
          lessons_started: number | null
          locale: string | null
          reported_seconds: number | null
          role: string | null
          session_id: string | null
          started_at: string | null
          surfaces: number | null
          visible_seconds: number | null
        }
        Relationships: []
      }
      insights_signup_funnel_integrity: {
        Row: {
          accounts_created: number | null
          day: string | null
          signup_complete: number | null
          signup_start: number | null
          signup_submit: number | null
          unobserved: number | null
        }
        Relationships: []
      }
      insights_time_to_value: {
        Row: {
          activated_at: string | null
          first_seen: string | null
          hours_to_value: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "learning_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      insights_today_activity: {
        Row: {
          day: string | null
          device: string | null
          event: string | null
          events: number | null
          locale: string | null
          role: string | null
          route_class: string | null
          sessions: number | null
          total_value: number | null
          users: number | null
        }
        Relationships: []
      }
      insights_today_users: {
        Row: {
          day: string | null
          role: string | null
          sessions: number | null
          users: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_guardian_invite: {
        Args: { p_accepting: string; p_token: string }
        Returns: string
      }
      account_age_record_is_minor: {
        Args: { p_user: string }
        Returns: boolean
      }
      account_erasure_in_progress: {
        Args: { p_first: string; p_second: string }
        Returns: boolean
      }
      acknowledge_learner_graduation: {
        Args: { p_register: string; p_user_id: string }
        Returns: boolean
      }
      act_on_learning_bridge_prompt: {
        Args: {
          p_actor_id: string
          p_amount: number
          p_icon: string
          p_prompt_id: string
          p_recurrence: string
          p_title: string
        }
        Returns: Json
      }
      activate_lesson_version_request: {
        Args: { p_actor: string; p_request_id: string }
        Returns: undefined
      }
      add_tutor_session_cost: {
        Args: { p_amount: number; p_session_id: string }
        Returns: number
      }
      admin_retention_at_distance: {
        Args: never
        Returns: {
          avg_first_attempt_score: number
          bucket: string
          n: number
        }[]
      }
      admin_retention_by_topic: {
        Args: never
        Returns: {
          avg_first_attempt_score: number
          n: number
          source_topic_slug: string
          source_topic_title: Json
        }[]
      }
      adult_by_birth_month: { Args: { p_user: string }; Returns: boolean }
      age_at_least_by_birth_month: {
        Args: { p_user: string; p_years: number }
        Returns: boolean
      }
      age_declaration_promotion_due: {
        Args: { p_birth_month: string; p_now?: string }
        Returns: boolean
      }
      allocate_pending_credit: {
        Args: {
          p_created_by: string
          p_credit_id: string
          p_goal_id?: string
          p_kid_user_id: string
          p_save: number
          p_share: number
          p_spend: number
        }
        Returns: boolean
      }
      allocate_task_reward: {
        Args: {
          p_created_by: string
          p_goal_id?: string
          p_kid_user_id: string
          p_save: number
          p_share: number
          p_spend: number
          p_task_id: string
        }
        Returns: boolean
      }
      analytics_disclosure_coverage: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      avatar_options_valid: { Args: { p_options: Json }; Returns: boolean }
      award_tutor_xp: {
        Args: {
          p_cap: number
          p_requested: number
          p_session_id: string
          p_since: string
          p_user_id: string
        }
        Returns: number
      }
      banking_movement_allowed: {
        Args: { p_kid_user_id: string }
        Returns: boolean
      }
      cancel_account_deletion: {
        Args: { p_subject: string }
        Returns: {
          anon_ids: Json
          attempts: number
          cancelled_at: string | null
          completed_at: string | null
          depot_paths: Json
          held_reason: string | null
          id: string
          initiated_by: string
          last_error: string | null
          population: string
          requested_at: string
          scheduled_for: string
          started_at: string | null
          status: string
          steps: Json
          subject_id: string
        }
        SetofOptions: {
          from: "*"
          to: "account_deletion_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancel_learning_streak_pause: {
        Args: { p_guardian_id: string; p_learner_id: string; p_today: string }
        Returns: Json
      }
      chore_tag_adoption: {
        Args: { p_since: string }
        Returns: {
          bonus_tasks: number
          contribution_tasks: number
          tutors: number
          tutors_using_contribution: number
        }[]
      }
      claim_account_deletion: {
        Args: { p_request: string }
        Returns: {
          anon_ids: Json
          attempts: number
          cancelled_at: string | null
          completed_at: string | null
          depot_paths: Json
          held_reason: string | null
          id: string
          initiated_by: string
          last_error: string | null
          population: string
          requested_at: string
          scheduled_for: string
          started_at: string | null
          status: string
          steps: Json
          subject_id: string
        }
        SetofOptions: {
          from: "*"
          to: "account_deletion_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_game_ai_line: {
        Args: {
          p_cap: number
          p_run_id: string
          p_since: string
          p_user_id: string
        }
        Returns: boolean
      }
      clear_learner_memory: {
        Args: {
          p_actor: string
          p_decided_by: string
          p_expected: string
          p_store: string
          p_user: string
        }
        Returns: string
      }
      commit_course_pathway_placement: {
        Args: { p_lesson_ids: string[]; p_result: Json }
        Returns: string
      }
      commit_course_placement: {
        Args: { p_lesson_ids: string[]; p_result: Json }
        Returns: string
      }
      complete_account_deletion: {
        Args: { p_request: string }
        Returns: {
          anon_ids: Json
          attempts: number
          cancelled_at: string | null
          completed_at: string | null
          depot_paths: Json
          held_reason: string | null
          id: string
          initiated_by: string
          last_error: string | null
          population: string
          requested_at: string
          scheduled_for: string
          started_at: string | null
          status: string
          steps: Json
          subject_id: string
        }
        SetofOptions: {
          from: "*"
          to: "account_deletion_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      complete_lesson: {
        Args: {
          p_lesson_id: string
          p_local_date: string
          p_minutes: number
          p_passed: boolean
          p_run_id: string
          p_score: number
          p_user_id: string
          p_xp: number
        }
        Returns: Json
      }
      complete_v2_lesson: {
        Args: {
          p_document_version_id: string
          p_lesson_id: string
          p_local_date: string
          p_minutes: number
          p_required_segment_ids: string[]
          p_run_id: string
          p_user_id: string
          p_xp: number
        }
        Returns: Json
      }
      complete_v2_mixed_lesson: {
        Args: {
          p_document_version_id: string
          p_lesson_id: string
          p_local_date: string
          p_minutes: number
          p_required_segment_ids: string[]
          p_run_id: string
          p_user_id: string
          p_viewed_segment_ids: string[]
          p_xp: number
        }
        Returns: Json
      }
      content_bypass_checks: {
        Args: { p_days: number }
        Returns: {
          action: string
          closed_at: string
          closing_verified_at: string
          course_id: string
          due_at: string
          id: number
          justified: boolean
          lesson_id: string
          locale: string
          occurred_at: string
          state: string
        }[]
      }
      content_bypass_metrics: {
        Args: { p_days: number }
        Returns: {
          bypasses: number
          complete: number
          decided: number
          overdue_open: number
          publish_actions: number
          unverified: number
        }[]
      }
      content_course_of_lesson: { Args: { p_lesson: string }; Returns: string }
      content_defect_escape_rate: {
        Args: { p_since: string; p_until: string }
        Returns: {
          escapes: number
          gate_id: string
          published_versions: number
        }[]
      }
      content_is_release_bypass: {
        Args: { p_action: string; p_detail: Json }
        Returns: boolean
      }
      content_release_actor_allowed: {
        Args: { p_actor: string }
        Returns: boolean
      }
      content_retro_check_days: { Args: never; Returns: number }
      coop_goal_candidates: { Args: { p_user: string }; Returns: string[] }
      coop_goal_child_teen: { Args: { p_user: string }; Returns: boolean }
      coop_goal_close: {
        Args: { p_goal: string; p_reason: string }
        Returns: undefined
      }
      coop_goal_done: { Args: { p_goal: string }; Returns: number }
      coop_goal_edge: {
        Args: { p_from: string; p_to: string }
        Returns: boolean
      }
      coop_goal_eligible: { Args: { p_user: string }; Returns: boolean }
      coop_goal_end_member: {
        Args: {
          p_actor: string
          p_goal: string
          p_reason: string
          p_user: string
        }
        Returns: boolean
      }
      coop_goal_guardian_allows: { Args: { p_user: string }; Returns: boolean }
      coop_goal_guardian_goals: {
        Args: { p_guardian: string; p_kid: string }
        Returns: Json
      }
      coop_goal_guardian_view: {
        Args: { p_guardian: string; p_kid: string }
        Returns: Json
      }
      coop_goal_lock: { Args: { p_goal: string }; Returns: undefined }
      coop_goal_log: {
        Args: {
          p_action: string
          p_actor: string
          p_detail?: Json
          p_goal: string
          p_subject: string
        }
        Returns: undefined
      }
      coop_goal_mutual: { Args: { p_a: string; p_b: string }; Returns: boolean }
      coop_goal_overview: { Args: { p_user: string }; Returns: Json }
      coop_goal_reconcile: { Args: { p_goal: string }; Returns: undefined }
      create_coop_goal: {
        Args: {
          p_creator: string
          p_days: number
          p_invitees: string[]
          p_target: number
        }
        Returns: string
      }
      credit_game_session: {
        Args: {
          p_credit: boolean
          p_max_credit_seconds: number
          p_session_id: string
          p_user_id: string
        }
        Returns: Json
      }
      data_practice_applies: {
        Args: { p_practice: string; p_subject: string }
        Returns: boolean
      }
      data_practice_has_tutor: { Args: { p_subject: string }; Returns: boolean }
      data_practice_is_migrated_child: {
        Args: { p_subject: string }
        Returns: boolean
      }
      data_practice_set_consent: {
        Args: {
          p_actor: string
          p_grant: boolean
          p_practice: string
          p_subject: string
          p_version: number
        }
        Returns: Json
      }
      data_practice_state: { Args: { p_subject: string }; Returns: Json }
      decide_age_correction: {
        Args: {
          p_approve: boolean
          p_reason: string
          p_request: string
          p_staff: string
        }
        Returns: string
      }
      decide_coop_goal_invitation: {
        Args: { p_accept: boolean; p_goal: string; p_user: string }
        Returns: string
      }
      decide_guardian_link: {
        Args: { p_actor: string; p_confirm: boolean; p_link_id: string }
        Returns: string
      }
      decide_learner_memory_proposal: {
        Args: {
          p_actor: string
          p_decided_by: string
          p_proposal_id: string
          p_verdict: string
        }
        Returns: string
      }
      decide_redemption: {
        Args: {
          p_approve: boolean
          p_decided_by: string
          p_redemption_id: string
        }
        Returns: boolean
      }
      decide_social_connection: {
        Args: {
          p_approve: boolean
          p_guardian_id: string
          p_request_id: string
        }
        Returns: string
      }
      decide_teen_connection: {
        Args: { p_accept: boolean; p_request_id: string; p_subject_id: string }
        Returns: string
      }
      dismiss_learning_bridge_prompt: {
        Args: { p_actor_id: string; p_prompt_id: string }
        Returns: Json
      }
      effective_age_band: { Args: { p_user: string }; Returns: string }
      emergency_activate_lesson_version: {
        Args: {
          p_actor: string
          p_document_version_id: string
          p_justification: string
          p_lesson_id: string
        }
        Returns: {
          code: string
          message: string
          ok: boolean
        }[]
      }
      end_coop_goal_membership: {
        Args: { p_actor: string; p_goal: string; p_member: string }
        Returns: string
      }
      end_game_session: {
        Args: { p_reason: string; p_session_id: string; p_user_id: string }
        Returns: boolean
      }
      end_revoked_tutor_powers: {
        Args: { p_actor: string; p_user: string }
        Returns: Json
      }
      erase_account_data: { Args: { p_request: string }; Returns: Json }
      evaluate_social_pattern: { Args: { p_subject: string }; Returns: boolean }
      family_analytics_admitted: { Args: { p_user: string }; Returns: boolean }
      family_autonomy_admits_reward: {
        Args: { p_cost: number; p_kid: string }
        Returns: boolean
      }
      family_autonomy_admits_task: {
        Args: { p_coins: number; p_kid: string; p_kind: string }
        Returns: boolean
      }
      family_autonomy_apply: {
        Args: {
          p_actor: string
          p_actor_kind: string
          p_kid: string
          p_reason: string
          p_reason_code: string
          p_request: string
          p_to_level: number
          p_to_limit: number
        }
        Returns: undefined
      }
      family_autonomy_cap: { Args: { p_level: number }; Returns: number }
      family_autonomy_decide_request: {
        Args: {
          p_actor: string
          p_grant: boolean
          p_limit: number
          p_reason: string
          p_reason_code: string
          p_request: string
          p_revisit_on: string
        }
        Returns: string
      }
      family_autonomy_eligibility: {
        Args: { p_kid: string; p_level: number }
        Returns: Json
      }
      family_autonomy_eligible_for: {
        Args: { p_kid: string; p_level: number }
        Returns: boolean
      }
      family_autonomy_level: {
        Args: { p_kid: string }
        Returns: {
          level: number
          level_since: string
          preapproved_limit: number
          stored_level: number
          stored_limit: number
        }[]
      }
      family_autonomy_progression: {
        Args: { p_since: string; p_window_days?: number }
        Returns: {
          judged: number
          level: number
          progressed: number
          waiting: number
        }[]
      }
      family_autonomy_record: {
        Args: { p_kid: string }
        Returns: {
          approved: number
          not_approved: number
        }[]
      }
      family_autonomy_request_level: {
        Args: { p_kid: string; p_note: string }
        Returns: string
      }
      family_autonomy_set: {
        Args: {
          p_actor: string
          p_kid: string
          p_level: number
          p_limit: number
          p_reason?: string
          p_reason_code?: string
        }
        Returns: number
      }
      family_autonomy_staff_lower: {
        Args: {
          p_kid: string
          p_level: number
          p_reason: string
          p_staff: string
        }
        Returns: number
      }
      family_autonomy_status: { Args: { p_kid: string }; Returns: Json }
      family_autonomy_step_down: { Args: { p_kid: string }; Returns: number }
      family_autonomy_step_downs: {
        Args: { p_since: string }
        Returns: {
          actor_kind: string
          step_downs: number
        }[]
      }
      family_autonomy_threshold: { Args: { p_key: string }; Returns: number }
      family_changed_columns: {
        Args: { p_new: Json; p_old: Json }
        Returns: string[]
      }
      family_child_age: { Args: { p_kid: string }; Returns: number }
      family_child_in_family: { Args: { p_kid: string }; Returns: boolean }
      family_decide_redemption: {
        Args: {
          p_actor: string
          p_approve: boolean
          p_reason: string
          p_reason_code: string
          p_redemption: string
          p_revisit_on: string
        }
        Returns: string
      }
      family_decide_task: {
        Args: {
          p_actor: string
          p_outcome: string
          p_reason: string
          p_reason_code: string
          p_task: string
        }
        Returns: string
      }
      family_decision_matches: {
        Args: {
          p_decision: string
          p_id: string
          p_outcome: string
          p_subject: string
        }
        Returns: {
          actor_kind: string
          actor_user_id: string | null
          created_at: string
          id: string
          kid_user_id: string
          legacy: boolean
          level_request_id: string | null
          outcome: string
          prior_status: string
          reason: string | null
          reason_code: string | null
          redemption_id: string | null
          reviews_decision_id: string | null
          revisit_on: string | null
          subject: string
          task_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "family_decisions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      family_decision_not_approved: {
        Args: { p_outcome: string; p_prior_status: string }
        Returns: boolean
      }
      family_denial_actionability: {
        Args: { p_since: string }
        Returns: {
          actionable: number
          admitted: number
          denials: number
          scored: number
          structured: number
        }[]
      }
      family_denial_reason_sample: {
        Args: { p_limit?: number; p_since: string }
        Returns: {
          created_at: string
          decision_id: string
          outcome: string
          reason: string
          reason_code: string
          subject: string
        }[]
      }
      family_engagement_insight: {
        Args: { p_active_days?: number; p_limit?: number }
        Returns: Json
      }
      family_evidence_cleared: {
        Args: {
          p_bucket: string
          p_ext: string
          p_hash: string
          p_task: string
        }
        Returns: boolean
      }
      family_evidence_due: {
        Args: { p_limit?: number }
        Returns: {
          bucket: string
          ext: string
          hash: string
          shared: boolean
          task_id: string
        }[]
      }
      family_is_verified_guardian: {
        Args: { p_kid: string; p_parent: string }
        Returns: boolean
      }
      family_money_credit_class: {
        Args: { p_income_source: string; p_reason: string }
        Returns: string
      }
      family_money_register: { Args: { p_user: string }; Returns: string }
      family_money_register_distribution: {
        Args: never
        Returns: {
          holders: number
          register: string
        }[]
      }
      family_only_nulled: {
        Args: { p_changed: string[]; p_new: Json; p_nullable: string[] }
        Returns: boolean
      }
      family_post_goal_motivation: {
        Args: { p_since: string }
        Returns: {
          goals: number
          goals_with_drop: number
          mean_after_per_day: number
          mean_before_per_day: number
          next_goal_within_2_days: boolean
        }[]
      }
      family_reason_actionable: { Args: { p_reason: string }; Returns: boolean }
      family_redemption_credit_timing: {
        Args: { p_since: string }
        Returns: {
          bin: string
          credit_class: string
          exposure_hours: number
          rate_per_100_child_days: number
          requests: number
        }[]
      }
      family_request_redemption: {
        Args: {
          p_catalog: string
          p_kid: string
          p_note: string
          p_reason_kind: string
        }
        Returns: Json
      }
      family_request_role: { Args: never; Returns: string }
      family_research_admitted: {
        Args: { p_subject: string }
        Returns: boolean
      }
      family_research_age_at: {
        Args: { p_at: string; p_user: string }
        Returns: number
      }
      family_research_completeness: {
        Args: { p_min_tenure_months?: number; p_months?: number }
        Returns: {
          cohort: string
          complete: number
          enrolled: number
          long_tenure: number
          measurable: number
        }[]
      }
      family_research_disclosure_version: { Args: never; Returns: number }
      family_research_is_adult: { Args: { p_user: string }; Returns: boolean }
      family_research_set_consent: {
        Args: {
          p_actor: string
          p_participate: boolean
          p_subject: string
          p_version: number
        }
        Returns: Json
      }
      family_research_state: { Args: { p_subject: string }; Returns: Json }
      family_retention_compliance: {
        Args: never
        Returns: {
          data_class: string
          overdue: number
          retain_days: number
          table_name: string
        }[]
      }
      family_retention_days: { Args: { p_class: string }; Returns: number }
      family_retention_last_run: { Args: never; Returns: Json }
      family_retention_sweep: { Args: never; Returns: Json }
      family_review_decision: {
        Args: {
          p_actor: string
          p_decision: string
          p_outcome: string
          p_reason: string
          p_reason_code: string
        }
        Returns: string
      }
      family_save_contribution_persistence: {
        Args: { p_since: string }
        Returns: {
          children: number
          own_coins: number
          save_coins: number
          save_contributors: number
        }[]
      }
      family_score_denial_reason: {
        Args: { p_actionable: boolean; p_decision: string; p_staff: string }
        Returns: boolean
      }
      family_split_engagement: {
        Args: { p_since: string }
        Returns: {
          adjusted: number
          allocations: number
          kept_default: number
          source: string
        }[]
      }
      family_staff_may_support: { Args: { p_user: string }; Returns: boolean }
      family_staff_may_view_analytics: {
        Args: { p_user: string }
        Returns: boolean
      }
      family_state_integrity: {
        Args: { p_since: string }
        Returns: {
          outside_service: number
          table_name: string
          transitions: number
        }[]
      }
      family_talk_close: {
        Args: { p_actor: string; p_nudge: string; p_outcome: string }
        Returns: string
      }
      family_talk_nudge_rate: {
        Args: { p_since: string }
        Returns: {
          child_asks: number
          dismissed: number
          nudged: number
          patterns: number
          still_open: number
          talked: number
        }[]
      }
      family_talk_request: {
        Args: { p_decision: string; p_kid: string }
        Returns: string
      }
      family_task_mark_done: {
        Args: {
          p_completed_on: string
          p_kid: string
          p_note: string
          p_task: string
        }
        Returns: Json
      }
      family_task_self_log: {
        Args: { p_kid: string; p_task: string }
        Returns: boolean
      }
      forge_release_catalog_fingerprint: {
        Args: { p_course_id: string }
        Returns: string
      }
      forge_release_content_watermark: {
        Args: { p_course_id: string }
        Returns: string
      }
      forge_release_verification_refusal: {
        Args: { p_course_id: string }
        Returns: {
          code: string
          message: string
        }[]
      }
      fulfill_redemption: {
        Args: { p_actor: string; p_redemption_id: string }
        Returns: boolean
      }
      game_metrics_valid: { Args: { p: Json }; Returns: boolean }
      game_play_limits_read: {
        Args: { p_guardian: string; p_kid: string }
        Returns: Json
      }
      game_play_limits_write: {
        Args: {
          p_guardian: string
          p_kid: string
          p_minutes: number
          p_sessions: number
        }
        Returns: Json
      }
      gate_effectiveness_reviews_open: {
        Args: { p_now?: string }
        Returns: {
          age_days: number
          defect_kind: string
          escape_id: string
          gate_description: string
          gate_id: string
          lesson_id: string
          opened_at: string
          owner_role: string
          review_id: string
        }[]
      }
      get_completed_course_badges: {
        Args: { p_user_id: string }
        Returns: {
          badge_asset: string
          completed_at: string
          course_slug: string
          course_title: Json
        }[]
      }
      goal_next_step_decline: {
        Args: { p_goal: string; p_holder: string }
        Returns: boolean
      }
      goal_next_step_seen: {
        Args: { p_goal: string; p_holder: string }
        Returns: boolean
      }
      goal_progress_breakdown: {
        Args: { p_goal_ids: string[] }
        Returns: {
          bonus: number
          family: number
          goal_id: string
          own: number
          total: number
        }[]
      }
      grant_parent_role_with_justification: {
        Args: { p_actor: string; p_justification: string; p_user: string }
        Returns: string
      }
      guardian_adjust_wallet: {
        Args: {
          p_actor: string
          p_amount: number
          p_bucket: string
          p_kid_user_id: string
          p_reason: string
        }
        Returns: string
      }
      guardian_deletion_notices: { Args: { p_guardian: string }; Returns: Json }
      guardian_end_chore_streak_pause: {
        Args: { p_actor: string; p_pause: string }
        Returns: string
      }
      guardian_end_social_connection: {
        Args: { p_guardian: string; p_kid: string; p_other: string }
        Returns: number
      }
      guardian_pause_chore_streak: {
        Args: {
          p_actor: string
          p_ends_on: string
          p_kid: string
          p_starts_on: string
        }
        Returns: string
      }
      guardian_rename_flagged_child: {
        Args: { p_guardian: string; p_kid: string; p_username: string }
        Returns: string
      }
      guardian_withdraw_goal: {
        Args: {
          p_actor: string
          p_amount: number
          p_destination: string
          p_goal_id: string
          p_reason: string
        }
        Returns: string
      }
      habit_streak_advance: {
        Args: {
          p_best: number
          p_current: number
          p_days_practiced: number
          p_last: string
          p_paused: string[]
          p_rest_used: number
          p_today: string
        }
        Returns: Json
      }
      has_active_tutor_voice_consent: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      has_current_social_approval: {
        Args: { p_subject: string; p_viewer: string }
        Returns: boolean
      }
      has_current_teen_consent: {
        Args: { p_subject: string; p_viewer: string }
        Returns: boolean
      }
      has_data_practice_consent: {
        Args: { p_practice: string; p_subject: string }
        Returns: boolean
      }
      identity_metrics: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      insert_tutor_live_segment_checked: {
        Args: {
          p_answer: Json
          p_calibration_id: string
          p_elevated: boolean
          p_judge_model: string
          p_judge_prompt_hash: string
          p_key_verified: boolean
          p_locale: string
          p_payload: Json
          p_provenance: Json
          p_risk_category: string
          p_risk_signals: string[]
          p_sample_rate: number
          p_segment_type: string
          p_session_id: string
          p_source_key: string
          p_tier: number
        }
        Returns: {
          answer: Json | null
          attempts: number
          created_at: string
          id: string
          key_verified: boolean
          lesson_id: string | null
          origin: string
          payload: Json
          provenance: Json
          review_status: string | null
          score: number | null
          segment_type: string
          seq: number
          session_id: string
          voice_checked_at: string | null
          xp_awarded: number
        }[]
        SetofOptions: {
          from: "*"
          to: "tutor_segments"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      insert_tutor_segment_checked: {
        Args: {
          p_answer: Json
          p_key_verified: boolean
          p_lesson_id: string
          p_origin: string
          p_payload: Json
          p_provenance: Json
          p_review_status: string
          p_segment_type: string
          p_session_id: string
          p_source_key: string
        }
        Returns: {
          answer: Json | null
          attempts: number
          created_at: string
          id: string
          key_verified: boolean
          lesson_id: string | null
          origin: string
          payload: Json
          provenance: Json
          review_status: string | null
          score: number | null
          segment_type: string
          seq: number
          session_id: string
          voice_checked_at: string | null
          xp_awarded: number
        }[]
        SetofOptions: {
          from: "*"
          to: "tutor_segments"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      invite_coop_goal_member: {
        Args: { p_actor: string; p_goal: string; p_invitee: string }
        Returns: boolean
      }
      is_blocked: { Args: { a: string; b: string }; Returns: boolean }
      is_verified_guardian_of: { Args: { kid: string }; Returns: boolean }
      learning_autonomy_adoption: {
        Args: { p_since: string; p_until: string }
        Returns: {
          adoption_rate: number
          exercised: number
          lever: string
          offered: number
        }[]
      }
      learning_cpa_entry_stage_distribution: {
        Args: { p_since: string; p_until: string }
        Returns: {
          entry_stage: string
          runs: number
        }[]
      }
      learning_cue_hits: {
        Args: { p_since: string; p_until: string }
        Returns: {
          false_ticks: number
          hits: number
          missed: number
          responses: number
        }[]
      }
      learning_delayed_retention: {
        Args: { p_mastery?: number; p_since: string; p_until: string }
        Returns: {
          correct: number
          correct_share: number
          kc_id: string
          kc_key: string
          learners: number
          window_days: number
        }[]
      }
      learning_detection_cells: {
        Args: { p_since: string; p_until: string }
        Returns: {
          correct_rejections: number
          false_alarms: number
          hits: number
          lesson_id: string
          misses: number
          responses: number
        }[]
      }
      learning_detection_cells_by_phase: {
        Args: { p_since: string; p_until: string }
        Returns: {
          correct_rejections: number
          false_alarms: number
          hits: number
          item_phase: string
          misses: number
          responses: number
        }[]
      }
      learning_error_family_split: {
        Args: { p_since: string; p_until: string }
        Returns: {
          diagnostic: string
          errors: number
          family: string
        }[]
      }
      learning_first_unaided_stage_distribution: {
        Args: { p_since: string; p_until: string }
        Returns: {
          learners: number
          stage: string
        }[]
      }
      learning_json_array: { Args: { p_value: Json }; Returns: Json }
      learning_judgment_differentiation: {
        Args: { p_since: string; p_until: string }
        Returns: {
          attempts: number
          correct_not_sound: number
          correct_sound: number
          correlation: number
          divergent_share: number
          incorrect_not_sound: number
          incorrect_sound: number
          lesson_id: string
        }[]
      }
      learning_kc_learner_age_bands: {
        Args: { p_since: string }
        Returns: {
          age_band: string
          user_id: string
        }[]
      }
      learning_narrative_metrics: {
        Args: { p_since: string; p_until: string }
        Returns: Json
      }
      learning_qa_rates: {
        Args: { p_since: string; p_until: string }
        Returns: {
          detail: string
          event: string
          events: number
        }[]
      }
      learning_replay_notice_display_rate: {
        Args: { p_since: string; p_until: string }
        Returns: {
          below_best: number
          display_rate: number
          shown: number
        }[]
      }
      learning_rest_day_utilization: {
        Args: { p_since: string; p_until: string }
        Returns: {
          kept_by_rest_days: number
          learners_with_lapse: number
          rest_days_used: number
          restarted: number
          utilization_rate: number
        }[]
      }
      learning_scorer_parity: {
        Args: { p_since: string; p_until: string }
        Returns: {
          agreed: number
          agreement_share: number
          graded: number
          reported: number
        }[]
      }
      learning_session_efficiency: {
        Args: { p_since: string; p_until: string }
        Returns: {
          efficiency_ratio: number
          graded_seconds: number
          learners: number
          session_seconds: number
          week_start: string
        }[]
      }
      learning_story_decision_segment: {
        Args: { p_segment: Json }
        Returns: boolean
      }
      learning_streak_paused_dates: {
        Args: { p_after: string; p_before: string; p_user_id: string }
        Returns: string[]
      }
      learning_transfer_success: {
        Args: { p_since: string; p_until: string }
        Returns: {
          first_attempts: number
          item_role: string
          kc: string
          success_share: number
          successes: number
        }[]
      }
      learning_variant_transfer: {
        Args: { p_since: string; p_until: string }
        Returns: {
          first_attempts: number
          kc: string
          success_share: number
          successes: number
          variant: string
        }[]
      }
      legacy_kc_credit_covers: {
        Args: { p_kc_id: string; p_stage: string; p_user_id: string }
        Returns: boolean
      }
      lesson_document_without_audio_stamps: {
        Args: { p_document: Json }
        Returns: Json
      }
      lesson_effective_locale_count: {
        Args: { p_lesson_id: string }
        Returns: number
      }
      lesson_stage3_fingerprint: {
        Args: { p_lesson_id: string }
        Returns: string
      }
      lesson_stage3_review_state: {
        Args: { p_document_version_id?: string; p_lesson_id: string }
        Returns: Json
      }
      lesson_version_request_for_decision: {
        Args: { p_document_version_id: string; p_lesson_id: string }
        Returns: {
          course_id: string
          document_sha256: string
          lesson_status: string
          locale: string
          request_id: string
          request_status: string
          version_id: string
        }[]
      }
      list_expired_kid_suspensions: {
        Args: { p_limit: number; p_older_than_days: number }
        Returns: {
          suspended_at: string
          user_id: string
        }[]
      }
      list_minor_record_tutors: {
        Args: never
        Returns: {
          user_id: string
        }[]
      }
      mark_under13_origin: { Args: { p_user_id: string }; Returns: boolean }
      mentor_age_calibration_coverage: {
        Args: { p_from: string; p_to: string }
        Returns: {
          calibrated_before_start: number
          coverage: number
          sessions: number
          unknown_age_sessions: number
        }[]
      }
      mentor_resolution_efficiency: {
        Args: { p_since: string; p_until: string }
        Returns: {
          intent: string
          median_turns: number
          p75_turns: number
          resolved_sessions: number
          week_start: string
        }[]
      }
      money_bridge_eligible: { Args: { p_user: string }; Returns: boolean }
      money_bridge_engagement: {
        Args: never
        Returns: {
          arrived: number
          completed: number
          eligible: number
          engaged: number
          milestone: string
        }[]
      }
      money_bridge_mark: {
        Args: {
          p_done: boolean
          p_holder: string
          p_milestone: string
          p_step: number
        }
        Returns: Json
      }
      money_bridge_state: { Args: { p_holder: string }; Returns: Json }
      note_learner_register: {
        Args: { p_register: string; p_user_id: string }
        Returns: Json
      }
      offer_learning_bridge_prompt: {
        Args: {
          p_audience: string
          p_candidates: Json
          p_cooldown_days?: number
          p_course_id: string
          p_learner_id: string
          p_lesson_id: string
          p_topic_id: string
          p_ttl_days?: number
        }
        Returns: Json
      }
      onboarding_discovery_metrics: { Args: never; Returns: Json }
      parent_coaching_deliver: {
        Args: { p_now?: string; p_tips: string[]; p_tutor: string }
        Returns: Json
      }
      parent_coaching_delivery_rate: {
        Args: { p_period: string }
        Returns: {
          delivered: number
          dismissed: number
          eligible: number
          opened: number
          period: string
        }[]
      }
      parent_coaching_eligible: { Args: { p_tutor: string }; Returns: boolean }
      parent_coaching_mark: {
        Args: { p_action: string; p_delivery: string; p_tutor: string }
        Returns: Json
      }
      parent_coaching_reflection_rate: {
        Args: { p_since: string }
        Returns: {
          shared: number
          skipped: number
          tutor_decisions: number
          with_reflection: number
          written: number
        }[]
      }
      parent_coaching_row: {
        Args: {
          p: Database["public"]["Tables"]["parent_coaching_deliveries"]["Row"]
        }
        Returns: Json
      }
      parent_time_to_value: {
        Args: { p_since: string; p_until: string }
        Returns: {
          median_seconds: number
          p75_seconds: number
          reached: number
          signups: number
          within_target: number
        }[]
      }
      pin_v2_run_approach: {
        Args: { p_approach_id: string; p_run_id: string; p_user_id: string }
        Returns: string
      }
      practice_difficulty_actor_allowed: {
        Args: { p_actor: string }
        Returns: boolean
      }
      practice_success_band_metrics: {
        Args: { p_since: string; p_until: string }
        Returns: {
          assisted: number
          band_scope: string
          families: Json
          first_attempts: number
          lesson_id: string
          lesson_slug: string
          lesson_title: Json
          lower_pct: number
          min_sample: number
          status: string
          success_pct: number
          successes: number
          upper_pct: number
        }[]
      }
      probe_family_engagement_insight: {
        Args: { p_retain_days?: number }
        Returns: string
      }
      profile_cover_valid: { Args: { p_cover: Json }; Returns: boolean }
      profile_field_flags: { Args: { p_value: string }; Returns: string[] }
      profile_fields_flagged: { Args: { p_user: string }; Returns: boolean }
      profile_review_in_scope: { Args: { p_user: string }; Returns: boolean }
      promote_age_declaration: { Args: { p_user_id: string }; Returns: string }
      promote_due_age_declarations: { Args: never; Returns: number }
      prune_family_money_events: {
        Args: { p_retain_days?: number }
        Returns: number
      }
      publish_v2_lesson_version: {
        Args: {
          p_answer_keys: Json
          p_document: Json
          p_lesson_id: string
          p_locale: string
          p_release_manifest: Json
          p_version_id: string
        }
        Returns: Json
      }
      purge_closed_learning_bridge_prompts: {
        Args: { p_days: number }
        Returns: number
      }
      purge_expired_tutor_sessions: {
        Args: { p_limit?: number }
        Returns: {
          audio_paths: string[]
          session_id: string
        }[]
      }
      reach_goal_if_covered: { Args: { p_goal_id: string }; Returns: undefined }
      record_account_deletion_step: {
        Args: {
          p_depot_paths: Json
          p_error: string
          p_request: string
          p_result: Json
          p_step: string
        }
        Returns: boolean
      }
      record_age_declaration:
        | { Args: { p_age_band: string; p_user_id: string }; Returns: string }
        | {
            Args: {
              p_age_band: string
              p_birth_month: string
              p_user_id: string
            }
            Returns: string
          }
      record_content_defect_escape: {
        Args: {
          p_actor: string
          p_defect_kind: string
          p_gate_id: string
          p_lesson_id: string
        }
        Returns: string
      }
      record_course_assembly_incident: {
        Args: { p_course_id: string }
        Returns: undefined
      }
      record_decision_reflection: {
        Args: {
          p_actor: string
          p_reflection: string
          p_subject: string
          p_subject_id: string
        }
        Returns: string
      }
      record_family_autonomy_eligibility: {
        Args: { p_kid: string }
        Returns: number
      }
      record_family_autonomy_eligibility_all: { Args: never; Returns: number }
      record_family_evidence_purge: {
        Args: { p_cleared: number; p_failed: number; p_run: number }
        Returns: boolean
      }
      record_family_redemption_timing: {
        Args: { p_cost: number; p_holder: string; p_source: string }
        Returns: undefined
      }
      record_family_research_snapshots: {
        Args: { p_period?: string }
        Returns: number
      }
      record_forge_stage3_items: {
        Args: {
          p_items: Json
          p_lesson_id: string
          p_locale: string
          p_run_id: string
          p_version_id: string
        }
        Returns: number
      }
      record_game_run: {
        Args: {
          p_best_lap_ms: number
          p_character: string
          p_finish_ms: number
          p_game_id: string
          p_kart_body: string
          p_lap_ms: number[]
          p_lens: string
          p_metrics: Json
          p_mode: string
          p_rank: number
          p_run_key: string
          p_session_id: string
          p_speed_class: string
          p_track_id: string
          p_user_id: string
        }
        Returns: Json
      }
      record_learner_decisions: {
        Args: {
          p_course_id: string
          p_decisions: Json
          p_lesson_id: string
          p_locale: string
          p_topic_id: string
          p_user_id: string
        }
        Returns: number
      }
      record_learning_practice_day: {
        Args: { p_local_date: string; p_user_id: string }
        Returns: Json
      }
      record_learning_retention_release: {
        Args: { p_release_id: string; p_since: string; p_until?: string }
        Returns: number
      }
      record_lesson_grade: {
        Args: {
          p_client_attempt: number
          p_context: Json
          p_hints_used: number
          p_lesson_id: string
          p_max_attempts: number
          p_run_id: string
          p_segment_id: string
          p_user_id: string
          p_verdict: Json
        }
        Returns: Json
      }
      record_lesson_pedagogical_review: {
        Args: {
          p_actor: string
          p_author: string
          p_checks: Json
          p_document_version_id: string
          p_fingerprint: string
          p_forge_items: Json
          p_lesson_id: string
        }
        Returns: {
          code: string
          message: string
          ok: boolean
          result: string
          review_id: string
        }[]
      }
      record_mentor_age_calibration: {
        Args: { p_tier: number; p_user_id: string }
        Returns: number
      }
      record_mentor_judge_calibration: {
        Args: { p_calibration: Json; p_strata: Json }
        Returns: string
      }
      record_release_audit: {
        Args: {
          p_actor: string
          p_findings: number
          p_kind: string
          p_note: string
          p_release_id: string
          p_result: string
        }
        Returns: string
      }
      record_savings_bonus_explanation: {
        Args: {
          p_answer: number
          p_example_saved: number
          p_step: string
          p_user: string
        }
        Returns: boolean
      }
      record_social_protection_event: {
        Args: { p_event: string; p_subject: string; p_viewer: string }
        Returns: undefined
      }
      record_staff_access_review: {
        Args: {
          p_actor: string
          p_grant_key: string
          p_kind: string
          p_note: string
          p_outcome: string
          p_subject: string
        }
        Returns: string
      }
      record_staff_insight_check: {
        Args: { p_insight: string; p_outcome: string; p_source: string }
        Returns: undefined
      }
      record_staff_ip_sighting: {
        Args: { p_address: unknown; p_user_id: string }
        Returns: undefined
      }
      record_tutor_live_review: {
        Args: {
          p_issue: string
          p_reviewer: string
          p_segment_id: string
          p_verdict: string
        }
        Returns: string
      }
      record_v2_cpa_grade_retry: {
        Args: {
          p_document_version_id: string
          p_jti: string
          p_next_expires_at: string
          p_next_jti: string
          p_required_attempted_segment_id: string
          p_run_id: string
          p_segment_id: string
          p_user_id: string
          p_verdict: Json
        }
        Returns: Json
      }
      record_v2_first_unaided_stage: {
        Args: {
          p_document_version_id: string
          p_fading_group_id: string
          p_receipt_jti: string
          p_stage: string
          p_user_id: string
        }
        Returns: undefined
      }
      record_v2_lesson_grade: {
        Args: {
          p_document_version_id: string
          p_jti: string
          p_run_id: string
          p_segment_id: string
          p_user_id: string
          p_verdict: Json
        }
        Returns: Json
      }
      record_v2_lesson_grade_ordered: {
        Args: {
          p_document_version_id: string
          p_jti: string
          p_required_met_segment_id?: string
          p_run_id: string
          p_segment_id: string
          p_user_id: string
          p_verdict: Json
        }
        Returns: Json
      }
      record_v2_lesson_grade_retry: {
        Args: {
          p_document_version_id: string
          p_jti: string
          p_next_expires_at: string
          p_next_jti: string
          p_required_met_segment_id: string
          p_run_id: string
          p_segment_id: string
          p_user_id: string
          p_verdict: Json
        }
        Returns: Json
      }
      record_v2_segment_view: {
        Args: {
          p_document_version_id: string
          p_run_id: string
          p_segment_id: string
          p_user_id: string
        }
        Returns: boolean
      }
      record_v2_time_on_task: {
        Args: {
          p_receipt_jti: string
          p_run_id: string
          p_seconds: number
          p_segment_id: string
          p_user_id: string
        }
        Returns: boolean
      }
      record_wallet_split: {
        Args: {
          p_goal_id: string
          p_holder: string
          p_save: number
          p_share: number
          p_source: string
          p_spend: number
        }
        Returns: undefined
      }
      refresh_insights_rollups: {
        Args: { window_days?: number }
        Returns: string
      }
      reject_lesson_version: {
        Args: {
          p_actor: string
          p_document_version_id: string
          p_lesson_id: string
          p_reason: string
        }
        Returns: {
          code: string
          message: string
          ok: boolean
        }[]
      }
      release_course: {
        Args: { p_actor: string; p_course_id: string }
        Returns: {
          adventures_published: number
          code: string
          lessons_published: number
          message: string
          ok: boolean
          sagas_published: number
          topics_published: number
        }[]
      }
      release_lesson: {
        Args: { p_actor: string; p_lesson_id: string }
        Returns: {
          code: string
          lessons_published: number
          message: string
          ok: boolean
        }[]
      }
      release_lesson_version: {
        Args: {
          p_actor: string
          p_document_version_id: string
          p_lesson_id: string
        }
        Returns: {
          code: string
          message: string
          ok: boolean
        }[]
      }
      remove_social_follower: {
        Args: { p_follower_id: string; p_subject_id: string }
        Returns: boolean
      }
      request_account_deletion: {
        Args: {
          p_actor: string
          p_grace_days: number
          p_initiated_by: string
          p_population: string
          p_subject: string
        }
        Returns: {
          anon_ids: Json
          attempts: number
          cancelled_at: string | null
          completed_at: string | null
          depot_paths: Json
          held_reason: string | null
          id: string
          initiated_by: string
          last_error: string | null
          population: string
          requested_at: string
          scheduled_for: string
          started_at: string | null
          status: string
          steps: Json
          subject_id: string
        }
        SetofOptions: {
          from: "*"
          to: "account_deletion_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      request_age_correction: {
        Args: { p_age_band: string; p_birth_month: string; p_user: string }
        Returns: string
      }
      request_social_connection: {
        Args: { p_kid_user_id: string; p_requester_id: string }
        Returns: string
      }
      request_teen_connection: {
        Args: { p_requester_id: string; p_subject_id: string }
        Returns: string
      }
      resolve_gate_effectiveness_review: {
        Args: {
          p_actor: string
          p_gate_change_ref: string
          p_note: string
          p_outcome: string
          p_review_id: string
        }
        Returns: {
          code: string
          message: string
          ok: boolean
        }[]
      }
      resolve_practice_difficulty_review: {
        Args: {
          p_actor: string
          p_decision: string
          p_lower?: number
          p_min_sample?: number
          p_note: string
          p_review_id: string
          p_upper?: number
        }
        Returns: Json
      }
      resolve_social_review_case: {
        Args: { p_resolved_by: string; p_subject: string }
        Returns: boolean
      }
      review_profile_fields: { Args: { p_user: string }; Returns: boolean }
      revoke_own_guardian_link: {
        Args: { p_actor: string; p_kid_user_id: string }
        Returns: boolean
      }
      revoke_parent_verification: {
        Args: { p_actor: string; p_reason: string; p_user: string }
        Returns: string
      }
      revoke_staff_grant: {
        Args: {
          p_actor: string
          p_grant: string
          p_kind: string
          p_subject: string
        }
        Returns: string
      }
      run_due_scheduled_credits: {
        Args: { p_kid_user_id: string }
        Returns: number
      }
      run_social_graph_retention: { Args: { p_limit?: number }; Returns: Json }
      save_game_snapshot: {
        Args: {
          p_data: Json
          p_game_id: string
          p_revision: number
          p_user_id: string
        }
        Returns: Json
      }
      savings_bonus_comprehension: {
        Args: { p_since: string }
        Returns: {
          completed: number
          eligible: number
          shown: number
        }[]
      }
      savings_bonus_framing: { Args: { p_kid: string }; Returns: string }
      search_tutor_turns: {
        Args: {
          p_limit?: number
          p_locale?: string
          p_query: string
          p_user_id: string
        }
        Returns: {
          rank: number
          said_at: string
          seq: number
          session_id: string
          speaker: string
          turn_text: string
        }[]
      }
      set_coop_goal_guardian_consent: {
        Args: { p_enabled: boolean; p_guardian: string; p_kid: string }
        Returns: boolean
      }
      set_course_status: {
        Args: { p_actor: string; p_course_id: string; p_status: string }
        Returns: {
          code: string
          message: string
          ok: boolean
        }[]
      }
      set_kid_sign_in_ban: {
        Args: { p_banned: boolean; p_user: string }
        Returns: undefined
      }
      set_learning_streak_pause: {
        Args: {
          p_ends_on: string
          p_guardian_id: string
          p_learner_id: string
          p_starts_on: string
          p_today: string
        }
        Returns: Json
      }
      set_lesson_status: {
        Args: { p_actor: string; p_lesson_id: string; p_status: string }
        Returns: {
          code: string
          message: string
          ok: boolean
        }[]
      }
      set_practice_difficulty_band: {
        Args: {
          p_actor: string
          p_lesson_id: string
          p_lower: number
          p_min_sample: number
          p_rationale: string
          p_review_id?: string
          p_upper: number
        }
        Returns: Json
      }
      set_teen_analytics_preference: {
        Args: { p_enabled: boolean; p_user_id: string }
        Returns: boolean
      }
      set_teen_profile_discoverable: {
        Args: { p_discoverable: boolean; p_user: string }
        Returns: boolean
      }
      set_tutor_pack_status: {
        Args: {
          p_actor: string
          p_content_hash: string
          p_from: string
          p_pack_id: string
          p_to: string
        }
        Returns: Json
      }
      set_wallet_usual_split: {
        Args: {
          p_actor: string
          p_holder: string
          p_save: number
          p_share: number
          p_spend: number
        }
        Returns: boolean
      }
      share_destination_archive: {
        Args: { p_actor: string; p_destination: string }
        Returns: boolean
      }
      share_destination_create: {
        Args: {
          p_actor: string
          p_holder: string
          p_kind: string
          p_title: string
        }
        Returns: string
      }
      share_destination_steward: {
        Args: { p_actor: string; p_destination: string }
        Returns: boolean
      }
      share_gift_completion: {
        Args: { p_since: string; p_window_days?: number }
        Returns: {
          given_in_window: number
          given_later: number
          holders_with_share: number
          holders_without_destination: number
          pledged: number
          returned: number
          waiting: number
        }[]
      }
      share_gift_pledge: {
        Args: { p_amount: number; p_destination: string; p_holder: string }
        Returns: string
      }
      share_gift_settle: {
        Args: {
          p_actor: string
          p_gift: string
          p_note: string
          p_outcome: string
        }
        Returns: string
      }
      social_child_account: { Args: { p_user: string }; Returns: boolean }
      social_edge_consented: {
        Args: { p_followed: string; p_follower: string }
        Returns: boolean
      }
      social_family: { Args: { p_a: string; p_b: string }; Returns: boolean }
      social_governance_metrics: { Args: never; Returns: Json }
      social_guardian_is_current: {
        Args: { p_guardian: string; p_kid: string }
        Returns: boolean
      }
      social_messaging_surfaces: { Args: never; Returns: Json }
      social_pattern_qualifies: {
        Args: { p_subject: string }
        Returns: boolean
      }
      social_protection_count: {
        Args: {
          p_event: string
          p_related: boolean
          p_subject_tier: string
          p_viewer_tier: string
        }
        Returns: undefined
      }
      social_protection_metrics: { Args: { p_days: number }; Returns: Json }
      social_protection_related: {
        Args: { p_subject: string; p_viewer: string }
        Returns: boolean
      }
      social_retention_windows: { Args: never; Returns: Json }
      social_safety_metrics: { Args: never; Returns: Json }
      social_subject_visible: { Args: { p_subject: string }; Returns: boolean }
      social_tier: { Args: { p_user: string }; Returns: string }
      staff_access_review_status: {
        Args: { p_cadence_days?: number }
        Returns: Json
      }
      staff_insight_uptime: {
        Args: { p_insight: string; p_since: string }
        Returns: {
          checks: number
          last_checked_at: string
          last_outcome: string
          ok: number
          source: string
        }[]
      }
      stage3_open_items: {
        Args: { p_document_version_id: string; p_lesson_id: string }
        Returns: {
          created_at: string
          document_version_id: string | null
          flag_text: string
          gate: number
          id: string
          lesson_id: string
          locale: string | null
          resolution: string | null
          resolution_note: string | null
          review_id: string | null
          run_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "lesson_stage3_review_items"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      stage3_refuse_or_bypass: {
        Args: {
          p_document_version_id: string
          p_lesson_id: string
          p_refusal: string
        }
        Returns: undefined
      }
      stage3_release_refusal: {
        Args: { p_document_version_id?: string; p_lesson_id: string }
        Returns: string
      }
      stage3_review_checks_valid: { Args: { p_checks: Json }; Returns: boolean }
      stage3_review_items: {
        Args: never
        Returns: {
          allows_not_applicable: boolean
          item: string
          item_position: number
        }[]
      }
      start_game_session_checked: {
        Args: {
          p_band: string
          p_cap: number
          p_client_build: string
          p_expires_at: string
          p_game_id: string
          p_locale: string
          p_max_minutes: number
          p_mentor: string
          p_session_ref: string
          p_since: string
          p_user_id: string
        }
        Returns: {
          active_seconds: number
          band: string
          client_build: string | null
          close_reason: string | null
          ended_at: string | null
          expires_at: string
          game_id: string
          id: string
          last_active_at: string
          last_heartbeat_at: string
          locale: string
          max_minutes: number
          mentor: string | null
          session_ref: string
          started_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "game_sessions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      start_tutor_session_checked: {
        Args: {
          p_cap: number
          p_character: string
          p_companion: string
          p_consent_id: string
          p_course_id: string
          p_diorama: string
          p_intent: string
          p_locale: string
          p_since: string
          p_skill_key: string
          p_tier: number
          p_topic_id: string
          p_user_id: string
          p_voice_used: boolean
        }
        Returns: {
          canary_arm: string | null
          canary_proposal_id: string | null
          character: string
          close_reason: string | null
          closing_script: string | null
          companion: string | null
          consent_id: string | null
          cost_usd: number
          course_id: string | null
          diorama: string
          end_signal_evaluated: boolean | null
          ended_at: string | null
          evaluation_rubric_hash: string | null
          id: string
          intent: string
          locale: string
          opening: string | null
          purge_after: string
          segment_count: number
          skill_key: string | null
          started_at: string
          summary: Json | null
          telemetry_action_turns: number | null
          telemetry_evaluated_turns: number | null
          telemetry_mode: string | null
          tier: number
          topic_id: string | null
          turn_count: number
          user_id: string
          voice_used: boolean
          xp_awarded: number
        }[]
        SetofOptions: {
          from: "*"
          to: "tutor_sessions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      submit_social_report: {
        Args: {
          p_category: string
          p_note: string
          p_reporter_id: string
          p_subject_id: string
        }
        Returns: string
      }
      sweep_learning_practice_days: { Args: never; Returns: number }
      sync_practice_difficulty_reviews: {
        Args: { p_now: string; p_window_days: number }
        Returns: number
      }
      teen_archive_personal_reward: {
        Args: { p_holder: string; p_reward: string }
        Returns: boolean
      }
      teen_claim_personal_reward: {
        Args: { p_holder: string; p_reward: string }
        Returns: string
      }
      teen_create_personal_reward: {
        Args: { p_cost: number; p_holder: string; p_title: string }
        Returns: string
      }
      teen_decide_guardian_link: {
        Args: { p_confirm: boolean; p_link_id: string; p_teen: string }
        Returns: string
      }
      teen_discoverable_base_eligible: {
        Args: { p_user: string }
        Returns: boolean
      }
      teen_discoverable_eligible: { Args: { p_user: string }; Returns: boolean }
      teen_log_income: {
        Args: {
          p_goal_id: string
          p_holder: string
          p_save: number
          p_share: number
          p_source: string
          p_spend: number
        }
        Returns: string
      }
      teen_profile_discoverable: { Args: { p_user: string }; Returns: boolean }
      teen_release_goal: {
        Args: {
          p_amount: number
          p_destination: string
          p_goal_id: string
          p_holder: string
        }
        Returns: string
      }
      teen_wallet_adoption: {
        Args: { p_since: string }
        Returns: {
          adopters: number
          eligible_teens: number
          independent_adopters: number
          linked_adopters: number
          new_adopters: number
        }[]
      }
      teen_wallet_holder: { Args: { p_user: string }; Returns: boolean }
      tutor_fts_config: { Args: { p_locale: string }; Returns: unknown }
      tutor_verification_revoked: { Args: { p_user: string }; Returns: boolean }
      v2_document_approach_ids: {
        Args: { p_document: Json }
        Returns: string[]
      }
      v2_segment_approach_id: {
        Args: { p_document: Json; p_segment_id: string }
        Returns: string
      }
      wallet_access: { Args: { p_user: string }; Returns: Json }
      wallet_holder_kind: { Args: { p_user: string }; Returns: string }
      wallet_recommended_split: {
        Args: never
        Returns: {
          save_pct: number
          share_pct: number
          spend_pct: number
        }[]
      }
      wallet_split_coins: {
        Args: {
          p_amount: number
          p_save_pct: number
          p_share_pct: number
          p_spend_pct: number
        }
        Returns: {
          save: number
          share: number
          spend: number
        }[]
      }
      wallet_usual_split: {
        Args: { p_holder: string }
        Returns: {
          custom: boolean
          save_pct: number
          share_pct: number
          spend_pct: number
        }[]
      }
      withdraw_social_connection: {
        Args: { p_followed_id: string; p_follower_id: string }
        Returns: boolean
      }
      write_learner_memory_checked: {
        Args: {
          p_actor: string
          p_after_hash: string
          p_before_hash: string
          p_expected_before: string
          p_new_content: string
          p_session_id: string
          p_store: string
          p_user_id: string
        }
        Returns: string
      }
      write_learner_memory_pair_checked: {
        Args: {
          p_actor: string
          p_learner_after_hash: string
          p_learner_before_hash: string
          p_learner_expected: string
          p_learner_new: string
          p_pedagogy_after_hash: string
          p_pedagogy_before_hash: string
          p_pedagogy_expected: string
          p_pedagogy_new: string
          p_session_id: string
          p_user_id: string
        }
        Returns: Json
      }
      write_tutor_plan: {
        Args: { p_content: Json; p_session_id: string; p_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

