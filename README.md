# Opal Webstore

This is the base Express which is embedded in the docker image when a new webstore is provisioned.

## Running the tests

```bash
yarn
test/*.bats
```

## Rebuid the docker image

First update the build locally:

```
# Update packages
bundle update mno-enterprise
bin/rake mnoe:frontend:update mnoe:admin:update

# Commit the packages
git add -u *.lock
git commit -m "Bump packages"

# Commit the build
git add public/dashboard public/admin
git commit -m "Rebuild frontend"
```

Merge this in the `feature/docker-img` branch

And follow the build at: https://cloud.docker.com/app/maestrano/repository/docker/maestrano/opal-webstore/builds

Once the build is finished, connect to the compute racks and:
```
sudo docker pull maestrano/opal-webstore
```
