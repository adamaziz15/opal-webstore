module MnoEnterprise
  class Jpi::V1::QuotesController < Jpi::V1::BaseResourceController
    include MnoEnterprise::Concerns::Controllers::Jpi::V1::QuotesController
    #==================================================================
    # Instance methods
    #==================================================================
    # POST /mnoe/jpi/v1/organizations/:id/quote
    # Sends post request to MnoHub
    def create
      @quote = MnoEnterprise::ProductQuote.fetch_quote!(quote_params)
      if @quote.errors.empty?
        render :show
      else
        render json: @quote.errors, status: :bad_request
      end
    end

    protected

    def quote_params
      params.tap do |whitelisted|
        if params[:quote][:custom_data].is_a? String
          whitelisted[:quote][:custom_data] = JSON.parse(params[:quote][:custom_data])
          whitelisted[:quote][:custom_data][:edit_action] = params.delete(:edit_action)
          whitelisted[:quote][:custom_data][:subscription_id] = params.delete(:subscription_id)
        end
      end
    end
  end
end
