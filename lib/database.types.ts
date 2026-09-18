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
      bookings: {
        Row: {
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
        Insert: {
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
          refund_status?: Database["public"]["Enums"]["refund_status"] | null
          starts_at: string
          status?: Database["public"]["Enums"]["booking_status"]
          total_amount: number
          user_id: string
        }
        Update: {
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
          created_at: string
          full_name: string | null
          id: string
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
          created_at?: string
          full_name?: string | null
          id: string
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
          created_at?: string
          full_name?: string | null
          id?: string
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
      venues: {
        Row: {
          address: string
          amenities: string[]
          booking_horizon_days: number
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cancel_booking: {
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
      complete_past_bookings: { Args: never; Returns: number }
      confirm_payment: {
        Args: {
          p_amount: number
          p_bank_tx_id: string
          p_raw: Json
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
      expire_pending_bookings: { Args: never; Returns: number }
      gen_booking_code: { Args: never; Returns: string }
      get_venue_availability: {
        Args: { p_date: string; p_venue_id: string }
        Returns: {
          court_id: string
          court_name: string
          ends_at: string
          is_available: boolean
          price: number
          slot_minutes: number
          sport: Database["public"]["Enums"]["sport_type"]
          starts_at: string
        }[]
      }
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
      register_venue: {
        Args: {
          p_address: string
          p_close_time: string
          p_description: string
          p_district: string
          p_name: string
          p_open_time: string
          p_payout_account: string
          p_payout_bank: string
          p_phone: string
          p_sports: Json
        }
        Returns: {
          address: string
          amenities: string[]
          booking_horizon_days: number
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
      slugify: { Args: { p_text: string }; Returns: string }
      unaccent_vi: { Args: { p_text: string }; Returns: string }
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
