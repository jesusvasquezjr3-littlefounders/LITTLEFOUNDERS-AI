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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
      }
      learning_stats: {
        Row: {
          last_active_date: string | null
          lessons_completed: number
          minutes_learned: number
          streak_days: number
          updated_at: string
          user_id: string
          xp_points: number
        }
        Insert: {
          last_active_date?: string | null
          lessons_completed?: number
          minutes_learned?: number
          streak_days?: number
          updated_at?: string
          user_id: string
          xp_points?: number
        }
        Update: {
          last_active_date?: string | null
          lessons_completed?: number
          minutes_learned?: number
          streak_days?: number
          updated_at?: string
          user_id?: string
          xp_points?: number
        }
        Relationships: []
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
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_segment_attempts: {
        Row: {
          attempt_number: number
          created_at: string
          id: string
          lesson_id: string
          score: number
          segment_id: string
          user_id: string
        }
        Insert: {
          attempt_number: number
          created_at?: string
          id?: string
          lesson_id: string
          score: number
          segment_id: string
          user_id: string
        }
        Update: {
          attempt_number?: number
          created_at?: string
          id?: string
          lesson_id?: string
          score?: number
          segment_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_segment_attempts_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
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
        Relationships: []
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
            foreignKeyName: "tasks_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
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
          learning_objective: Json
          position: number
          prior_knowledge: string
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
          learning_objective?: Json
          position: number
          prior_knowledge?: string
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
          learning_objective?: Json
          position?: number
          prior_knowledge?: string
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
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_blocked: { Args: { a: string; b: string }; Returns: boolean }
      is_verified_guardian_of: { Args: { kid: string }; Returns: boolean }
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

