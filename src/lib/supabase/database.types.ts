export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      account_access: {
        Row: {
          active: boolean;
          created_at: string;
          email: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          email: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          email?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      category_tags: {
        Row: {
          client_updated_at: string;
          color_hex: string;
          created_at: string;
          deleted_at: string | null;
          id: string;
          name: string;
          position: string;
          revision: number;
          surface: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          client_updated_at?: string;
          color_hex: string;
          created_at?: string;
          deleted_at?: string | null;
          id: string;
          name: string;
          position: string;
          revision?: number;
          surface: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          client_updated_at?: string;
          color_hex?: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          name?: string;
          position?: string;
          revision?: number;
          surface?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      checklist_items: {
        Row: {
          category_tag_id: string | null;
          checked: boolean;
          client_updated_at: string;
          collapsed: boolean;
          created_at: string;
          daily_entry_id: string;
          deleted_at: string | null;
          id: string;
          parent_id: string | null;
          priority: boolean;
          revision: number;
          scheduled_time: string | null;
          sort_rank: string;
          text: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          category_tag_id?: string | null;
          checked?: boolean;
          client_updated_at?: string;
          collapsed?: boolean;
          created_at?: string;
          daily_entry_id: string;
          deleted_at?: string | null;
          id: string;
          parent_id?: string | null;
          priority?: boolean;
          revision?: number;
          scheduled_time?: string | null;
          sort_rank: string;
          text?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          category_tag_id?: string | null;
          checked?: boolean;
          client_updated_at?: string;
          collapsed?: boolean;
          created_at?: string;
          daily_entry_id?: string;
          deleted_at?: string | null;
          id?: string;
          parent_id?: string | null;
          priority?: boolean;
          revision?: number;
          scheduled_time?: string | null;
          sort_rank?: string;
          text?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'checklist_items_category_tag_fkey';
            columns: ['category_tag_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'category_tags';
            referencedColumns: ['id', 'user_id'];
          },
          {
            foreignKeyName: 'checklist_items_daily_entry_fkey';
            columns: ['daily_entry_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'daily_entries';
            referencedColumns: ['id', 'user_id'];
          },
          {
            foreignKeyName: 'checklist_items_parent_fkey';
            columns: ['parent_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'checklist_items';
            referencedColumns: ['id', 'user_id'];
          },
        ];
      };
      daily_entries: {
        Row: {
          category_summaries: Json;
          category_tag_ids: string[];
          client_updated_at: string;
          completed_count: number;
          created_at: string;
          date: string;
          deleted_at: string | null;
          id: string;
          item_count: number;
          revision: number;
          timezone: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          category_summaries?: Json;
          category_tag_ids?: string[];
          client_updated_at?: string;
          completed_count?: number;
          created_at?: string;
          date: string;
          deleted_at?: string | null;
          id: string;
          item_count?: number;
          revision?: number;
          timezone: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          category_summaries?: Json;
          category_tag_ids?: string[];
          client_updated_at?: string;
          completed_count?: number;
          created_at?: string;
          date?: string;
          deleted_at?: string | null;
          id?: string;
          item_count?: number;
          revision?: number;
          timezone?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      goal_groups: {
        Row: {
          category_tag_id: string | null;
          client_updated_at: string;
          created_at: string;
          deleted_at: string | null;
          id: string;
          revision: number;
          sort_rank: string;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          category_tag_id?: string | null;
          client_updated_at?: string;
          created_at?: string;
          deleted_at?: string | null;
          id: string;
          revision?: number;
          sort_rank: string;
          title?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          category_tag_id?: string | null;
          client_updated_at?: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          revision?: number;
          sort_rank?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'goal_groups_category_tag_fkey';
            columns: ['category_tag_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'category_tags';
            referencedColumns: ['id', 'user_id'];
          },
        ];
      };
      goal_steps: {
        Row: {
          category_tag_id: string | null;
          client_updated_at: string;
          collapsed: boolean;
          completed: boolean;
          created_at: string;
          deleted_at: string | null;
          goal_id: string;
          id: string;
          parent_id: string | null;
          priority: boolean;
          revision: number;
          sort_rank: string;
          text: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          category_tag_id?: string | null;
          client_updated_at?: string;
          collapsed?: boolean;
          completed?: boolean;
          created_at?: string;
          deleted_at?: string | null;
          goal_id: string;
          id: string;
          parent_id?: string | null;
          priority?: boolean;
          revision?: number;
          sort_rank: string;
          text?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          category_tag_id?: string | null;
          client_updated_at?: string;
          collapsed?: boolean;
          completed?: boolean;
          created_at?: string;
          deleted_at?: string | null;
          goal_id?: string;
          id?: string;
          parent_id?: string | null;
          priority?: boolean;
          revision?: number;
          sort_rank?: string;
          text?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'goal_steps_category_tag_fkey';
            columns: ['category_tag_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'category_tags';
            referencedColumns: ['id', 'user_id'];
          },
          {
            foreignKeyName: 'goal_steps_goal_fkey';
            columns: ['goal_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'goals';
            referencedColumns: ['id', 'user_id'];
          },
          {
            foreignKeyName: 'goal_steps_parent_fkey';
            columns: ['parent_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'goal_steps';
            referencedColumns: ['id', 'user_id'];
          },
        ];
      };
      goals: {
        Row: {
          category_tag_id: string | null;
          client_updated_at: string;
          completed_at: string | null;
          created_at: string;
          deleted_at: string | null;
          group_id: string | null;
          id: string;
          revision: number;
          sort_rank: string;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          category_tag_id?: string | null;
          client_updated_at?: string;
          completed_at?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          group_id?: string | null;
          id: string;
          revision?: number;
          sort_rank: string;
          title?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          category_tag_id?: string | null;
          client_updated_at?: string;
          completed_at?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          group_id?: string | null;
          id?: string;
          revision?: number;
          sort_rank?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'goals_category_tag_fkey';
            columns: ['category_tag_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'category_tags';
            referencedColumns: ['id', 'user_id'];
          },
          {
            foreignKeyName: 'goals_group_fkey';
            columns: ['group_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'goal_groups';
            referencedColumns: ['id', 'user_id'];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          deleted_at: string | null;
          email: string;
          full_name: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          email: string;
          full_name?: string | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          email?: string;
          full_name?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      current_user_has_app_access: { Args: never; Returns: boolean };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  'public'
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
