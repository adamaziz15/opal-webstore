# frozen_string_literal: true

unless ENV['FEATURE_RESTRICTIONS_DISABLED'] && ENV['PAYMENT_RESTRICTIONS_DISABLED']

  module MnoEnterprise
    # Monkey patch method refresh_json_schema! to disable the ability to enable finance

    # Frontend configuration management
    class TenantConfig
      # Update the JSON schema with values available after initialization
      def self.refresh_json_schema!(frontend_config)
        # Start Monkey Patch
        disable_features = { admin_panel: { finance_readonly: true, dashboard_templates: { enabled_readonly: true } },
                             dashboard: { organization_management: { billing_readonly: true }, impac_readonly: true,
                                          payment_readonly: true } }

        if ENV['FEATURE_RESTRICTIONS_DISABLED']
          disable_features.delete(:admin_panel)
          disable_features[:dashboard].delete(:impac_readonly)
          disable_features[:dashboard][:organization_management] = { billing: { enabled_readonly: true } }
        end

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
        override = {
          admin_panel: {
            finance: { enabled: false },
            dashboard_templates: { enabled: false }
          },
          dashboard: {
            organization_management: {
              billing: { enabled: false }
            },
            impac: { enabled: false },
            payment: { enabled: false }
          }
        }

        if ENV['FEATURE_RESTRICTIONS_DISABLED']
          override.delete(:admin_panel)
          override[:dashboard].delete(:impac)
        end

        unless ENV['PAYMENT_RESTRICTIONS_DISABLED']
          override[:dashboard][:organization_management][:billing][:enabled] = true
          override[:dashboard][:payment][:enabled] = true
        end

        frontend_config.deep_merge!(override)
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
end
