# frozen_string_literal: true
module MnoEnterprise
  # Monkey patch method refresh_json_schema! to disable the ability to enable finance

  # Frontend configuration management
  class TenantConfig
    # Update the JSON schema with values available after initialization
    def self.refresh_json_schema!(frontend_config)
      # Start Monkey Patch
      disable_finance = { admin_panel: { finance_readonly: true } }
      frontend_config.deep_merge!(disable_finance)
      # End Monkey Patch
      update_locales_list!
      update_application_list!
      flag_readonly_fields(json_schema, frontend_config)
    end
  end
end

