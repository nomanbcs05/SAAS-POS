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
          section: string
          capacity: number
          status: string
          created_at: string
          restaurant_id: string | null
          tenant_id: string | null
        }
        Insert: {
          id?: string
          table_number: string
          section?: string
          capacity?: number
          status?: string
          created_at?: string
          restaurant_id?: string | null
          tenant_id?: string | null
        }
        Update: {
          id?: string
          table_number?: string
          section?: string
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
          multi_printer_kot_enabled?: boolean | null
        }
        Insert: {
          id?: string
          restaurant_name: string
          owner_id?: string | null
          plan_type?: string
          billing_status?: string
          created_at?: string
          multi_printer_kot_enabled?: boolean | null
        }
        Update: {
          id?: string
          restaurant_name?: string
          owner_id?: string | null
          plan_type?: string
          billing_status?: string
          created_at?: string
          multi_printer_kot_enabled?: boolean | null
        }
        Relationships: []
      }
      tenant_printers: {
        Row: {
          id: string
          tenant_id: string
          name: string
          printer_type: 'system' | 'usb' | 'network' | 'bluetooth'
          device_name: string | null
          ip_address: string | null
          port: number | null
          bluetooth_identifier: string | null
          is_default: boolean
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          name: string
          printer_type?: 'system' | 'usb' | 'network' | 'bluetooth'
          device_name?: string | null
          ip_address?: string | null
          port?: number | null
          bluetooth_identifier?: string | null
          is_default?: boolean
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          name?: string
          printer_type?: 'system' | 'usb' | 'network' | 'bluetooth'
          device_name?: string | null
          ip_address?: string | null
          port?: number | null
          bluetooth_identifier?: string | null
          is_default?: boolean
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_printers_tenant_id_fkey"
            columns: ["tenant_id"]
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          }
        ]
      }
      printer_category_routes: {
        Row: {
          id: string
          tenant_id: string
          category_name: string
          printer_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          category_name: string
          printer_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          category_name?: string
          printer_id?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_printer_routes_printer_id"
            columns: ["printer_id"]
            referencedRelation: "tenant_printers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "printer_category_routes_tenant_id_fkey"
            columns: ["tenant_id"]
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          }
        ]
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
