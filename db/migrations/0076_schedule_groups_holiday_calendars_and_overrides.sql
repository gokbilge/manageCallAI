ALTER TABLE schedules
    ADD COLUMN IF NOT EXISTS description text,
    ADD COLUMN IF NOT EXISTS holiday_calendar_name text,
    ADD COLUMN IF NOT EXISTS holiday_calendar_json jsonb NOT NULL DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS override_windows_json jsonb NOT NULL DEFAULT '[]';

UPDATE schedules
SET holiday_calendar_json = COALESCE((
        SELECT jsonb_agg(
            jsonb_build_object(
                'date', entry->>'date',
                'name', COALESCE(NULLIF(entry->>'name', ''), 'Holiday ' || COALESCE(entry->>'date', 'entry')),
                'closed', COALESCE((entry->>'closed')::boolean, true),
                'open_time', entry->>'open_time',
                'close_time', entry->>'close_time'
            )
        )
        FROM jsonb_array_elements(
            CASE
                WHEN jsonb_typeof(holiday_overrides_json) = 'array' THEN holiday_overrides_json
                ELSE '[]'::jsonb
            END
        ) AS entry
    ), '[]'::jsonb)
WHERE holiday_calendar_json = '[]'::jsonb;

ALTER TABLE schedules
    DROP COLUMN IF EXISTS holiday_overrides_json;
