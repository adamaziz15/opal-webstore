module MnoEnterprise
  class Jpi::V1::BlueSkyTranslationsController < Jpi::V1::AppReviewsController
    PRODUCT_URL = "https://awg-capability4.verecloud.com/language/:locale/productSchemas/product_schema_:locale.json".freeze
    ERROR_URL = "https://awg-capability4.verecloud.com/language/:locale/jsoneditor_messages_:locale.json".freeze

    def schema_translations
      set_locale
      product_data = fetch_data(PRODUCT_URL.dup)
      error_data = fetch_data(ERROR_URL.dup)

      if product_data.blank? && !default_locale
        product_data = fetch_data(PRODUCT_URL.dup, get_default_locale)
      end

      if error_data.blank? && !default_locale
        error_data = fetch_data(ERROR_URL.dup, get_default_locale)
      end

      return render json: { product_translations: product_data, error_translations: error_data }
    end

    def set_locale
      @locale ||= params[:locale]&.downcase || I18n.locale.to_s.downcase
    end

    def set_url_params(url, locale)
      url.gsub!(":locale", locale)
    end

    def default_locale
      @locale == get_default_locale
    end

    def fetch_data(url, locale = @locale)
      set_url_params(url, locale)

      resp = HTTParty.get(url)
      JSON.parse(resp.body).to_json rescue nil
    end

    def get_default_locale
      'en-us'
    end
  end
end
