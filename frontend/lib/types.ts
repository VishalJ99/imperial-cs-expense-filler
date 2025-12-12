// Type-specific field structures matching Excel columns

export interface TravelGeneralFields {
  date: string | null
  mode: string | null
  is_return: boolean
  from_location: string | null
  to_location: string | null
  foreign_currency: string | null
  sterling_total: number | null
  is_non_uk_eu: boolean
}

export interface TravelMileageFields {
  date: string | null
  miles: number | null
  is_return: boolean
  from_location: string | null
  to_location: string | null
  cost_per_mile: number | null
}

export interface HospitalityFields {
  date: string | null
  principal_guest: string | null
  organisation: string | null
  total_numbers: number | null
  foreign_currency: string | null
  sterling_total: number | null
  non_college_staff: boolean
}

export interface OtherFields {
  date: string | null
  expense_type: string | null
  description: string | null
  foreign_currency: string | null
  sterling_total: number | null
  is_non_uk_eu: boolean
}

export interface TypeSpecificFields {
  travel_general: TravelGeneralFields
  travel_mileage: TravelMileageFields
  hospitality: HospitalityFields
  other: OtherFields
}

export type ActiveSection = 'travel_general' | 'travel_mileage' | 'hospitality' | 'other'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ParsedReceipt {
  active_section: ActiveSection
  confidence: string
  raw_description: string
  fields: TypeSpecificFields
}

export interface Receipt {
  id: string
  filename: string
  image_base64: string
  thumbnail_base64: string
  parsed: ParsedReceipt | null
  approved: boolean
  processing: boolean
  error: string | null
  chat_history: ChatMessage[]
}

export interface HeaderInfo {
  name: string
  cid: string
  dob: string
  address: string
  postcode: string
  bank_name: string
  bank_branch: string
  sort_code: string
  account_number: string
  foreign_currency: string
  exchange_rate: string
  purpose: string
}

// Helper to create empty field structure
export function createEmptyFields(): TypeSpecificFields {
  return {
    travel_general: {
      date: null,
      mode: null,
      is_return: false,
      from_location: null,
      to_location: null,
      foreign_currency: null,
      sterling_total: null,
      is_non_uk_eu: false
    },
    travel_mileage: {
      date: null,
      miles: null,
      is_return: false,
      from_location: null,
      to_location: null,
      cost_per_mile: null
    },
    hospitality: {
      date: null,
      principal_guest: null,
      organisation: null,
      total_numbers: null,
      foreign_currency: null,
      sterling_total: null,
      non_college_staff: false
    },
    other: {
      date: null,
      expense_type: null,
      description: null,
      foreign_currency: null,
      sterling_total: null,
      is_non_uk_eu: false
    }
  }
}

export function createEmptyParsedReceipt(): ParsedReceipt {
  return {
    active_section: 'other',
    confidence: 'low',
    raw_description: '',
    fields: createEmptyFields()
  }
}
