-- Public EPK links are rendered as hrefs. The editor already rejects non-https URLs;
-- this keeps a direct API write from storing javascript: or other schemes.
-- Version matches the migration already applied on the remote project.
ALTER TABLE public.epk_links
  ADD CONSTRAINT epk_links_url_https CHECK (url ~ '^https://');
