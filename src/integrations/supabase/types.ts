export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      products: {
        Row: {
          id: string
          name: string
          sku: string
          price: number
          cost: number
          stock: number
          category: string
          image: string | null
          created_at: string
          restaurant_id: string | null
          tenant_id: string | null
        }
        Insert: {
          id?: string
          name: string
          sku: string
          price: number
          cost: number
          stock?: number
          category: string
          image?: string | null
          created_at?: string
          restaurant_id?: string | null
          tenant_id?: string | null
        }
        Update: {
          id?: string
          name?: string
          sku?: string
          price?: number
          cost?: number
          stock?: number
          category?: string
          image?: string | null
          created_at?: string
          restaurant_id?: string | null
          tenant_id?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          id: string
          name: string
          phone: string | null
          email: string | null
          loyalty_points: number
          total_spent: number
          visit_count: number
          created_at: string
          restaurant_id: string | null
          tenant_id: string | null
        }
        Insert: {
          id?: string
          name: string
          phone?: string | null
          email?: string | null
          loyalty_points?: number
          total_spent?: number
          visit_count?: number
          created_at?: string
          restaurant_id?: string | null
          tenant_id?: string | null
        }
        Update: {
          id?: string
          name?: string
          phone?: string | null
          email?: string | null
          loyalty_points?: number
          total_spent?: number
          visit_count?: number
          created_at?: string
          restaurant_id?: string | null
          tenant_id?: string | null
        }
        Relationships: []
      }
      orders: {
        Row: {
          id: string
          customer_id: string | null
          total_amount: number
          status: string
          payment_method: string
          order_type: string
          created_at: string
          restaurant_id: string | null
          tenant_id: string | null
        }
        Insert: {
          id?: string
          customer_id?: string | null
          total_amount: number
          status?: string
          payment_method: string
          order_type?: string
          created_at?: string
          restaurant_id?: string | null
          tenant_id?: string | null
        }
        Update: {
          id?: string
          customer_id?: string | null
          total_amount?: number
          status?: string
          payment_method?: string
          order_type?: string
          created_at?: string
          restaurant_id?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          }
        ]
      }
      order_items: {
        Row: {
          id: string
          order_id: string | null
          product_id: string | null
          quantity: number
          price: number
          created_at: string
          restaurant_id: string | null
          tenant_id: string | null
        }
        Insert: {
          id?: string
          order_id?: string | null
          product_id?: string | null
          quantity: number
          price: number
          created_at?: string
          restaurant_id?: string | null
          tenant_id?: string | null
        }
        Update: {
          id?: string
          order_id?: string | null
          product_id?: string | null
          quantity: number
          price: number
          created_at?: string
          restaurant_id?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          }
        ]
      }
      categories: {
        Row: {
          id: string
          name: string
          icon: string
          created_at: string
          restaurant_id: string | null
          tenant_id: string | null
        }
        Insert: {
          id?: string
          name: string
          icon: string
          created_at?: string
          restaurant_id?: string | null
          tenant_id?: string | null
        }
        Update: {
          id?: string
          name?: string
          icon?: string
          created_at?: string
          restaurant_id?: string | null
          tenant_id?: string | null
        }
        Relationships: []
      }
      daily_registers: {
        Row: {
          id: string
          opened_at: string
          closed_at: string | null
          starting_amount: number
          ending_amount: number | null
          status: string
          notes: string | null
          restaurant_id: string | null
          tenant_id: string | null
        }
        Insert: {
          id?: string
          opened_at?: string
          closed_at?: string | null
          starting_amount: number
          ending_amount?: number | null
          status?: string
          notes?: string | null
          restaurant_id?: string | null
          tenant_id?: string | null
        }
        Update: {
          id?: string
          opened_at?: string
          closed_at?: string | null
          starting_amount?: number
          ending_amount?: number | null
          status?: string
          notes?: string | null
          restaurant_id?: string | null
          tenant_id?: string | null
        }
        Relationships: []
      }
      restaurant_tables: {
        Row: {
          id: string
          table_number: string
          capacity: number
          status: string
          created_at: string
          restaurant_id: string | null
          tenant_id: string | null
        }
        Insert: {
          id?: string
          table_number: string
          capacity?: number
          status?: string
          created_at?: string
          restaurant_id?: string | null
          tenant_id?: string | null
        }
        Update: {
          id?: string
          table_number?: string
          capacity?: number
          status?: string
          created_at?: string
          restaurant_id?: string | null
          tenant_id?: string | null
        }
        Relationships: []
      }
      restaurants: {
        Row: {
          id: string
          name: string
          slug: string
          owner_id: string | null
          subscription_status: string
          license_expiry: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          owner_id?: string | null
          subscription_status?: string
          license_expiry?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          owner_id?: string | null
          subscription_status?: string
          license_expiry?: string | null
          created_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          restaurant_id: string | null
          tenant_id: string | null
          full_name: string | null
          email: string | null
          role: string
          created_at: string
        }
        Insert: {
          id: string
          restaurant_id?: string | null
          tenant_id?: string | null
          full_name?: string | null
          email?: string | null
          role?: string
          created_at?: string
        }
        Update: {
          id?: string
          restaurant_id?: string | null
          tenant_id?: string | null
          full_name?: string | null
          email?: string | null
          role?: string
          created_at?: string
        }
        Relationships: []
      }
      tenants: {
        Row: {
          id: string
          restaurant_name: string
          owner_id: string | null
          plan_type: string
          billing_status: string
          created_at: string
        }
        Insert: {
          id?: string
          restaurant_name: string
          owner_id?: string | null
          plan_type?: string
          billing_status?: string
          created_at?: string
        }
        Update: {
          id?: string
          restaurant_name?: string
          owner_id?: string | null
          plan_type?: string
          billing_status?: string
          created_at?: string
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
