#!/bin/sh
# Runs once, on the first start of an empty Postgres volume: creates the Evolution database.
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-SQL
  CREATE DATABASE evolution OWNER "$POSTGRES_USER";
SQL
