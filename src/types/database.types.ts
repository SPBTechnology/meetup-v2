
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "conversation_invites": {
                  Row: {
                    "code": string,"conversation_id": string,"created_at": string,"created_by": string | null,"expires_at": string,"id": string,"max_uses": number | null,"revoked_at": string | null,"use_count": number
                  }
                  Insert: {
                    "code"?: string,"conversation_id": string,"created_at"?: string,"created_by"?: string | null,"expires_at"?: string,"id"?: string,"max_uses"?: number | null,"revoked_at"?: string | null,"use_count"?: number
                  }
                  Update: {
                    "code"?: string,"conversation_id"?: string,"created_at"?: string,"created_by"?: string | null,"expires_at"?: string,"id"?: string,"max_uses"?: number | null,"revoked_at"?: string | null,"use_count"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "conversation_invites_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversation_summaries"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversation_invites_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversation_invites_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"conversation_participants": {
                  Row: {
                    "conversation_id": string,"joined_at": string,"user_id": string
                  }
                  Insert: {
                    "conversation_id": string,"joined_at"?: string,"user_id": string
                  }
                  Update: {
                    "conversation_id"?: string,"joined_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "conversation_participants_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversation_summaries"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversation_participants_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversation_participants_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"conversations": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"name": string | null,"type": Database["public"]['Enums']["conversation_type"]
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"name"?: string | null,"type"?: Database["public"]['Enums']["conversation_type"]
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"name"?: string | null,"type"?: Database["public"]['Enums']["conversation_type"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "conversations_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"event_date_options": {
                  Row: {
                    "created_at": string,"created_by": string | null,"ends_at": string | null,"event_id": string,"id": string,"starts_at": string
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"ends_at"?: string | null,"event_id": string,"id"?: string,"starts_at": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"ends_at"?: string | null,"event_id"?: string,"id"?: string,"starts_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_date_options_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_date_options_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "event_summaries"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_date_options_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                },"event_locations": {
                  Row: {
                    "address": string | null,"created_at": string,"created_by": string | null,"event_id": string,"id": string,"lat": number | null,"lng": number | null,"name": string,"place_id": string | null,"place_type": string | null,"sort_order": number
                  }
                  Insert: {
                    "address"?: string | null,"created_at"?: string,"created_by"?: string | null,"event_id": string,"id"?: string,"lat"?: number | null,"lng"?: number | null,"name": string,"place_id"?: string | null,"place_type"?: string | null,"sort_order"?: number
                  }
                  Update: {
                    "address"?: string | null,"created_at"?: string,"created_by"?: string | null,"event_id"?: string,"id"?: string,"lat"?: number | null,"lng"?: number | null,"name"?: string,"place_id"?: string | null,"place_type"?: string | null,"sort_order"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_locations_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_locations_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "event_summaries"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_locations_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                },"event_responses": {
                  Row: {
                    "date_option_id": string,"responded_at": string,"response": Database["public"]['Enums']["event_response"],"user_id": string
                  }
                  Insert: {
                    "date_option_id": string,"responded_at"?: string,"response": Database["public"]['Enums']["event_response"],"user_id": string
                  }
                  Update: {
                    "date_option_id"?: string,"responded_at"?: string,"response"?: Database["public"]['Enums']["event_response"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_responses_date_option_id_fkey"
      columns: ["date_option_id"]
isOneToOne: false
      referencedRelation: "event_date_options"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_responses_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"events": {
                  Row: {
                    "allow_alt_dates": boolean,"allow_alt_locations": boolean,"confirmed_option_id": string | null,"conversation_id": string,"created_at": string,"created_by": string | null,"description": string | null,"id": string,"status": Database["public"]['Enums']["event_status"],"title": string,"updated_at": string
                  }
                  Insert: {
                    "allow_alt_dates"?: boolean,"allow_alt_locations"?: boolean,"confirmed_option_id"?: string | null,"conversation_id": string,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"id"?: string,"status"?: Database["public"]['Enums']["event_status"],"title": string,"updated_at"?: string
                  }
                  Update: {
                    "allow_alt_dates"?: boolean,"allow_alt_locations"?: boolean,"confirmed_option_id"?: string | null,"conversation_id"?: string,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"id"?: string,"status"?: Database["public"]['Enums']["event_status"],"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "events_confirmed_option_fk"
      columns: ["id","confirmed_option_id"]
isOneToOne: false
      referencedRelation: "event_date_options"
      referencedColumns: ["event_id","id"]
    },{
      foreignKeyName: "events_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversation_summaries"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "events_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "events_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"messages": {
                  Row: {
                    "content": string,"conversation_id": string,"created_at": string,"id": string,"kind": Database["public"]['Enums']["message_kind"],"sender_id": string | null
                  }
                  Insert: {
                    "content": string,"conversation_id": string,"created_at"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["message_kind"],"sender_id"?: string | null
                  }
                  Update: {
                    "content"?: string,"conversation_id"?: string,"created_at"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["message_kind"],"sender_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "messages_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversation_summaries"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_sender_id_fkey"
      columns: ["sender_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_url": string | null,"created_at": string,"display_name": string,"id": string,"phone_number": string | null,"updated_at": string
                  }
                  Insert: {
                    "avatar_url"?: string | null,"created_at"?: string,"display_name": string,"id": string,"phone_number"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "avatar_url"?: string | null,"created_at"?: string,"display_name"?: string,"id"?: string,"phone_number"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "conversation_summaries": {
                  Row: {
                    "created_at": string | null,"created_by": string | null,"id": string | null,"last_activity_at": string | null,"last_message_at": string | null,"last_message_content": string | null,"last_message_id": string | null,"last_message_sender_id": string | null,"name": string | null,"type": Database["public"]['Enums']["conversation_type"] | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "conversations_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_sender_id_fkey"
      columns: ["last_message_sender_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"event_summaries": {
                  Row: {
                    "accepted_count": number | null,"conversation_id": string | null,"created_at": string | null,"created_by": string | null,"declined_count": number | null,"first_location_name": string | null,"id": string | null,"location_count": number | null,"maybe_count": number | null,"multi_date": boolean | null,"nearest_date": string | null,"single_date_option_id": string | null,"status": Database["public"]['Enums']["event_status"] | null,"title": string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "events_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversation_summaries"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "events_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "events_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "accept_invite":
{ Args: { "p_code": string }; Returns: string
                           },
"add_participants":
{ Args: { "p_conversation_id": string,"p_user_ids": (string)[] }; Returns: number
                           },
"create_conversation":
{ Args: { "p_name"?: string,"p_type"?: Database["public"]['Enums']["conversation_type"] }; Returns: string
                           },
"create_event":
{ Args: { "p_allow_alt_dates"?: boolean,"p_allow_alt_locations"?: boolean,"p_conversation_id": string,"p_description"?: string,"p_locations"?: (string)[],"p_starts_at"?: (string)[],"p_title": string }; Returns: string
                           },
"match_phone_numbers":
{ Args: { "p_phone_numbers": (string)[] }; Returns: {
              "display_name": string,"phone_number": string,"user_id": string
            }[]
                           }
          }
          Enums: {
            "conversation_type": "direct"|"group","event_response": "accepted"|"maybe"|"declined","event_status": "planning"|"confirmed"|"cancelled","message_kind": "user"|"system"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "conversation_type": ["direct", "group"],"event_response": ["accepted", "maybe", "declined"],"event_status": ["planning", "confirmed", "cancelled"],"message_kind": ["user", "system"]
          }
        }
} as const

