module MnoEnterprise
  class Jpi::V1::SubscriptionsController < Jpi::V1::BaseResourceController
    include MnoEnterprise::Concerns::Controllers::Jpi::V1::SubscriptionsController
    include MnoEnterprise::BlueSky::SubscriptionMapperHelper

    protected

    def subscription_cart_params
      # custom_data is an arbitrary hash
      # On Rails 5.1 use `permit(custom_data: {})`
      subscription_params.permit(:start_date, :max_licenses, :product_pricing_id, :product_contract_id, :custom_data, :currency).tap do |whitelisted|
        custom_data = params[:subscription][:custom_data]
        params[:subscription][:custom_data] = JSON.parse(custom_data) if custom_data.is_a? String
        whitelisted[:custom_data] = params[:subscription][:custom_data] if params[:subscription].has_key?(:custom_data) && params[:subscription][:custom_data].is_a?(Hash)
      end
    end

    def subscription_update_params
      subscription_params.permit(:product_contract_id, :product_id).tap do |whitelisted|
        whitelisted[:subscription_events_attributes] = params[:subscription][:subscription_events_attributes].tap do |events|
          events.each do |event|
            custom_data = event[:subscription_details][:custom_data]
            event[:subscription_details][:custom_data] = JSON.parse(custom_data) if custom_data.is_a? String
          end
        end
      end
    end
  end
end
