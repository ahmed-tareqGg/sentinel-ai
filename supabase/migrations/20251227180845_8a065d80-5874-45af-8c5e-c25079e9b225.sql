-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'soc_analyst', 'viewer');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Create incidents table
CREATE TABLE public.incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_number TEXT UNIQUE NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  src_ip TEXT,
  dst_ip TEXT,
  severity INTEGER NOT NULL DEFAULT 1 CHECK (severity >= 1 AND severity <= 5),
  event_type TEXT NOT NULL,
  classification TEXT DEFAULT 'Pending' CHECK (classification IN ('True Positive', 'False Positive', 'Pending')),
  confidence INTEGER DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 100),
  status TEXT DEFAULT 'Open' CHECK (status IN ('Open', 'In Progress', 'Closed')),
  risk_level TEXT DEFAULT 'Low' CHECK (risk_level IN ('Critical', 'High', 'Medium', 'Low')),
  message TEXT,
  file_hash TEXT,
  mitre_technique TEXT,
  mitre_tactic TEXT,
  assigned_to UUID REFERENCES auth.users(id),
  raw_log JSONB,
  ai_analysis JSONB,
  sandbox_result JSONB,
  evidence TEXT[],
  recommended_actions TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create incident timeline table
CREATE TABLE public.incident_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  details TEXT
);

-- Create audit logs table
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create playbooks table
CREATE TABLE public.playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  conditions JSONB NOT NULL DEFAULT '{}',
  actions JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create playbook executions table
CREATE TABLE public.playbook_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id UUID NOT NULL REFERENCES public.playbooks(id) ON DELETE CASCADE,
  incident_id UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  results JSONB,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playbook_executions ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- Handle new user signup - create profile and default role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id, 
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );
  
  -- Assign default viewer role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'viewer');
  
  RETURN NEW;
END;
$$;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update timestamp function
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Update triggers
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_incidents_updated_at
  BEFORE UPDATE ON public.incidents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_playbooks_updated_at
  BEFORE UPDATE ON public.playbooks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Generate incident number
CREATE OR REPLACE FUNCTION public.generate_incident_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(incident_number FROM 5) AS INTEGER)), 0) + 1 
  INTO next_num FROM public.incidents;
  NEW.incident_number := 'INC-' || LPAD(next_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER generate_incident_number_trigger
  BEFORE INSERT ON public.incidents
  FOR EACH ROW EXECUTE FUNCTION public.generate_incident_number();

-- RLS Policies

-- Profiles: Users can view all profiles, edit own
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

-- User roles: Only admins can manage, users can view own
CREATE POLICY "Users can view own role"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Incidents: All authenticated can view, admin/analyst can modify
CREATE POLICY "Authenticated users can view incidents"
  ON public.incidents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin and analysts can create incidents"
  ON public.incidents FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'soc_analyst'));

CREATE POLICY "Admin and analysts can update incidents"
  ON public.incidents FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'soc_analyst'));

CREATE POLICY "Admins can delete incidents"
  ON public.incidents FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Incident timeline: Same as incidents
CREATE POLICY "Authenticated users can view timeline"
  ON public.incident_timeline FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin and analysts can create timeline entries"
  ON public.incident_timeline FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'soc_analyst'));

-- Audit logs: Admins can view all, users can view own
CREATE POLICY "Admins can view all audit logs"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR user_id = auth.uid());

CREATE POLICY "System can insert audit logs"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Playbooks: Admins can manage, all can view
CREATE POLICY "Authenticated users can view playbooks"
  ON public.playbooks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage playbooks"
  ON public.playbooks FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Playbook executions: Same as playbooks
CREATE POLICY "Authenticated users can view executions"
  ON public.playbook_executions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can insert executions"
  ON public.playbook_executions FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Enable realtime for incidents
ALTER PUBLICATION supabase_realtime ADD TABLE public.incidents;
ALTER TABLE public.incidents REPLICA IDENTITY FULL;