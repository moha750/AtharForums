-- ════════════════════════════════════════════════════════════════════════════
-- منتديات أثر — قراءة الإحصاءات
--
-- كل دالّة هنا تتحقّق من الصلاحية بنفسها قبل أن تعيد صفًّا واحدًا. السبب أنها
-- SECURITY DEFINER فتتجاوز RLS بطبيعتها — فلو نسينا الفحص لانكشفت اللوحة
-- لأي مستخدم مسجَّل. الفحص في أول سطر من كل دالّة، بلا استثناء.
--
-- الروبوتات مستثناة من كل رقم (device = 'bot'). تُسجَّل ليُعرف حجمها، ولا
-- تُحتسب زوارًا.
-- ════════════════════════════════════════════════════════════════════════════

/** حارس مشترك: مشرف فأعلى. */
create or replace function public.analytics_require_admin()
returns void language plpgsql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  if not public.is_admin() then
    raise exception 'الإحصاءات مقصورة على إدارة أثر.' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.analytics_require_admin() from public;
grant execute on function public.analytics_require_admin() to authenticated;

-- ── المؤشّرات الرئيسة، ومعها الفترة السابقة للمقارنة ───────────────────────

create or replace function public.analytics_overview(p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_span     interval := p_to - p_from;
  v_prev_from timestamptz := p_from - v_span;
  v_current  jsonb;
  v_previous jsonb;
begin
  perform public.analytics_require_admin();

  with v as (
    select * from public.analytics_visits
    where started_at >= p_from and started_at < p_to and device <> 'bot'
  )
  select jsonb_build_object(
    'visitors',      count(distinct visitor_id),
    'visits',        count(*),
    'pageviews',     coalesce(sum(pageviews), 0),
    'bounces',       count(*) filter (where pageviews <= 1),
    'bounce_rate',   case when count(*) = 0 then 0
                     else round(count(*) filter (where pageviews <= 1)::numeric * 100 / count(*), 1) end,
    'avg_duration_s',case when count(*) = 0 then 0
                     else round(avg(duration_ms)::numeric / 1000, 0) end,
    'views_per_visit', case when count(*) = 0 then 0
                     else round(coalesce(sum(pageviews), 0)::numeric / count(*), 2) end,
    'returning',     count(*) filter (where is_returning),
    'returning_rate',case when count(*) = 0 then 0
                     else round(count(*) filter (where is_returning)::numeric * 100 / count(*), 1) end,
    'identified',    count(*) filter (where profile_id is not null),
    'conversions',   coalesce(sum(conversions), 0),
    'conversion_rate', case when count(*) = 0 then 0
                     else round(count(*) filter (where conversions > 0)::numeric * 100 / count(*), 1) end,
    'bots',          (select count(*) from public.analytics_visits
                      where started_at >= p_from and started_at < p_to and device = 'bot')
  ) into v_current from v;

  with v as (
    select * from public.analytics_visits
    where started_at >= v_prev_from and started_at < p_from and device <> 'bot'
  )
  select jsonb_build_object(
    'visitors',      count(distinct visitor_id),
    'visits',        count(*),
    'pageviews',     coalesce(sum(pageviews), 0),
    'bounce_rate',   case when count(*) = 0 then 0
                     else round(count(*) filter (where pageviews <= 1)::numeric * 100 / count(*), 1) end,
    'avg_duration_s',case when count(*) = 0 then 0
                     else round(avg(duration_ms)::numeric / 1000, 0) end,
    'conversions',   coalesce(sum(conversions), 0)
  ) into v_previous from v;

  return jsonb_build_object('current', v_current, 'previous', v_previous);
end;
$$;

revoke all on function public.analytics_overview(timestamptz, timestamptz) from public;
grant execute on function public.analytics_overview(timestamptz, timestamptz) to authenticated;

-- ── السلسلة الزمنية ────────────────────────────────────────────────────────

create or replace function public.analytics_timeseries(
  p_from   timestamptz,
  p_to     timestamptz,
  p_bucket text default 'day'
)
returns table (bucket timestamptz, visitors bigint, visits bigint, pageviews bigint, conversions bigint)
language plpgsql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_unit text;
  v_step interval;
begin
  perform public.analytics_require_admin();

  v_unit := case lower(coalesce(p_bucket, 'day'))
              when 'hour'  then 'hour'
              when 'week'  then 'week'
              when 'month' then 'month'
              else 'day'
            end;
  v_step := case v_unit
              when 'hour'  then interval '1 hour'
              when 'week'  then interval '1 week'
              when 'month' then interval '1 month'
              else interval '1 day'
            end;

  return query
  with grid as (
    select generate_series(date_trunc(v_unit, p_from), date_trunc(v_unit, p_to - interval '1 millisecond'), v_step) as b
  ),
  agg as (
    select date_trunc(v_unit, av.started_at)  as b,
           count(distinct av.visitor_id)      as visitors,
           count(*)                           as visits,
           coalesce(sum(av.pageviews), 0)     as pageviews,
           coalesce(sum(av.conversions), 0)   as conversions
    from public.analytics_visits av
    where av.started_at >= p_from and av.started_at < p_to and av.device <> 'bot'
    group by 1
  )
  select grid.b,
         coalesce(agg.visitors, 0)::bigint,
         coalesce(agg.visits, 0)::bigint,
         coalesce(agg.pageviews, 0)::bigint,
         coalesce(agg.conversions, 0)::bigint
  from grid left join agg on agg.b = grid.b
  order by grid.b;
end;
$$;

revoke all on function public.analytics_timeseries(timestamptz, timestamptz, text) from public;
grant execute on function public.analytics_timeseries(timestamptz, timestamptz, text) to authenticated;

-- ── التفصيل حسب بُعد: الصفحات، المصادر، الحملات، الأجهزة، الدول … ─────────

create or replace function public.analytics_breakdown(
  p_from      timestamptz,
  p_to        timestamptz,
  p_dimension text,
  p_limit     integer default 10
)
returns table (label text, visits bigint, pageviews bigint, visitors bigint, share numeric)
language plpgsql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 10), 1), 100);
  v_total bigint;
