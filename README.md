# Opal Webstore

This is the base Express which is embedded in the docker image when a new webstore is provisioned.

[![](https://images.microbadger.com/badges/image/maestrano/opal-webstore.svg)](https://microbadger.com/images/maestrano/opal-webstore "Get your own image badge on microbadger.com")
[![](https://images.microbadger.com/badges/version/maestrano/opal-webstore.svg)](https://microbadger.com/images/maestrano/opal-webstore "Get your own version badge on microbadger.com")


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

## Update the dummy locale

For I18n testing, we use a "dummy" locale which contains randomly generated translations.
To update this locale, follow these instructions:

```ruby
# Generate the YAML locale file
$ bin/rails console
> g = MnoEnterprise::Frontend::LocalesGenerator.new('./')
> g.generate_dummy
--> Generated ./dummy.zh.yaml
$ mv ./dummy.zh.yaml config/locales/zh-ZH.yml

# Regenerate the frontend locales
$ bin/rake mnoe:locales:generate
$ git add -u config/locales/ public/dashboard/locales/
$ git commit -m "Refresh locales"
```
