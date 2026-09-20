'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

const schema = z.object({ eventId: z.string().uuid(), slug: z.string().min(1).max(120) })

export async function registerForEvent(formData: FormData) {
  const parsed = schema.safeParse({
    eventId: formData.get('eventId'),
    slug: formData.get('slug'),
  })
  if (!parsed.success) return

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from('event_registrations')
    .upsert(
      { event_id: parsed.data.eventId, profile_id: user.id, status: 'registered' },
      { onConflict: 'event_id,profile_id' }
    )

  revalidatePath(`/events/${parsed.data.slug}`)
}

export async function cancelEventRegistration(formData: FormData) {
  const parsed = schema.safeParse({
    eventId: formData.get('eventId'),
    slug: formData.get('slug'),
  })
  if (!parsed.success) return

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from('event_registrations')
    .update({ status: 'cancelled' })
    .eq('event_id', parsed.data.eventId)
    .eq('profile_id', user.id)

  revalidatePath(`/events/${parsed.data.slug}`)
}
