source 'https://rubygems.org'

# Bundle edge Rails instead: gem 'rails', github: 'rails/rails'
gem 'rails', '~> 4.2.4'
# Use sqlite3 as the database for Active Record
gem 'sqlite3'
gem 'turbolinks'
gem 'jquery-rails'
gem 'puma'
gem 'uglifier', '>= 1.3.0'
gem 'tzinfo-data', platforms: [:mingw, :mswin, :x64_mingw, :jruby]

gem 'uuid'

# Maestrano Enterprise Engine
gem 'mno-enterprise', git: 'https://github.com/maestrano/mno-enterprise.git', branch: 'feature/249-fix-devise-failure-app'
# gem 'mno-enterprise', path: '../mno-enterprise'

# For Nimbus Authentication Strategy
gem 'httparty'

# Redis cache
gem 'redis-rails'

# Background jobs
gem 'sucker_punch', '~> 2.0'

gem 'monetize'
gem 'money'

gem 'webmock', '~> 3.0.1'

group :uat, :production do
  gem 'newrelic_rpm'
  gem 'nex_client', '~> 0.16.0'
end

group :development, :test do
  gem 'figaro'

  # Security audits
  gem 'brakeman', require: false
  gem 'bundler-audit', require: false

  # Style check
  gem 'rubocop', '~> 0.52.0', require: false
  gem 'rubocop-rspec', require: false
end

group :test do
  gem 'simplecov'
  gem 'rspec-rails'
  gem 'factory_girl_rails'
  gem 'shoulda-matchers'
  gem 'timecop'
end
