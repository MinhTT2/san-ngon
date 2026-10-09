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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      court_closures: {
        Row: {
          court_id: string
          created_at: string
          ends_at: string
          id: string
          reason: string | null
          starts_at: string
          tournament_id: string | null
        }
        Insert: {
          court_id: string
          created_at?: string
          ends_at: string
          id?: string
          reason?: string | null
          starts_at: string
          tournament_id?: string | null
        }
        Update: {
          court_id?: string
          created_at?: string
          ends_at?: string
          id?: string
          reason?: string | null
          starts_at?: string
          tournament_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "court_closures_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "court_closures_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: true
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      community_profiles: {
        Row: {
          bio: string
          display_name: string
          facebook_url: string
          is_public: boolean
          location: string
          phone: string
          show_facebook: boolean
          show_phone: boolean
          show_zalo: boolean
          skill_level: string
          sport: Database["public"]["Enums"]["sport_type"]
          updated_at: string
          user_id: string
          usual_play_times: string
          zalo_phone: string
        }
        Insert: {
          bio?: string
          display_name: string
          facebook_url?: string
          is_public?: boolean
          location: string
          phone: string
          show_facebook?: boolean
          show_phone?: boolean
          show_zalo?: boolean
          skill_level: string
          sport: Database["public"]["Enums"]["sport_type"]
          updated_at?: string
          user_id: string
          usual_play_times?: string
          zalo_phone?: string
        }
        Update: {
          bio?: string
          display_name?: string
          facebook_url?: string
          is_public?: boolean
          location?: string
          phone?: string
          show_facebook?: boolean
          show_phone?: boolean
          show_zalo?: boolean
          skill_level?: string
          sport?: Database["public"]["Enums"]["sport_type"]
          updated_at?: string
          user_id?: string
          usual_play_times?: string
          zalo_phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          category: string
          created_at: string
          handled_by: string | null
          id: string
          message: string
          page_path: string | null
          reply: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          handled_by?: string | null
          id: string
          message: string
          page_path?: string | null
          reply?: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          handled_by?: string | null
          id?: string
          message?: string
          page_path?: string | null
          reply?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_handled_by_fkey"
            columns: ["handled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sepay_transfer_claims: {
        Row: {
          transaction_key: string
        }
        Insert: {
          transaction_key: string
        }
        Update: {
          transaction_key?: string
        }
        Relationships: []
      }
      tournament_payment_events: {
        Row: {
          amount: number
          created_at: string
          outcome: string
          raw: Json
          refund_amount: number
          refund_status: string
          refunded_amount: number
          registration_id: string
          transaction_key: string
        }
        Insert: {
          amount: number
          created_at?: string
          outcome?: string
          raw: Json
          refund_amount?: number
          refund_status?: string
          refunded_amount?: number
          registration_id: string
          transaction_key: string
        }
        Update: {
          amount?: number
          created_at?: string
          outcome?: string
          raw?: Json
          refund_amount?: number
          refund_status?: string
          refunded_amount?: number
          registration_id?: string
          transaction_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_payment_events_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "tournament_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_registrations: {
        Row: {
          account_name: string | null
          account_number: string | null
          address: string
          balance_receipt: string | null
          balance_received_at: string | null
          balance_received_by: string | null
          balance_refund_due: number
          balance_refund_receipt: string | null
          balance_refunded_at: string | null
          balance_refunded_by: string | null
          balance_waived_at: string | null
          bank: string | null
          cancellation_kind: string | null
          cancelled_at: string | null
          code: string
          connection_id: string | null
          created_at: string
          deposit_amount: number
          entry_fee: number
          full_name: string
          id: string
          note: string
          paid_at: string | null
          payment_expires_at: string | null
          payment_owner_id: string | null
          phone: string
          refund_deadline: string | null
          reminder_sent_at: string | null
          review_note: string
          status: string
          team_name: string
          tournament_id: string
          user_id: string
        }
        Insert: {
          account_name?: string | null
          account_number?: string | null
          address: string
          balance_receipt?: string | null
          balance_received_at?: string | null
          balance_received_by?: string | null
          balance_refund_due?: number
          balance_refund_receipt?: string | null
          balance_refunded_at?: string | null
          balance_refunded_by?: string | null
          balance_waived_at?: string | null
          bank?: string | null
          cancellation_kind?: string | null
          cancelled_at?: string | null
          code: string
          connection_id?: string | null
          created_at?: string
          deposit_amount: number
          entry_fee: number
          full_name: string
          id?: string
          note?: string
          paid_at?: string | null
          payment_expires_at?: string | null
          payment_owner_id?: string | null
          phone: string
          refund_deadline?: string | null
          reminder_sent_at?: string | null
          review_note?: string
          status?: string
          team_name?: string
          tournament_id: string
          user_id: string
        }
        Update: {
          account_name?: string | null
          account_number?: string | null
          address?: string
          balance_receipt?: string | null
          balance_received_at?: string | null
          balance_received_by?: string | null
          balance_refund_due?: number
          balance_refund_receipt?: string | null
          balance_refunded_at?: string | null
          balance_refunded_by?: string | null
          balance_waived_at?: string | null
          bank?: string | null
          cancellation_kind?: string | null
          cancelled_at?: string | null
          code?: string
          connection_id?: string | null
          created_at?: string
          deposit_amount?: number
          entry_fee?: number
          full_name?: string
          id?: string
          note?: string
          paid_at?: string | null
          payment_expires_at?: string | null
          payment_owner_id?: string | null
          phone?: string
          refund_deadline?: string | null
          reminder_sent_at?: string | null
          review_note?: string
          status?: string
          team_name?: string
          tournament_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_registrations_balance_received_by_fkey"
            columns: ["balance_received_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_registrations_balance_refunded_by_fkey"
            columns: ["balance_refunded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_registrations_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "sepay_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_registrations_payment_owner_id_fkey"
            columns: ["payment_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_registrations_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_registrations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          address: string
          cancel_window_hours: number
          cancelled_by: string | null
          capacity: number
          cover_path: string | null
          court_id: string | null
          created_at: string
          deposit_amount: number
          description: string
          ends_at: string
          entry_fee: number
          id: string
          manager_id: string
          payment_deadline: string
          payment_hold_hours: number
          registration_deadline: string
          review_note: string
          reviewed_by: string | null
          sport: Database["public"]["Enums"]["sport_type"]
          starts_at: string
          status: string
          title: string
        }
        Insert: {
          address: string
          cancel_window_hours?: number
          cancelled_by?: string | null
          capacity: number
          cover_path?: string | null
          court_id?: string | null
          created_at?: string
          deposit_amount: number
          description: string
          ends_at: string
          entry_fee: number
          id?: string
          manager_id: string
          payment_deadline: string
          payment_hold_hours?: number
          registration_deadline: string
          review_note?: string
          reviewed_by?: string | null
          sport: Database["public"]["Enums"]["sport_type"]
          starts_at: string
          status?: string
          title: string
        }
        Update: {
          address?: string
          cancel_window_hours?: number
          cancelled_by?: string | null
          capacity?: number
          cover_path?: string | null
          court_id?: string | null
          created_at?: string
          deposit_amount?: number
          description?: string
          ends_at?: string
          entry_fee?: number
          id?: string
          manager_id?: string
          payment_deadline?: string
          payment_hold_hours?: number
          registration_deadline?: string
          review_note?: string
          reviewed_by?: string | null
          sport?: Database["public"]["Enums"]["sport_type"]
          starts_at?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournaments_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_payment_events: {
        Row: {
          amount: number
          created_at: string
          invoice_id: string
          outcome: string
          raw: Json
          transaction_key: string
        }
        Insert: {
          amount: number
          created_at?: string
          invoice_id: string
          outcome?: string
          raw: Json
          transaction_key: string
        }
        Update: {
          amount?: number
          created_at?: string
          invoice_id?: string
          outcome?: string
          raw?: Json
          transaction_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_payment_events_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "subscription_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_invoices: {
        Row: {
          account_name: string
          account_number: string
          amount: number
          bank: string
          code: string
          connection_id: string | null
          created_at: string
          id: string
          owner_id: string
          paid_at: string | null
          period_end: string | null
          period_start: string | null
          status: string
        }
        Insert: {
          account_name: string
          account_number: string
          amount?: number
          bank: string
          code: string
          connection_id?: string | null
          created_at?: string
          id?: string
          owner_id: string
          paid_at?: string | null
          period_end?: string | null
          period_start?: string | null
          status?: string
        }
        Update: {
          account_name?: string
          account_number?: string
          amount?: number
          bank?: string
          code?: string
          connection_id?: string | null
          created_at?: string
          id?: string
          owner_id?: string
          paid_at?: string | null
          period_end?: string | null
          period_start?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_invoices_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "sepay_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_invoices_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_receiver: {
        Row: {
          account_name: string
          account_number: string
          bank: string
          connection_id: string | null
          singleton: boolean
        }
        Insert: {
          account_name: string
          account_number: string
          bank: string
          connection_id?: string | null
          singleton?: boolean
        }
        Update: {
          account_name?: string
          account_number?: string
          bank?: string
          connection_id?: string | null
          singleton?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "subscription_receiver_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "sepay_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_subscriptions: {
        Row: {
          fee_required: boolean
          owner_id: string
          paid_until: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          fee_required?: boolean
          owner_id: string
          paid_until?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          fee_required?: boolean
          owner_id?: string
          paid_until?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "owner_subscriptions_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_subscriptions_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sepay_events: {
        Row: {
          amount: number
          booking_id: string
          connection_id: string | null
          created_at: string
          raw: Json
          transaction_key: string
        }
        Insert: {
          amount: number
          booking_id: string
          connection_id?: string | null
          created_at?: string
          raw: Json
          transaction_key: string
        }
        Update: {
          amount?: number
          booking_id?: string
          connection_id?: string | null
          created_at?: string
          raw?: Json
          transaction_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "sepay_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sepay_events_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "sepay_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      sepay_oauth_states: {
        Row: {
          expires_at: string
          owner_id: string
          return_to: string
          state_hash: string
        }
        Insert: {
          expires_at?: string
          owner_id: string
          return_to?: string
          state_hash: string
        }
        Update: {
          expires_at?: string
          owner_id?: string
          return_to?: string
          state_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "sepay_oauth_states_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sepay_connections: {
        Row: {
          access_token_encrypted: string | null
          account_name: string | null
          account_number: string | null
          bank: string | null
          bank_account_id: string | null
          checked_at: string | null
          created_at: string
          id: string
          last_webhook_at: string | null
          operation_expires_at: string | null
          operation_token: string | null
          owner_id: string
          refresh_token_encrypted: string | null
          status: string
          token_expires_at: string | null
          webhook_id: string | null
          webhook_key_encrypted: string | null
          webhook_key_hash: string | null
        }
        Insert: {
          access_token_encrypted?: string | null
          account_name?: string | null
          account_number?: string | null
          bank?: string | null
          bank_account_id?: string | null
          checked_at?: string | null
          created_at?: string
          id?: string
          last_webhook_at?: string | null
          operation_expires_at?: string | null
          operation_token?: string | null
          owner_id: string
          refresh_token_encrypted?: string | null
          status?: string
          token_expires_at?: string | null
          webhook_id?: string | null
          webhook_key_encrypted?: string | null
          webhook_key_hash?: string | null
        }
        Update: {
          access_token_encrypted?: string | null
          account_name?: string | null
          account_number?: string | null
          bank?: string | null
          bank_account_id?: string | null
          checked_at?: string | null
          created_at?: string
          id?: string
          last_webhook_at?: string | null
          operation_expires_at?: string | null
          operation_token?: string | null
          owner_id?: string
          refresh_token_encrypted?: string | null
          status?: string
          token_expires_at?: string | null
          webhook_id?: string | null
          webhook_key_encrypted?: string | null
          webhook_key_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sepay_connections_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_operator: {
        Row: {
          accepts_new_bookings: boolean
          account_name: string | null
          account_number: string | null
          bank: string | null
          multi_owner_enabled: boolean
          owner_id: string
          singleton: boolean
        }
        Insert: {
          accepts_new_bookings?: boolean
          account_name?: string | null
          account_number?: string | null
          bank?: string | null
          multi_owner_enabled?: boolean
          owner_id: string
          singleton?: boolean
        }
        Update: {
          accepts_new_bookings?: boolean
          account_name?: string | null
          account_number?: string | null
          bank?: string | null
          multi_owner_enabled?: boolean
          owner_id?: string
          singleton?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "booking_operator_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_requests: {
        Row: {
          booking_id: string
          created_at: string
          payload_hash: string
          request_id: string
          user_id: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          payload_hash: string
          request_id: string
          user_id: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          payload_hash?: string
          request_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_requests_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          court_name_snapshot: string | null
          sport_snapshot: Database["public"]["Enums"]["sport_type"] | null
          venue_name_snapshot: string | null
          venue_address_snapshot: string | null
          venue_district_snapshot: string | null
          venue_city_snapshot: string | null
          details_recorded_at: string | null
          cancelled_at: string | null
          code: string
          court_id: string
          created_at: string
          customer_name: string | null
          customer_phone: string
          deposit_amount: number
          ends_at: string
          expires_at: string
          id: string
          note: string | null
          paid_at: string | null
          payment_account: string | null
          payment_account_name: string | null
          payment_bank: string | null
          payment_connection_id: string | null
          payment_owner_id: string | null
          refund_status: Database["public"]["Enums"]["refund_status"] | null
          starts_at: string
          status: Database["public"]["Enums"]["booking_status"]
          total_amount: number
          user_id: string
        }
        Insert: {
          court_name_snapshot?: string | null
          sport_snapshot?: Database["public"]["Enums"]["sport_type"] | null
          venue_name_snapshot?: string | null
          venue_address_snapshot?: string | null
          venue_district_snapshot?: string | null
          venue_city_snapshot?: string | null
          details_recorded_at?: string | null
          cancelled_at?: string | null
          code: string
          court_id: string
          created_at?: string
          customer_name?: string | null
          customer_phone: string
          deposit_amount: number
          ends_at: string
          expires_at?: string
          id?: string
          note?: string | null
          paid_at?: string | null
          payment_account?: string | null
          payment_account_name?: string | null
          payment_bank?: string | null
          payment_connection_id?: string | null
          payment_owner_id?: string | null
          refund_status?: Database["public"]["Enums"]["refund_status"] | null
          starts_at: string
          status?: Database["public"]["Enums"]["booking_status"]
          total_amount: number
          user_id: string
        }
        Update: {
          court_name_snapshot?: string | null
          sport_snapshot?: Database["public"]["Enums"]["sport_type"] | null
          venue_name_snapshot?: string | null
          venue_address_snapshot?: string | null
          venue_district_snapshot?: string | null
          venue_city_snapshot?: string | null
          details_recorded_at?: string | null
          cancelled_at?: string | null
          code?: string
          court_id?: string
          created_at?: string
          customer_name?: string | null
          customer_phone?: string
          deposit_amount?: number
          ends_at?: string
          expires_at?: string
          id?: string
          note?: string | null
          paid_at?: string | null
          payment_account?: string | null
          payment_account_name?: string | null
          payment_bank?: string | null
          payment_connection_id?: string | null
          payment_owner_id?: string | null
          refund_status?: Database["public"]["Enums"]["refund_status"] | null
          starts_at?: string
          status?: Database["public"]["Enums"]["booking_status"]
          total_amount?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_payment_connection_id_fkey"
            columns: ["payment_connection_id"]
            isOneToOne: false
            referencedRelation: "sepay_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_payment_owner_id_fkey"
            columns: ["payment_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      courts: {
        Row: {
          close_time: string | null
          id: string
          is_active: boolean
          is_indoor: boolean
          name: string
          open_time: string | null
          slot_minutes: number
          sort_order: number
          sport: Database["public"]["Enums"]["sport_type"]
          surface: string | null
          venue_id: string
        }
        Insert: {
          close_time?: string | null
          id?: string
          is_active?: boolean
          is_indoor?: boolean
          name: string
          open_time?: string | null
          slot_minutes?: number
          sort_order?: number
          sport: Database["public"]["Enums"]["sport_type"]
          surface?: string | null
          venue_id: string
        }
        Update: {
          close_time?: string | null
          id?: string
          is_active?: boolean
          is_indoor?: boolean
          name?: string
          open_time?: string | null
          slot_minutes?: number
          sort_order?: number
          sport?: Database["public"]["Enums"]["sport_type"]
          surface?: string | null
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "courts_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          booking_id: string | null
          channel: Database["public"]["Enums"]["notif_channel"]
          created_at: string
          failed_reason: string | null
          id: string
          kind: Database["public"]["Enums"]["notif_kind"]
          read_at: string | null
          sent_at: string | null
          title: string
          tournament_id: string | null
          user_id: string
        }
        Insert: {
          body?: string | null
          booking_id?: string | null
          channel?: Database["public"]["Enums"]["notif_channel"]
          created_at?: string
          failed_reason?: string | null
          id?: string
          kind: Database["public"]["Enums"]["notif_kind"]
          read_at?: string | null
          sent_at?: string | null
          title: string
          tournament_id?: string | null
          user_id: string
        }
        Update: {
          body?: string | null
          booking_id?: string | null
          channel?: Database["public"]["Enums"]["notif_channel"]
          created_at?: string
          failed_reason?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["notif_kind"]
          read_at?: string | null
          sent_at?: string | null
          title?: string
          tournament_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          bank_tx_id: string | null
          booking_id: string
          created_at: string
          id: string
          paid_at: string | null
          provider: string
          raw: Json | null
          ref_code: string
          status: string
        }
        Insert: {
          amount: number
          bank_tx_id?: string | null
          booking_id: string
          created_at?: string
          id?: string
          paid_at?: string | null
          provider?: string
          raw?: Json | null
          ref_code: string
          status?: string
        }
        Update: {
          amount?: number
          bank_tx_id?: string | null
          booking_id?: string
          created_at?: string
          id?: string
          paid_at?: string | null
          provider?: string
          raw?: Json | null
          ref_code?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      price_rules: {
        Row: {
          court_id: string
          days: number[]
          end_time: string
          id: string
          label: string | null
          price_per_hour: number
          priority: number
          start_time: string
        }
        Insert: {
          court_id: string
          days?: number[]
          end_time: string
          id?: string
          label?: string | null
          price_per_hour: number
          priority?: number
          start_time: string
        }
        Update: {
          court_id?: string
          days?: number[]
          end_time?: string
          id?: string
          label?: string | null
          price_per_hour?: number
          priority?: number
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_rules_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          business_license_name: string | null
          business_license_path: string | null
          created_at: string
          full_name: string | null
          id: string
          owner_application_status: string | null
          payout_account: string | null
          payout_bank: string | null
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          telegram_chat_id: string | null
          telegram_link_expires_at: string | null
          telegram_link_token_hash: string | null
        }
        Insert: {
          avatar_url?: string | null
          business_license_name?: string | null
          business_license_path?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          owner_application_status?: string | null
          payout_account?: string | null
          payout_bank?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          telegram_chat_id?: string | null
          telegram_link_expires_at?: string | null
          telegram_link_token_hash?: string | null
        }
        Update: {
          avatar_url?: string | null
          business_license_name?: string | null
          business_license_path?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          owner_application_status?: string | null
          payout_account?: string | null
          payout_bank?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          telegram_chat_id?: string | null
          telegram_link_expires_at?: string | null
          telegram_link_token_hash?: string | null
        }
        Relationships: []
      }
      venue_favorites: {
        Row: {
          created_at: string
          user_id: string
          venue_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
          venue_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venue_favorites_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venues: {
        Row: {
          address: string
          amenities: string[]
          booking_horizon_days: number
          business_license_name: string | null
          business_license_path: string | null
          city: string
          close_time: string
          created_at: string
          deposit_pct: number
          description: string | null
          district: string
          id: string
          images: string[]
          lat: number | null
          lng: number | null
          name: string
          open_time: string
          owner_id: string
          phone: string | null
          slug: string
          status: Database["public"]["Enums"]["venue_status"]
        }
        Insert: {
          address: string
          amenities?: string[]
          booking_horizon_days?: number
          business_license_name?: string | null
          business_license_path?: string | null
          city?: string
          close_time?: string
          created_at?: string
          deposit_pct?: number
          description?: string | null
          district: string
          id?: string
          images?: string[]
          lat?: number | null
          lng?: number | null
          name: string
          open_time?: string
          owner_id: string
          phone?: string | null
          slug: string
          status?: Database["public"]["Enums"]["venue_status"]
        }
        Update: {
          address?: string
          amenities?: string[]
          booking_horizon_days?: number
          business_license_name?: string | null
          business_license_path?: string | null
          city?: string
          close_time?: string
          created_at?: string
          deposit_pct?: number
          description?: string | null
          district?: string
          id?: string
          images?: string[]
          lat?: number | null
          lng?: number | null
          name?: string
          open_time?: string
          owner_id?: string
          phone?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["venue_status"]
        }
        Relationships: [
          {
            foreignKeyName: "venues_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }

      tournament_settlements: {
        Row: {
          agreed_at: string | null
          agreed_by: string | null
          cancellation_venue_fee: number
          due_at: string
          owner_id: string
          terms_note: string
          tournament_id: string
          venue_fee: number | null
        }
        Insert: {
          agreed_at?: string | null
          agreed_by?: string | null
          cancellation_venue_fee?: number
          due_at: string
          owner_id: string
          terms_note?: string
          tournament_id: string
          venue_fee?: number | null
        }
        Update: {
          agreed_at?: string | null
          agreed_by?: string | null
          cancellation_venue_fee?: number
          due_at?: string
          owner_id?: string
          terms_note?: string
          tournament_id?: string
          venue_fee?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_settlements_agreed_by_fkey"
            columns: ["agreed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_settlements_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_settlements_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: true
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_transfers: {
        Row: {
          amount: number
          created_at: string
          id: string
          receipt: string
          received_at: string | null
          received_by: string | null
          recorded_by: string
          tournament_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          receipt: string
          received_at?: string | null
          received_by?: string | null
          recorded_by: string
          tournament_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          receipt?: string
          received_at?: string | null
          received_by?: string | null
          recorded_by?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_transfers_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_transfers_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_transfers_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      search_my_bookings: {
        Args: {
          p_filter?: string
          p_from?: string
          p_page?: number
          p_query?: string
          p_to?: string
        }
        Returns: Json
      }

      search_owner_bookings: {
        Args: {
          p_from?: string
          p_page?: number
          p_query?: string
          p_refund_needed?: boolean
          p_show_history?: boolean
          p_status?: string
          p_to?: string
          p_venue_id: string
        }
        Returns: Json
      }

      cancel_tournament: { Args: { p_id: string }; Returns: undefined }
      cancel_tournament_registration: {
        Args: { p_id: string }
        Returns: undefined
      }
      confirm_tournament_payment: {
        Args: {
          p_amount: number
          p_bank_tx_id: string
          p_connection_id: string
          p_raw: Json
          p_receiver_account: string
          p_receiver_bank: string
          p_ref_code: string
        }
        Returns: Json
      }
      get_booking_calendar: { Args: { p_code: string }; Returns: Json }
      get_community_profile: { Args: { p_id: string }; Returns: Json }
      get_my_favorites: { Args: never; Returns: Json }
      get_owner_period_stats: {
        Args: { p_days?: number; p_venue_id: string }
        Returns: Json
      }
      get_tournament_capacity: { Args: { p_id: string }; Returns: number }
      manages_tournament: { Args: { p_id: string }; Returns: boolean }
      mark_tournament_refund: {
        Args: { p_expected_amount: number; p_transaction_key: string }
        Returns: undefined
      }
      register_tournament: {
        Args: { p_data: Json; p_id: string }
        Returns: string
      }
      review_feedback: {
        Args: {
          p_id: string
          p_reply: string
          p_status: string
          p_updated_at: string
        }
        Returns: undefined
      }
      review_tournament: {
        Args: {
          p_approve: boolean
          p_cancellation_venue_fee?: number
          p_court_id: string
          p_id: string
          p_note?: string
          p_terms_confirmed?: boolean
          p_terms_note?: string
          p_venue_fee?: number
        }
        Returns: undefined
      }
      review_tournament_registration: {
        Args: { p_approve: boolean; p_id: string; p_note?: string }
        Returns: undefined
      }
      search_community: {
        Args: { p_location?: string; p_page?: number; p_sport?: string }
        Returns: Json
      }
      set_community_profile: { Args: { p_data: Json }; Returns: undefined }
      set_venue_favorite: {
        Args: { p_saved: boolean; p_venue_id: string }
        Returns: boolean
      }
      submit_feedback: {
        Args: {
          p_category: string
          p_id: string
          p_message: string
          p_page_path?: string
          p_title: string
        }
        Returns: string
      }
      submit_tournament: { Args: { p_data: Json }; Returns: string }
      get_admin_subscriptions: {
        Args: never
        Returns: {
          active: boolean
          fee_required: boolean
          full_name: string
          owner_id: string
          paid_until: string
          phone: string
        }[]
      }
      confirm_subscription_payment: {
        Args: {
          p_amount: number
          p_bank_tx_id: string
          p_connection_id: string
          p_raw: Json
          p_receiver_account: string
          p_receiver_bank: string
          p_ref_code: string
        }
        Returns: Json
      }
      create_subscription_invoice: {
        Args: never
        Returns: {
          account_name: string
          account_number: string
          amount: number
          bank: string
          code: string
          connection_id: string | null
          created_at: string
          id: string
          owner_id: string
          paid_at: string | null
          period_end: string | null
          period_start: string | null
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "subscription_invoices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_owner_subscription_fee: {
        Args: { p_owner_id: string; p_required: boolean }
        Returns: undefined
      }
      get_my_subscription: { Args: never; Returns: Json }
      owner_subscription_allows: {
        Args: { p_owner_id: string }
        Returns: boolean
      }
      initialize_legacy_receiver: {
        Args: { p_account: string; p_bank: string; p_name: string }
        Returns: undefined
      }
      get_my_sepay_connection: { Args: never; Returns: Json }
      disconnect_sepay_connection: {
        Args: { p_operation: string; p_owner_id: string }
        Returns: undefined
      }
      claim_sepay_connection: {
        Args: { p_operation: string; p_owner_id: string }
        Returns: {
          access_token_encrypted: string | null
          account_name: string | null
          account_number: string | null
          bank: string | null
          bank_account_id: string | null
          checked_at: string | null
          created_at: string
          id: string
          last_webhook_at: string | null
          operation_expires_at: string | null
          operation_token: string | null
          owner_id: string
          refresh_token_encrypted: string | null
          status: string
          token_expires_at: string | null
          webhook_id: string | null
          webhook_key_encrypted: string | null
          webhook_key_hash: string | null
        }
        SetofOptions: {
          from: "*"
          to: "sepay_connections"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      activate_sepay_connection: {
        Args: { p_operation: string; p_owner_id: string }
        Returns: undefined
      }
      venue_accepts_bookings: { Args: { p_venue_id: string }; Returns: boolean }
      get_admin_stats: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      get_owner_stats: {
        Args: { p_from: string; p_to: string; p_venue_id: string }
        Returns: Json
      }
      cancel_booking: {
        Args: { p_code: string; p_pending_only?: boolean }
        Returns: {
          cancelled_at: string | null
          code: string
          court_id: string
          created_at: string
          customer_name: string | null
          customer_phone: string
          deposit_amount: number
          ends_at: string
          expires_at: string
          id: string
          note: string | null
          paid_at: string | null
          refund_status: Database["public"]["Enums"]["refund_status"] | null
          starts_at: string
          status: Database["public"]["Enums"]["booking_status"]
          total_amount: number
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      complete_past_bookings: { Args: never; Returns: number }
      confirm_payment:
        | {
            Args: {
              p_amount: number
              p_bank_tx_id: string
              p_raw: Json
              p_ref_code: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_amount: number
              p_bank_tx_id: string
              p_connection_id: string
              p_raw: Json
              p_receiver_account: string
              p_receiver_bank: string
              p_ref_code: string
            }
            Returns: Json
          }
      confirm_payment_manual: {
        Args: { p_code: string }
        Returns: {
          cancelled_at: string | null
          code: string
          court_id: string
          created_at: string
          customer_name: string | null
          customer_phone: string
          deposit_amount: number
          ends_at: string
          expires_at: string
          id: string
          note: string | null
          paid_at: string | null
          refund_status: Database["public"]["Enums"]["refund_status"] | null
          starts_at: string
          status: Database["public"]["Enums"]["booking_status"]
          total_amount: number
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      connect_telegram: {
        Args: { p_chat_id: string; p_token: string }
        Returns: boolean
      }
      create_booking: {
        Args: {
          p_court_id: string
          p_customer_name: string
          p_customer_phone: string
          p_ends_at: string
          p_note?: string
          p_starts_at: string
        }
        Returns: {
          cancelled_at: string | null
          code: string
          court_id: string
          created_at: string
          customer_name: string | null
          customer_phone: string
          deposit_amount: number
          ends_at: string
          expires_at: string
          id: string
          note: string | null
          paid_at: string | null
          refund_status: Database["public"]["Enums"]["refund_status"] | null
          starts_at: string
          status: Database["public"]["Enums"]["booking_status"]
          total_amount: number
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_booking_once: {
        Args: {
          p_court_id: string
          p_customer_name: string
          p_customer_phone: string
          p_ends_at: string
          p_note?: string
          p_request_id: string
          p_starts_at: string
        }
        Returns: {
          cancelled_at: string | null
          code: string
          court_id: string
          created_at: string
          customer_name: string | null
          customer_phone: string
          deposit_amount: number
          ends_at: string
          expires_at: string
          id: string
          note: string | null
          paid_at: string | null
          payment_account: string | null
          payment_account_name: string | null
          payment_bank: string | null
          payment_connection_id: string | null
          payment_owner_id: string | null
          refund_status: Database["public"]["Enums"]["refund_status"] | null
          starts_at: string
          status: Database["public"]["Enums"]["booking_status"]
          total_amount: number
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_court: {
        Args: {
          p_close_time: string
          p_is_indoor: boolean
          p_name: string
          p_open_time: string
          p_price_per_hour: number
          p_slot_minutes: number
          p_sport: Database["public"]["Enums"]["sport_type"]
          p_surface: string
          p_venue_id: string
        }
        Returns: {
          close_time: string | null
          id: string
          is_active: boolean
          is_indoor: boolean
          name: string
          open_time: string | null
          slot_minutes: number
          sort_order: number
          sport: Database["public"]["Enums"]["sport_type"]
          surface: string | null
          venue_id: string
        }
        SetofOptions: {
          from: "*"
          to: "courts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_venue: {
        Args: {
          p_address: string
          p_close_time: string
          p_description: string
          p_district: string
          p_name: string
          p_open_time: string
          p_phone: string
          p_sports: Json
        }
        Returns: {
          address: string
          amenities: string[]
          booking_horizon_days: number
          business_license_name: string | null
          business_license_path: string | null
          city: string
          close_time: string
          created_at: string
          deposit_pct: number
          description: string | null
          district: string
          id: string
          images: string[]
          lat: number | null
          lng: number | null
          name: string
          open_time: string
          owner_id: string
          phone: string | null
          slug: string
          status: Database["public"]["Enums"]["venue_status"]
        }
        SetofOptions: {
          from: "*"
          to: "venues"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_court: { Args: { p_court_id: string }; Returns: undefined }
      delete_venue: { Args: { p_venue_id: string }; Returns: undefined }
      expire_pending_bookings: { Args: never; Returns: number }
      gen_booking_code: { Args: never; Returns: string }
      get_owner_email: { Args: { p_owner_id: string }; Returns: string }
      get_venue_availability: {
        Args: { p_date: string; p_venue_id: string }
        Returns: {
          court_id: string
          court_name: string
          ends_at: string
          is_available: boolean
          slot_status: string
          hold_expires_at: string | null
          price: number
          slot_minutes: number
          sport: Database["public"]["Enums"]["sport_type"]
          starts_at: string
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      mark_refund_done: {
        Args: { p_code: string }
        Returns: {
          cancelled_at: string | null
          code: string
          court_id: string
          created_at: string
          customer_name: string | null
          customer_phone: string
          deposit_amount: number
          ends_at: string
          expires_at: string
          id: string
          note: string | null
          paid_at: string | null
          refund_status: Database["public"]["Enums"]["refund_status"] | null
          starts_at: string
          status: Database["public"]["Enums"]["booking_status"]
          total_amount: number
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      owns_court: { Args: { p_court_id: string }; Returns: boolean }
      register_owner: {
        Args: {
          p_business_license_name: string
          p_business_license_path: string
          p_full_name: string
          p_payout_account: string
          p_payout_bank: string
          p_phone: string
        }
        Returns: {
          avatar_url: string | null
          business_license_name: string | null
          business_license_path: string | null
          created_at: string
          full_name: string | null
          id: string
          owner_application_status: string | null
          payout_account: string | null
          payout_bank: string | null
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          telegram_chat_id: string | null
          telegram_link_expires_at: string | null
          telegram_link_token_hash: string | null
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      review_owner: {
        Args: { p_owner_id: string; p_status: string }
        Returns: undefined
      }
      review_venue: {
        Args: { p_status: string; p_venue_id: string }
        Returns: undefined
      }
      set_profile_avatar: { Args: { p_path: string }; Returns: Json }
      slugify: { Args: { p_text: string }; Returns: string }
      unaccent_vi: { Args: { p_text: string }; Returns: string }
      update_court: {
        Args: {
          p_close_time: string
          p_court_id: string
          p_is_active: boolean
          p_is_indoor: boolean
          p_name: string
          p_open_time: string
          p_price_per_hour: number
          p_slot_minutes: number
          p_sport: Database["public"]["Enums"]["sport_type"]
          p_surface: string
        }
        Returns: {
          close_time: string | null
          id: string
          is_active: boolean
          is_indoor: boolean
          name: string
          open_time: string | null
          slot_minutes: number
          sort_order: number
          sport: Database["public"]["Enums"]["sport_type"]
          surface: string | null
          venue_id: string
        }
        SetofOptions: {
          from: "*"
          to: "courts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_profile: {
        Args: { p_full_name: string; p_phone: string }
        Returns: Json
      }
      update_venue: {
        Args: {
          p_address: string
          p_booking_horizon_days: number
          p_close_time: string
          p_deposit_pct: number
          p_description: string
          p_district: string
          p_name: string
          p_open_time: string
          p_phone: string
          p_venue_id: string
        }
        Returns: {
          address: string
          amenities: string[]
          booking_horizon_days: number
          business_license_name: string | null
          business_license_path: string | null
          city: string
          close_time: string
          created_at: string
          deposit_pct: number
          description: string | null
          district: string
          id: string
          images: string[]
          lat: number | null
          lng: number | null
          name: string
          open_time: string
          owner_id: string
          phone: string | null
          slug: string
          status: Database["public"]["Enums"]["venue_status"]
        }
        SetofOptions: {
          from: "*"
          to: "venues"
          isOneToOne: true
          isSetofReturn: false
        }
      }

      tournament_notice: {
        Args: { p_body: string; p_id: string; p_title: string; p_user: string }
        Returns: undefined
      }
      refresh_tournament: { Args: { p_id: string }; Returns: undefined }
      resubmit_tournament: {
        Args: { p_data: Json; p_id: string }
        Returns: string
      }
      process_tournament_deadlines: { Args: never; Returns: undefined }
      get_tournament_proposal: { Args: { p_id: string }; Returns: Json }
      get_tournament_registrations: { Args: { p_id: string }; Returns: Json }
      get_my_tournament_registrations: {
        Args: { p_page?: number }
        Returns: Json
      }
      set_tournament_terms: {
        Args: {
          p_cancellation_venue_fee?: number
          p_id: string
          p_note: string
          p_venue_fee: number
        }
        Returns: undefined
      }
      record_tournament_balance: {
        Args: { p_id: string; p_receipt: string; p_refund: boolean }
        Returns: undefined
      }
      get_tournament_settlement: { Args: { p_id: string }; Returns: Json }
      record_tournament_transfer: {
        Args: { p_expected_balance: number; p_id: string; p_receipt: string }
        Returns: string
      }
      confirm_tournament_transfer: {
        Args: { p_id: string }
        Returns: undefined
      }
      waive_tournament_balance: {
        Args: { p_id: string; p_note: string }
        Returns: undefined
      }
    }
    Enums: {
      booking_status:
        | "pending"
        | "confirmed"
        | "completed"
        | "cancelled"
        | "no_show"
      notif_channel: "app" | "email" | "telegram"
      notif_kind:
        | "new_booking"
        | "deposit_paid"
        | "expiring_soon"
        | "rescheduled"
        | "venue_approved"
        | "owner_application"
        | "tournament"
      refund_status: "none" | "needed" | "done"
      sport_type:
        | "football5"
        | "football7"
        | "football11"
        | "badminton"
        | "pickleball"
        | "tennis"
      user_role: "player" | "owner" | "admin"
      venue_status: "draft" | "pending" | "active" | "rejected"
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
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
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
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
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
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
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
    Enums: {
      booking_status: [
        "pending",
        "confirmed",
        "completed",
        "cancelled",
        "no_show",
      ],
      notif_channel: ["app", "email", "telegram"],
      notif_kind: [
        "new_booking",
        "deposit_paid",
        "expiring_soon",
        "rescheduled",
        "venue_approved",
        "owner_application",
        "tournament",
      ],
      refund_status: ["none", "needed", "done"],
      sport_type: [
        "football5",
        "football7",
        "football11",
        "badminton",
        "pickleball",
        "tennis",
      ],
      user_role: ["player", "owner", "admin"],
      venue_status: ["draft", "pending", "active", "rejected"],
    },
  },
} as const