begin
  perform public.analytics_require_admin();

  if p_dimension in ('path', 'page_type', 'entity_slug') then
    -- أبعاد الحدث: تُحسب من المشاهدات لا من الزيارات
    select count(*) into v_total
    from public.analytics_events e
    join public.analytics_visits v on v.id = e.visit_id
    where e.occurred_at >= p_from and e.occurred_at < p_to
      and e.kind = 'pageview' and v.device <> 'bot';

    return query
    select coalesce(
             case p_dimension
               when 'path'        then e.path
               when 'page_type'   then e.page_type
               else e.entity_slug
             end, '—')::text                      as label,
           count(distinct e.visit_id)::bigint     as visits,
           count(*)::bigint                       as pageviews,
           count(distinct v.visitor_id)::bigint   as visitors,
           case when v_total = 0 then 0 else round(count(*)::numeric * 100 / v_total, 1) end as share
    from public.analytics_events e
    join public.analytics_visits v on v.id = e.visit_id
    where e.occurred_at >= p_from and e.occurred_at < p_to
      and e.kind = 'pageview' and v.device <> 'bot'
      and (p_dimension <> 'entity_slug' or e.entity_slug is not null)
    group by 1
    order by 3 desc, 2 desc
    limit v_limit;

  else
    -- أبعاد الزيارة
    select count(*) into v_total
    from public.analytics_visits
    where started_at >= p_from and started_at < p_to and device <> 'bot';

    return query
    select coalesce(
             case p_dimension
               when 'referrer_host' then v.referrer_host
               when 'utm_source'    then v.utm_source
               when 'utm_medium'    then v.utm_medium
               when 'utm_campaign'  then v.utm_campaign
               when 'device'        then v.device::text
               when 'browser'       then v.browser
               when 'os'            then v.os
               when 'country'       then v.country
               when 'locale'        then v.locale
               when 'entry_path'    then v.entry_path
               when 'exit_path'     then v.exit_path
               else null
             end,
             case p_dimension when 'referrer_host' then 'مباشر' else '—' end
           )::text                                 as label,
           count(*)::bigint                        as visits,
           coalesce(sum(v.pageviews), 0)::bigint   as pageviews,
           count(distinct v.visitor_id)::bigint    as visitors,
           case when v_total = 0 then 0 else round(count(*)::numeric * 100 / v_total, 1) end as share
    from public.analytics_visits v
    where v.started_at >= p_from and v.started_at < p_to and v.device <> 'bot'
    group by 1
    order by 2 desc, 3 desc
    limit v_limit;
  end if;
