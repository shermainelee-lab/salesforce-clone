-- Blank probability on insert OR update falls back to the stage default
create or replace function private.opportunity_defaults()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.probability is null then
    new.probability := private.stage_probability(new.stage);
  elsif tg_op = 'UPDATE' and new.stage is distinct from old.stage
        and new.probability is not distinct from old.probability then
    new.probability := private.stage_probability(new.stage);
  end if;

  if new.stage in ('closed_won', 'closed_lost') then
    if tg_op = 'INSERT' or old.stage not in ('closed_won', 'closed_lost') then
      new.closed_at := now();
    end if;
  else
    new.closed_at := null;
  end if;
  return new;
end;
$$;
