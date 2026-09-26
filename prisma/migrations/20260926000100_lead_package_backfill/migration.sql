UPDATE "leads"
SET "type" = 'package', "payload" = "payload" - 'source'
WHERE "type" = 'calculator' AND "payload" ->> 'source' = 'services';
