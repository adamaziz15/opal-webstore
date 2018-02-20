#!/bin/bash

# Helper methods to manage the container

IMAGE=maestrano/opal-webstore
CONTAINER_NAME=bats-test

# Wait for container to be ready
function wait_for_container(){
  try_count=0
  HEALTH_CHECK="starting"
  while [ "$HEALTH_CHECK" == "starting" ] || [ "$HEALTH_CHECK" == "unhealthy" ]
  do
    try_count=$(( try_count + 1 ))
    [ $try_count -gt 100 ] && exit 20
    sleep 5
    HEALTH_CHECK=$(docker inspect --format='{{.State.Health.Status}}' ${CONTAINER_NAME} 2>/dev/null)
  done
}

# Start the docker container and wait for it
function start_container() {
  docker run -P -d \
    --name ${CONTAINER_NAME} \
    --env-file ./docker/docker_env.list \
    --rm ${IMAGE}
  wait_for_container
}

# Stop and remove the container
function stop_container() {
  docker rm -f ${CONTAINER_NAME}
}
