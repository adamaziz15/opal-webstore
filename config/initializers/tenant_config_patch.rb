# frozen_string_literal: true

module MnoEnterprise
  # Monkey patch method refresh_json_schema! to disable the ability to enable finance

  # Frontend configuration management
  class TenantConfig
    # Update the JSON schema with values available after initialization
    def self.refresh_json_schema!(frontend_config)
      # Start Monkey Patch
      disable_features = { admin_panel: { apps_management_readonly: true, finance_readonly: true, dashboard_templates: { enabled_readonly: true } },
                           dashboard: { organization_management: { billing_readonly: true }, impac_readonly: true,
                                        payment_readonly: true } }

      frontend_config.deep_merge!(disable_features)
      # End Monkey Patch
      update_locales_list!
      update_application_list!
      flag_readonly_fields(json_schema, frontend_config)
    end

    # Monkey patch method load_config! to force disabled finance in case it was previously enabled

    # Load the Tenant#frontend_config from MnoHub and add it to the settings
    def self.load_config!
      return unless (frontend_config = fetch_tenant_config)

      # Start Monkey Patch
      frontend_config[:admin_panel][:finance][:enabled] = false
      frontend_config[:admin_panel][:apps_management][:enabled] = false
      frontend_config[:admin_panel][:dashboard_templates][:enabled] = false
      frontend_config[:dashboard][:organization_management][:billing][:enabled] = false
      frontend_config[:dashboard][:impac][:enabled] = false
      frontend_config[:dashboard][:payment][:enabled] = false
      # End Monkey Patch

      # Merge the settings and reload
      Settings.add_source!(frontend_config)
      Settings.reload!

      # Reconfigure mnoe
      reconfigure_mnoe!

      # Update JSON_SCHEMA with readonly flags (`<field>_readonly`)
      refresh_json_schema!(frontend_config)

      # # Save settings in YAML format for easy debugging
      # Rails.logger.debug "Settings loaded -> Saving..."
      # File.open(Rails.root.join('tmp', 'cache', 'settings.yml'), 'w') do |f|
      #   f.write(Settings.to_hash.deep_stringify_keys.to_yaml)
      # end

      clear_cache
    end
  end
end

