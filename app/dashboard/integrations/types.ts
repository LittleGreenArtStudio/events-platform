export type CalendarOption = {
  id: string
  name: string
  color: string | null
}

export type CalendarSuggestion = {
  googleId: string
  title: string
  date: string
  startTime: string | null
  endTime: string | null
  location: string | null
  description: string | null
  alreadyExists: boolean
}
