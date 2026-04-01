-- Create trigger function to auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_role text;
  user_email text;
begin
  user_email := new.email;
  
  -- Determine role based on email domain
  if user_email like '%@olula.edu.mn' then
    user_role := 'teacher';
  else
    -- Get role from user metadata or default to student
    user_role := coalesce(new.raw_user_meta_data ->> 'role', 'student');
  end if;

  insert into public.profiles (
    id, 
    email, 
    role, 
    first_name, 
    last_name, 
    grade,
    class_code
  )
  values (
    new.id,
    user_email,
    user_role,
    coalesce(new.raw_user_meta_data ->> 'first_name', null),
    coalesce(new.raw_user_meta_data ->> 'last_name', null),
    (new.raw_user_meta_data ->> 'grade')::integer,
    new.raw_user_meta_data ->> 'class_code'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Drop existing trigger if exists and create new one
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
