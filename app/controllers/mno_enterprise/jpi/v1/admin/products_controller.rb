module MnoEnterprise
  class Jpi::V1::Admin::ProductsController < Jpi::V1::Admin::BaseResourceController
    include MnoEnterprise::Concerns::Controllers::Jpi::V1::Admin::ProductsController
    ATTRIBUTES = [:name, :active, :logo, :external_id, :free_trial_enabled, :free_trial_duration, :free_trial_unit, :single_billing_enabled, :billed_locally, :local]
  end
end
