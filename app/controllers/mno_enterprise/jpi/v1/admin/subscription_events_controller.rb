module MnoEnterprise
  class Jpi::V1::Admin::SubscriptionEventsController < Jpi::V1::Admin::BaseResourceController
    include MnoEnterprise::Concerns::Controllers::Jpi::V1::Admin::SubscriptionEventsController

    protected

    def subscription_event_params
      params.require(:subscription_event).permit(:event_type).tap do |whitelisted|
        whitelisted[:subscription_details] = params[:subscription_event][:subscription_details].tap do |details|
          details[:custom_data] = JSON.parse(details[:custom_data]) if details[:custom_data].is_a? String
        end
      end
    end
  end
end
