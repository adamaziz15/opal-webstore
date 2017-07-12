#!/bin/bash
set -ex

# Go to app directory
cd /app

# Set default environment variables
export FOREMAN_OPTS=${FOREMAN_OPTS:-""}
export RACK_ENV=${RACK_ENV:-production}
export RAILS_ENV=${RAILS_ENV:-production}
export RAILS_LOG_TO_STDOUT=${RAILS_LOG_TO_STDOUT:-true}
export GIT_BRANCH=${GIT_BRANCH:-master}
export BUNDLE_JOBS=${BUNDLE_JOBS:-$(nproc)} # default to number of cores

# Set mno-enterprise environnment variables
export mailer_default_host=${DEFAULT_APP_HOST}
export mailer_default_protocol=${DEFAULT_APP_PROTOCOL}

# Configure bundler to use gemstash server if specified
if [ -n "$GEMSTASH_SERVER" ]; then
  bundle config mirror.https://rubygems.org $GEMSTASH_SERVER
  bundle config mirror.https://rubygems.org.fallback_timeout 3
fi

# Run deploy hook
if [ -f /app/.deploy-hook ]; then
  [ "$NO_HOOK" == "true" ] || bash /app/.deploy-hook
fi

# Sync assets from Minio
if [ -n "$MINIO_URL" ] && [ -n "$MINIO_BUCKET" ]; then
#  export AWS_ACCESS_KEY_ID=${MINIO_ACCESS_KEY}
#  export AWS_SECRET_ACCESS_KEY=${MINIO_SECRET_KEY}
#  aws --endpoint-url ${MINIO_URL} s3 sync s3://${MINIO_BUCKET}/public /app/public/
   bundle exec rails runner "MnoEnterprise::SystemManager.fetch_assets"
fi

# Run bundler
#if [ -f /app/Gemfile ]; then
#  # Install all required gems
#  # Number of bundle jobs is defined by BUNDLE_JOBS and defaults to the number
#  # of available cores
#  [ "$NO_BUNDLE" == "true" ] || bundle install --without development test
#fi

# Run rails specific tasks
if [ -f /app/config/application.rb ]; then
  # Load schema (you should unset this var afterwards)
  [ "$RAILS_LOAD_SCHEMA" == "true" ] && bundle exec rake db:schema:load

  # Migrate database
  [ "$NO_MIGRATE" == "true" ] || bundle exec rake db:migrate

  # Pre-compile assets
  [ "$NO_COMPILE" == "true" ] || bundle exec rake assets:precompile
fi

# Nginx configuration
if [ ! "$NO_NGINX" == "true" ] && [ -f /app/nginx.conf ]; then
  rm -f /etc/nginx/sites-enabled/*
  cp -p /app/nginx.conf /etc/nginx/sites-enabled/
fi

# Update ownership
chown -R www-data:www-data /app /var/log/app

# Run post-deploy hook
if [ -f /app/.post-deploy-hook ]; then
  [ "$NO_HOOK" == "true" ] || bash /app/.post-deploy-hook
fi

# Perform command - default is "foreman start" (see Dockerfile)
exec "$@"
