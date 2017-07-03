MnoEnterprise.configure do |config|
  #===============================================
  # General Configuration
  #===============================================
  # Name of your company/application
  config.app_name = Settings.system.app_name

  # Fallback default country.
  # Used as default in geolocalised fields (e.g.: country, phone number)
  # config.app_country = 'US'

  # Fallback default currency.
  # config.app_currency = 'USD'

  #===============================================
  # Maestrano Enterprise Tenant Authentication
  #===============================================
  # Configure your tenant ID
  config.tenant_id = ENV['tenant_id']

  # Configure your tenant Key
  config.tenant_key = ENV['tenant_key']

  #===============================================
  # Emailing
  #===============================================
  # Adapter used to send emails
  config.mail_adapter = :smtp

  # Support email address
  config.support_email = Settings.system.email.support_email

  # Default sender for system generated emails
  config.default_sender_name = Settings.system.email.default_sender.name || Settings.system.email.app_name
  config.default_sender_email = Settings.system.email.default_sender.email

  #===============================================
  # External Routes
  #===============================================
  # Dashboard path
  # config.router.dashboard_path = '/dashboard/'

  # URL of the Terms and Conditions page.
  # Used on Devise Registration pages
  # config.router.terms_url = 'http://mywebsite.com/terms'

  # After sign out URL. Default to the root_path
  # config.router.after_sign_out_url = 'http://mywebsite.com/'

  #===============================================
  # Optional Modules
  #===============================================
  # Angular CSRF protection - Only needed if the AngularJS App
  # is not served through Rails asset pipeline
  config.include_angular_csrf = true

  # I18n - Controls:
  #   - Routing in development
  #   - Filter and locale management in controllers
  config.i18n_enabled = Settings.system.i18n.enabled

  #===============================================
  # Third Party Plugins
  #===============================================
  # Google Tag Manager
  # config.google_tag_container = nil

  # intercom
  config.intercom_app_id = ENV['INTERCOM_APP_ID']
  config.intercom_api_secret = ENV['INTERCOM_API_SECRET']
  config.intercom_token = ENV['INTERCOM_TOKEN']

  #===============================================
  # API Configuration
  #===============================================
  # ==> Maestrano Enterprise API Configuration
  # Configure the API host
  # config.mno_api_host = "https://api-enterprise.maestrano.com"
  config.mno_api_host = ENV['MNO_API_HOST'] || "#{Settings.mno.protocol}://#{Settings.mno.host}"

  # Configure the API root path
  # config.mno_api_root_path = "/v1"
  config.mno_api_root_path = Settings.mno.paths.root
end
