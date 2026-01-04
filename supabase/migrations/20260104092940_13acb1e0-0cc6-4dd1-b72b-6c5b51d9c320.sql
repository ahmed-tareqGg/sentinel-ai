-- User access approval + improved user visibility for enterprise RBAC

-- Ensure one role per user for safe upserts
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_user_id_key ON public.user_roles (user_id);

-- Allow user managers (CISO/SOC Manager via permissions) to view all profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='profiles' AND policyname='Managers can view all profiles'
  ) THEN
    CREATE POLICY "Managers can view all profiles"
    ON public.profiles
    FOR SELECT
    USING (public.has_permission(auth.uid(), 'users:manage'));
  END IF;
END$$;

-- Allow user managers to view/manage roles (but never their own)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='user_roles' AND policyname='Managers can view all roles'
  ) THEN
    CREATE POLICY "Managers can view all roles"
    ON public.user_roles
    FOR SELECT
    USING (public.has_permission(auth.uid(), 'users:manage'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='user_roles' AND policyname='Managers can assign roles (not self)'
  ) THEN
    CREATE POLICY "Managers can assign roles (not self)"
    ON public.user_roles
    FOR INSERT
    WITH CHECK (
      public.has_permission(auth.uid(), 'users:manage')
      AND user_id <> auth.uid()
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='user_roles' AND policyname='Managers can update roles (not self)'
  ) THEN
    CREATE POLICY "Managers can update roles (not self)"
    ON public.user_roles
    FOR UPDATE
    USING (
      public.has_permission(auth.uid(), 'users:manage')
      AND user_id <> auth.uid()
    )
    WITH CHECK (
      public.has_permission(auth.uid(), 'users:manage')
      AND user_id <> auth.uid()
    );
  END IF;
END$$;

-- Track whether a user is approved to access the app
CREATE TABLE IF NOT EXISTS public.user_access (
  user_id uuid PRIMARY KEY,
  approved boolean NOT NULL DEFAULT false,
  approved_by uuid NULL,
  approved_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_access ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='user_access' AND policyname='Users can view own access'
  ) THEN
    CREATE POLICY "Users can view own access"
    ON public.user_access
    FOR SELECT
    USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='user_access' AND policyname='Managers can view all access'
  ) THEN
    CREATE POLICY "Managers can view all access"
    ON public.user_access
    FOR SELECT
    USING (public.has_permission(auth.uid(), 'users:manage'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='user_access' AND policyname='Managers can update access'
  ) THEN
    CREATE POLICY "Managers can update access"
    ON public.user_access
    FOR UPDATE
    USING (public.has_permission(auth.uid(), 'users:manage'))
    WITH CHECK (public.has_permission(auth.uid(), 'users:manage'));
  END IF;
END$$;

-- Access requests (created automatically on signup if not pre-approved)
CREATE TABLE IF NOT EXISTS public.user_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NULL,
  email text NOT NULL,
  requested_role public.app_role NOT NULL DEFAULT 'soc_tier_1',
  status text NOT NULL DEFAULT 'pending',
  requested_by uuid NULL,
  reviewed_by uuid NULL,
  reviewed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS user_access_requests_email_key ON public.user_access_requests (email);
CREATE INDEX IF NOT EXISTS user_access_requests_status_idx ON public.user_access_requests (status);

ALTER TABLE public.user_access_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='user_access_requests' AND policyname='Managers can view access requests'
  ) THEN
    CREATE POLICY "Managers can view access requests"
    ON public.user_access_requests
    FOR SELECT
    USING (public.has_permission(auth.uid(), 'users:manage'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='user_access_requests' AND policyname='Users can view own access requests'
  ) THEN
    CREATE POLICY "Users can view own access requests"
    ON public.user_access_requests
    FOR SELECT
    USING (user_id = auth.uid() OR requested_by = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='user_access_requests' AND policyname='Authenticated users can create access requests'
  ) THEN
    CREATE POLICY "Authenticated users can create access requests"
    ON public.user_access_requests
    FOR INSERT
    WITH CHECK (requested_by = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='user_access_requests' AND policyname='Managers can update access requests'
  ) THEN
    CREATE POLICY "Managers can update access requests"
    ON public.user_access_requests
    FOR UPDATE
    USING (public.has_permission(auth.uid(), 'users:manage'))
    WITH CHECK (public.has_permission(auth.uid(), 'users:manage'));
  END IF;
END$$;

-- Enable realtime notifications for access requests
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_access_requests;
  EXCEPTION WHEN duplicate_object THEN
    -- already added
    NULL;
  END;
END$$;

-- Centralized, server-side role assignment (prevents self-downgrade/upgrade)
CREATE OR REPLACE FUNCTION public.set_user_role(_target_user uuid, _new_role public.app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_permission(auth.uid(), 'users:manage') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF _target_user = auth.uid() THEN
    RAISE EXCEPTION 'cannot change own role';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_target_user, _new_role)
  ON CONFLICT (user_id) DO UPDATE
    SET role = EXCLUDED.role;

  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, details)
  VALUES (
    auth.uid(),
    'set_user_role',
    'user_roles',
    _target_user::text,
    jsonb_build_object('new_role', _new_role)
  );