end;
$$;

revoke all on function public.analytics_breakdown(timestamptz, timestamptz, text, integer) from public;
grant execute on function public.analytics_breakdown(timestamptz, timestamptz, text, integer) to authenticated;

-- ── المتواجدون الآن ────────────────────────────────────────────────────────

create or replace function public.analytics_realtime()
returns jsonb language plpgsql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_result jsonb;
begin
  perform public.analytics_require_admin();

  select jsonb_build_object(
    'active_visitors', (
      select count(distinct visitor_id) from public.analytics_visits
      where last_seen_at > now() - interval '5 minutes' and device <> 'bot'
    ),
    'views_last_hour', (
      select count(*) from public.analytics_events e
      join public.analytics_visits v on v.id = e.visit_id
      where e.occurred_at > now() - interval '1 hour' and e.kind = 'pageview' and v.device <> 'bot'
    ),
    'top_now', coalesce((
      select jsonb_agg(row_to_json(t))
      from (
        select e.path, count(*)::bigint as views
        from public.analytics_events e
        join public.analytics_visits v on v.id = e.visit_id
        where e.occurred_at > now() - interval '30 minutes'
          and e.kind = 'pageview' and v.device <> 'bot'
        group by e.path order by views desc limit 5
      ) t
    ), '[]'::jsonb),
    'minutes', coalesce((
      select jsonb_agg(row_to_json(t) order by t.minute)
      from (
        select date_trunc('minute', e.occurred_at) as minute, count(*)::bigint as views
        from public.analytics_events e
        join public.analytics_visits v on v.id = e.visit_id
        where e.occurred_at > now() - interval '30 minutes'
          and e.kind = 'pageview' and v.device <> 'bot'
        group by 1
      ) t
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.analytics_realtime() from public;
grant execute on function public.analytics_realtime() to authenticated;

-- ── مسارات التحوّل: من مشاهدة إلى فعل ──────────────────────────────────────

create or replace function public.analytics_funnels(p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_result jsonb;
begin
  perform public.analytics_require_admin();

  with pv as (
    select e.page_type, e.entity_id, e.entity_slug, e.visit_id
    from public.analytics_events e
    join public.analytics_visits v on v.id = e.visit_id
    where e.occurred_at >= p_from and e.occurred_at < p_to
      and e.kind = 'pageview' and v.device <> 'bot'
  ),
  cv as (
    select e.name, e.entity_id, e.visit_id
    from public.analytics_events e
    join public.analytics_visits v on v.id = e.visit_id
    where e.occurred_at >= p_from and e.occurred_at < p_to
      and e.kind = 'conversion' and v.device <> 'bot'
  )
  select jsonb_build_object(
    'overall', coalesce((
      select jsonb_agg(row_to_json(t) order by t.completions desc)
      from (
        select name::text as name, count(*)::bigint as completions,
               count(distinct visit_id)::bigint as visits
        from cv group by name
      ) t
    ), '[]'::jsonb),

    -- التشويقية: زائر رأى الصفحة، كم منهم ترك بريده؟
    'teaser', (
      select jsonb_build_object(
        'views', (select count(distinct visit_id) from pv where page_type in ('teaser', 'home')),
        'signups', (select count(distinct visit_id) from cv where name = 'waitlist_signup'),
        'rate', case
          when (select count(distinct visit_id) from pv where page_type in ('teaser', 'home')) = 0 then 0
          else round(
            (select count(distinct visit_id) from cv where name = 'waitlist_signup')::numeric * 100 /
            (select count(distinct visit_id) from pv where page_type in ('teaser', 'home')), 1)
        end
      )
    ),

    -- المنتديات: من فتح صفحة منتدى، كم منهم طلب الانضمام؟
    'forums', coalesce((
      select jsonb_agg(row_to_json(t) order by t.views desc)
      from (
        select f.slug::text as slug,
               f.name_ar::text as name_ar,
               f.name_en::text as name_en,
               count(distinct p.visit_id)::bigint as views,
               (select count(distinct c.visit_id) from cv c
                 where c.name = 'join_request' and c.entity_id = f.id)::bigint as requests
        from public.forums f
        left join pv p on p.page_type = 'forum' and p.entity_id = f.id
        group by f.id, f.slug, f.name_ar, f.name_en
        having count(distinct p.visit_id) > 0
      ) t
    ), '[]'::jsonb),

    -- الفعاليات
    'events', coalesce((
      select jsonb_agg(row_to_json(t) order by t.views desc)
      from (
        select ev.slug::text as slug,
               ev.title_ar::text as title_ar,
               ev.title_en::text as title_en,
               count(distinct p.visit_id)::bigint as views,
               (select count(distinct c.visit_id) from cv c
                 where c.name = 'event_registration' and c.entity_id = ev.id)::bigint as registrations
        from public.events ev
        left join pv p on p.page_type = 'event' and p.entity_id = ev.id
        group by ev.id, ev.slug, ev.title_ar, ev.title_en
        having count(distinct p.visit_id) > 0
      ) t
    ), '[]'::jsonb),

    -- الدخول: من فتح صفحة الدخول، كم منهم طلب الرابط فعلًا؟
    'login', (
      select jsonb_build_object(
        'views', (select count(distinct visit_id) from pv where page_type = 'login'),
        'requested', (select count(distinct visit_id) from cv where name = 'magic_link_requested'),
        'rate', case
          when (select count(distinct visit_id) from pv where page_type = 'login') = 0 then 0
          else round(
            (select count(distinct visit_id) from cv where name = 'magic_link_requested')::numeric * 100 /
            (select count(distinct visit_id) from pv where page_type = 'login'), 1)
        end
      )
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.analytics_funnels(timestamptz, timestamptz) from public;
grant execute on function public.analytics_funnels(timestamptz, timestamptz) to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- شاشة الأفراد — «المشرف الأعلى» وحده، وكل فتح يُكتب في سجلّ التدقيق
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.analytics_people(
  p_from  timestamptz,
  p_to    timestamptz,
  p_limit integer default 25
)
returns table (
  profile_id uuid,
  full_name  text,
  email      text,
  visits     bigint,
  pageviews  bigint,
  last_seen  timestamptz
)
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  if not public.is_super_admin() then
    raise exception 'عرض سلوك الأفراد مقصور على المشرف الأعلى.' using errcode = '42501';
  end if;

  insert into public.audit_log (actor_id, action, entity, entity_id, meta)
  values (auth.uid(), 'analytics.people.view', 'analytics', null,
          jsonb_build_object('from', p_from, 'to', p_to));

  return query
  select p.id,
         coalesce(p.full_name_ar, p.full_name_en, '—')::text,
         p.email::text,
         count(v.id)::bigint,
         coalesce(sum(v.pageviews), 0)::bigint,
         max(v.last_seen_at)
  from public.analytics_visits v
  join public.profiles p on p.id = v.profile_id
  where v.started_at >= p_from and v.started_at < p_to and v.device <> 'bot'
  group by p.id, p.full_name_ar, p.full_name_en, p.email
  order by count(v.id) desc
  limit least(greatest(coalesce(p_limit, 25), 1), 200);
end;
$$;

revoke all on function public.analytics_people(timestamptz, timestamptz, integer) from public;
grant execute on function public.analytics_people(timestamptz, timestamptz, integer) to authenticated;

create or replace function public.analytics_person(
  p_profile_id uuid,
  p_from       timestamptz,
  p_to         timestamptz,
  p_limit      integer default 100
)
returns table (
  occurred_at timestamptz,
  path        text,
  page_type   text,
  locale      text,
  device      text,
  duration_ms integer
)
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  if not public.is_super_admin() then
    raise exception 'عرض سلوك الأفراد مقصور على المشرف الأعلى.' using errcode = '42501';
  end if;

  insert into public.audit_log (actor_id, action, entity, entity_id, meta)
  values (auth.uid(), 'analytics.person.view', 'profile', p_profile_id::text,
          jsonb_build_object('from', p_from, 'to', p_to));

  return query
  select e.occurred_at, e.path, e.page_type, e.locale, v.device::text, e.duration_ms
  from public.analytics_events e
  join public.analytics_visits v on v.id = e.visit_id
  where v.profile_id = p_profile_id
    and e.occurred_at >= p_from and e.occurred_at < p_to
  order by e.occurred_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 500);
end;
$$;

revoke all on function public.analytics_person(uuid, timestamptz, timestamptz, integer) from public;
grant execute on function public.analytics_person(uuid, timestamptz, timestamptz, integer) to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- الاحتفاظ: تجميع ثم محو. الأرقام تبقى، والأثر الشخصي يزول.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.analytics_rollup(p_day date)
returns void language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_from timestamptz := p_day::timestamptz;
  v_to   timestamptz := (p_day + 1)::timestamptz;
begin
  insert into public.analytics_daily (day, visitors, visits, pageviews, bounces, duration_ms, conversions, rolled_at)
  select p_day,
         count(distinct visitor_id),
         count(*),
         coalesce(sum(pageviews), 0),
         count(*) filter (where pageviews <= 1),
         coalesce(sum(duration_ms), 0),
         coalesce(sum(conversions), 0),
         now()
  from public.analytics_visits
  where started_at >= v_from and started_at < v_to and device <> 'bot'
  on conflict (day) do update set
    visitors = excluded.visitors, visits = excluded.visits, pageviews = excluded.pageviews,
    bounces = excluded.bounces, duration_ms = excluded.duration_ms,
    conversions = excluded.conversions, rolled_at = now();

  delete from public.analytics_daily_dim where day = p_day;

  insert into public.analytics_daily_dim (day, dimension, value, visits, pageviews)
  select p_day, d.dimension, d.value, count(*), coalesce(sum(v.pageviews), 0)
  from public.analytics_visits v
  cross join lateral (values
    ('device',        v.device::text),
    ('browser',       coalesce(v.browser, '—')),
    ('os',            coalesce(v.os, '—')),
    ('country',       coalesce(v.country, '—')),
    ('locale',        coalesce(v.locale, '—')),
    ('referrer_host', coalesce(v.referrer_host, 'مباشر')),
    ('utm_campaign',  coalesce(v.utm_campaign, '—')),
    ('entry_path',    coalesce(v.entry_path, '—'))
  ) as d(dimension, value)
  where v.started_at >= v_from and v.started_at < v_to and v.device <> 'bot'
  group by d.dimension, d.value;

  insert into public.analytics_daily_dim (day, dimension, value, visits, pageviews)
  select p_day, 'path', e.path, count(distinct e.visit_id), count(*)
  from public.analytics_events e
  join public.analytics_visits v on v.id = e.visit_id
  where e.occurred_at >= v_from and e.occurred_at < v_to
    and e.kind = 'pageview' and v.device <> 'bot'
  group by e.path
  on conflict (day, dimension, value) do update set
    visits = excluded.visits, pageviews = excluded.pageviews;
end;
$$;

revoke all on function public.analytics_rollup(date) from public;

/**
 * يُجمّع كل يوم مكتمل لم يُجمَّع بعد، ثم يمحو الصفوف الخام الأقدم من مدّة
 * الاحتفاظ. تُستدعى من لوحة التحكم أو من pg_cron.
 */
create or replace function public.analytics_prune(p_retain_days integer default 90)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_retain integer := least(greatest(coalesce(p_retain_days, 90), 7), 400);
  v_cutoff timestamptz := date_trunc('day', now()) - make_interval(days => v_retain);
  v_day    date;
  v_rolled integer := 0;
  v_deleted integer := 0;
begin
  perform public.analytics_require_admin();

  for v_day in
    select distinct started_at::date
    from public.analytics_visits
    where started_at < date_trunc('day', now())
      and started_at::date not in (select day from public.analytics_daily)
    order by 1
  loop
    perform public.analytics_rollup(v_day);
    v_rolled := v_rolled + 1;
  end loop;

  delete from public.analytics_visits where started_at < v_cutoff;
  get diagnostics v_deleted = row_count;

  return jsonb_build_object('rolled_days', v_rolled, 'deleted_visits', v_deleted, 'cutoff', v_cutoff);
end;
$$;

revoke all on function public.analytics_prune(integer) from public;
grant execute on function public.analytics_prune(integer) to authenticated;
