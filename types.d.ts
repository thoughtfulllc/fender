declare global {
  namespace NodeJS {
    interface ProcessEnv {
      BASE_URL: string
      DATABASE_URL: string
      EMAIL_FROM: string
      PORT?: string
      POSTMARK_SERVER_TOKEN: string
      TEXTBELT_API_KEY: string
      OPEN_AI_API_KEY: string
      OPEN_AI_ORGANIZATION: string
    }
  }
}

export type Timeframe = 'day' | 'week' | 'month' | 'quarter' | 'year'

export type Medium = 'sms' | 'email'

export type ThreadEmailMetadata = {
  medium: 'email'
  email: string
}

export type ThreadSmsMetadata = {
  medium: 'sms'
  phone: string
}

export type ThreadMetadata = ThreadEmailMetadata | ThreadSmsMetadata
