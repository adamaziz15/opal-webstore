#!./node_modules/bats/bin/bats

# Used for after all
TEST_COUNT=5

load 'container_helper'

function setup() {
  # Before all
  if [ "${BATS_TEST_NUMBER}" = "1" ]; then
    start_container
  fi
  # Before each
  container_ip=$(docker inspect --format '{{ .NetworkSettings.IPAddress }}' ${CONTAINER_NAME})
}

function teardown() {
  # After all
  if [ "${BATS_TEST_NUMBER}" = "${TEST_COUNT}" ]; then
    stop_container
  fi
}

# Fingerprinted assets have "far future expires" cache headers
function assert_cached_asset() {
  echo 'output:' "$output"

  # Success
  [[ $output =~ "200 OK" ]]

  # Far future expire headers
  [[ "$output" =~ "Expires" ]]
  [[ "$output" =~ "Cache-Control: max-age=31536000" ]]
  [[ "$output" =~ "Cache-Control: public" ]]
  [[ "$output" =~ "Last-Modified" ]]
  [[ "$output" =~ "ETag" ]]
}

# Non fingerprinted assets must be revalidated on each
# request and refetched if the content change
function assert_must_revalidate() {
  echo 'output:' "$output"
  [[ $output =~ "200 OK" ]]

  # Must revalidate with server
  [[ "$output" =~ "Cache-Control: max-age=0, must-revalidate" ]]
  [[ "$output" =~ "Last-Modified" ]]
  [[ "$output" =~ "ETag" ]]
}

@test "cache headers for the Theme Previewer style" {
  run curl -sI "http://${container_ip}/dashboard/styles/theme-previewer.less"
  assert_must_revalidate
}

@test "cache headers for index page" {
  run curl -sI "http://${container_ip}/dashboard/"
  assert_must_revalidate
}

@test "cache headers for fingerprinted dashboard assets" {
  asset=$(curl -s http://${container_ip}/dashboard/ | grep -oE "scripts/app-[0-9a-f]{10}.js")
  run curl -sI "http://${container_ip}/dashboard/${asset}"

  assert_cached_asset
}

@test "cache headers for non fingerprinted dashboard assets" {
  run curl -sI "http://${container_ip}/dashboard/images/main-logo.png"
  echo "/dashboard/images/main-logo.png"
  assert_must_revalidate

  run curl -sI "http://${container_ip}/dashboard/images/icons/connec-enabled-logo.png"
  echo "/dashboard/images/icons/connec-enabled-logo.png"
  assert_must_revalidate
}

@test "cache headers for fingerprinted rails assets" {
  asset=$(curl -s http://${container_ip}/mnoe/auth/users/sign_in | grep -oE "/assets/mno_enterprise/application-[0-9a-f]{64}.js")
  run curl -sI "http://${container_ip}/${asset}"

  assert_cached_asset
}
