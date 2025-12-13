import { BellIcon } from '@heroicons/react/24/outline'

export type MutablePreferences = {
  emailRouteUpdates: boolean
  pushRouteUpdates: boolean
}

export type PreferenceKey = keyof MutablePreferences

export const PREFERENCE_FIELDS = [
  {
    key: 'emailRouteUpdates',
    label: 'Route updates',
    description: 'Receive notifications when the crew is on their way or arriving on site.',
    icon: BellIcon,
  },
] as const
