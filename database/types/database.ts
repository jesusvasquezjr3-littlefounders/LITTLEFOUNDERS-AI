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
          id: string
          narrative_arc: string | null
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
          id?: string
          narrative_arc?: string | null
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
          id?: string
          narrative_arc?: string | null
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
          first_name: string
          id: string
          image_bucket: string
          image_ext: string
          image_hash: string
          image_url: string
          kid_user_id: string
          token: string
        }
        Insert: {
          achievement_kind: string
          achievement_label: string
          age_band?: string | null
          created_at?: string
          created_by: string
          first_name: string
          id?: string
          image_bucket: string
          image_ext: string
          image_hash: string
          image_url: string
          kid_user_id: string
          token: string
        }
        Update: {
          achievement_kind?: string
          achievement_label?: string
          age_band?: string | null
          created_at?: string
          created_by?: string
          first_name?: string
          id?: string
          image_bucket?: string
          image_ext?: string
          image_hash?: string
          image_url?: string
          kid_user_id?: string
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
          course_id: string
          verified_at: string
        }
        Insert: {
          checks?: Json
          course_id: string
          verified_at?: string
        }
        Update: {
          checks?: Json
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
      guardian_links: {
        Row: {
          created_at: string
          id: string
          kid_user_id: string
          parent_user_id: string
          verification_status: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kid_user_id: string
          parent_user_id: string
          verification_status?: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kid_user_id?: string
          parent_user_id?: string
          verification_status?: string
          verified_at?: string | null
        }
        Relationships: [
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
      learning_stats: {
        Row: {
          last_active_date: string | null
          lessons_completed: number
          longest_streak: number
          minutes_learned: number
          streak_days: number
          updated_at: string
          user_id: string
          xp_points: number
        }
        Insert: {
          last_active_date?: string | null
          lessons_completed?: number
          longest_streak?: number
          minutes_learned?: number
          streak_days?: number
          updated_at?: string
          user_id: string
          xp_points?: number
        }
        Update: {
          last_active_date?: string | null
          lessons_completed?: number
          longest_streak?: number
          minutes_learned?: number
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
      lessons: {
        Row: {
          cast: Json
          created_at: string
          difficulty: number
          estimated_minutes: number
          id: string
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
      parent_verifications: {
        Row: {
          birth_date: string
          checks: Json
          created_at: string
          document_type: string
          given_names: string
          id: string
          method: string
          status: string
          surnames: string
          user_id: string
          verified_at: string
        }
        Insert: {
          birth_date: string
          checks?: Json
          created_at?: string
          document_type?: string
          given_names: string
          id?: string
          method?: string
          status?: string
          surnames: string
          user_id: string
          verified_at?: string
        }
        Update: {
          birth_date?: string
          checks?: Json
          created_at?: string
          document_type?: string
          given_names?: string
          id?: string
          method?: string
          status?: string
          surnames?: string
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
      profiles: {
        Row: {
          birth_date: string | null
          cover: Json
          created_at: string
          display_name: string
          locale: string
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
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          kid_user_id: string
          status: string
        }
        Insert: {
          catalog_id: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          kid_user_id: string
          status?: string
        }
        Update: {
          catalog_id?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
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
            foreignKeyName: "redemptions_kid_user_id_fkey"
            columns: ["kid_user_id"]
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
      savings_goals: {
        Row: {
          created_at: string
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
      tasks: {
        Row: {
          allocated: boolean
          assigned_by: string
          assigned_to: string
          created_at: string
          due_at: string | null
          evidence_bucket: string | null
          evidence_ext: string | null
          evidence_hash: string | null
          evidence_uploaded_at: string | null
          id: string
          recurrence: string
          reward_coins: number
          status: string
          title: string
        }
        Insert: {
          allocated?: boolean
          assigned_by: string
          assigned_to: string
          created_at?: string
          due_at?: string | null
          evidence_bucket?: string | null
          evidence_ext?: string | null
          evidence_hash?: string | null
          evidence_uploaded_at?: string | null
          id?: string
          recurrence?: string
          reward_coins: number
          status?: string
          title: string
        }
        Update: {
          allocated?: boolean
          assigned_by?: string
          assigned_to?: string
          created_at?: string
          due_at?: string | null
          evidence_bucket?: string | null
          evidence_ext?: string | null
          evidence_hash?: string | null
          evidence_uploaded_at?: string | null
          id?: string
          recurrence?: string
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
          created_at: string
          id: string
          locale: string
          pack: Json
          released_at: string | null
          released_by: string | null
          skill_key: string
          status: string
          tier: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          locale: string
          pack: Json
          released_at?: string | null
          released_by?: string | null
          skill_key: string
          status?: string
          tier: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          locale?: string
          pack?: Json
          released_at?: string | null
          released_by?: string | null
          skill_key?: string
          status?: string
          tier?: number
          updated_at?: string
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
      tutor_sessions: {
        Row: {
          character: string
          close_reason: string | null
          companion: string | null
          consent_id: string | null
          cost_usd: number
          course_id: string | null
          diorama: string
          ended_at: string | null
          id: string
          intent: string
          locale: string
          purge_after: string
          segment_count: number
          skill_key: string | null
          started_at: string
          summary: Json | null
          tier: number
          topic_id: string | null
          turn_count: number
          user_id: string
          voice_used: boolean
          xp_awarded: number
        }
        Insert: {
          character: string
          close_reason?: string | null
          companion?: string | null
          consent_id?: string | null
          cost_usd?: number
          course_id?: string | null
          diorama: string
          ended_at?: string | null
          id?: string
          intent: string
          locale: string
          purge_after?: string
          segment_count?: number
          skill_key?: string | null
          started_at?: string
          summary?: Json | null
          tier: number
          topic_id?: string | null
          turn_count?: number
          user_id: string
          voice_used?: boolean
          xp_awarded?: number
        }
        Update: {
          character?: string
          close_reason?: string | null
          companion?: string | null
          consent_id?: string | null
          cost_usd?: number
          course_id?: string | null
          diorama?: string
          ended_at?: string | null
          id?: string
          intent?: string
          locale?: string
          purge_after?: string
          segment_count?: number
          skill_key?: string | null
          started_at?: string
          summary?: Json | null
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
      tutor_trajectory_step: {
        Row: {
          created_at: string
          difficulty: number
          event_kind: string
          id: string
          kc_id: string | null
          kc_mode: string | null
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
          id?: string
          kc_id?: string | null
          kc_mode?: string | null
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
          id?: string
          kc_id?: string | null
          kc_mode?: string | null
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
          granted_by: string
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
          granted_by: string
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
          granted_by?: string
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
      wallet_ledger: {
        Row: {
          amount: number
          bucket: string
          created_at: string
          created_by: string
          goal_id: string | null
          id: number
          kid_user_id: string
          reason: string
          redemption_id: string | null
          task_id: string | null
        }
        Insert: {
          amount: number
          bucket: string
          created_at?: string
          created_by: string
          goal_id?: string | null
          id?: never
          kid_user_id: string
          reason: string
          redemption_id?: string | null
          task_id?: string | null
        }
        Update: {
          amount?: number
          bucket?: string
          created_at?: string
          created_by?: string
          goal_id?: string | null
          id?: never
          kid_user_id?: string
          reason?: string
          redemption_id?: string | null
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
            foreignKeyName: "wallet_ledger_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
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
      get_completed_course_badges: {
        Args: { p_user_id: string }
        Returns: {
          badge_asset: string
          completed_at: string
          course_slug: string
          course_title: Json
        }[]
      }
      has_active_tutor_voice_consent: {
        Args: { p_user_id: string }
        Returns: boolean
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
      is_blocked: { Args: { a: string; b: string }; Returns: boolean }
      is_verified_guardian_of: { Args: { kid: string }; Returns: boolean }
      purge_expired_tutor_sessions: {
        Args: { p_limit?: number }
        Returns: {
          audio_paths: string[]
          session_id: string
        }[]
      }
      record_staff_ip_sighting: {
        Args: { p_address: unknown; p_user_id: string }
        Returns: undefined
      }
      refresh_insights_rollups: {
        Args: { window_days?: number }
        Returns: string
      }
      release_course: {
        Args: { p_course_id: string }
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
          character: string
          close_reason: string | null
          companion: string | null
          consent_id: string | null
          cost_usd: number
          course_id: string | null
          diorama: string
          ended_at: string | null
          id: string
          intent: string
          locale: string
          purge_after: string
          segment_count: number
          skill_key: string | null
          started_at: string
          summary: Json | null
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
      tutor_fts_config: { Args: { p_locale: string }; Returns: unknown }
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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

