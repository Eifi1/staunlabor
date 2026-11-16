-- Staunlabor's own database and its two roles on keksdose's SHARED Cloud SQL
-- instance (keksdose:europe-west4:keksdose-db), as Kurvenschmiede's and
-- Kastlan's are. Nothing else on the instance is touched: no other database,
-- no other role.
--
-- Run by deploy/apply-roles.sh as the instance's `postgres` user, which feeds
-- the two passwords in as :app_pw and :owner_pw from Secret Manager (the
-- secrets staunlabor-db-url-app and staunlabor-db-url-owner, which
-- setup-accounts.sh made). They are never written here. Safe to run again:
-- what exists is kept, and the passwords are set to the secrets' again.

\if :{?app_pw}
\else
\echo '>>> roles.sql ABORTED: app_pw is not set (run it through deploy/apply-roles.sh).'
\q
\endif
\if :{?owner_pw}
\else
\echo '>>> roles.sql ABORTED: owner_pw is not set (run it through deploy/apply-roles.sh).'
\q
\endif

-- ── 1) The roles ────────────────────────────────────────────────────────────
-- The owner owns the schema and runs the migrations (the staunlabor-migrate
-- job); the app role, which the backend connects as, may read and write rows
-- and nothing else. CONNECTION LIMIT is a cap, not a reservation: what the app
-- draws is the pool's, 1 + 1 a process at three instances, six. The cap is
-- twice that because a rollout runs two revisions at once (the old instances
-- keep their idle connection while the new ones open theirs), and at six the
-- new revision's account routes would be refused until the old one has gone.
-- The migrate job holds one at a time, an operator's psql the second.
SELECT 'CREATE ROLE staunlabor_owner NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'staunlabor_owner') \gexec
SELECT 'CREATE ROLE staunlabor_app NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'staunlabor_app') \gexec

ALTER ROLE staunlabor_owner LOGIN PASSWORD :'owner_pw' CONNECTION LIMIT 2;
ALTER ROLE staunlabor_app LOGIN PASSWORD :'app_pw' CONNECTION LIMIT 12;

-- On Cloud SQL `postgres` is no true superuser: to make a database owned by a
-- role it must be a member of it.
GRANT staunlabor_owner TO CURRENT_USER;

-- ── 2) The database ─────────────────────────────────────────────────────────
SELECT 'CREATE DATABASE staunlabor OWNER staunlabor_owner'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'staunlabor') \gexec

-- PostgreSQL lets every role connect to a new database (PUBLIC). Here only the
-- two of this app may: the instance's other apps' roles stay out.
REVOKE CONNECT, TEMPORARY ON DATABASE staunlabor FROM PUBLIC;
GRANT CONNECT ON DATABASE staunlabor TO staunlabor_owner, staunlabor_app;

-- ── 3) Inside the new database ──────────────────────────────────────────────
\connect staunlabor

-- PostgreSQL 15 and later lock the public schema; the owner builds the schema
-- there (`alembic upgrade head`).
GRANT USAGE, CREATE ON SCHEMA public TO staunlabor_owner;

-- The app role: rows only, no DDL, no ownership; and the same for every table
-- and sequence the owner's migrations make later.
GRANT USAGE ON SCHEMA public TO staunlabor_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO staunlabor_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO staunlabor_app;
ALTER DEFAULT PRIVILEGES FOR ROLE staunlabor_owner IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO staunlabor_app;
ALTER DEFAULT PRIVILEGES FOR ROLE staunlabor_owner IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO staunlabor_app;
