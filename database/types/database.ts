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
      courses: {
        Row: {
          created_at: string
          description: Json
          id: string
          position: number
          requires: Json
          slug: string
          status: string
          subject: string
          title: Json
        }
        Insert: {
          created_at?: string
          description?: Json
          id?: string
          position?: number
          requires?: Json
          slug: string
          status?: string
          subject?: string
          title?: Json
        }
        Update: {
          created_at?: string
          description?: Json
          id?: string
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
      families: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "families_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      family_members: {
        Row: {
          family_id: string
          joined_at: string
          member_role: string
          user_id: string
        }
        Insert: {
          family_id: string
          joined_at?: string
          member_role: string
          user_id: string
        }
        Update: {
          family_id?: string
          joined_at?: string
          member_role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_members_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_members_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "insights_family_engagement"
            referencedColumns: ["family_id"]
          },
          {
            foreignKeyName: "family_members_user_id_fkey"
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
      game_attempts: {
        Row: {
          created_at: string
          duration_seconds: number
          game_id: string
          id: string
          run_id: string
          score: number
          stats: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_seconds: number
          game_id: string
          id?: string
          run_id: string
          score: number
          stats?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number
          game_id?: string
          id?: string
          run_id?: string
          score?: number
          stats?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_attempts_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dataintel_users_sync"
            referencedColumns: ["user_id"]
          },
        ]
      }
      game_documents: {
        Row: {
          document: Json
          game_id: string
          locale: string
          schema_version: number
          updated_at: string
          validation: Json
        }
        Insert: {
          document: Json
          game_id: string
          locale: string
          schema_version?: number
          updated_at?: string
          validation?: Json
        }
        Update: {
          document?: Json
          game_id?: string
          locale?: string
          schema_version?: number
          updated_at?: string
          validation?: Json
        }
        Relationships: [
          {
            foreignKeyName: "game_documents_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      game_progress: {
        Row: {
          best_score: number
          game_id: string
          last_played_at: string | null
          passed: boolean
          plays: number
          updated_at: string
          user_id: string
          xp_earned: number
        }
        Insert: {
          best_score?: number
          game_id: string
          last_played_at?: string | null
          passed?: boolean
          plays?: number
          updated_at?: string
          user_id: string
          xp_earned?: number
        }
        Update: {
          best_score?: number
          game_id?: string
          last_played_at?: string | null
          passed?: boolean
          plays?: number
          updated_at?: string
          user_id?: string
          xp_earned?: number
        }
        Relationships: [
          {
            foreignKeyName: "game_progress_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
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
      games: {
        Row: {
          created_at: string
          estimated_minutes: number
          id: string
          mechanic: string
          position: number
          slug: string
          status: string
          tier: number
          title: Json
          topic_id: string
          xp_max: number
        }
        Insert: {
          created_at?: string
          estimated_minutes?: number
          id?: string
          mechanic: string
          position: number
          slug: string
          status?: string
          tier: number
          title?: Json
          topic_id: string
          xp_max?: number
        }
        Update: {
          created_at?: string
          estimated_minutes?: number
          id?: string
          mechanic?: string
          position?: number
          slug?: string
          status?: string
          tier?: number
          title?: Json
          topic_id?: string
          xp_max?: number
        }
        Relationships: [
          {
            foreignKeyName: "games_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
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
      learning_events: {
        Row: {
          anon_id: string | null
          created_at: string
          device: string | null
          event: string
          game_id: string | null
          id: number
          lesson_id: string | null
          locale: string | null
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
          created_at?: string
          device?: string | null
          event: string
          game_id?: string | null
          id?: never
          lesson_id?: string | null
          locale?: string | null
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
          created_at?: string
          device?: string | null
          event?: string
          game_id?: string | null
          id?: never
          lesson_id?: string | null
          locale?: string | null
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
          lesson_id: string
          locale: string
          schema_version: number
          updated_at: string
        }
        Insert: {
          answer_keys?: Json
          audio?: Json
          document: Json
          lesson_id: string
          locale: string
          schema_version?: number
          updated_at?: string
        }
        Update: {
          answer_keys?: Json
          audio?: Json
          document?: Json
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
          created_at: string
          hints_used: number
          id: string
          lesson_id: string
          run_id: string | null
          score: number
          segment_id: string
          user_id: string
        }
        Insert: {
          attempt_number: number
          created_at?: string
          hints_used?: number
          id?: string
          lesson_id: string
          run_id?: string | null
          score: number
          segment_id: string
          user_id: string
        }
        Update: {
          attempt_number?: number
          created_at?: string
          hints_used?: number
          id?: string
          lesson_id?: string
          run_id?: string | null
          score?: number
          segment_id?: string
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
      parent_verifications: {
        Row: {
          address: string
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
          address?: string
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
          address?: string
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
          assigned_by: string
          assigned_to: string
          created_at: string
          family_id: string
          id: string
          reward: Json
          status: string
          title: string
        }
        Insert: {
          assigned_by: string
          assigned_to: string
          created_at?: string
          family_id: string
          id?: string
          reward?: Json
          status?: string
          title: string
        }
        Update: {
          assigned_by?: string
          assigned_to?: string
          created_at?: string
          family_id?: string
          id?: string
          reward?: Json
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
            foreignKeyName: "tasks_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "insights_family_engagement"
            referencedColumns: ["family_id"]
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
          position: number
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
          position: number
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
          position?: number
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
    }
    Views: {
      dataintel_events_sync: {
        Row: {
          anon_id: string | null
          created_at: string | null
          device: string | null
          event: string | null
          event_id: number | null
          lesson_id: string | null
          locale: string | null
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
          created_at?: string | null
          device?: string | null
          event?: string | null
          event_id?: number | null
          lesson_id?: string | null
          locale?: string | null
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
          created_at?: string | null
          device?: string | null
          event?: string | null
          event_id?: number | null
          lesson_id?: string | null
          locale?: string | null
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
          lesson_id: string | null
          segment_count: number | null
          slug: string | null
          title_en: string | null
          title_es: string | null
          title_pt: string | null
        }
        Relationships: [
          {
            foreignKeyName: "adventures_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
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
          family_created_at: string | null
          family_id: string | null
          last_task_at: string | null
          members: number | null
          tasks_completed: number | null
          tasks_created: number | null
        }
        Relationships: []
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
      is_blocked: { Args: { a: string; b: string }; Returns: boolean }
      is_verified_guardian_of: { Args: { kid: string }; Returns: boolean }
      refresh_insights_rollups: {
        Args: { window_days?: number }
        Returns: string
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

