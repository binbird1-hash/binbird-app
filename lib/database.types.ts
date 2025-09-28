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
      client_list: {
        Row: {
          id: string
          client_name: string | null
          company: string | null
          address: string | null
          put_bins_out: string | null
          collection_day: string | null
          notes: string | null
          red_freq: string | null
          red_flip: string | null
          yellow_freq: string | null
          yellow_flip: string | null
          green_freq: string | null
          green_flip: string | null
          email: string | null
          number: string | null
          trial_start: string | null
          membership_start: string | null
          price_per_month: number | null
          photo_path: string | null
          assigned_to: string | null
          lat_lng: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          client_name?: string | null
          company?: string | null
          address?: string | null
          put_bins_out?: string | null
          collection_day?: string | null
          notes?: string | null
          red_freq?: string | null
          red_flip?: string | null
          yellow_freq?: string | null
          yellow_flip?: string | null
          green_freq?: string | null
          green_flip?: string | null
          email?: string | null
          number?: string | null
          trial_start?: string | null
          membership_start?: string | null
          price_per_month?: number | null
          photo_path?: string | null
          assigned_to?: string | null
          lat_lng?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          client_name?: string | null
          company?: string | null
          address?: string | null
          put_bins_out?: string | null
          collection_day?: string | null
          notes?: string | null
          red_freq?: string | null
          red_flip?: string | null
          yellow_freq?: string | null
          yellow_flip?: string | null
          green_freq?: string | null
          green_flip?: string | null
          email?: string | null
          number?: string | null
          trial_start?: string | null
          membership_start?: string | null
          price_per_month?: number | null
          photo_path?: string | null
          assigned_to?: string | null
          lat_lng?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      jobs: {
        Row: {
          id: string
          lat: number | null
          lng: number | null
          last_completed_on: string | null
          assigned_to: string | null
          day_of_week: string | null
          address: string | null
          photo_path: string | null
          client_name: string | null
          bins: string | null
          notes: string | null
          job_type: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          lat?: number | null
          lng?: number | null
          last_completed_on?: string | null
          assigned_to?: string | null
          day_of_week?: string | null
          address?: string | null
          photo_path?: string | null
          client_name?: string | null
          bins?: string | null
          notes?: string | null
          job_type?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          lat?: number | null
          lng?: number | null
          last_completed_on?: string | null
          assigned_to?: string | null
          day_of_week?: string | null
          address?: string | null
          photo_path?: string | null
          client_name?: string | null
          bins?: string | null
          notes?: string | null
          job_type?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      logs: {
        Row: {
          id: number
          job_id: string | null
          client_name: string | null
          address: string | null
          task_type: string | null
          bins: string | null
          notes: string | null
          photo_path: string | null
          done_on: string | null
          gps_lat: number | null
          gps_lng: number | null
          gps_acc: number | null
          gps_time: string | null
          user_id: string | null
          created_at: string | null
        }
        Insert: {
          id?: number
          job_id?: string | null
          client_name?: string | null
          address?: string | null
          task_type?: string | null
          bins?: string | null
          notes?: string | null
          photo_path?: string | null
          done_on?: string | null
          gps_lat?: number | null
          gps_lng?: number | null
          gps_acc?: number | null
          gps_time?: string | null
          user_id?: string | null
          created_at?: string | null
        }
        Update: {
          id?: number
          job_id?: string | null
          client_name?: string | null
          address?: string | null
          task_type?: string | null
          bins?: string | null
          notes?: string | null
          photo_path?: string | null
          done_on?: string | null
          gps_lat?: number | null
          gps_lng?: number | null
          gps_acc?: number | null
          gps_time?: string | null
          user_id?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      user_profile: {
        Row: {
          user_id: string
          full_name: string | null
          email: string | null
          phone: string | null
          role: string | null
          map_style_pref: string | null
          nav_pref: string | null
          abn: string | null
          pay_id: string | null
          created_at: string | null
        }
        Insert: {
          user_id: string
          full_name?: string | null
          email?: string | null
          phone?: string | null
          role?: string | null
          map_style_pref?: string | null
          nav_pref?: string | null
          abn?: string | null
          pay_id?: string | null
          created_at?: string | null
        }
        Update: {
          user_id?: string
          full_name?: string | null
          email?: string | null
          phone?: string | null
          role?: string | null
          map_style_pref?: string | null
          nav_pref?: string | null
          abn?: string | null
          pay_id?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {}
    Functions: {
      refresh_jobs: {
        Args: Record<string, never>
        Returns: void
      }
    }
    Enums: {}
    CompositeTypes: {}
  }
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']

export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']
