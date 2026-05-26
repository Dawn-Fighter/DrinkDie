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
      profiles: {
        Row: {
          handle: string
          id: string
          updated_at: string
        }
        Insert: {
          handle: string
          id: string
          updated_at?: string
        }
        Update: {
          handle?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      scans: {
        Row: {
          brand: string
          caffeine_mg: number
          chaos: number
          handle: string
          id: string
          label: string
          ml: number
          scanned_at: string
          sleep_debt: number
          user_id: string
        }
        Insert: {
          brand: string
          caffeine_mg: number
          chaos: number
          handle: string
          id: string
          label: string
          ml: number
          scanned_at?: string
          sleep_debt: number
          user_id: string
        }
        Update: {
          brand?: string
          caffeine_mg?: number
          chaos?: number
          handle?: string
          id?: string
          label?: string
          ml?: number
          scanned_at?: string
          sleep_debt?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: { [_ in never]: never }
  }
}

export type ScanRow = Database['public']['Tables']['scans']['Row']
export type ProfileRow = Database['public']['Tables']['profiles']['Row']
