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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      approval_requests: {
        Row: {
          action_params: Json | null
          action_type: string
          approved_at: string | null
          approved_by: string | null
          created_at: string
          escalated_to: string | null
          escalation_count: number | null
          id: string
          incident_id: string | null
          playbook_id: string | null
          reason: string | null
          requested_at: string
          requested_by: string | null
          sla_deadline: string | null
          status: string
        }
        Insert: {
          action_params?: Json | null
          action_type: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          escalated_to?: string | null
          escalation_count?: number | null
          id?: string
          incident_id?: string | null
          playbook_id?: string | null
          reason?: string | null
          requested_at?: string
          requested_by?: string | null
          sla_deadline?: string | null
          status?: string
        }
        Update: {
          action_params?: Json | null
          action_type?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          escalated_to?: string | null
          escalation_count?: number | null
          id?: string
          incident_id?: string | null
          playbook_id?: string | null
          reason?: string | null
          requested_at?: string
          requested_by?: string | null
          sla_deadline?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_requests_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_requests_playbook_id_fkey"
            columns: ["playbook_id"]
            isOneToOne: false
            referencedRelation: "playbooks"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          resource_id: string | null
          resource_type: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      compliance_audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          actor_type: string
          created_at: string
          details: Json | null
          execution_mode: string | null
          id: string
          ip_address: string | null
          resource_id: string | null
          resource_type: string
          result: string
          tenant_id: string | null
          timestamp: string
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          actor_type: string
          created_at?: string
          details?: Json | null
          execution_mode?: string | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type: string
          result: string
          tenant_id?: string | null
          timestamp?: string
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          actor_type?: string
          created_at?: string
          details?: Json | null
          execution_mode?: string | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type?: string
          result?: string
          tenant_id?: string | null
          timestamp?: string
        }
        Relationships: []
      }
      incident_timeline: {
        Row: {
          details: string | null
          id: string
          incident_id: string
          stage: string
          timestamp: string
        }
        Insert: {
          details?: string | null
          id?: string
          incident_id: string
          stage: string
          timestamp?: string
        }
        Update: {
          details?: string | null
          id?: string
          incident_id?: string
          stage?: string
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "incident_timeline_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          ai_analysis: Json | null
          assigned_to: string | null
          classification: string | null
          confidence: number | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          dst_ip: string | null
          event_type: string
          evidence: string[] | null
          file_hash: string | null
          id: string
          incident_number: string
          message: string | null
          mitre_tactic: string | null
          mitre_technique: string | null
          raw_log: Json | null
          recommended_actions: string[] | null
          risk_level: string | null
          sandbox_result: Json | null
          severity: number
          src_ip: string | null
          status: string | null
          timestamp: string
          updated_at: string
        }
        Insert: {
          ai_analysis?: Json | null
          assigned_to?: string | null
          classification?: string | null
          confidence?: number | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          dst_ip?: string | null
          event_type: string
          evidence?: string[] | null
          file_hash?: string | null
          id?: string
          incident_number: string
          message?: string | null
          mitre_tactic?: string | null
          mitre_technique?: string | null
          raw_log?: Json | null
          recommended_actions?: string[] | null
          risk_level?: string | null
          sandbox_result?: Json | null
          severity?: number
          src_ip?: string | null
          status?: string | null
          timestamp?: string
          updated_at?: string
        }
        Update: {
          ai_analysis?: Json | null
          assigned_to?: string | null
          classification?: string | null
          confidence?: number | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          dst_ip?: string | null
          event_type?: string
          evidence?: string[] | null
          file_hash?: string | null
          id?: string
          incident_number?: string
          message?: string | null
          mitre_tactic?: string | null
          mitre_technique?: string | null
          raw_log?: Json | null
          recommended_actions?: string[] | null
          risk_level?: string | null
          sandbox_result?: Json | null
          severity?: number
          src_ip?: string | null
          status?: string | null
          timestamp?: string
          updated_at?: string
        }
        Relationships: []
      }
      integrations: {
        Row: {
          auto_execution_threshold: number | null
          autonomous_mode_enabled: boolean | null
          config: Json | null
          created_at: string
          display_name: string
          execution_mode: string | null
          id: string
          is_configured: boolean | null
          is_enabled: boolean | null
          last_error: string | null
          last_successful_call: string | null
          name: string
          type: string
          updated_at: string
        }
        Insert: {
          auto_execution_threshold?: number | null
          autonomous_mode_enabled?: boolean | null
          config?: Json | null
          created_at?: string
          display_name: string
          execution_mode?: string | null
          id?: string
          is_configured?: boolean | null
          is_enabled?: boolean | null
          last_error?: string | null
          last_successful_call?: string | null
          name: string
          type: string
          updated_at?: string
        }
        Update: {
          auto_execution_threshold?: number | null
          autonomous_mode_enabled?: boolean | null
          config?: Json | null
          created_at?: string
          display_name?: string
          execution_mode?: string | null
          id?: string
          is_configured?: boolean | null
          is_enabled?: boolean | null
          last_error?: string | null
          last_successful_call?: string | null
          name?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      mitre_coverage: {
        Row: {
          coverage_status: string | null
          detection_count: number | null
          has_playbook: boolean | null
          id: string
          last_detected: string | null
          playbook_ids: string[] | null
          tactic: string
          technique_id: string
          technique_name: string
          updated_at: string
        }
        Insert: {
          coverage_status?: string | null
          detection_count?: number | null
          has_playbook?: boolean | null
          id?: string
          last_detected?: string | null
          playbook_ids?: string[] | null
          tactic: string
          technique_id: string
          technique_name: string
          updated_at?: string
        }
        Update: {
          coverage_status?: string | null
          detection_count?: number | null
          has_playbook?: boolean | null
          id?: string
          last_detected?: string | null
          playbook_ids?: string[] | null
          tactic?: string
          technique_id?: string
          technique_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      playbook_executions: {
        Row: {
          ai_explanation: string | null
          completed_at: string | null
          decision_factors: Json | null
          execution_mode: string | null
          id: string
          incident_id: string
          playbook_id: string
          results: Json | null
          started_at: string
          status: string | null
        }
        Insert: {
          ai_explanation?: string | null
          completed_at?: string | null
          decision_factors?: Json | null
          execution_mode?: string | null
          id?: string
          incident_id: string
          playbook_id: string
          results?: Json | null
          started_at?: string
          status?: string | null
        }
        Update: {
          ai_explanation?: string | null
          completed_at?: string | null
          decision_factors?: Json | null
          execution_mode?: string | null
          id?: string
          incident_id?: string
          playbook_id?: string
          results?: Json | null
          started_at?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "playbook_executions_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playbook_executions_playbook_id_fkey"
            columns: ["playbook_id"]
            isOneToOne: false
            referencedRelation: "playbooks"
            referencedColumns: ["id"]
          },
        ]
      }
      playbook_feedback: {
        Row: {
          analyst_id: string | null
          created_at: string
          execution_id: string | null
          feedback_type: string
          id: string
          incident_id: string | null
          notes: string | null
          playbook_id: string | null
          suggested_actions: Json | null
        }
        Insert: {
          analyst_id?: string | null
          created_at?: string
          execution_id?: string | null
          feedback_type: string
          id?: string
          incident_id?: string | null
          notes?: string | null
          playbook_id?: string | null
          suggested_actions?: Json | null
        }
        Update: {
          analyst_id?: string | null
          created_at?: string
          execution_id?: string | null
          feedback_type?: string
          id?: string
          incident_id?: string | null
          notes?: string | null
          playbook_id?: string | null
          suggested_actions?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "playbook_feedback_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "playbook_executions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playbook_feedback_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playbook_feedback_playbook_id_fkey"
            columns: ["playbook_id"]
            isOneToOne: false
            referencedRelation: "playbooks"
            referencedColumns: ["id"]
          },
        ]
      }
      playbook_learning: {
        Row: {
          approval_count: number | null
          auto_execution_threshold: number | null
          confidence_adjustment: number | null
          id: string
          last_updated: string
          modification_count: number | null
          playbook_id: string | null
          rejection_count: number | null
          tenant_id: string | null
        }
        Insert: {
          approval_count?: number | null
          auto_execution_threshold?: number | null
          confidence_adjustment?: number | null
          id?: string
          last_updated?: string
          modification_count?: number | null
          playbook_id?: string | null
          rejection_count?: number | null
          tenant_id?: string | null
        }
        Update: {
          approval_count?: number | null
          auto_execution_threshold?: number | null
          confidence_adjustment?: number | null
          id?: string
          last_updated?: string
          modification_count?: number | null
          playbook_id?: string | null
          rejection_count?: number | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "playbook_learning_playbook_id_fkey"
            columns: ["playbook_id"]
            isOneToOne: true
            referencedRelation: "playbooks"
            referencedColumns: ["id"]
          },
        ]
      }
      playbook_suggestions: {
        Row: {
          confidence_score: number | null
          converted_playbook_id: string | null
          created_at: string
          description: string | null
          id: string
          incident_count: number | null
          name: string
          pattern_source: string | null
          reasoning: string
          reviewed_at: string | null
          reviewed_by: string | null
          sample_incident_ids: string[] | null
          status: string | null
          suggested_actions: Json
          suggested_conditions: Json
        }
        Insert: {
          confidence_score?: number | null
          converted_playbook_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          incident_count?: number | null
          name: string
          pattern_source?: string | null
          reasoning: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          sample_incident_ids?: string[] | null
          status?: string | null
          suggested_actions: Json
          suggested_conditions: Json
        }
        Update: {
          confidence_score?: number | null
          converted_playbook_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          incident_count?: number | null
          name?: string
          pattern_source?: string | null
          reasoning?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          sample_incident_ids?: string[] | null
          status?: string | null
          suggested_actions?: Json
          suggested_conditions?: Json
        }
        Relationships: [
          {
            foreignKeyName: "playbook_suggestions_converted_playbook_id_fkey"
            columns: ["converted_playbook_id"]
            isOneToOne: false
            referencedRelation: "playbooks"
            referencedColumns: ["id"]
          },
        ]
      }
      playbooks: {
        Row: {
          actions: Json
          conditions: Json
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          actions?: Json
          conditions?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          actions?: Json
          conditions?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
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
          role?: Database["public"]["Enums"]["app_role"]
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
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
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
      app_role: "admin" | "soc_analyst" | "viewer"
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
      app_role: ["admin", "soc_analyst", "viewer"],
    },
  },
} as const
