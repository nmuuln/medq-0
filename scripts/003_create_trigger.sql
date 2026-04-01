-- Function to generate unique class code for teachers
CREATE OR REPLACE FUNCTION generate_class_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate 6-character alphanumeric code
    new_code := upper(substr(md5(random()::text), 1, 6));
    
    -- Check if code exists
    SELECT EXISTS(SELECT 1 FROM profiles WHERE class_code = new_code) INTO code_exists;
    
    -- Exit loop if unique
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  RETURN new_code;
END;
$$;

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role TEXT;
  user_class_code TEXT;
  user_teacher_id UUID;
  user_grade INTEGER;
BEGIN
  -- Get role from metadata
  user_role := COALESCE(new.raw_user_meta_data ->> 'role', 'student');
  
  -- Handle class code based on role
  IF user_role = 'teacher' THEN
    -- Generate unique class code for teacher
    user_class_code := generate_class_code();
    user_teacher_id := NULL;
    user_grade := NULL;
  ELSE
    -- Use provided class code for student/parent
    user_class_code := new.raw_user_meta_data ->> 'class_code';
    
    -- Find teacher by class code
    SELECT id INTO user_teacher_id 
    FROM profiles 
    WHERE class_code = user_class_code AND role = 'teacher'
    LIMIT 1;
    
    -- Get grade for students
    IF user_role = 'student' THEN
      user_grade := (new.raw_user_meta_data ->> 'grade')::INTEGER;
    ELSE
      user_grade := NULL;
    END IF;
  END IF;
  
  -- Insert profile
  INSERT INTO public.profiles (
    id, 
    email, 
    role, 
    first_name, 
    last_name, 
    grade,
    class_code,
    teacher_id
  )
  VALUES (
    new.id,
    new.email,
    user_role,
    COALESCE(new.raw_user_meta_data ->> 'first_name', NULL),
    COALESCE(new.raw_user_meta_data ->> 'last_name', NULL),
    user_grade,
    user_class_code,
    user_teacher_id
  )
  ON CONFLICT (id) DO NOTHING;

  -- If teacher just registered, update any messages sent to their email
  IF user_role = 'teacher' THEN
    UPDATE messages 
    SET to_id = new.id 
    WHERE to_email = new.email AND to_id IS NULL;
  END IF;

  RETURN new;
END;
$$;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
