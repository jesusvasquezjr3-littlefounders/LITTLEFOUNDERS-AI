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
          id: string
          slug: string
          status: string
          title: Json
        }
        Insert: {
          created_at?: string
          id?: string
          slug: string
          status?: string
          title?: Json
        }
        Update: {
          created_at?: string
          id?: string
          slug?: string
          status?: string
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
          lessons_completed: number
          minutes_learned: number
          streak_days: number
          updated_at: string
          user_id: string
          xp_points: number
        }
        Insert: {
          lessons_completed?: number
          minutes_learned?: number
          streak_days?: number
          updated_at?: string
          user_id: string
          xp_points?: number
        }
        Update: {
          lessons_completed?: number
          minutes_learned?: number
          streak_days?: number
          updated_at?: string
          user_id?: string
          xp_points?: number
        }
        Relationships: []
      }
      lessons: {
        Row: {
          content: Json
          course_id: string
          created_at: string
          id: string
          position: number
          schema_version: number
        }
        Insert: {
          content?: Json
          course_id: string
          created_at?: string
          id?: string
          position?: number
          schema_version?: number
        }
        Update: {
          content?: Json
          course_id?: string
          created_at?: string
          id?: string
          position?: number
          schema_version?: number
        }
        Relationships: [
          {
            foreignKeyName: "lessons_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
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

