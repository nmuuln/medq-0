-- Create profiles table
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null check (role in ('teacher', 'student', 'parent')),
  first_name text,
  last_name text,
  grade integer,
  class_code text,
  created_at timestamptz default now()
);

-- Create classes table
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  code text not null unique,
  name text,
  grade integer,
  created_at timestamptz default now()
);

-- Create class_memberships table
create table if not exists public.class_memberships (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('student', 'parent')),
  joined_at timestamptz default now(),
  unique(class_id, user_id)
);

-- Create messages table
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references public.profiles(id) on delete cascade,
  to_user_id uuid not null references public.profiles(id) on delete cascade,
  text text not null,
  read boolean default false,
  sent_at timestamptz default now()
);

-- Create assignments table
create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  class_id uuid references public.classes(id) on delete cascade,
  grade integer,
  title text not null,
  description text,
  deadline timestamptz,
  points integer default 100,
  created_at timestamptz default now()
);

-- Create submissions table
create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  text text,
  file_path text,
  submitted_at timestamptz default now(),
  score integer,
  graded_at timestamptz
);

-- Create indexes for better performance
create index if not exists idx_profiles_email on public.profiles(email);
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_messages_from_user on public.messages(from_user_id);
create index if not exists idx_messages_to_user on public.messages(to_user_id);
create index if not exists idx_messages_sent_at on public.messages(sent_at);
create index if not exists idx_assignments_teacher on public.assignments(teacher_id);
create index if not exists idx_assignments_grade on public.assignments(grade);
create index if not exists idx_submissions_assignment on public.submissions(assignment_id);
create index if not exists idx_submissions_student on public.submissions(student_id);
