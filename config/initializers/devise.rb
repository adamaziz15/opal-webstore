require 'nimbus_remote_authenticatable'

Devise.setup do |config|
  config.warden do |manager|
    manager.default_strategies(scope: :user).unshift :nimbus_remote_authenticatable
  end
end
