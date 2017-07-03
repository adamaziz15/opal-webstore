require 'rails_helper'

RSpec.describe NimbusRemoteAuthenticatable::NimbusAuthenticatable do

  let(:user) { build(:user, email: 'test@maestrano.com', password: 'superpassword') }
  let(:auth_hash) {{ "user" => { "email" => user.email, "password" => user.password }}}

  let(:subject) { described_class.new(Rack::MockRequest.env_for('/mnoe/auth/users/sign_in', {params: auth_hash}), :user) }

  before {stub_api_v2(:get, '/users', user, [], {filter: {email: 'test@maestrano.com'}, page: {number: 1, size: 1}})}

  describe ".valid?" do
    context 'when user is authenticated against Nimbus' do

      let(:stubbed_response) { double(HTTParty::Response, code: 200) }
      before {allow(HTTParty).to receive(:get).and_return(stubbed_response)}

      it "validates the strategy" do
        expect(subject.valid?).to eq(true)
      end
    end
    context 'when user is not authenticated against Nimbus' do

      let(:stubbed_response) { double(HTTParty::Response, code: 401) }
      before {allow(HTTParty).to receive(:get).and_return(stubbed_response)}

      it "does not validate the strategy" do
        expect(subject.valid?).to eq(false)
      end
    end
  end

  describe ".authenticate!" do
    context 'when user is authenticated against Nimbus' do

      let(:stubbed_response) { double(HTTParty::Response, code: 200) }
      before {allow(HTTParty).to receive(:get).and_return(stubbed_response)}

      it "authenticate user" do
        expect(subject.authenticate!).to eq(:success)
      end
    end
    context 'when user is not authenticated against Nimbus' do

      let(:stubbed_response) { double(HTTParty::Response, code: 401) }
      before {allow(HTTParty).to receive(:get).and_return(stubbed_response)}
      before {allow_any_instance_of(MnoEnterprise::User).to receive(:lock_strategy_enabled?).and_return(false)}

      it "fails to authenticate user" do
        expect(subject.authenticate!).to eq(:failure)
      end
    end
  end
end
