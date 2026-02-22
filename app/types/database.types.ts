export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      lesson_signs: {
        Row: {
          id: string
          is_new: boolean | null
          lesson_id: string | null
          order_index: number | null
          sign_id: string | null
        }
        Insert: {
          id?: string
          is_new?: boolean | null
          lesson_id?: string | null
          order_index?: number | null
          sign_id?: string | null
        }
        Update: {
          id?: string
          is_new?: boolean | null
          lesson_id?: string | null
          order_index?: number | null
          sign_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lesson_signs_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_signs_sign_id_fkey"
            columns: ["sign_id"]
            isOneToOne: false
            referencedRelation: "signs"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          created_at: string | null
          gemini_prompt: string | null
          gemini_response: Json | null
          id: string
          intro_text: string | null
          learning_stage: string | null
          lesson_type: string | null
          theme: string | null
          title: string | null
        }
        Insert: {
          created_at?: string | null
          gemini_prompt?: string | null
          gemini_response?: Json | null
          id?: string
          intro_text?: string | null
          learning_stage?: string | null
          lesson_type?: string | null
          theme?: string | null
          title?: string | null
        }
        Update: {
          created_at?: string | null
          gemini_prompt?: string | null
          gemini_response?: Json | null
          id?: string
          intro_text?: string | null
          learning_stage?: string | null
          lesson_type?: string | null
          theme?: string | null
          title?: string | null
        }
        Relationships: []
      }
      practice_problems: {
        Row: {
          answered_at: string | null
          attempt_count: number | null
          hints_used: number | null
          id: string
          is_correct: boolean | null
          knowledge_bucket: string | null
          model_confidence: number | null
          problem_type: string | null
          prompt_text: string | null
          session_id: string | null
          sign_id: string | null
          user_answer: string | null
          video_path: string | null
        }
        Insert: {
          answered_at?: string | null
          attempt_count?: number | null
          hints_used?: number | null
          id?: string
          is_correct?: boolean | null
          knowledge_bucket?: string | null
          model_confidence?: number | null
          problem_type?: string | null
          prompt_text?: string | null
          session_id?: string | null
          sign_id?: string | null
          user_answer?: string | null
          video_path?: string | null
        }
        Update: {
          answered_at?: string | null
          attempt_count?: number | null
          hints_used?: number | null
          id?: string
          is_correct?: boolean | null
          knowledge_bucket?: string | null
          model_confidence?: number | null
          problem_type?: string | null
          prompt_text?: string | null
          session_id?: string | null
          sign_id?: string | null
          user_answer?: string | null
          video_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "practice_problems_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "practice_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_problems_sign_id_fkey"
            columns: ["sign_id"]
            isOneToOne: false
            referencedRelation: "signs"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_sessions: {
        Row: {
          completed_at: string | null
          correct_count: number | null
          id: string
          score: number | null
          session_type: string | null
          started_at: string | null
          status: string | null
          total_problems: number | null
          user_id: string | null
          user_lesson_id: string | null
        }
        Insert: {
          completed_at?: string | null
          correct_count?: number | null
          id?: string
          score?: number | null
          session_type?: string | null
          started_at?: string | null
          status?: string | null
          total_problems?: number | null
          user_id?: string | null
          user_lesson_id?: string | null
        }
        Update: {
          completed_at?: string | null
          correct_count?: number | null
          id?: string
          score?: number | null
          session_type?: string | null
          started_at?: string | null
          status?: string | null
          total_problems?: number | null
          user_id?: string | null
          user_lesson_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "practice_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_sessions_user_lesson_id_fkey"
            columns: ["user_lesson_id"]
            isOneToOne: false
            referencedRelation: "user_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      signs: {
        Row: {
          ai_description: string | null
          ai_fun_fact: string | null
          ai_generated_at: string | null
          ai_mnemonic: string | null
          category: string | null
          created_at: string | null
          difficulty: number | null
          display_text: string
          id: string
          is_active: boolean | null
          model_label: string | null
          sign_type: string | null
          slug: string
          video_path: string | null
        }
        Insert: {
          ai_description?: string | null
          ai_fun_fact?: string | null
          ai_generated_at?: string | null
          ai_mnemonic?: string | null
          category?: string | null
          created_at?: string | null
          difficulty?: number | null
          display_text: string
          id?: string
          is_active?: boolean | null
          model_label?: string | null
          sign_type?: string | null
          slug: string
          video_path?: string | null
        }
        Update: {
          ai_description?: string | null
          ai_fun_fact?: string | null
          ai_generated_at?: string | null
          ai_mnemonic?: string | null
          category?: string | null
          created_at?: string | null
          difficulty?: number | null
          display_text?: string
          id?: string
          is_active?: boolean | null
          model_label?: string | null
          sign_type?: string | null
          slug?: string
          video_path?: string | null
        }
        Relationships: []
      }
      streaks: {
        Row: {
          current_streak: number | null
          id: string
          last_activity: string | null
          longest_streak: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          current_streak?: number | null
          id?: string
          last_activity?: string | null
          longest_streak?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          current_streak?: number | null
          id?: string
          last_activity?: string | null
          longest_streak?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "streaks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_lessons: {
        Row: {
          completed_at: string | null
          id: string
          lesson_id: string | null
          practice_done: boolean | null
          score: number | null
          started_at: string | null
          status: string | null
          user_id: string | null
          xp_earned: number | null
        }
        Insert: {
          completed_at?: string | null
          id?: string
          lesson_id?: string | null
          practice_done?: boolean | null
          score?: number | null
          started_at?: string | null
          status?: string | null
          user_id?: string | null
          xp_earned?: number | null
        }
        Update: {
          completed_at?: string | null
          id?: string
          lesson_id?: string | null
          practice_done?: boolean | null
          score?: number | null
          started_at?: string | null
          status?: string | null
          user_id?: string | null
          xp_earned?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "user_lessons_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_lessons_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_sign_progress: {
        Row: {
          created_at: string | null
          id: string
          last_practiced: string | null
          mastery_score: number | null
          mastery_status: string | null
          sign_id: string | null
          times_correct: number | null
          times_incorrect: number | null
          times_seen: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_practiced?: string | null
          mastery_score?: number | null
          mastery_status?: string | null
          sign_id?: string | null
          times_correct?: number | null
          times_incorrect?: number | null
          times_seen?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          last_practiced?: string | null
          mastery_score?: number | null
          mastery_status?: string | null
          sign_id?: string | null
          times_correct?: number | null
          times_incorrect?: number | null
          times_seen?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_sign_progress_sign_id_fkey"
            columns: ["sign_id"]
            isOneToOne: false
            referencedRelation: "signs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_sign_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string | null
          display_name: string | null
          id: string
          learning_stage: string | null
          level: number | null
          onboarding_complete: boolean | null
          updated_at: string | null
          xp: number | null
        }
        Insert: {
          created_at?: string | null
          display_name?: string | null
          id: string
          learning_stage?: string | null
          level?: number | null
          onboarding_complete?: boolean | null
          updated_at?: string | null
          xp?: number | null
        }
        Update: {
          created_at?: string | null
          display_name?: string | null
          id?: string
          learning_stage?: string | null
          level?: number | null
          onboarding_complete?: boolean | null
          updated_at?: string | null
          xp?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
