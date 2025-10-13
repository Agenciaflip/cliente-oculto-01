export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      analysis_metrics: {
        Row: {
          analysis_id: string
          created_at: string | null
          experience_score: number | null
          id: string
        }
        Insert: {
          analysis_id: string
          created_at?: string | null
          experience_score?: number | null
          id?: string
        }
        Update: {
          analysis_id?: string
          created_at?: string | null
          experience_score?: number | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analysis_metrics_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: true
            referencedRelation: "analysis_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      analysis_requests: {
        Row: {
          ai_gender: string | null
          analysis_depth: string
          business_segment: string | null
          city: string | null
          cnpj: string | null
          company_name: string | null
          competitor_description: string | null
          competitor_url: string | null
          completed_at: string | null
          created_at: string
          first_reactivation_sent: boolean | null
          first_reactivation_sent_at: string | null
          id: string
          investigation_goals: string | null
          last_message_at: string | null
          metadata: Json | null
          metrics: Json | null
          persona: Database["public"]["Enums"]["persona_type"]
          processing_stage: string | null
          processing_started_at: string | null
          questions_strategy: Json | null
          research_data: Json | null
          retry_count: number | null
          started_at: string | null
          status: Database["public"]["Enums"]["analysis_status"]
          target_phone: string
          timeout_minutes: number | null
          user_id: string
        }
        Insert: {
          ai_gender?: string | null
          analysis_depth?: string
          business_segment?: string | null
          city?: string | null
          cnpj?: string | null
          company_name?: string | null
          competitor_description?: string | null
          competitor_url?: string | null
          completed_at?: string | null
          created_at?: string
          first_reactivation_sent?: boolean | null
          first_reactivation_sent_at?: string | null
          id?: string
          investigation_goals?: string | null
          last_message_at?: string | null
          metadata?: Json | null
          metrics?: Json | null
          persona?: Database["public"]["Enums"]["persona_type"]
          processing_stage?: string | null
          processing_started_at?: string | null
          questions_strategy?: Json | null
          research_data?: Json | null
          retry_count?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["analysis_status"]
          target_phone: string
          timeout_minutes?: number | null
          user_id: string
        }
        Update: {
          ai_gender?: string | null
          analysis_depth?: string
          business_segment?: string | null
          city?: string | null
          cnpj?: string | null
          company_name?: string | null
          competitor_description?: string | null
          competitor_url?: string | null
          completed_at?: string | null
          created_at?: string
          first_reactivation_sent?: boolean | null
          first_reactivation_sent_at?: string | null
          id?: string
          investigation_goals?: string | null
          last_message_at?: string | null
          metadata?: Json | null
          metrics?: Json | null
          persona?: Database["public"]["Enums"]["persona_type"]
          processing_stage?: string | null
          processing_started_at?: string | null
          questions_strategy?: Json | null
          research_data?: Json | null
          retry_count?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["analysis_status"]
          target_phone?: string
          timeout_minutes?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analysis_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_messages: {
        Row: {
          analysis_id: string
          content: string
          created_at: string
          id: string
          metadata: Json | null
          role: string
        }
        Insert: {
          analysis_id: string
          content: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role: string
        }
        Update: {
          analysis_id?: string
          content?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_messages_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analysis_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_logo: string | null
          created_at: string
          credits_remaining: number
          full_name: string | null
          id: string
          last_activity_at: string | null
          notification_email: string | null
          plan: string | null
          stripe_customer_id: string | null
          subscription_tier: Database["public"]["Enums"]["subscription_tier"]
          updated_at: string
        }
        Insert: {
          company_logo?: string | null
          created_at?: string
          credits_remaining?: number
          full_name?: string | null
          id: string
          last_activity_at?: string | null
          notification_email?: string | null
          plan?: string | null
          stripe_customer_id?: string | null
          subscription_tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
        }
        Update: {
          company_logo?: string | null
          created_at?: string
          credits_remaining?: number
          full_name?: string | null
          id?: string
          last_activity_at?: string | null
          notification_email?: string | null
          plan?: string | null
          stripe_customer_id?: string | null
          subscription_tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
        }
        Relationships: []
      }
      sales_analysis: {
        Row: {
          analysis_id: string
          categories: Json
          comparative_analysis: string | null
          competitive_positioning: string | null
          conversion_probability: number | null
          created_at: string | null
          id: string
          overall_score: number
          recommended_actions: string[] | null
          sales_methodology_detected: string[] | null
        }
        Insert: {
          analysis_id: string
          categories: Json
          comparative_analysis?: string | null
          competitive_positioning?: string | null
          conversion_probability?: number | null
          created_at?: string | null
          id?: string
          overall_score: number
          recommended_actions?: string[] | null
          sales_methodology_detected?: string[] | null
        }
        Update: {
          analysis_id?: string
          categories?: Json
          comparative_analysis?: string | null
          competitive_positioning?: string | null
          conversion_probability?: number | null
          created_at?: string | null
          id?: string
          overall_score?: number
          recommended_actions?: string[] | null
          sales_methodology_detected?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_analysis_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: true
            referencedRelation: "analysis_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          plan_tier: Database["public"]["Enums"]["subscription_tier"]
          status: string
          stripe_subscription_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan_tier: Database["public"]["Enums"]["subscription_tier"]
          status: string
          stripe_subscription_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan_tier?: Database["public"]["Enums"]["subscription_tier"]
          status?: string
          stripe_subscription_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          created_at: string | null
          id: string
          message: string
          sender_id: string
          sender_type: string
          ticket_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          sender_id: string
          sender_type: string
          ticket_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          sender_id?: string
          sender_type?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          created_at: string | null
          id: string
          priority: string | null
          status: string
          subject: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          priority?: string | null
          status?: string
          subject: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          priority?: string | null
          status?: string
          subject?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_tracking: {
        Row: {
          analyses_count: number
          analyses_limit: number
          created_at: string
          id: string
          month: string
          user_id: string
        }
        Insert: {
          analyses_count?: number
          analyses_limit: number
          created_at?: string
          id?: string
          month: string
          user_id: string
        }
        Update: {
          analyses_count?: number
          analyses_limit?: number
          created_at?: string
          id?: string
          month?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_tracking_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_delete_user: {
        Args: { _target_user_id: string }
        Returns: Json
      }
      get_all_users_for_admin: {
        Args: Record<PropertyKey, never>
        Returns: {
          created_at: string
          credits_remaining: number
          email: string
          full_name: string
          last_activity_at: string
          plan: string
          subscription_tier: Database["public"]["Enums"]["subscription_tier"]
          user_id: string
        }[]
      }
      get_user_email: {
        Args: { _user_id: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      analysis_status:
        | "pending"
        | "researching"
        | "chatting"
        | "analyzing"
        | "completed"
        | "failed"
        | "processing"
      app_role: "admin" | "user"
      persona_type:
        | "interested"
        | "price_hunter"
        | "competitor"
        | "custom"
        | "ideal_client"
        | "curious_client"
        | "difficult_client"
      subscription_tier: "free" | "basic" | "premium"
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
    Enums: {
      analysis_status: [
        "pending",
        "researching",
        "chatting",
        "analyzing",
        "completed",
        "failed",
        "processing",
      ],
      app_role: ["admin", "user"],
      persona_type: [
        "interested",
        "price_hunter",
        "competitor",
        "custom",
        "ideal_client",
        "curious_client",
        "difficult_client",
      ],
      subscription_tier: ["free", "basic", "premium"],
    },
  },
} as const
