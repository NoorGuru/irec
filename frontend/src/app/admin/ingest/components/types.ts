export type StepStatus = 'pending' | 'running' | 'done' | 'error' | 'retrying'

export interface PipelineStep {
  id: string
  label: string
  status: StepStatus
  detail?: string
  startedAt?: number
  completedAt?: number
}

export interface ExtractionResult {
  channel_name: string
  channel_id?: string | null
  video_id: string
  title?: string | null
  published_at: string
  tickers_extracted: string[]
  recommendation_count: number
  video_summary?: string | null
}

export interface FailedIngestion {
  url: string
  error: string
  timestamp: number
}

export interface JobConfig {
  id: string
  url: string
  mode: 'normal' | 'reextract' | 'force_reingest'
  manualTranscriptText?: string
}
