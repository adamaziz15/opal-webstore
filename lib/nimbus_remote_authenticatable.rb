module NimbusRemoteAuthenticatable
  class NimbusAuthenticatable < Devise::Strategies::Authenticatable
    include HTTParty

    # Timeout in seconds
    default_timeout 30

    # user is valid for this strategy if he can be successfully authenticated
    # otherwise the regular remote authenticable method is used
    def valid?

      auth_params = params[scope]
      return false if !auth_params

      (nimbus_auth(auth_params)&.code == 200) ? true : false
    end

    def authenticate!
      # authentication_hash doesn't include the password
      auth_params = params[scope]

      # mapping.to is a wrapper over the resource model
      resource = mapping.to.new

      return fail! if !resource || !auth_params

      @response = nimbus_auth(auth_params)
      user = MnoEnterprise::User.where(email: auth_params['email']).first

      if validate(user){nimbus_auth(auth_params)&.code == 200}
        success!(user)
      else
        fail!
      end
    end

    private

    def nimbus_auth(auth_params)
      @response ||= self.class.post(
        ENV.fetch('REMOTE_AUTH_URL'),
        body: {username: auth_params['email'], password: auth_params['password']}.to_json,
      )
    rescue
      fail!
      nil
    end
  end
end

Warden::Strategies.add :nimbus_remote_authenticatable, NimbusRemoteAuthenticatable::NimbusAuthenticatable
Devise.add_module :nimbus_remote_authenticatable, strategy: true
