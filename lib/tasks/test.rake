# Don't crash in production
begin
  require 'bundler/audit/task'
  require 'rubocop/rake_task'
  require 'rspec/core/rake_task'

  Bundler::Audit::Task.new
  RuboCop::RakeTask.new
rescue LoadError
end

namespace :test do
  desc 'Run all tests'
  task all: :environment do
    Rake::Task['bundle:audit'].invoke
    Rake::Task['brakeman:run'].invoke
    Rake::Task['rubocop'].invoke
  end
end

task :test do
  Rake::Task['test:all'].invoke
end

# Running `rake` runs all the tests.
task default: :test
