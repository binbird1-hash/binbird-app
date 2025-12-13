import { BellAlertIcon, CheckBadgeIcon, TruckIcon } from '@heroicons/react/24/outline'

export type MutablePreferences = {
  emailEnRoute: boolean
  pushEnRoute: boolean
  emailOnSite: boolean
  pushOnSite: boolean
  emailJobComplete: boolean
  pushJobComplete: boolean
}

export type PreferenceKey = keyof MutablePreferences

export const PREFERENCE_FIELDS = [
  {
    key: 'emailEnRoute',
    label: 'Crew en route',
    description: 'Get updates when staff are on their way to your site.',
    icon: TruckIcon,
  },
  {
    key: 'emailOnSite',
    label: 'Crew on site',
    description: 'Know the moment the crew arrives and begins work.',
    icon: BellAlertIcon,
  },
  {
    key: 'emailJobComplete',
    label: 'Job complete',
    description: 'Be notified as soon as service is finished and proof is uploaded.',
    icon: CheckBadgeIcon,
  },
] as const
