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
      }
    }
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: { [_ in never]: never }
  }
}

export type ScanRow = Database['public']['Tables']['scans']['Row']
