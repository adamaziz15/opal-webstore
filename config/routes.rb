Rails.application.routes.draw do
  # This line mount Maestrano Enterprise routes in your application under /mnoe.
  # If you would like to change where this engine is mounted, simply change the :at option to something different
  #
  # We ask that you don't use the :as option here, as Mnoe relies on it being the default of "mno_enterprise"

  scope '(:locale)' do
    mount MnoEnterprise::Engine, at: '/mnoe', as: :mno_enterprise
  end

  scope '(:locale)' do
    namespace :mnoe, module: :mno_enterprise do
      namespace :jpi do
        namespace :v1 do
          get :schema_translations, to: 'blue_sky_translations#schema_translations'
        end
      end
    end
  end

  if Settings.dashboard.public_pages.enabled
    root to: redirect('dashboard/')
  else
    root to: redirect('mnoe/auth/users/sign_in')
  end
end
