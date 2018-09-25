module MnoEnterprise
  class Jpi::V1::BlueSkyConfigController < Jpi::V1::BaseResourceController
    def bluesky_config
      config = {
        bluesky_host: ENV['BS_LOCALE_HOST']
      }

      render json: config
    end
  end
end
