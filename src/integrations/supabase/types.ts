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
      agent_api_keys: {
        Row: {
          created_at: string
          created_by: string | null
          data_source_id: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          key_hash: string
          key_prefix: string
          last_used: string | null
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_source_id?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          key_hash: string
          key_prefix: string
          last_used?: string | null
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_source_id?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          key_hash?: string
          key_prefix?: string
          last_used?: string | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_api_keys_data_source_id_fkey"
            columns: ["data_source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_license_bindings: {
        Row: {
          first_seen_at: string
          hardware_id: string
          id: string
          is_active: boolean
          last_seen_at: string
          license_id: string
        }
        Insert: {
          first_seen_at?: string
          hardware_id: string
          id?: string
          is_active?: boolean
          last_seen_at?: string
          license_id: string
        }
        Update: {
          first_seen_at?: string
          hardware_id?: string
          id?: string
          is_active?: boolean
          last_seen_at?: string
          license_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_license_bindings_license_id_fkey"
            columns: ["license_id"]
            isOneToOne: false
            referencedRelation: "agent_licenses"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_licenses: {
        Row: {
          active_agents: number | null
          created_at: string
          created_by: string | null
          data_source_id: string | null
          expires_at: string
          id: string
          is_active: boolean | null
          issued_at: string
          last_validated: string | null
          license_hash: string
          license_key: string
          license_type: string
          max_agents: number | null
          organization_name: string | null
          updated_at: string
        }
        Insert: {
          active_agents?: number | null
          created_at?: string
          created_by?: string | null
          data_source_id?: string | null
          expires_at: string
          id?: string
          is_active?: boolean | null
          issued_at?: string
          last_validated?: string | null
          license_hash: string
          license_key: string
          license_type?: string
          max_agents?: number | null
          organization_name?: string | null
          updated_at?: string
        }
        Update: {
          active_agents?: number | null
          created_at?: string
          created_by?: string | null
          data_source_id?: string | null
          expires_at?: string
          id?: string
          is_active?: boolean | null
          issued_at?: string
          last_validated?: string | null
          license_hash?: string
          license_key?: string
          license_type?: string
          max_agents?: number | null
          organization_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_licenses_data_source_id_fkey"
            columns: ["data_source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      analyst_notes: {
        Row: {
          author_email: string | null
          author_id: string
          author_role: string | null
          content: string
          created_at: string
          id: string
          incident_id: string
          note_type: string | null
          updated_at: string
        }
        Insert: {
          author_email?: string | null
          author_id: string
          author_role?: string | null
          content: string
          created_at?: string
          id?: string
          incident_id: string
          note_type?: string | null
          updated_at?: string
        }
        Update: {
          author_email?: string | null
          author_id?: string
          author_role?: string | null
          content?: string
          created_at?: string
          id?: string
          incident_id?: string
          note_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "analyst_notes_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
        ]
      }
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
      compliance_controls: {
        Row: {
          applicable: string | null
          category: string | null
          comments: string | null
          control_category: string | null
          control_code: string
          control_status: Database["public"]["Enums"]["control_status"] | null
          created_at: string | null
          description: string | null
          evidence_reference: string | null
          gap_description: string | null
          gap_identified: boolean | null
          id: string
          implementation_description: string | null
          implemented: boolean | null
          justification: string | null
          last_review: string | null
          next_review_date: string | null
          owner: string | null
          owner_user_id: string | null
          priority: string | null
          remediation_due_date: string | null
          remediation_plan: string | null
          risk_reference: string | null
          sla_days: number | null
          standard: string
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          applicable?: string | null
          category?: string | null
          comments?: string | null
          control_category?: string | null
          control_code: string
          control_status?: Database["public"]["Enums"]["control_status"] | null
          created_at?: string | null
          description?: string | null
          evidence_reference?: string | null
          gap_description?: string | null
          gap_identified?: boolean | null
          id?: string
          implementation_description?: string | null
          implemented?: boolean | null
          justification?: string | null
          last_review?: string | null
          next_review_date?: string | null
          owner?: string | null
          owner_user_id?: string | null
          priority?: string | null
          remediation_due_date?: string | null
          remediation_plan?: string | null
          risk_reference?: string | null
          sla_days?: number | null
          standard: string
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          applicable?: string | null
          category?: string | null
          comments?: string | null
          control_category?: string | null
          control_code?: string
          control_status?: Database["public"]["Enums"]["control_status"] | null
          created_at?: string | null
          description?: string | null
          evidence_reference?: string | null
          gap_description?: string | null
          gap_identified?: boolean | null
          id?: string
          implementation_description?: string | null
          implemented?: boolean | null
          justification?: string | null
          last_review?: string | null
          next_review_date?: string | null
          owner?: string | null
          owner_user_id?: string | null
          priority?: string | null
          remediation_due_date?: string | null
          remediation_plan?: string | null
          risk_reference?: string | null
          sla_days?: number | null
          standard?: string
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      compliance_evidence: {
        Row: {
          control_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          evidence_type: string
          file_url: string | null
          id: string
          reference_id: string | null
          source: string | null
          title: string
        }
        Insert: {
          control_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          evidence_type: string
          file_url?: string | null
          id?: string
          reference_id?: string | null
          source?: string | null
          title: string
        }
        Update: {
          control_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          evidence_type?: string
          file_url?: string | null
          id?: string
          reference_id?: string | null
          source?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_evidence_control_id_fkey"
            columns: ["control_id"]
            isOneToOne: false
            referencedRelation: "compliance_controls"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_reports: {
        Row: {
          file_url: string | null
          generated_at: string | null
          generated_by: string | null
          id: string
          standard: string
          status: string | null
          summary: Json | null
        }
        Insert: {
          file_url?: string | null
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          standard: string
          status?: string | null
          summary?: Json | null
        }
        Update: {
          file_url?: string | null
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          standard?: string
          status?: string | null
          summary?: Json | null
        }
        Relationships: []
      }
      control_evidence: {
        Row: {
          audit_log_id: string | null
          compliance_audit_log_id: string | null
          control_id: string | null
          created_at: string | null
          id: string
          status: string | null
        }
        Insert: {
          audit_log_id?: string | null
          compliance_audit_log_id?: string | null
          control_id?: string | null
          created_at?: string | null
          id?: string
          status?: string | null
        }
        Update: {
          audit_log_id?: string | null
          compliance_audit_log_id?: string | null
          control_id?: string | null
          created_at?: string | null
          id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "control_evidence_control_id_fkey"
            columns: ["control_id"]
            isOneToOne: false
            referencedRelation: "compliance_controls"
            referencedColumns: ["id"]
          },
        ]
      }
      control_gaps: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          control_id: string | null
          gap_description: string | null
          gap_severity: string | null
          gap_status: string | null
          id: string
          identified_at: string | null
          identified_by: string | null
          remediation_owner: string | null
          remediation_plan: string | null
          target_date: string | null
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          control_id?: string | null
          gap_description?: string | null
          gap_severity?: string | null
          gap_status?: string | null
          id?: string
          identified_at?: string | null
          identified_by?: string | null
          remediation_owner?: string | null
          remediation_plan?: string | null
          target_date?: string | null
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          control_id?: string | null
          gap_description?: string | null
          gap_severity?: string | null
          gap_status?: string | null
          id?: string
          identified_at?: string | null
          identified_by?: string | null
          remediation_owner?: string | null
          remediation_plan?: string | null
          target_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "control_gaps_control_id_fkey"
            columns: ["control_id"]
            isOneToOne: true
            referencedRelation: "compliance_controls"
            referencedColumns: ["id"]
          },
        ]
      }
      control_mapping_rules: {
        Row: {
          control_id: string | null
          created_at: string | null
          created_by: string | null
          evidence_type: string | null
          id: string
          is_active: boolean | null
          match_field: string
          match_operator: string | null
          match_value: string
          source_type: string
        }
        Insert: {
          control_id?: string | null
          created_at?: string | null
          created_by?: string | null
          evidence_type?: string | null
          id?: string
          is_active?: boolean | null
          match_field: string
          match_operator?: string | null
          match_value: string
          source_type: string
        }
        Update: {
          control_id?: string | null
          created_at?: string | null
          created_by?: string | null
          evidence_type?: string | null
          id?: string
          is_active?: boolean | null
          match_field?: string
          match_operator?: string | null
          match_value?: string
          source_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "control_mapping_rules_control_id_fkey"
            columns: ["control_id"]
            isOneToOne: false
            referencedRelation: "compliance_controls"
            referencedColumns: ["id"]
          },
        ]
      }
      control_rules: {
        Row: {
          control_id: string | null
          created_at: string | null
          id: string
          match_action: string
          match_resource: string | null
        }
        Insert: {
          control_id?: string | null
          created_at?: string | null
          id?: string
          match_action: string
          match_resource?: string | null
        }
        Update: {
          control_id?: string | null
          created_at?: string | null
          id?: string
          match_action?: string
          match_resource?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "control_rules_control_id_fkey"
            columns: ["control_id"]
            isOneToOne: false
            referencedRelation: "compliance_controls"
            referencedColumns: ["id"]
          },
        ]
      }
      correlation_rule_matches: {
        Row: {
          id: string
          incident_id: string | null
          match_count: number | null
          match_key: string | null
          matched_logs: Json | null
          rule_id: string
          triggered_at: string
        }
        Insert: {
          id?: string
          incident_id?: string | null
          match_count?: number | null
          match_key?: string | null
          matched_logs?: Json | null
          rule_id: string
          triggered_at?: string
        }
        Update: {
          id?: string
          incident_id?: string | null
          match_count?: number | null
          match_key?: string | null
          matched_logs?: Json | null
          rule_id?: string
          triggered_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "correlation_rule_matches_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "correlation_rule_matches_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "correlation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      correlation_rules: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          event_type_filter: string[] | null
          hits_count: number | null
          id: string
          incident_title_template: string | null
          is_active: boolean
          last_triggered_at: string | null
          match_field: string
          match_operator: string
          match_value: string | null
          name: string
          severity_override: number | null
          threshold_count: number
          time_window_minutes: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_type_filter?: string[] | null
          hits_count?: number | null
          id?: string
          incident_title_template?: string | null
          is_active?: boolean
          last_triggered_at?: string | null
          match_field?: string
          match_operator?: string
          match_value?: string | null
          name: string
          severity_override?: number | null
          threshold_count?: number
          time_window_minutes?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_type_filter?: string[] | null
          hits_count?: number | null
          id?: string
          incident_title_template?: string | null
          is_active?: boolean
          last_triggered_at?: string | null
          match_field?: string
          match_operator?: string
          match_value?: string | null
          name?: string
          severity_override?: number | null
          threshold_count?: number
          time_window_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      data_sources: {
        Row: {
          agent_version: string | null
          api_key_hash: string | null
          config: Json | null
          created_at: string
          created_by: string | null
          hostname: string | null
          id: string
          ip_address: string | null
          last_heartbeat: string | null
          last_log_received: string | null
          log_types: string[] | null
          logs_received_today: number | null
          logs_received_total: number | null
          name: string
          os_type: string | null
          os_version: string | null
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          agent_version?: string | null
          api_key_hash?: string | null
          config?: Json | null
          created_at?: string
          created_by?: string | null
          hostname?: string | null
          id?: string
          ip_address?: string | null
          last_heartbeat?: string | null
          last_log_received?: string | null
          log_types?: string[] | null
          logs_received_today?: number | null
          logs_received_total?: number | null
          name: string
          os_type?: string | null
          os_version?: string | null
          status?: string
          type: string
          updated_at?: string
        }
        Update: {
          agent_version?: string | null
          api_key_hash?: string | null
          config?: Json | null
          created_at?: string
          created_by?: string | null
          hostname?: string | null
          id?: string
          ip_address?: string | null
          last_heartbeat?: string | null
          last_log_received?: string | null
          log_types?: string[] | null
          logs_received_today?: number | null
          logs_received_total?: number | null
          name?: string
          os_type?: string | null
          os_version?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      grc_audit_trail: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          change_summary: string | null
          entity_id: string | null
          entity_name: string | null
          entity_type: string
          id: string
          ip_address: string | null
          new_value: Json | null
          old_value: Json | null
          timestamp: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          change_summary?: string | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          new_value?: Json | null
          old_value?: Json | null
          timestamp?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          change_summary?: string | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          new_value?: Json | null
          old_value?: Json | null
          timestamp?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      incident_evidence: {
        Row: {
          added_by: string | null
          added_by_email: string | null
          created_at: string
          description: string | null
          evidence_type: string
          file_name: string | null
          file_size: number | null
          file_url: string | null
          id: string
          incident_id: string
          linked_ioc_id: string | null
          source: string | null
          title: string
        }
        Insert: {
          added_by?: string | null
          added_by_email?: string | null
          created_at?: string
          description?: string | null
          evidence_type: string
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          incident_id: string
          linked_ioc_id?: string | null
          source?: string | null
          title: string
        }
        Update: {
          added_by?: string | null
          added_by_email?: string | null
          created_at?: string
          description?: string | null
          evidence_type?: string
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          incident_id?: string
          linked_ioc_id?: string | null
          source?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "incident_evidence_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_evidence_linked_ioc_id_fkey"
            columns: ["linked_ioc_id"]
            isOneToOne: false
            referencedRelation: "incident_iocs"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_iocs: {
        Row: {
          added_by: string | null
          added_by_email: string | null
          confidence: string | null
          created_at: string
          id: string
          incident_id: string
          ioc_type: string
          notes: string | null
          source: string | null
          value: string
        }
        Insert: {
          added_by?: string | null
          added_by_email?: string | null
          confidence?: string | null
          created_at?: string
          id?: string
          incident_id: string
          ioc_type: string
          notes?: string | null
          source?: string | null
          value: string
        }
        Update: {
          added_by?: string | null
          added_by_email?: string | null
          confidence?: string | null
          created_at?: string
          id?: string
          incident_id?: string
          ioc_type?: string
          notes?: string | null
          source?: string | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "incident_iocs_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_reports: {
        Row: {
          ai_model: string | null
          content: string
          created_at: string
          format: string
          generated_by: string | null
          generated_by_email: string | null
          generated_by_role: string | null
          id: string
          incident_id: string
          report_type: string
          title: string
        }
        Insert: {
          ai_model?: string | null
          content: string
          created_at?: string
          format?: string
          generated_by?: string | null
          generated_by_email?: string | null
          generated_by_role?: string | null
          id?: string
          incident_id: string
          report_type?: string
          title: string
        }
        Update: {
          ai_model?: string | null
          content?: string
          created_at?: string
          format?: string
          generated_by?: string | null
          generated_by_email?: string | null
          generated_by_role?: string | null
          id?: string
          incident_id?: string
          report_type?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "incident_reports_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
        ]
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
          assigned_at: string | null
          assigned_to: string | null
          classification: string | null
          closed_at: string | null
          closed_reason: string | null
          confidence: number | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          dst_ip: string | null
          escalated_at: string | null
          escalated_from: string | null
          escalated_to: string | null
          escalation_reason: string | null
          event_type: string
          evidence: string[] | null
          file_hash: string | null
          id: string
          incident_number: string
          incident_owner_id: string | null
          incident_owner_role: string | null
          message: string | null
          mitre_tactic: string | null
          mitre_technique: string | null
          raw_log: Json | null
          recommended_actions: string[] | null
          resolved_at: string | null
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
          assigned_at?: string | null
          assigned_to?: string | null
          classification?: string | null
          closed_at?: string | null
          closed_reason?: string | null
          confidence?: number | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          dst_ip?: string | null
          escalated_at?: string | null
          escalated_from?: string | null
          escalated_to?: string | null
          escalation_reason?: string | null
          event_type: string
          evidence?: string[] | null
          file_hash?: string | null
          id?: string
          incident_number: string
          incident_owner_id?: string | null
          incident_owner_role?: string | null
          message?: string | null
          mitre_tactic?: string | null
          mitre_technique?: string | null
          raw_log?: Json | null
          recommended_actions?: string[] | null
          resolved_at?: string | null
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
          assigned_at?: string | null
          assigned_to?: string | null
          classification?: string | null
          closed_at?: string | null
          closed_reason?: string | null
          confidence?: number | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          dst_ip?: string | null
          escalated_at?: string | null
          escalated_from?: string | null
          escalated_to?: string | null
          escalation_reason?: string | null
          event_type?: string
          evidence?: string[] | null
          file_hash?: string | null
          id?: string
          incident_number?: string
          incident_owner_id?: string | null
          incident_owner_role?: string | null
          message?: string | null
          mitre_tactic?: string | null
          mitre_technique?: string | null
          raw_log?: Json | null
          recommended_actions?: string[] | null
          resolved_at?: string | null
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
      log_ingestion_stats: {
        Row: {
          bytes_received: number | null
          count: number | null
          data_source_id: string | null
          date: string
          hour: number | null
          id: string
          incidents_created: number | null
          log_type: string
        }
        Insert: {
          bytes_received?: number | null
          count?: number | null
          data_source_id?: string | null
          date?: string
          hour?: number | null
          id?: string
          incidents_created?: number | null
          log_type: string
        }
        Update: {
          bytes_received?: number | null
          count?: number | null
          data_source_id?: string | null
          date?: string
          hour?: number | null
          id?: string
          incidents_created?: number | null
          log_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "log_ingestion_stats_data_source_id_fkey"
            columns: ["data_source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["id"]
          },
        ]
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
      raw_logs: {
        Row: {
          analyzed_at: string | null
          created_at: string
          data_source_id: string | null
          error_message: string | null
          hostname: string | null
          id: string
          incident_id: string | null
          ip_address: string | null
          log_type: string
          mitre_technique: string | null
          parsed_message: string | null
          processing_status: string | null
          raw_payload: Json
          received_at: string
          severity: string | null
          timestamp: string
        }
        Insert: {
          analyzed_at?: string | null
          created_at?: string
          data_source_id?: string | null
          error_message?: string | null
          hostname?: string | null
          id?: string
          incident_id?: string | null
          ip_address?: string | null
          log_type: string
          mitre_technique?: string | null
          parsed_message?: string | null
          processing_status?: string | null
          raw_payload: Json
          received_at?: string
          severity?: string | null
          timestamp?: string
        }
        Update: {
          analyzed_at?: string | null
          created_at?: string
          data_source_id?: string | null
          error_message?: string | null
          hostname?: string | null
          id?: string
          incident_id?: string | null
          ip_address?: string | null
          log_type?: string
          mitre_technique?: string | null
          parsed_message?: string | null
          processing_status?: string | null
          raw_payload?: Json
          received_at?: string
          severity?: string | null
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "raw_logs_data_source_id_fkey"
            columns: ["data_source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raw_logs_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_register: {
        Row: {
          control_id: string | null
          created_at: string | null
          created_by: string | null
          id: string
          impact: Database["public"]["Enums"]["risk_impact"] | null
          inherent_risk_score: number | null
          likelihood: Database["public"]["Enums"]["risk_likelihood"] | null
          mitigation_status: string | null
          mitigation_strategy: string | null
          residual_impact: Database["public"]["Enums"]["risk_impact"] | null
          residual_likelihood:
            | Database["public"]["Enums"]["risk_likelihood"]
            | null
          residual_risk_score: number | null
          risk_category: string | null
          risk_description: string | null
          risk_id: string
          risk_owner: string | null
          risk_title: string
          treatment_option: string | null
          updated_at: string | null
        }
        Insert: {
          control_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          impact?: Database["public"]["Enums"]["risk_impact"] | null
          inherent_risk_score?: number | null
          likelihood?: Database["public"]["Enums"]["risk_likelihood"] | null
          mitigation_status?: string | null
          mitigation_strategy?: string | null
          residual_impact?: Database["public"]["Enums"]["risk_impact"] | null
          residual_likelihood?:
            | Database["public"]["Enums"]["risk_likelihood"]
            | null
          residual_risk_score?: number | null
          risk_category?: string | null
          risk_description?: string | null
          risk_id: string
          risk_owner?: string | null
          risk_title: string
          treatment_option?: string | null
          updated_at?: string | null
        }
        Update: {
          control_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          impact?: Database["public"]["Enums"]["risk_impact"] | null
          inherent_risk_score?: number | null
          likelihood?: Database["public"]["Enums"]["risk_likelihood"] | null
          mitigation_status?: string | null
          mitigation_strategy?: string | null
          residual_impact?: Database["public"]["Enums"]["risk_impact"] | null
          residual_likelihood?:
            | Database["public"]["Enums"]["risk_likelihood"]
            | null
          residual_risk_score?: number | null
          risk_category?: string | null
          risk_description?: string | null
          risk_id?: string
          risk_owner?: string | null
          risk_title?: string
          treatment_option?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "risk_register_control_id_fkey"
            columns: ["control_id"]
            isOneToOne: false
            referencedRelation: "compliance_controls"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string | null
          id: string
          permission: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string | null
          id?: string
          permission: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string | null
          id?: string
          permission?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      soar_actions: {
        Row: {
          action_type: string
          created_at: string
          details: Json | null
          execution_mode: string | null
          id: string
          incident_id: string | null
          status: string | null
          target: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          details?: Json | null
          execution_mode?: string | null
          id?: string
          incident_id?: string | null
          status?: string | null
          target?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          details?: Json | null
          execution_mode?: string | null
          id?: string
          incident_id?: string | null
          status?: string | null
          target?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "soar_actions_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
        ]
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
      user_access: {
        Row: {
          approved: boolean
          approved_at: string | null
          approved_by: string | null
          created_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_access_requests: {
        Row: {
          created_at: string
          email: string
          id: string
          requested_by: string | null
          requested_role: Database["public"]["Enums"]["app_role"]
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          requested_by?: string | null
          requested_role?: Database["public"]["Enums"]["app_role"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          requested_by?: string | null
          requested_role?: Database["public"]["Enums"]["app_role"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
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
      approve_user_access: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _target_user: string
        }
        Returns: undefined
      }
      calculate_control_coverage: {
        Args: { _standard?: string }
        Returns: {
          applicable_controls: number
          coverage_percentage: number
          gap_count: number
          implemented_controls: number
          not_implemented: number
          partially_implemented: number
          planned_controls: number
          total_controls: number
        }[]
      }
      generate_agent_api_key: {
        Args: { _data_source_id: string; _expires_days?: number; _name: string }
        Returns: {
          api_key: string
          key_id: string
        }[]
      }
      generate_agent_license:
        | {
            Args: {
              _data_source_id: string
              _expires_days?: number
              _license_type?: string
              _max_agents?: number
              _organization_name: string
            }
            Returns: {
              license_id: string
              license_key: string
            }[]
          }
        | {
            Args: {
              _data_source_id: string
              _expires_days?: number
              _expires_hours?: number
              _license_type?: string
              _max_agents?: number
              _organization_name: string
            }
            Returns: {
              license_id: string
              license_key: string
            }[]
          }
      get_user_permissions: { Args: { _user_id: string }; Returns: string[] }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_permission: {
        Args: { _permission: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      identify_control_gaps: { Args: never; Returns: number }
      is_demo_user: { Args: { _user_id: string }; Returns: boolean }
      log_grc_audit: {
        Args: {
          _action: string
          _change_summary?: string
          _entity_id: string
          _entity_name?: string
          _entity_type: string
          _new_value?: Json
          _old_value?: Json
        }
        Returns: string
      }
      reject_user_access: { Args: { _target_user: string }; Returns: undefined }
      set_user_role: {
        Args: {
          _new_role: Database["public"]["Enums"]["app_role"]
          _target_user: string
        }
        Returns: undefined
      }
      validate_agent_license: {
        Args: { _hardware_id?: string; _license_key: string }
        Returns: {
          active_agents: number
          days_remaining: number
          error_message: string
          expires_at: string
          is_valid: boolean
          license_type: string
          max_agents: number
          organization_name: string
        }[]
      }
      verify_agent_api_key: {
        Args: { _api_key: string }
        Returns: {
          data_source_id: string
          data_source_name: string
          is_valid: boolean
          key_id: string
        }[]
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "soc_analyst"
        | "viewer"
        | "soc_tier_1"
        | "soc_tier_2"
        | "soc_tier_3"
        | "soc_manager"
        | "grc_engineer"
        | "ciso"
        | "demo_user"
      control_status:
        | "not_implemented"
        | "planned"
        | "partially_implemented"
        | "fully_implemented"
      risk_impact:
        | "negligible"
        | "minor"
        | "moderate"
        | "major"
        | "catastrophic"
      risk_likelihood:
        | "rare"
        | "unlikely"
        | "possible"
        | "likely"
        | "almost_certain"
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
      app_role: [
        "admin",
        "soc_analyst",
        "viewer",
        "soc_tier_1",
        "soc_tier_2",
        "soc_tier_3",
        "soc_manager",
        "grc_engineer",
        "ciso",
        "demo_user",
      ],
      control_status: [
        "not_implemented",
        "planned",
        "partially_implemented",
        "fully_implemented",
      ],
      risk_impact: ["negligible", "minor", "moderate", "major", "catastrophic"],
      risk_likelihood: [
        "rare",
        "unlikely",
        "possible",
        "likely",
        "almost_certain",
      ],
    },
  },
} as const
