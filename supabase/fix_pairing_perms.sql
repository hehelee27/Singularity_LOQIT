-- Ensure the existing owner policy covers the new column
-- If you use specific column permissions, uncomment this:
-- GRANT ALL(installation_id) ON TABLE devices TO authenticated;

-- Make sure the policy allows UPDATE on this column for owners
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'devices' 
        AND policyname = 'devices_owner_update'
    ) THEN
        CREATE POLICY "devices_owner_update" ON devices 
        FOR UPDATE 
        USING (owner_id = auth.uid())
        WITH CHECK (owner_id = auth.uid());
    END IF;
END $$;
