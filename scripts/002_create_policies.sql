-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- =====================
-- PROFILES POLICIES
-- =====================

-- Users can read their own profile
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Anyone can see teachers (for student chat feature)
CREATE POLICY "profiles_select_teachers" ON profiles
  FOR SELECT USING (role = 'teacher');

-- Teachers can see students in their class
CREATE POLICY "profiles_teachers_see_students" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles AS teacher 
      WHERE teacher.id = auth.uid() 
      AND teacher.role = 'teacher'
      AND teacher.class_code = profiles.class_code
    )
  );

-- Parents can see students in their class
CREATE POLICY "profiles_parents_see_students" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles AS parent 
      WHERE parent.id = auth.uid() 
      AND parent.role = 'parent'
      AND parent.class_code = profiles.class_code
      AND profiles.role = 'student'
    )
  );

-- =====================
-- ASSIGNMENTS POLICIES
-- =====================

-- Teachers can CRUD their own assignments
CREATE POLICY "assignments_teacher_all" ON assignments
  FOR ALL USING (auth.uid() = teacher_id);

-- Students can read assignments for their grade
CREATE POLICY "assignments_student_select" ON assignments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'student'
      AND grade = assignments.grade
    )
  );

-- Parents can read assignments for their children's grade
CREATE POLICY "assignments_parent_select" ON assignments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles AS p
      JOIN profiles AS student ON student.class_code = p.class_code AND student.role = 'student'
      WHERE p.id = auth.uid() 
      AND p.role = 'parent'
      AND student.grade = assignments.grade
    )
  );

-- =====================
-- SUBMISSIONS POLICIES
-- =====================

-- Students can CRUD their own submissions
CREATE POLICY "submissions_student_all" ON submissions
  FOR ALL USING (auth.uid() = student_id);

-- Teachers can read/update submissions for their assignments
CREATE POLICY "submissions_teacher_select" ON submissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM assignments 
      WHERE assignments.id = submissions.assignment_id 
      AND assignments.teacher_id = auth.uid()
    )
  );

CREATE POLICY "submissions_teacher_update" ON submissions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM assignments 
      WHERE assignments.id = submissions.assignment_id 
      AND assignments.teacher_id = auth.uid()
    )
  );

-- Parents can read their children's submissions
CREATE POLICY "submissions_parent_select" ON submissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles AS p
      JOIN profiles AS student ON student.class_code = p.class_code AND student.role = 'student'
      WHERE p.id = auth.uid() 
      AND p.role = 'parent'
      AND student.id = submissions.student_id
    )
  );

-- =====================
-- MESSAGES POLICIES
-- =====================

-- Users can read messages sent to them
CREATE POLICY "messages_select_received" ON messages
  FOR SELECT USING (auth.uid() = to_id);

-- Users can read messages they sent
CREATE POLICY "messages_select_sent" ON messages
  FOR SELECT USING (auth.uid() = from_id);

-- Teachers can read messages sent to their email (even if they registered later)
CREATE POLICY "messages_select_by_email" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND email = messages.to_email
    )
  );

-- Users can send messages
CREATE POLICY "messages_insert" ON messages
  FOR INSERT WITH CHECK (auth.uid() = from_id);
