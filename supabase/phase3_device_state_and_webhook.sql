ALTER TABLE devices ADD COLUMN IF NOT EXISTS state text;

DROP TRIGGER IF EXISTS devices_generate_device_key_webhook ON public.devices;

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.enqueue_generate_device_key_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://xeykhdyanzjkymlfwseo.supabase.co/functions/v1/generate-device-key',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhleWtoZHlhbnpqa3ltbGZ3c2VvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MzM1NjIsImV4cCI6MjA5MDEwOTU2Mn0.XSkxceiFbDqODroiNIcN7tu9yJcaAGk8UmdCUVdrC3o'
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'devices',
      'schema', 'public',
      'record', to_jsonb(NEW),
      'old_record', NULL
    )
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER devices_generate_device_key_webhook
AFTER INSERT ON public.devices
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_generate_device_key_webhook();