END;
$$;

-- Approve / reject user access with audit logging
CREATE OR REPLACE FUNCTION public.approve_user_access(_target_user uuid, _role public.app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  IF NOT public.has_permission(auth.uid(), 'users:manage') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF _target_user = auth.uid() THEN
    RAISE EXCEPTION 'cannot approve own access';
  END IF;

  SELECT email INTO v_email FROM public.profiles WHERE id = _target_user;

  -- role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_target_user, _role)
  ON CONFLICT (user_id) DO UPDATE
    SET role = EXCLUDED.role;

  -- access
  INSERT INTO public.user_access (user_id, approved, approved_by, approved_at, updated_at)
  VALUES (_target_user, true, auth.uid(), now(), now())
  ON CONFLICT (user_id) DO UPDATE
    SET approved = true,
        approved_by = auth.uid(),
        approved_at = now(),
        updated_at = now();

  -- request
  UPDATE public.user_access_requests
  SET status = 'approved',
      user_id = COALESCE(user_id, _target_user),
      requested_role = _role,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
  WHERE email = lower(v_email);

  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, details)
  VALUES (
    auth.uid(),
    'approve_user_access',
    'user_access',
    _target_user::text,
    jsonb_build_object('email', v_email, 'role', _role)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_user_access(_target_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  IF NOT public.has_permission(auth.uid(), 'users:manage') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF _target_user = auth.uid() THEN
    RAISE EXCEPTION 'cannot reject own access';
  END IF;

  SELECT email INTO v_email FROM public.profiles WHERE id = _target_user;

  INSERT INTO public.user_access (user_id, approved, approved_by, approved_at, updated_at)
  VALUES (_target_user, false, auth.uid(), NULL, now())
  ON CONFLICT (user_id) DO UPDATE
    SET approved = false,
        approved_by = auth.uid(),
        approved_at = NULL,
        updated_at = now();

  UPDATE public.user_access_requests
  SET status = 'rejected',
      user_id = COALESCE(user_id, _target_user),
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
  WHERE email = lower(v_email);

  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, details)
  VALUES (
    auth.uid(),
    'reject_user_access',
    'user_access',
    _target_user::text,
    jsonb_build_object('email', v_email)
  );
END;
$$;

-- Update signup handler to create access request + gate access until approved
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_role public.app_role := 'soc_tier_1';
  v_approved boolean := false;
  v_status text;
BEGIN
  v_email := lower(NEW.email);

  -- Profile (safe idempotent)
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    v_email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(v_email, '@', 1))
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        updated_at = now();

  -- Pre-approval check
  SELECT status, requested_role
  INTO v_status, v_role
  FROM public.user_access_requests
  WHERE email = v_email
  LIMIT 1;

  IF FOUND AND v_status = 'approved' THEN
    v_approved := true;
  ELSE
    v_approved := false;
    v_role := 'soc_tier_1';

    -- Create/refresh a pending request
    INSERT INTO public.user_access_requests (email, user_id, requested_role, status, requested_by, updated_at)
    VALUES (v_email, NEW.id, 'soc_tier_1', 'pending', NEW.id, now())
    ON CONFLICT (email) DO UPDATE
      SET user_id = EXCLUDED.user_id,
          status = CASE WHEN public.user_access_requests.status = 'approved' THEN 'approved' ELSE 'pending' END,
          updated_at = now();
  END IF;

  -- Role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_role)
  ON CONFLICT (user_id) DO UPDATE
    SET role = EXCLUDED.role;

  -- Access gate
  INSERT INTO public.user_access (user_id, approved, approved_at, updated_at)
  VALUES (
    NEW.id,
    v_approved,
    CASE WHEN v_approved THEN now() ELSE NULL END,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE
    SET approved = EXCLUDED.approved,
        approved_at = EXCLUDED.approved_at,
        updated_at = now();

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block signups
  RETURN NEW;
END;
$$;