module MnoEnterprise
  class Jpi::V1::Admin::QuotesController < Jpi::V1::Admin::BaseResourceController
    include MnoEnterprise::Concerns::Controllers::Jpi::V1::QuotesController
    #==================================================================
    # Instance methods
    #==================================================================
    # POST /mnoe/jpi/v1/organizations/:id/quote
    # Sends post request to MnoHub
    def create
      @quote =  MnoEnterprise::ProductQuote.fetch_quote!(quote_params)
      if @quote.errors.empty?
        render :show
      else
        render json: @quote.errors, status: :bad_request
      end
    end

    protected

    def quote_params
      params.tap do |whitelisted|
        whitelisted[:quote][:custom_data] = JSON.parse(params[:quote][:custom_data]) if params[:quote][:custom_data].is_a? String
      end
    end
  end
end
