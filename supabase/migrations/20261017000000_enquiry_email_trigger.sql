-- Email every new enquiry to its assigned RM.
-- Trigger -> pg_net -> Edge Function send-enquiry-email (Brevo).

create extension if not exists pg_net;

alter table public.enquiries
  add column if not exists email_status text,
  add column if not exists email_sent_to text,
  add column if not exists email_sent_at timestamptz;

comment on column public.enquiries.email_status is 'RM notification email: sent / failed: <reason>. Filled by the send-enquiry-email edge function.';

-- Shared secret between this trigger and the edge function (never leaves the database).
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'enquiry_email_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'enquiry_email_secret');
  end if;
end $$;

-- Edge function reads the secret through this (service_role only).
create or replace function public.get_enquiry_email_secret()
returns text
language sql
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'enquiry_email_secret' limit 1;
$$;
revoke all on function public.get_enquiry_email_secret() from public, anon, authenticated;
grant execute on function public.get_enquiry_email_secret() to service_role;

create or replace function public.notify_enquiry_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform net.http_post(
    url := 'https://rgzpytocxhjzxsopkrmu.supabase.co/functions/v1/send-enquiry-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-enquiry-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'enquiry_email_secret' limit 1)
    ),
    body := jsonb_build_object('id', new.id),
    timeout_milliseconds := 10000
  );
  return new;
exception when others then
  -- Never block an enquiry from being saved because of the email.
  raise warning 'notify_enquiry_email failed for enquiry %: %', new.id, sqlerrm;
  return new;
end;
$$;
revoke all on function public.notify_enquiry_email() from public, anon, authenticated;

drop trigger if exists enquiries_send_email on public.enquiries;
create trigger enquiries_send_email
  after insert on public.enquiries
  for each row execute function public.notify_enquiry_email();
