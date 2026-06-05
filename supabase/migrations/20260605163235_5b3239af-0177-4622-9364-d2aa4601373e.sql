
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_role public.app_role := 'soc_tier_1';
  v_requested_role public.app_role := 'soc_tier_1';
  v_approved boolean := false;
  v_status text;
  v_meta_role text;
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

  -- Determine requested role from metadata (validated against enum)
  v_meta_role := NEW.raw_user_meta_data->>'requested_role';
  IF v_meta_role IS NOT NULL AND v_meta_role IN (
    'soc_tier_1','soc_tier_2','soc_tier_3','soc_manager','grc_engineer','ciso'
  ) THEN
    v_requested_role := v_meta_role::public.app_role;
  END IF;

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
    v_role := v_requested_role;

    INSERT INTO public.user_access_requests (email, user_id, requested_role, status, requested_by, updated_at)
    VALUES (v_email, NEW.id, v_requested_role, 'pending', NEW.id, now())
    ON CONFLICT (email) DO UPDATE
      SET user_id = EXCLUDED.user_id,
          requested_role = EXCLUDED.requested_role,
          status = CASE WHEN public.user_access_requests.status = 'approved' THEN 'approved' ELSE 'pending' END,
          updated_at = now();
  END IF;

  -- Role (provisional; final role set on approval)
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
  RETURN NEW;
END;
$$;
