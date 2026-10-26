-- A new enum value must commit before purchase functions use it.
alter type public.notif_kind add value if not exists 'vip';
