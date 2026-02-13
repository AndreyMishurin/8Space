-- Update handle_new_user to support Google OAuth user_metadata
-- Google OAuth provides: full_name, name, avatar_url, picture
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name',
      split_part(NEW.email, '@', 1)
    ),
    COALESCE(
      NEW.raw_user_meta_data ->> 'avatar_url',
      NEW.raw_user_meta_data ->> 'picture'
    )
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = COALESCE(
      EXCLUDED.display_name,
      profiles.display_name
    ),
    avatar_url = COALESCE(
      EXCLUDED.avatar_url,
      profiles.avatar_url
    );

  RETURN NEW;
END;
$$;
