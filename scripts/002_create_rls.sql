-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.class_memberships enable row level security;
alter table public.messages enable row level security;
alter table public.assignments enable row level security;
alter table public.submissions enable row level security;

-- Profiles policies
-- Everyone can view all profiles (needed for chat list)
drop policy if exists "profiles_select_all" on public.profiles;
create policy "profiles_select_all" on public.profiles
  for select using (true);

-- Users can update their own profile
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- Insert handled by trigger
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

-- Classes policies
-- Teachers can create classes
drop policy if exists "classes_insert_teacher" on public.classes;
create policy "classes_insert_teacher" on public.classes
  for insert with check (auth.uid() = teacher_id);

-- Teachers can view their classes, members can view classes they belong to
drop policy if exists "classes_select" on public.classes;
create policy "classes_select" on public.classes
  for select using (
    auth.uid() = teacher_id 
    or exists (
      select 1 from public.class_memberships 
      where class_id = id and user_id = auth.uid()
    )
  );

-- Teachers can update/delete their classes
drop policy if exists "classes_update_teacher" on public.classes;
create policy "classes_update_teacher" on public.classes
  for update using (auth.uid() = teacher_id);

drop policy if exists "classes_delete_teacher" on public.classes;
create policy "classes_delete_teacher" on public.classes
  for delete using (auth.uid() = teacher_id);

-- Class memberships policies
-- Users can join classes
drop policy if exists "memberships_insert" on public.class_memberships;
create policy "memberships_insert" on public.class_memberships
  for insert with check (auth.uid() = user_id);

-- Users can view memberships they're part of
drop policy if exists "memberships_select" on public.class_memberships;
create policy "memberships_select" on public.class_memberships
  for select using (auth.uid() = user_id or exists (
    select 1 from public.classes where id = class_id and teacher_id = auth.uid()
  ));

-- Messages policies
-- Users can view messages they sent or received
drop policy if exists "messages_select" on public.messages;
create policy "messages_select" on public.messages
  for select using (auth.uid() = from_user_id or auth.uid() = to_user_id);

-- Users can send messages
drop policy if exists "messages_insert" on public.messages;
create policy "messages_insert" on public.messages
  for insert with check (auth.uid() = from_user_id);

-- Recipients can update messages (mark as read)
drop policy if exists "messages_update" on public.messages;
create policy "messages_update" on public.messages
  for update using (auth.uid() = to_user_id);

-- Assignments policies
-- Teachers can manage their assignments
drop policy if exists "assignments_insert_teacher" on public.assignments;
create policy "assignments_insert_teacher" on public.assignments
  for insert with check (auth.uid() = teacher_id);

drop policy if exists "assignments_update_teacher" on public.assignments;
create policy "assignments_update_teacher" on public.assignments
  for update using (auth.uid() = teacher_id);

drop policy if exists "assignments_delete_teacher" on public.assignments;
create policy "assignments_delete_teacher" on public.assignments
  for delete using (auth.uid() = teacher_id);

-- Everyone can view assignments (students need to see them)
drop policy if exists "assignments_select" on public.assignments;
create policy "assignments_select" on public.assignments
  for select using (true);

-- Submissions policies
-- Students can submit
drop policy if exists "submissions_insert_student" on public.submissions;
create policy "submissions_insert_student" on public.submissions
  for insert with check (auth.uid() = student_id);

-- Students can view their own, teachers can view all for their assignments
drop policy if exists "submissions_select" on public.submissions;
create policy "submissions_select" on public.submissions
  for select using (
    auth.uid() = student_id 
    or exists (
      select 1 from public.assignments 
      where id = assignment_id and teacher_id = auth.uid()
    )
  );

-- Teachers can update submissions (grading)
drop policy if exists "submissions_update_teacher" on public.submissions;
create policy "submissions_update_teacher" on public.submissions
  for update using (
    exists (
      select 1 from public.assignments 
      where id = assignment_id and teacher_id = auth.uid()
    )
  );
