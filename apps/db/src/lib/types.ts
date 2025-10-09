// Typy generowane przez Supabase CLI
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      // Tutaj będą Twoje tabele po wygenerowaniu typów
      orders: {
        Row: {
          id: string;
          created_at: string;
          // ... inne pola
        };
        Insert: {
          id?: string;
          created_at?: string;
          // ... inne pola
        };
        Update: {
          id?: string;
          created_at?: string;
          // ... inne pola
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}
