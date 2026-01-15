-- Fix pgcrypto function resolution when pgcrypto is installed in schema 'extensions'
-- Update RPC functions to schema-qualify pgcrypto calls

CREATE OR REPLACE FUNCTION public.generate_agent_api_key(
  _data_source_id uuid,
  _name text,
  _expires_days integer DEFAULT 365
)
RETURNS TABLE(api_key text, key_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_key TEXT;
  v_prefix TEXT;
  v_key_id UUID;
BEGIN
  -- Generate a secure random key
  v_key := 'socm_' || encode(extensions.gen_random_bytes(32), 'hex');
  v_prefix := substring(v_key from 1 for 12);

  -- Insert the key record
  INSERT INTO public.agent_api_keys (
    data_source_id,
    key_prefix,
    key_hash,
    name,
    expires_at,
    created_by
  )
  VALUES (
    _data_source_id,
    v_prefix,
    extensions.crypt(v_key, extensions.gen_salt('bf')),
    _name,
    CASE WHEN _expires_days > 0 THEN now() + (_expires_days || ' days')::interval ELSE NULL END,
    auth.uid()
  )
  RETURNING id INTO v_key_id;

  RETURN QUERY SELECT v_key, v_key_id;
END;
$function$;


CREATE OR REPLACE FUNCTION public.verify_agent_api_key(_api_key text)
RETURNS TABLE(data_source_id uuid, data_source_name text, key_id uuid, is_valid boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_prefix TEXT;
  v_record RECORD;
BEGIN
  v_prefix := substring(_api_key from 1 for 12);

  SELECT ak.id, ak.data_source_id, ak.key_hash, ak.is_active, ak.expires_at, ds.name
  INTO v_record
  FROM public.agent_api_keys ak
  JOIN public.data_sources ds ON ds.id = ak.data_source_id
  WHERE ak.key_prefix = v_prefix
    AND ak.is_active = true
    AND (ak.expires_at IS NULL OR ak.expires_at > now())
  LIMIT 1;

  IF v_record IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, NULL::UUID, false;
    RETURN;
  END IF;

  -- Verify the key hash
  IF v_record.key_hash = extensions.crypt(_api_key, v_record.key_hash) THEN
    -- Update last used
    UPDATE public.agent_api_keys SET last_used = now() WHERE id = v_record.id;
    RETURN QUERY SELECT v_record.data_source_id, v_record.name, v_record.id, true;
  ELSE
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, NULL::UUID, false;
  END IF;
END;
$function$;
