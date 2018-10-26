module MnoEnterprise
  module BlueSky::SubscriptionMapperHelper
    extend ActiveSupport::Concern
    include HTTParty

    def render(*args)
      map_remote_subscription_data
      super
    end

    private

    def map_remote_subscription_data
      return unless MnoEnterprise::Tenant.show.external_id.presence && (@subscription || @subscriptions)

      if @subscription
        return unless has_remote_data?(@subscription)

        # Fetch remote configuration
        config = get_configuration(@subscription)

        # Map data to subscription
        @subscription.custom_data = config['configuration']
        @subscription.available_actions = config['availableActions']
        @subscription.non_schema_actions = config['nonSchemaActions']
      elsif @subscriptions
        # Filter out subscriptions that don't have remote data
        remote_subs = @subscriptions.select { |s| has_remote_data?(s) }
        return if remote_subs.blank?

        # Fetch supported order types
        available_actions = get_order_types(remote_subs)

        # Map data to subscriptions
        @subscriptions.each do |s|
          config = available_actions.find { |actions| actions['hub_id'] == s.id }
          next unless config

          s.available_actions = config['availableActions']
          s.non_schema_actions = config['nonSchemaActions']
        end
      end
    end

    def get_order_types(subscriptions)
      query = {
        org_uids: subscriptions.map { |s| s.organization.uid }.uniq,
        external_id: MnoEnterprise::Tenant.show.external_id,
        subscription_ids: subscriptions.map(&:id)
      }

      HTTParty.get(available_actions_url, default_options.merge(query: query))
    end

    def get_configuration(subscription)
      query = {
        org_uids: [subscription.organization.uid],
        external_id: MnoEnterprise::Tenant.show.external_id
      }

      HTTParty.get(config_url(subscription.id), default_options.merge(query: query))
    end

    def default_options
      { headers: default_headers, basic_auth: auth }
    end

    def default_headers
      { 'Content-Type' => 'application/json' }
    end

    def auth
      { username: MnoEnterprise.tenant_id, password: MnoEnterprise.tenant_key }
    end

    def has_remote_data?(subscription)
      !%w[pending provisioning].include?(subscription.status) &&
        Settings.bluesky_products.to_a.include?(subscription.product.external_id)
    end

    def adapter_host
      [ENV['BLUESKY_ADAPTER_URL'], 'api/v1/subscriptions'].join('/')
    end

    def config_url(sub_id)
      [adapter_host, sub_id, 'configuration'].join('/')
    end

    def available_actions_url
      [adapter_host, 'available_actions'].join('/')
    end
  end
end
